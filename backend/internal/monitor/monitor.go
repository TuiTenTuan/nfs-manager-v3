package monitor

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/nfs"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/shares"
)

type Service struct {
	pool     *pgxpool.Pool
	provider nfs.Provider
	shares   *shares.Service
}

func New(pool *pgxpool.Pool, p nfs.Provider, sh *shares.Service) *Service {
	return &Service{pool: pool, provider: p, shares: sh}
}

func (s *Service) StoreSample(ctx context.Context, m nfs.Metrics) error {
	clients, _ := json.Marshal(m.Clients)
	_, err := s.pool.Exec(ctx,
		`INSERT INTO metrics_samples (share_id, bytes_read_per_sec, bytes_write_per_sec, ops_per_sec, active_connections, clients, provider)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		m.ShareID, m.BytesReadPerSec, m.BytesWritePerSec, m.OpsPerSec, m.ActiveConnections, clients, m.Provider)
	return err
}

func (s *Service) Global(c *gin.Context) {
	m := s.provider.CollectGlobalMetrics()
	_ = s.StoreSample(c.Request.Context(), m)
	c.JSON(http.StatusOK, m)
}

func (s *Service) Share(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	sh, _ := s.shares.Get(c.Request.Context(), id)
	path := ""
	if sh != nil {
		path = sh.Path
	}
	m := s.provider.CollectShareMetrics(id, path)
	sid := id
	m.ShareID = &sid
	_ = s.StoreSample(c.Request.Context(), m)
	c.JSON(http.StatusOK, m)
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("", s.Global)
	r.GET("/shares/:id", s.Share)
}

func PruneOldSamples(ctx context.Context, pool *pgxpool.Pool, retainDays int) {
	if retainDays <= 0 {
		retainDays = 30
	}
	cutoff := time.Now().AddDate(0, 0, -retainDays)
	_, _ = pool.Exec(ctx, `DELETE FROM metrics_samples WHERE recorded_at < $1`, cutoff)
}
