package configuration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/audit"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/exports"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/groups"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/middleware"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/shares"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/templates"
)

const exportVersion = 1

type ExportPayload struct {
	Version    int              `json:"version"`
	ExportedAt string           `json:"exported_at"`
	Groups     []ImportGroup    `json:"groups"`
	Shares     []ImportShare    `json:"shares"`
	Templates  []ImportTemplate `json:"templates"`
}

type ImportShare struct {
	Name         string          `json:"name"`
	Path         string          `json:"path"`
	GroupName    string          `json:"group_name,omitempty"`
	ConfigMode   string          `json:"config_mode"`
	BasicJSON    json.RawMessage `json:"basic_json"`
	AdvancedJSON json.RawMessage `json:"advanced_json"`
	RawExport    *string         `json:"raw_export"`
	Enabled      bool            `json:"enabled"`
}

type ImportGroup struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type ImportTemplate struct {
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Category     string          `json:"category"`
	BasicJSON    json.RawMessage `json:"basic_json"`
	AdvancedJSON json.RawMessage `json:"advanced_json"`
	RawExport    *string         `json:"raw_export"`
}

type ImportPayload struct {
	Version   int              `json:"version"`
	Groups    []ImportGroup    `json:"groups"`
	Shares    []ImportShare    `json:"shares"`
	Templates []ImportTemplate `json:"templates"`
}

type ImportSummary struct {
	Groups    ItemSummary `json:"groups"`
	Shares    ItemSummary `json:"shares"`
	Templates ItemSummary `json:"templates"`
	Warnings  []string    `json:"warnings,omitempty"`
	Errors    []string    `json:"errors,omitempty"`
	Valid     bool        `json:"valid"`
}

type ItemSummary struct {
	Total     int `json:"total"`
	Create    int `json:"create"`
	Update    int `json:"update"`
	Unchanged int `json:"unchanged"`
}

type Service struct {
	pool    *pgxpool.Pool
	audit   *audit.Service
	groups  *groups.Service
	shares  *shares.Service
	tmpl    *templates.Service
	exports *exports.Service
}

func New(pool *pgxpool.Pool, au *audit.Service, g *groups.Service, sh *shares.Service, t *templates.Service, ex *exports.Service) *Service {
	return &Service{pool: pool, audit: au, groups: g, shares: sh, tmpl: t, exports: ex}
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("/export", middleware.RequireAdmin(), s.handleExport)
	r.POST("/import/validate", middleware.RequireAdmin(), s.handleImportValidate)
	r.POST("/import", middleware.RequireAdmin(), s.handleImport)
}

