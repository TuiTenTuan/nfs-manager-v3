package reports

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

type ReportPoint struct {
	Period            string  `json:"period"`
	ShareID           *int    `json:"share_id,omitempty"`
	AvgRead           float64 `json:"avg_bytes_read_per_sec"`
	AvgWrite          float64 `json:"avg_bytes_write_per_sec"`
	TotalBytesRead    int64   `json:"total_bytes_read"`
	TotalBytesWrite   int64   `json:"total_bytes_write"`
	AvgOps            float64 `json:"avg_ops_per_sec"`
	MaxConnections    int     `json:"max_active_connections"`
	SampleCount       int     `json:"sample_count"`
}

type TimeseriesPoint struct {
	RecordedAt       time.Time `json:"recorded_at"`
	AvgRead          float64   `json:"avg_bytes_read_per_sec"`
	AvgWrite         float64   `json:"avg_bytes_write_per_sec"`
	BytesReadVolume  int64     `json:"bytes_read_volume"`
	BytesWriteVolume int64     `json:"bytes_write_volume"`
	SampleCount      int       `json:"sample_count"`
}

func bucketInterval(period string) string {
	switch period {
	case "week":
		return "1 hour"
	case "month":
		return "1 day"
	case "year":
		return "1 week"
	default:
		return "15 minutes"
	}
}

func periodStart(period string) time.Time {
	now := time.Now()
	switch period {
	case "week":
		return now.AddDate(0, 0, -7)
	case "month":
		return now.AddDate(0, -1, 0)
	case "year":
		return now.AddDate(-1, 0, 0)
	default:
		return now.AddDate(0, 0, -1)
	}
}

func (s *Service) Get(ctx context.Context, period string, shareID *int) ([]ReportPoint, error) {
	since := periodStart(period)
	q := `SELECT share_id,
		COALESCE(AVG(bytes_read_per_sec),0),
		COALESCE(AVG(bytes_write_per_sec),0),
		CASE
			WHEN MAX(bytes_read_total) > MIN(bytes_read_total)
				THEN MAX(bytes_read_total) - MIN(bytes_read_total)
			ELSE COALESCE(SUM(bytes_read_per_sec) * 1.5, 0)::bigint
		END,
		CASE
			WHEN MAX(bytes_write_total) > MIN(bytes_write_total)
				THEN MAX(bytes_write_total) - MIN(bytes_write_total)
			ELSE COALESCE(SUM(bytes_write_per_sec) * 1.5, 0)::bigint
		END,
		COALESCE(AVG(ops_per_sec),0),
		COALESCE(MAX(active_connections),0),
		COUNT(*)
		FROM metrics WHERE recorded_at >= $1`
	args := []any{since}
	if shareID != nil {
		q += ` AND share_id = $2`
		args = append(args, *shareID)
	}
	q += ` GROUP BY share_id ORDER BY share_id NULLS FIRST`

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var points []ReportPoint
	for rows.Next() {
		var p ReportPoint
		p.Period = period
		if err := rows.Scan(&p.ShareID, &p.AvgRead, &p.AvgWrite, &p.TotalBytesRead, &p.TotalBytesWrite, &p.AvgOps, &p.MaxConnections, &p.SampleCount); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	if len(points) == 0 {
		points = []ReportPoint{{Period: period, SampleCount: 0}}
	}
	return points, rows.Err()
}

func (s *Service) GetTimeseries(ctx context.Context, period string, shareID *int) ([]TimeseriesPoint, error) {
	since := periodStart(period)
	bucket := bucketInterval(period)
	q := `SELECT time_bucket($1::interval, recorded_at) AS bucket,
		COALESCE(AVG(bytes_read_per_sec), 0),
		COALESCE(AVG(bytes_write_per_sec), 0),
		CASE
			WHEN MAX(bytes_read_total) > MIN(bytes_read_total)
				THEN MAX(bytes_read_total) - MIN(bytes_read_total)
			ELSE COALESCE(SUM(bytes_read_per_sec) * 1.5, 0)::bigint
		END,
		CASE
			WHEN MAX(bytes_write_total) > MIN(bytes_write_total)
				THEN MAX(bytes_write_total) - MIN(bytes_write_total)
			ELSE COALESCE(SUM(bytes_write_per_sec) * 1.5, 0)::bigint
		END,
		COUNT(*)::int
		FROM metrics
		WHERE recorded_at >= $2`
	args := []any{bucket, since}
	if shareID != nil {
		q += ` AND share_id = $3`
		args = append(args, *shareID)
	} else {
		q += ` AND share_id IS NULL`
	}
	q += ` GROUP BY bucket ORDER BY bucket ASC`

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []TimeseriesPoint
	for rows.Next() {
		var p TimeseriesPoint
		if err := rows.Scan(&p.RecordedAt, &p.AvgRead, &p.AvgWrite, &p.BytesReadVolume, &p.BytesWriteVolume, &p.SampleCount); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	return points, rows.Err()
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("/timeseries", s.handleTimeseries)
	r.GET("", s.handleGet)
}

func (s *Service) handleTimeseries(c *gin.Context) {
	period := c.DefaultQuery("period", "day")
	if period != "day" && period != "week" && period != "month" && period != "year" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid period"})
		return
	}
	var shareID *int
	if raw := c.Query("share_id"); raw != "" {
		id, err := strconv.Atoi(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid share_id"})
			return
		}
		shareID = &id
	}
	points, err := s.GetTimeseries(c.Request.Context(), period, shareID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if points == nil {
		points = []TimeseriesPoint{}
	}
	c.JSON(http.StatusOK, gin.H{"period": period, "points": points, "provider": "db"})
}

func (s *Service) handleGet(c *gin.Context) {
	period := c.DefaultQuery("period", "day")
	if period != "day" && period != "week" && period != "month" && period != "year" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid period"})
		return
	}
	points, err := s.Get(c.Request.Context(), period, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"period": period, "points": points, "provider": "db"})
}
