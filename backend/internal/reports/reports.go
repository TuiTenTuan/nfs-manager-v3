package reports

import (
	"context"
	"net/http"
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
	AvgOps            float64 `json:"avg_ops_per_sec"`
	MaxConnections    int     `json:"max_active_connections"`
	SampleCount       int     `json:"sample_count"`
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
		COALESCE(AVG(ops_per_sec),0),
		COALESCE(MAX(active_connections),0),
		COUNT(*)
		FROM metrics_samples WHERE recorded_at >= $1`
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
		if err := rows.Scan(&p.ShareID, &p.AvgRead, &p.AvgWrite, &p.AvgOps, &p.MaxConnections, &p.SampleCount); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	if len(points) == 0 {
		points = []ReportPoint{{Period: period, SampleCount: 0}}
	}
	return points, rows.Err()
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("", s.handleGet)
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