func (s *Service) handleExport(c *gin.Context) {
	ctx := c.Request.Context()
	groupList, err := s.groups.List(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	shareList, err := s.shares.List(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tmplList, err := s.tmpl.List(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	groupNameByID := map[int]string{}
	exportGroups := make([]ImportGroup, 0, len(groupList))
	for _, g := range groupList {
		groupNameByID[g.ID] = g.Name
		exportGroups = append(exportGroups, ImportGroup{Name: g.Name, Description: g.Description})
	}

	exportShares := make([]ImportShare, 0, len(shareList))
	for _, sh := range shareList {
		item := ImportShare{
			Name:         sh.Name,
			Path:         sh.Path,
			ConfigMode:   sh.ConfigMode,
			BasicJSON:    sh.BasicJSON,
			AdvancedJSON: sh.AdvancedJSON,
			RawExport:    sh.RawExport,
			Enabled:      sh.Enabled,
		}
		if sh.GroupID != nil {
			if name, ok := groupNameByID[*sh.GroupID]; ok {
				item.GroupName = name
			}
		}
		exportShares = append(exportShares, item)
	}

	exportTemplates := make([]ImportTemplate, 0, len(tmplList))
	for _, t := range tmplList {
		exportTemplates = append(exportTemplates, ImportTemplate{
			Name:         t.Name,
			Description:  t.Description,
			Category:     t.Category,
			BasicJSON:    t.BasicJSON,
			AdvancedJSON: t.AdvancedJSON,
			RawExport:    t.RawExport,
		})
	}

	payload := ExportPayload{
		Version:    exportVersion,
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		Groups:     exportGroups,
		Shares:     exportShares,
		Templates:  exportTemplates,
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	filename := fmt.Sprintf("nfs-manager-config-%s.json", time.Now().UTC().Format("20060102-150405"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "application/json", data)
}

func (s *Service) handleImportValidate(c *gin.Context) {
	payload, err := s.bindImport(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	summary := s.summarize(c.Request.Context(), payload)
	c.JSON(http.StatusOK, summary)
}

func (s *Service) handleImport(c *gin.Context) {
	payload, err := s.bindImport(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	summary := s.summarize(c.Request.Context(), payload)
	if !summary.Valid {
		c.JSON(http.StatusBadRequest, summary)
		return
	}

	ctx := c.Request.Context()
	groupIDByName, err := s.upsertGroups(ctx, payload.Groups)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := s.upsertShares(ctx, payload.Shares, groupIDByName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := s.upsertTemplates(ctx, payload.Templates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	uid := middleware.GetUserID(c)
	username := middleware.GetUsername(c)
	_ = s.audit.Log(ctx, "configuration.import", "configuration", nil, &uid, username, summary)
	if err := s.exports.RebuildAndApply(ctx, uid, username, "configuration.import_apply", nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "summary": summary})
}

func (s *Service) bindImport(c *gin.Context) (*ImportPayload, error) {
	var payload ImportPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		return nil, err
	}
	if payload.Version != exportVersion {
		return nil, fmt.Errorf("unsupported config version %d", payload.Version)
	}
	if len(payload.Groups) == 0 && len(payload.Shares) == 0 && len(payload.Templates) == 0 {
		return nil, errors.New("import file contains no configuration data")
	}
	return &payload, nil
}

func (s *Service) summarize(ctx context.Context, payload *ImportPayload) ImportSummary {
	summary := ImportSummary{Valid: true}
	summary.Groups.Total = len(payload.Groups)
	summary.Shares.Total = len(payload.Shares)
	summary.Templates.Total = len(payload.Templates)

	existingGroups, _ := s.groups.List(ctx)
	groupByName := map[string]groups.Group{}
	for _, g := range existingGroups {
		groupByName[g.Name] = g
	}

	for _, g := range payload.Groups {
		if g.Name == "" {
			summary.Errors = append(summary.Errors, "group missing name")
			summary.Valid = false
			continue
		}
		if cur, ok := groupByName[g.Name]; ok {
			if cur.Description == g.Description {
				summary.Groups.Unchanged++
			} else {
				summary.Groups.Update++
				summary.Warnings = append(summary.Warnings, fmt.Sprintf("Group %q will be updated", g.Name))
			}
		} else {
			summary.Groups.Create++
		}
	}

	existingShares, _ := s.shares.List(ctx)
	shareByPath := map[string]shares.Share{}
	for _, sh := range existingShares {
		shareByPath[sh.Path] = sh
	}

	for _, sh := range payload.Shares {
		if sh.Name == "" || sh.Path == "" {
			summary.Errors = append(summary.Errors, "share missing name or path")
			summary.Valid = false
			continue
		}
		if cur, ok := shareByPath[sh.Path]; ok {
			summary.Shares.Update++
			if cur.Name != sh.Name {
				summary.Warnings = append(summary.Warnings, fmt.Sprintf("Share at %q will be overwritten (was %q)", sh.Path, cur.Name))
			} else {
				summary.Warnings = append(summary.Warnings, fmt.Sprintf("Share %q will be updated", sh.Name))
			}
		} else {
			summary.Shares.Create++
		}
	}

	existingTemplates, _ := s.tmpl.List(ctx)
	tmplByName := map[string]templates.Template{}
	for _, t := range existingTemplates {
		tmplByName[t.Name] = t
	}
	for _, t := range payload.Templates {
		if t.Name == "" {
			summary.Errors = append(summary.Errors, "template missing name")
			summary.Valid = false
			continue
		}
		if _, ok := tmplByName[t.Name]; ok {
			summary.Templates.Update++
			summary.Warnings = append(summary.Warnings, fmt.Sprintf("Template %q will be updated", t.Name))
		} else {
			summary.Templates.Create++
		}
	}
	return summary
}

func (s *Service) upsertGroups(ctx context.Context, items []ImportGroup) (map[string]int, error) {
	out := map[string]int{}
	for _, g := range items {
		var id int
		err := s.pool.QueryRow(ctx,
			`INSERT INTO share_groups (name, description) VALUES ($1, $2)
			 ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()
			 RETURNING id`, g.Name, g.Description).Scan(&id)
		if err != nil {
			return nil, err
		}
		out[g.Name] = id
	}
	return out, nil
}

func (s *Service) upsertShares(ctx context.Context, items []ImportShare, groupIDByName map[string]int) error {
	for _, sh := range items {
		var groupID *int
		if sh.GroupName != "" {
			if id, ok := groupIDByName[sh.GroupName]; ok {
				groupID = &id
			}
		}
		mode := sh.ConfigMode
		if mode == "" {
			mode = "form"
		}
		basic := sh.BasicJSON
		if len(basic) == 0 {
			basic = json.RawMessage(`{}`)
		}
		adv := sh.AdvancedJSON
		if len(adv) == 0 {
			adv = json.RawMessage(`{}`)
		}

		var existingID int
		err := s.pool.QueryRow(ctx, `SELECT id FROM nfs_shares WHERE path = $1`, sh.Path).Scan(&existingID)
		if errors.Is(err, pgx.ErrNoRows) {
			_, err = s.pool.Exec(ctx,
				`INSERT INTO nfs_shares (name, path, group_id, config_mode, basic_json, advanced_json, raw_export, enabled)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
				sh.Name, sh.Path, groupID, mode, basic, adv, sh.RawExport, sh.Enabled)
		} else if err == nil {
			_, err = s.pool.Exec(ctx,
				`UPDATE nfs_shares SET name=$1, group_id=$2, config_mode=$3, basic_json=$4,
				 advanced_json=$5, raw_export=$6, enabled=$7, version=version+1, updated_at=NOW() WHERE id=$8`,
				sh.Name, groupID, mode, basic, adv, sh.RawExport, sh.Enabled, existingID)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) upsertTemplates(ctx context.Context, items []ImportTemplate) error {
	for _, t := range items {
		basic := t.BasicJSON
		if len(basic) == 0 {
			basic = json.RawMessage(`{}`)
		}
		adv := t.AdvancedJSON
		if len(adv) == 0 {
			adv = json.RawMessage(`{}`)
		}
		cat := t.Category
		if cat == "" {
			cat = "general"
		}
		_, err := s.pool.Exec(ctx,
			`INSERT INTO export_templates (name, description, category, basic_json, advanced_json, raw_export)
			 VALUES ($1,$2,$3,$4,$5,$6)
			 ON CONFLICT (name) DO UPDATE SET
			   description = EXCLUDED.description,
			   category = EXCLUDED.category,
			   basic_json = EXCLUDED.basic_json,
			   advanced_json = EXCLUDED.advanced_json,
			   raw_export = EXCLUDED.raw_export,
			   updated_at = NOW()`,
			t.Name, t.Description, cat, basic, adv, t.RawExport)
		if err != nil {
			return err
		}
	}
	return nil
}
