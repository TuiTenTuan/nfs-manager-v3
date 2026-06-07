package groups

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/audit"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/middleware"
)

type Group struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	ShareCount  int    `json:"share_count"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type Service struct {
	pool  *pgxpool.Pool
	audit *audit.Service
}

func New(pool *pgxpool.Pool, au *audit.Service) *Service {
	return &Service{pool: pool, audit: au}
}

func (s *Service) List(ctx context.Context) ([]Group, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT sg.id, sg.name, sg.description,
		        (SELECT COUNT(*)::int FROM nfs_shares WHERE group_id = sg.id) AS share_count,
		        sg.created_at::text, sg.updated_at::text
		 FROM share_groups sg ORDER BY sg.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Group
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.ShareCount, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, g)
	}
	return list, rows.Err()
}

func (s *Service) Get(ctx context.Context, id int) (*Group, error) {
	var g Group
	err := s.pool.QueryRow(ctx,
		`SELECT id, name, description, created_at::text, updated_at::text FROM share_groups WHERE id = $1`, id).
		Scan(&g.ID, &g.Name, &g.Description, &g.CreatedAt, &g.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &g, err
}

func (s *Service) Create(ctx context.Context, name, desc string) (*Group, error) {
	var id int
	err := s.pool.QueryRow(ctx,
		`INSERT INTO share_groups (name, description) VALUES ($1, $2) RETURNING id`,
		name, desc).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id int, name, desc string) (*Group, error) {
	_, err := s.pool.Exec(ctx,
		`UPDATE share_groups SET name = $1, description = $2, updated_at = NOW() WHERE id = $3`,
		name, desc, id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM share_groups WHERE id = $1`, id)
	return err
}

func (s *Service) BulkSetEnabled(ctx context.Context, groupID int, enabled bool) (int64, error) {
	ct, err := s.pool.Exec(ctx,
		`UPDATE nfs_shares SET enabled = $1, updated_at = NOW(), version = version + 1 WHERE group_id = $2`,
		enabled, groupID)
	return ct.RowsAffected(), err
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("", s.handleList)
	r.GET("/:id", s.handleGet)
	r.POST("", middleware.RequireAdmin(), s.handleCreate)
	r.PUT("/:id", middleware.RequireAdmin(), s.handleUpdate)
	r.DELETE("/:id", middleware.RequireAdmin(), s.handleDelete)
	r.POST("/:id/bulk-enable", middleware.RequireAdmin(), s.handleBulkEnable)
	r.POST("/:id/bulk-disable", middleware.RequireAdmin(), s.handleBulkDisable)
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
	g, _ := s.Get(c.Request.Context(), id)
	if g == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, g)
}

func (s *Service) handleCreate(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	g, err := s.Create(c.Request.Context(), req.Name, req.Description)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	uid := middleware.GetUserID(c)
	_ = s.audit.Log(c.Request.Context(), "group.create", "group", &g.ID, &uid, middleware.GetUsername(c), req)
	c.JSON(http.StatusCreated, g)
}

func (s *Service) handleUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	g, _ := s.Update(c.Request.Context(), id, req.Name, req.Description)
	if g == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, g)
}

func (s *Service) handleDelete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	_ = s.Delete(c.Request.Context(), id)
	c.Status(http.StatusNoContent)
}

func (s *Service) handleBulkEnable(c *gin.Context) {
	s.bulkToggle(c, true)
}

func (s *Service) handleBulkDisable(c *gin.Context) {
	s.bulkToggle(c, false)
}

func (s *Service) bulkToggle(c *gin.Context, enabled bool) {
	id, _ := strconv.Atoi(c.Param("id"))
	n, err := s.BulkSetEnabled(c.Request.Context(), id, enabled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": n})
}
