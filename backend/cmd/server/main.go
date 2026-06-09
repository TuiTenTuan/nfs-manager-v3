package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/audit"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/auth"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/config"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/configuration"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/db"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/filesystem"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/exports"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/groups"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/monitor"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/nfs"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/reports"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/router"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/shares"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/templates"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/users"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()
	if err := db.MigrateUp(cfg.Database); err != nil {
		log.Fatal("migrate:", err)
	}
	log.Println("database migrations applied")

	pool, err := db.NewPool(ctx, cfg.Database)
	if err != nil {
		log.Fatal("db:", err)
	}
	defer pool.Close()

	provider := nfs.NewProvider(cfg.NFSProvider, cfg.NFSRootAllowlist, cfg.ManagedExportsPath)
	auditSvc := audit.New(pool)
	userSvc := users.New(pool, auditSvc)
	if err := userSvc.SeedFirstAdmin(ctx); err != nil {
		log.Fatal("seed admin:", err)
	}

	tmplSvc := templates.New(pool)
	if err := tmplSvc.SeedDefaults(ctx); err != nil {
		log.Printf("seed templates: %v", err)
	}

	authSvc := auth.New(cfg, pool, userSvc, auditSvc)
	exportSvc := exports.New(pool, auditSvc, provider)
	shareSvc := shares.New(pool, auditSvc, provider, exportSvc, cfg.NFSRootAllowlist)
	exportSvc.SetSharesProvider(shareSvc)

	if result, err := shareSvc.SyncFromOS(ctx, shares.StartupAdditive); err != nil {
		log.Printf("WARN startup sync OS→DB: %v", err)
	} else {
		log.Printf("startup sync OS→DB: added=%d skipped=%d unchanged=%d", result.Added, result.Skipped, result.Unchanged)
		sysUID := 0
		_ = auditSvc.Log(ctx, "shares.sync_startup_os", "shares", nil, &sysUID, "system", result)
	}
	if err := shareSvc.SyncToOSOnStartup(ctx); err != nil {
		log.Printf("WARN startup sync DB→OS: %v", err)
	}
	groupSvc := groups.New(pool, auditSvc, shareSvc)
	monSvc := monitor.New(pool, provider, shareSvc)
	reportSvc := reports.New(pool)
	fsSvc := filesystem.New(cfg.NFSRootAllowlist)
	configSvc := configuration.New(pool, auditSvc, groupSvc, shareSvc, tmplSvc, exportSvc)

	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		for range ticker.C {
			monitor.PruneOldSamples(ctx, pool, 30)
		}
	}()

	r := router.Setup(&router.Services{
		Config: cfg, Pool: pool, Provider: provider,
		Auth: authSvc, Users: userSvc, Groups: groupSvc,
		Shares: shareSvc, Exports: exportSvc, Templates: tmplSvc,
		Monitor: monSvc, Reports: reportSvc, Audit: auditSvc,
		Filesystem: fsSvc, Configuration: configSvc,
	})

	addr := ":" + cfg.HTTPPort
	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		log.Printf("nfs-manager API listening on %s (provider=%s)", addr, provider.Name())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
