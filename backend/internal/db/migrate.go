package db

import (
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/config"
)

func migrationsSource() string {
	dir := "file://migrations"
	if _, err := os.Stat("migrations"); os.IsNotExist(err) {
		dir = "file://backend/migrations"
	}
	return dir
}

func newMigrator(dbCfg config.DatabaseConfig) (*migrate.Migrate, error) {
	return migrate.New(migrationsSource(), dbCfg.URL())
}

func MigrateUp(dbCfg config.DatabaseConfig) error {
	m, err := newMigrator(dbCfg)
	if err != nil {
		return err
	}
	defer m.Close()
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}

func MigrateDown(dbCfg config.DatabaseConfig) error {
	m, err := newMigrator(dbCfg)
	if err != nil {
		return err
	}
	defer m.Close()
	if err := m.Down(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}
