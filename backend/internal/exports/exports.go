package exports

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/audit"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/middleware"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/nfs"
)

type ShareLinesProvider interface {
	EnabledExportLines(ctx context.Context) ([]string, error)
}

type Service struct {
	pool     *pgxpool.Pool
	audit    *audit.Service
	provider nfs.Provider
	shares   ShareLinesProvider
}

func New(pool *pgxpool.Pool, au *audit.Service, p nfs.Provider) *Service {
	return &Service{pool: pool, audit: au, provider: p}
}

func (s *Service) SetSharesProvider(sp ShareLinesProvider) {
	s.shares = sp
}

func (s *Service) GetRaw(c *gin.Context) {
	content, err := s.provider.GetManagedExports()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"content": content, "provider": s.provider.Name()})
}

func (s *Service) PutRaw(c *gin.Context) {
	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := s.provider.SetManagedExports(req.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	uid := middleware.GetUserID(c)
	_ = s.audit.Log(c.Request.Context(), "exports.raw_edit", "exports", nil, &uid, middleware.GetUsername(c), nil)
	_, _ = s.pool.Exec(c.Request.Context(),
		`INSERT INTO managed_exports_snapshot (content, created_by) VALUES ($1, $2)`,
		req.Content, uid)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Service) Validate(c *gin.Context) {
	var req struct {
		Content string `json:"content"`
	}
	_ = c.ShouldBindJSON(&req)
	content := req.Content
	if content == "" {
		var err error
		content, err = s.provider.GetManagedExports()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	errs := s.provider.ValidateText(content)
	c.JSON(http.StatusOK, gin.H{"valid": len(errs) == 0, "errors": errs})
}

func (s *Service) Apply(c *gin.Context) {
	content, err := s.provider.GetManagedExports()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	errs := s.provider.ValidateText(content)
	if len(errs) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"valid": false, "errors": errs})
		return
	}
	if err := s.applyContent(c.Request.Context(), content, middleware.GetUserID(c), middleware.GetUsername(c), "exports.apply", nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Service) SyncOS(c *gin.Context) {
	content, err := s.provider.SyncFromOS()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	uid := middleware.GetUserID(c)
	_ = s.audit.Log(c.Request.Context(), "exports.sync_os", "exports", nil, &uid, middleware.GetUsername(c), nil)
	c.JSON(http.StatusOK, gin.H{"content": content})
}

func (s *Service) RebuildAndApply(ctx context.Context, userID int, username, action string, entityID *int) error {
	lines, err := s.shares.EnabledExportLines(ctx)
	if err != nil {
		return err
	}
	for i, line := range lines {
		errs := s.provider.ValidateText(line)
		if len(errs) > 0 {
			return &ValidationFailed{Errors: errs, Line: i + 1}
		}
	}
	content := nfs.BuildManagedFile(lines)
	errs := s.provider.ValidateText(content)
	if len(errs) > 0 {
		return &ValidationFailed{Errors: errs}
	}
	return s.applyContent(ctx, content, userID, username, action, entityID)
}

type ValidationFailed struct {
	Errors []nfs.ValidationError
	Line   int
}

func (v *ValidationFailed) Error() string { return "validation failed" }

func (s *Service) applyContent(ctx context.Context, content string, userID int, username, action string, entityID *int) error {
	if err := s.provider.Apply(content); err != nil {
		return err
	}
	if err := s.provider.Reload(); err != nil {
		return err
	}
	_ = s.audit.Log(ctx, action, "exports", entityID, &userID, username, gin.H{"provider": s.provider.Name()})
	_, _ = s.pool.Exec(ctx,
		`INSERT INTO managed_exports_snapshot (content, created_by) VALUES ($1, $2)`,
		content, userID)
	return nil
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("/raw", s.GetRaw)
	r.PUT("/raw", middleware.RequireAdmin(), s.PutRaw)
	r.POST("/validate", middleware.RequireAdmin(), s.Validate)
	r.POST("/apply", middleware.RequireAdmin(), s.Apply)
	r.POST("/sync-os", middleware.RequireAdmin(), s.SyncOS)
}

func ExtractManagedSection(content string) string {
	const begin = "# BEGIN NFS-MANAGER"
	const end = "# END NFS-MANAGER"
	if !strings.Contains(content, begin) {
		return content
	}
	start := strings.Index(content, begin)
	endIdx := strings.Index(content, end)
	if endIdx < 0 {
		return content[start:]
	}
	return content[start : endIdx+len(end)]
}
