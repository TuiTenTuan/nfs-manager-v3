package templates

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/middleware"
)

type Template struct {
	ID           int             `json:"id"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Category     string          `json:"category"`
	BasicJSON    json.RawMessage `json:"basic_json"`
	AdvancedJSON json.RawMessage `json:"advanced_json"`
	RawExport    *string         `json:"raw_export"`
	CreatedAt    string          `json:"created_at"`
	UpdatedAt    string          `json:"updated_at"`
}

type Service struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) SeedDefaults(ctx context.Context) error {
	var n int
	_ = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM export_templates`).Scan(&n)
	if n > 0 {
		return nil
	}
	defaults := []Template{
		{
			Name: "General Share Folder", Category: "general", Description: "Standard RW share for general files",
			BasicJSON:    json.RawMessage(`{"path":"/srv/nfs/data","clients":["*"],"read_only":false,"root_squash":true,"sync":true,"security":"sys"}`),
			AdvancedJSON: json.RawMessage(`{}`),
			RawExport:    strPtr("/srv/nfs/data *(rw,sync,root_squash)"),
		},
		{
			Name: "Hot File Share", Category: "performance", Description: "High-throughput async share",
			BasicJSON:    json.RawMessage(`{"path":"/srv/nfs/hot","clients":["192.168.0.0/16"],"read_only":false,"root_squash":true,"sync":false,"security":"sys"}`),
			AdvancedJSON: json.RawMessage(`{"subtree_check":false,"secure_ports":true}`),
			RawExport:    strPtr("/srv/nfs/hot 192.168.0.0/16(rw,async,root_squash)"),
		},
		{
			Name: "Database Files", Category: "database", Description: "RO share for DB backup mounts",
			BasicJSON:    json.RawMessage(`{"path":"/srv/nfs/dbfiles","clients":["10.0.0.0/8"],"read_only":true,"root_squash":true,"sync":true,"security":"sys"}`),
			AdvancedJSON: json.RawMessage(`{"fsid":"0"}`),
			RawExport:    strPtr("/srv/nfs/dbfiles 10.0.0.0/8(ro,sync,root_squash,fsid=0)"),
		},
	}
	for _, t := range defaults {
		_, err := s.pool.Exec(ctx,
			`INSERT INTO export_templates (name, description, category, basic_json, advanced_json, raw_export)
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			t.Name, t.Description, t.Category, t.BasicJSON, t.AdvancedJSON, t.RawExport)
		if err != nil {
			return err
		}
	}
	return nil
}

func strPtr(s string) *string { return &s }

func (s *Service) List(ctx context.Context) ([]Template, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, description, category, basic_json, advanced_json, raw_export, created_at::text, updated_at::text
		 FROM export_templates ORDER BY category, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Template
	for rows.Next() {
		var t Template
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.Category, &t.BasicJSON, &t.AdvancedJSON, &t.RawExport, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (s *Service) Get(ctx context.Context, id int) (*Template, error) {
	var t Template
	err := s.pool.QueryRow(ctx,
		`SELECT id, name, description, category, basic_json, advanced_json, raw_export, created_at::text, updated_at::text
		 FROM export_templates WHERE id = $1`, id).
		Scan(&t.ID, &t.Name, &t.Description, &t.Category, &t.BasicJSON, &t.AdvancedJSON, &t.RawExport, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &t, err
}

func (s *Service) Create(ctx context.Context, t Template) (*Template, error) {
	var id int
	err := s.pool.QueryRow(ctx,
		`INSERT INTO export_templates (name, description, category, basic_json, advanced_json, raw_export)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		t.Name, t.Description, t.Category, t.BasicJSON, t.AdvancedJSON, t.RawExport).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id int, t Template) (*Template, error) {
	_, err := s.pool.Exec(ctx,
		`UPDATE export_templates SET name=$1, description=$2, category=$3, basic_json=$4, advanced_json=$5, raw_export=$6, updated_at=NOW() WHERE id=$7`,
		t.Name, t.Description, t.Category, t.BasicJSON, t.AdvancedJSON, t.RawExport, id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM export_templates WHERE id = $1`, id)
	return err
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("", s.handleList)
	r.GET("/:id", s.handleGet)
	r.POST("", middleware.RequireAdmin(), s.handleCreate)
	r.PUT("/:id", middleware.RequireAdmin(), s.handleUpdate)
	r.DELETE("/:id", middleware.RequireAdmin(), s.handleDelete)
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
	t, _ := s.Get(c.Request.Context(), id)
	if t == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, t)
}

func (s *Service) handleCreate(c *gin.Context) {
	var t Template
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	created, err := s.Create(c.Request.Context(), t)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (s *Service) handleUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var t Template
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updated, _ := s.Update(c.Request.Context(), id, t)
	c.JSON(http.StatusOK, updated)
}

func (s *Service) handleDelete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	_ = s.Delete(c.Request.Context(), id)
	c.Status(http.StatusNoContent)
}
