package monitor

import (
	"context"
	"encoding/json"
	"log"
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
	cache    *liveCache
}

func New(pool *pgxpool.Pool, p nfs.Provider, sh *shares.Service) *Service {
	return &Service{pool: pool, provider: p, shares: sh, cache: newLiveCache()}
}

func (s *Service) StoreSample(ctx context.Context, m nfs.Metrics) error {
	clients, _ := json.Marshal(m.Clients)
	_, err := s.pool.Exec(ctx,
		`INSERT INTO metrics (share_id, bytes_read_per_sec, bytes_write_per_sec, ops_per_sec, active_connections, clients, provider)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		m.ShareID, m.BytesReadPerSec, m.BytesWritePerSec, m.OpsPerSec, m.ActiveConnections, clients, m.Provider)
	return err
}

func (s *Service) Global(c *gin.Context) {
	if m, ok := s.cache.getGlobal(); ok {
		c.JSON(http.StatusOK, m)
		return
	}
	c.JSON(http.StatusOK, s.provider.CollectGlobalMetrics())
}

func (s *Service) Share(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if m, ok := s.cache.getShare(id); ok {
		c.JSON(http.StatusOK, m)
		return
	}
	sh, _ := s.shares.Get(c.Request.Context(), id)
	path := ""
	if sh != nil {
		path = sh.Path
	}
	m := s.provider.CollectShareMetrics(id, path)
	sid := id
	m.ShareID = &sid
	c.JSON(http.StatusOK, m)
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("", s.Global)
	r.GET("/shares/:id", s.Share)
}

func PruneOldMetrics(ctx context.Context, pool *pgxpool.Pool, retainDays int) (int64, error) {
	if retainDays <= 0 {
		retainDays = 30
	}
	cutoff := time.Now().AddDate(0, 0, -retainDays)
	tag, err := pool.Exec(ctx, `DELETE FROM metrics WHERE recorded_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func RunPruneLoop(ctx context.Context, pool *pgxpool.Pool, retainDays int) {
	if n, err := PruneOldMetrics(ctx, pool, retainDays); err != nil {
		log.Printf("metrics prune: %v", err)
	} else {
		log.Printf("metrics prune: removed %d rows (retention %d days)", n, retainDays)
	}

	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if n, err := PruneOldMetrics(ctx, pool, retainDays); err != nil {
				log.Printf("metrics prune: %v", err)
			} else {
				log.Printf("metrics prune: removed %d rows (retention %d days)", n, retainDays)
			}
		}
	}
}
