package shares

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/audit"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/middleware"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/exports"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/nfs"
)

type Share struct {
	ID           int             `json:"id"`
	Name         string          `json:"name"`
	Path         string          `json:"path"`
	GroupID      *int            `json:"group_id"`
	ConfigMode   string          `json:"config_mode"`
	BasicJSON    json.RawMessage `json:"basic_json"`
	AdvancedJSON json.RawMessage `json:"advanced_json"`
	RawExport    *string         `json:"raw_export"`
	Enabled      bool            `json:"enabled"`
	Version      int             `json:"version"`
	CreatedAt    string          `json:"created_at"`
	UpdatedAt    string          `json:"updated_at"`
	PreviewLine  string          `json:"preview_line,omitempty"`
}

type Service struct {
	pool      *pgxpool.Pool
	audit     *audit.Service
	provider  nfs.Provider
	exports   *exports.Service
	allowlist []string
}

func New(pool *pgxpool.Pool, au *audit.Service, p nfs.Provider, ex *exports.Service, allowlist []string) *Service {
	return &Service{pool: pool, audit: au, provider: p, exports: ex, allowlist: allowlist}
}

func (s *Service) List(ctx context.Context) ([]Share, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, path, group_id, config_mode, basic_json, advanced_json, raw_export,
		        enabled, version, created_at::text, updated_at::text
		 FROM nfs_shares ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Share
	for rows.Next() {
		var sh Share
		var raw *string
		if err := rows.Scan(&sh.ID, &sh.Name, &sh.Path, &sh.GroupID, &sh.ConfigMode,
			&sh.BasicJSON, &sh.AdvancedJSON, &raw, &sh.Enabled, &sh.Version, &sh.CreatedAt, &sh.UpdatedAt); err != nil {
			return nil, err
		}
		sh.RawExport = raw
		sh.PreviewLine = s.previewLine(sh)
		list = append(list, sh)
	}
	return list, rows.Err()
}

