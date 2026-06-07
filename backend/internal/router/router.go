package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/audit"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/auth"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/config"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/exports"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/groups"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/middleware"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/monitor"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/nfs"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/reports"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/shares"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/templates"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/users"
)

type Services struct {
	Config    *config.Config
	Pool      *pgxpool.Pool
	Provider  nfs.Provider
	Auth      *auth.Service
	Users     *users.Service
	Groups    *groups.Service
	Shares    *shares.Service
	Exports   *exports.Service
	Templates *templates.Service
	Monitor   *monitor.Service
	Reports   *reports.Service
	Audit     *audit.Service
}

func Setup(svc *Services) *gin.Engine {
	if svc.Config.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.Default()
	r.Use(corsMiddleware(svc.Config.CORSOrigin))

	v3 := r.Group("/api/v3")
	{
		v3.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":     "ok",
				"provider":   svc.Provider.Name(),
				"nfs_server": svc.Config.NFSServerHost,
			})
		})

		v3.POST("/auth/login", svc.Auth.Login)
		v3.POST("/auth/refresh", svc.Auth.Refresh)

		protected := v3.Group("")
		protected.Use(svc.Auth.Middleware(), middleware.RequireViewerOrAdmin())
		{
			protected.GET("/audit", handleAuditList(svc.Audit))

			ro := protected.Group("")
			svc.Users.RegisterRoutes(ro.Group("/users"))
			svc.Groups.RegisterRoutes(ro.Group("/groups"))
			svc.Shares.RegisterRoutes(ro.Group("/shares"))
			svc.Templates.RegisterRoutes(ro.Group("/templates"))
			svc.Exports.RegisterRoutes(ro.Group("/exports"))
			svc.Monitor.RegisterRoutes(ro.Group("/monitor"))
			svc.Reports.RegisterRoutes(ro.Group("/reports"))
		}
	}
	return r
}

func corsMiddleware(origin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type")
		c.Header("Access-Control-Allow-Credentials", "true")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func handleAuditList(auditSvc *audit.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		list, err := auditSvc.List(c.Request.Context(), 200)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, list)
	}
}
