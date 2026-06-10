package monitor

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/nfs"
)

type liveCache struct {
	mu        sync.RWMutex
	global    nfs.Metrics
	globalOK  bool
	byShare   map[int]nfs.Metrics
}

func newLiveCache() *liveCache {
	return &liveCache{byShare: make(map[int]nfs.Metrics)}
}

func (c *liveCache) setGlobal(m nfs.Metrics) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.global = m
	c.globalOK = true
}

func (c *liveCache) getGlobal() (nfs.Metrics, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.global, c.globalOK
}

func (c *liveCache) setShare(id int, m nfs.Metrics) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.byShare[id] = m
}

func (c *liveCache) getShare(id int) (nfs.Metrics, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	m, ok := c.byShare[id]
	return m, ok
}

type Collector struct {
	svc      *Service
	interval time.Duration
}

func NewCollector(svc *Service, interval time.Duration) *Collector {
	return &Collector{svc: svc, interval: interval}
}

func (col *Collector) Run(ctx context.Context) {
	ticker := time.NewTicker(col.interval)
	defer ticker.Stop()

	col.tick(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			col.tick(ctx)
		}
	}
}

func (col *Collector) tick(ctx context.Context) {
	m := col.svc.provider.CollectGlobalMetrics()
	if err := col.svc.StoreSample(ctx, m); err != nil {
		log.Printf("metrics collector: global: %v", err)
	} else {
		col.svc.cache.setGlobal(m)
	}

	list, err := col.svc.shares.List(ctx)
	if err != nil {
		log.Printf("metrics collector: list shares: %v", err)
		return
	}
	for _, sh := range list {
		if !sh.Enabled {
			continue
		}
		sm := col.svc.provider.CollectShareMetrics(sh.ID, sh.Path)
		sid := sh.ID
		sm.ShareID = &sid
		if err := col.svc.StoreSample(ctx, sm); err != nil {
			log.Printf("metrics collector: share %d: %v", sh.ID, err)
			continue
		}
		col.svc.cache.setShare(sh.ID, sm)
	}
}
