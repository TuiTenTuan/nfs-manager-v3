package users

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/audit"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/middleware"
)

type User struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	Role         string `json:"role"`
	Disabled     bool   `json:"disabled"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type Service struct {
	pool  *pgxpool.Pool
	audit *audit.Service
}

func New(pool *pgxpool.Pool, au *audit.Service) *Service {
	return &Service{pool: pool, audit: au}
}

func (s *Service) Count(ctx context.Context) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Service) SeedFirstAdmin(ctx context.Context) error {
	n, err := s.Count(ctx)
	if err != nil || n > 0 {
		return err
	}
	pass := randomPassword(16)
	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx,
		`INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')`,
		"admin", string(hash))
	if err != nil {
		return err
	}
	fmt.Println("\n========================================")
	fmt.Println(" FIRST RUN: admin user created")
	fmt.Println(" Username: admin")
	fmt.Printf(" Password: %s\n", pass)
	fmt.Println(" Save this password now — it will not be shown again.")
	fmt.Println("========================================\n")
	return nil
}

func randomPassword(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)[:n]
}

func (s *Service) GetByUsername(ctx context.Context, username string) (*User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`SELECT id, username, password_hash, role, disabled, created_at::text, updated_at::text
		 FROM users WHERE username = $1`, username).
		Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.Disabled, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Service) List(ctx context.Context) ([]User, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, username, password_hash, role, disabled, created_at::text, updated_at::text FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.Disabled, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, rows.Err()
}

func (s *Service) Get(ctx context.Context, id int) (*User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`SELECT id, username, password_hash, role, disabled, created_at::text, updated_at::text FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.Disabled, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &u, err
}

func (s *Service) Create(ctx context.Context, username, password, role string) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	var id int
	err = s.pool.QueryRow(ctx,
		`INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
		username, string(hash), role).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id int, username, role string) (*User, error) {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET username = $1, role = $2, updated_at = NOW() WHERE id = $3`,
		username, role, id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	ct, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Service) ChangePassword(ctx context.Context, id int, newPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx,
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
		string(hash), id)
	return err
}

func (s *Service) CountActiveAdmins(ctx context.Context) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE role = 'admin' AND disabled = FALSE`).Scan(&n)
	return n, err
}

func (s *Service) SetDisabled(ctx context.Context, id int, disabled bool) (*User, error) {
	ct, err := s.pool.Exec(ctx,
		`UPDATE users SET disabled = $1, updated_at = NOW() WHERE id = $2`,
		disabled, id)
	if err != nil {
		return nil, err
	}
	if ct.RowsAffected() == 0 {
		return nil, pgx.ErrNoRows
	}
	return s.Get(ctx, id)
}

// Gin binding tags are the canonical API validation rules (mirrored in frontend/src/lib/validation.ts).
type createUserReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required,min=8"` // min=8 → PASSWORD_MIN_LENGTH
	Role     string `json:"role" binding:"required,oneof=admin viewer"`
}

type updateUserReq struct {
	Username string `json:"username" binding:"required"`
	Role     string `json:"role" binding:"required,oneof=admin viewer"`
}

type changePasswordReq struct {
	Password    string `json:"password" binding:"required,min=8"`     // current password
	NewPassword string `json:"new_password" binding:"required,min=8"` // min=8 → PASSWORD_MIN_LENGTH
}

type setStatusReq struct {
	Disabled bool `json:"disabled"`
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("", s.handleList)
	r.GET("/:id", s.handleGet)
	r.POST("", middleware.RequireAdmin(), s.handleCreate)
	r.PUT("/:id", middleware.RequireAdmin(), s.handleUpdate)
	r.PATCH("/:id/status", middleware.RequireAdmin(), s.handleSetStatus)
	r.DELETE("/:id", middleware.RequireAdmin(), s.handleDelete)
	r.POST("/:id/password", s.handleChangePassword)
	r.POST("/me/password", s.handleChangeOwnPassword)
}

func (s *Service) handleList(c *gin.Context) {
	list, err := s.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	for i := range list {
		list[i].PasswordHash = ""
	}
	c.JSON(http.StatusOK, list)
}

func (s *Service) handleGet(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	u, _ := s.Get(c.Request.Context(), id)
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	u.PasswordHash = ""
	c.JSON(http.StatusOK, u)
}

func (s *Service) handleCreate(c *gin.Context) {
	var req createUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u, err := s.Create(c.Request.Context(), req.Username, req.Password, req.Role)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	uid := middleware.GetUserID(c)
	_ = s.audit.Log(c.Request.Context(), "user.create", "user", &u.ID, &uid, middleware.GetUsername(c), gin.H{"username": req.Username})
	u.PasswordHash = ""
	c.JSON(http.StatusCreated, u)
}

func (s *Service) handleUpdate(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req updateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u, err := s.Update(c.Request.Context(), id, req.Username, req.Role)
	if err != nil || u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	uid := middleware.GetUserID(c)
	_ = s.audit.Log(c.Request.Context(), "user.update", "user", &id, &uid, middleware.GetUsername(c), req)
	u.PasswordHash = ""
	c.JSON(http.StatusOK, u)
}

func (s *Service) handleDelete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := s.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	uid := middleware.GetUserID(c)
	_ = s.audit.Log(c.Request.Context(), "user.delete", "user", &id, &uid, middleware.GetUsername(c), nil)
	c.Status(http.StatusNoContent)
}

func (s *Service) handleSetStatus(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req setStatusReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	target, err := s.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if target == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	if req.Disabled {
		if middleware.GetUserID(c) == id {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot disable your own account"})
			return
		}
		if target.Role == "admin" {
			n, err := s.CountActiveAdmins(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if n <= 1 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "cannot disable the last active admin"})
				return
			}
		}
	}

	u, err := s.SetDisabled(c.Request.Context(), id, req.Disabled)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	uid := middleware.GetUserID(c)
	action := "user.enable"
	if req.Disabled {
		action = "user.disable"
	}
	_ = s.audit.Log(c.Request.Context(), action, "user", &id, &uid, middleware.GetUsername(c), gin.H{"disabled": req.Disabled})
	u.PasswordHash = ""
	c.JSON(http.StatusOK, u)
}

func (s *Service) handleChangePassword(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	role, _ := c.Get("role")
	actorID := middleware.GetUserID(c)
	if role != "admin" && actorID != id {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	target, err := s.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if target == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var req struct {
		NewPassword string `json:"new_password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := s.ChangePassword(c.Request.Context(), id, req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	uid := middleware.GetUserID(c)
	_ = s.audit.Log(c.Request.Context(), "user.password_change", "user", &id, &uid, middleware.GetUsername(c), nil)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Service) handleChangeOwnPassword(c *gin.Context) {
	var req changePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u, err := s.Get(c.Request.Context(), middleware.GetUserID(c))
	if err != nil || u == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "wrong password"})
		return
	}
	if err := s.ChangePassword(c.Request.Context(), u.ID, req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func PublicUser(u *User) User {
	u.PasswordHash = ""
	return *u
}
