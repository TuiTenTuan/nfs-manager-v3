package audit

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Entry struct {
	ID         int             `json:"id"`
	Action     string          `json:"action"`
	EntityType string          `json:"entity_type,omitempty"`
	EntityID   *int            `json:"entity_id,omitempty"`
	UserID     *int            `json:"user_id,omitempty"`
	Username   string          `json:"username,omitempty"`
	Details    json.RawMessage `json:"details,omitempty"`
	CreatedAt  string          `json:"created_at"`
}

type Service struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) Log(ctx context.Context, action, entityType string, entityID *int, userID *int, username string, details any) error {
	var detailsJSON []byte
	if details != nil {
		detailsJSON, _ = json.Marshal(details)
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO audit_log (action, entity_type, entity_id, user_id, username, details)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		action, entityType, entityID, userID, username, detailsJSON,
	)
	return err
}

func (s *Service) List(ctx context.Context, limit int) ([]Entry, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, action, entity_type, entity_id, user_id, username, details, created_at::text
		 FROM audit_log ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Entry
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.Action, &e.EntityType, &e.EntityID, &e.UserID, &e.Username, &e.Details, &e.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, rows.Err()
}