func (s *Service) Get(ctx context.Context, id int) (*Share, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, name, path, group_id, config_mode, basic_json, advanced_json, raw_export,
		        enabled, version, created_at::text, updated_at::text
		 FROM nfs_shares WHERE id = $1`, id)
	var sh Share
	var raw *string
	err := row.Scan(&sh.ID, &sh.Name, &sh.Path, &sh.GroupID, &sh.ConfigMode,
		&sh.BasicJSON, &sh.AdvancedJSON, &raw, &sh.Enabled, &sh.Version, &sh.CreatedAt, &sh.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	sh.RawExport = raw
	sh.PreviewLine = s.previewLine(sh)
	return &sh, err
}

func (s *Service) previewLine(sh Share) string {
	if sh.ConfigMode == "raw" && sh.RawExport != nil {
		return strings.TrimSpace(*sh.RawExport)
	}
	basic, adv := parseFormJSON(sh.BasicJSON, sh.AdvancedJSON)
	path := basic.Path
	if path == "" {
		path = sh.Path
	}
	return nfs.RenderFormLine(path, basic, adv)
}

func parseFormJSON(basicRaw, advRaw json.RawMessage) (nfs.ShareForm, nfs.ShareAdvanced) {
	var basic nfs.ShareForm
	var adv nfs.ShareAdvanced
	_ = json.Unmarshal(basicRaw, &basic)
	_ = json.Unmarshal(advRaw, &adv)
	return basic, adv
}

func (s *Service) Create(ctx context.Context, sh Share) (*Share, error) {
	var id int
	err := s.pool.QueryRow(ctx,
		`INSERT INTO nfs_shares (name, path, group_id, config_mode, basic_json, advanced_json, raw_export, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		sh.Name, sh.Path, sh.GroupID, sh.ConfigMode, sh.BasicJSON, sh.AdvancedJSON, sh.RawExport, sh.Enabled).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id int, sh Share) (*Share, error) {
	_, err := s.pool.Exec(ctx,
		`UPDATE nfs_shares SET name=$1, path=$2, group_id=$3, config_mode=$4, basic_json=$5,
		 advanced_json=$6, raw_export=$7, enabled=$8, version=version+1, updated_at=NOW() WHERE id=$9`,
		sh.Name, sh.Path, sh.GroupID, sh.ConfigMode, sh.BasicJSON, sh.AdvancedJSON, sh.RawExport, sh.Enabled, id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM nfs_shares WHERE id = $1`, id)
	return err
}

func (s *Service) ExportLineForShare(sh Share) string {
	if sh.ConfigMode == "raw" && sh.RawExport != nil && strings.TrimSpace(*sh.RawExport) != "" {
		return strings.TrimSpace(*sh.RawExport)
	}
	basic, adv := parseFormJSON(sh.BasicJSON, sh.AdvancedJSON)
	path := sh.Path
	if basic.Path != "" {
		path = basic.Path
	}
	return nfs.RenderFormLine(path, basic, adv)
}

func (s *Service) ValidateSharePayload(sh Share) []nfs.ValidationError {
	line := s.ExportLineForShare(sh)
	return s.provider.ValidateText(line)
}

func (s *Service) ValidateShare(ctx context.Context, id int) ([]nfs.ValidationError, error) {
	sh, _ := s.Get(ctx, id)
	if sh == nil {
		return nil, errors.New("not found")
	}
	return s.ValidateSharePayload(*sh), nil
}

func (s *Service) PreviewSharePayload(sh Share) string {
	return s.ExportLineForShare(sh)
}

func (s *Service) ApplyShare(ctx context.Context, id int, userID int, username string) error {
	errs, _ := s.ValidateShare(ctx, id)
	if len(errs) > 0 {
		return &ValidateError{Errors: errs}
	}
	return s.exports.RebuildAndApply(ctx, userID, username, "share.apply", &id)
}

type ValidateError struct {
	Errors []nfs.ValidationError
}

func (e *ValidateError) Error() string { return "validation failed" }

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("", s.handleList)
	r.GET("/:id", s.handleGet)
	r.POST("", middleware.RequireAdmin(), s.handleCreate)
	r.POST("/sync-from-os", middleware.RequireAdmin(), s.handleSyncFromOS)
	r.POST("/validate", middleware.RequireAdmin(), s.handleValidateDraft)
	r.POST("/preview", s.handlePreviewDraft)
	r.PUT("/:id", middleware.RequireAdmin(), s.handleUpdate)
	r.DELETE("/:id", middleware.RequireAdmin(), s.handleDelete)
	r.POST("/:id/validate", middleware.RequireAdmin(), s.handleValidate)
	r.POST("/:id/apply", middleware.RequireAdmin(), s.handleApply)
	r.POST("/:id/preview", s.handlePreview)
	r.POST("/:id/generate-raw", middleware.RequireAdmin(), s.handleGenerateRaw)
	r.POST("/:id/generate-mount", s.handleGenerateMount)
}

func (s *Service) handleList(c *gin.Context) {
	list, err := s.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (s *Service) handleGet(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	sh, _ := s.Get(c.Request.Context(), id)
	if sh == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, sh)
}

func (s *Service) handleCreate(c *gin.Context) {
	var sh Share
	if err := c.ShouldBindJSON(&sh); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if sh.ConfigMode == "" {
		sh.ConfigMode = "form"
	}
	created, err := s.Create(c.Request.Context(), sh)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	uid := middleware.GetUserID(c)
	username := middleware.GetUsername(c)
	_ = s.audit.Log(c.Request.Context(), "share.create", "share", &created.ID, &uid, username, nil)
	if created.Enabled {
		if err := s.exports.RebuildAndApply(c.Request.Context(), uid, username, "share.create_apply", &created.ID); err != nil {
			c.JSON(http.StatusCreated, gin.H{"share": created, "apply_warning": err.Error()})
			return
		}
	}
	c.JSON(http.StatusCreated, created)
}

func (s *Service) handleUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var sh Share
	if err := c.ShouldBindJSON(&sh); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updated, _ := s.Update(c.Request.Context(), id, sh)
	if updated == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	uid := middleware.GetUserID(c)
	username := middleware.GetUsername(c)
	_ = s.audit.Log(c.Request.Context(), "share.update", "share", &id, &uid, username, nil)
	if err := s.exports.RebuildAndApply(c.Request.Context(), uid, username, "share.update_apply", &id); err != nil {
		c.JSON(http.StatusOK, gin.H{"share": updated, "apply_warning": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (s *Service) handleDelete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := s.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	uid := middleware.GetUserID(c)
	username := middleware.GetUsername(c)
	_ = s.audit.Log(c.Request.Context(), "share.delete", "share", &id, &uid, username, nil)
	if err := s.exports.RebuildAndApply(c.Request.Context(), uid, username, "share.delete_apply", &id); err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": true, "apply_warning": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (s *Service) handleValidateDraft(c *gin.Context) {
	var sh Share
	if err := c.ShouldBindJSON(&sh); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	errs := s.ValidateSharePayload(sh)
	c.JSON(http.StatusOK, gin.H{"valid": len(errs) == 0, "errors": errs})
}

func (s *Service) handlePreviewDraft(c *gin.Context) {
	var sh Share
	if err := c.ShouldBindJSON(&sh); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"preview": s.PreviewSharePayload(sh)})
}

func (s *Service) handleValidate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var sh Share
	if err := c.ShouldBindJSON(&sh); err == nil && sh.Name != "" {
		errs := s.ValidateSharePayload(sh)
		c.JSON(http.StatusOK, gin.H{"valid": len(errs) == 0, "errors": errs})
		return
	}
	errs, err := s.ValidateShare(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"valid": len(errs) == 0, "errors": errs})
}

func (s *Service) handleApply(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var body Share
	if err := c.ShouldBindJSON(&body); err == nil && (body.Name != "" || body.Path != "") {
		body.ID = id
		if _, err := s.Update(c.Request.Context(), id, body); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	if err := s.ApplyShare(c.Request.Context(), id, middleware.GetUserID(c), middleware.GetUsername(c)); err != nil {
		if ve, ok := err.(*ValidateError); ok {
			c.JSON(http.StatusBadRequest, gin.H{"valid": false, "errors": ve.Errors})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Service) handlePreview(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	sh, _ := s.Get(c.Request.Context(), id)
	if sh == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"preview": s.ExportLineForShare(*sh)})
}

func (s *Service) handleGenerateRaw(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	sh, _ := s.Get(c.Request.Context(), id)
	if sh == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	line := s.ExportLineForShare(*sh)
	c.JSON(http.StatusOK, gin.H{"raw_export": line})
}

func (s *Service) handleSyncFromOS(c *gin.Context) {
	result, err := s.SyncFromOS(c.Request.Context(), ManualReconcile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	uid := middleware.GetUserID(c)
	_ = s.audit.Log(c.Request.Context(), "shares.sync_os_manual", "shares", nil, &uid, middleware.GetUsername(c), result)
	c.JSON(http.StatusOK, result)
}

func (s *Service) handleGenerateMount(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	sh, _ := s.Get(c.Request.Context(), id)
	if sh == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var req struct {
		nfs.MountClientOptions
		Hard *bool `json:"hard"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	opts := req.MountClientOptions
	opts.Hard = true
	if req.Hard != nil {
		opts.Hard = *req.Hard
	}

	result, err := nfs.RenderMountConfig(req.Server, sh.Path, opts)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uid := middleware.GetUserID(c)
	_ = s.audit.Log(c.Request.Context(), "share.generate_mount", "share", &id, &uid, middleware.GetUsername(c), nil)
	c.JSON(http.StatusOK, result)
}

func (s *Service) EnabledExportLines(ctx context.Context) ([]string, error) {
	list, err := s.List(ctx)
	if err != nil {
		return nil, err
	}
	var lines []string
	for _, sh := range list {
		if !sh.Enabled {
			continue
		}
		lines = append(lines, s.ExportLineForShare(sh))
	}
	return lines, nil
}
