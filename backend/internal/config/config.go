package config

import (
	"fmt"
	"net/url"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

func (d DatabaseConfig) URL() string {
	user := url.UserPassword(d.User, d.Password)
	return fmt.Sprintf("postgres://%s@%s:%s/%s?sslmode=%s",
		user.String(), d.Host, d.Port, url.PathEscape(d.Name), url.QueryEscape(d.SSLMode))
}

type Config struct {
	AppEnv             string
	HTTPPort           string
	Database           DatabaseConfig
	JWTAccessSecret    string
	JWTRefreshSecret   string
	JWTAccessTTL       time.Duration
	JWTRefreshTTL      time.Duration
	NFSProvider        string
	NFSServerHost      string
	NFSRootAllowlist   []string
	ManagedExportsPath string
	CORSOrigin         string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	accessTTL, _ := time.ParseDuration(getEnv("JWT_ACCESS_TTL", "15m"))
	refreshTTL, _ := time.ParseDuration(getEnv("JWT_REFRESH_TTL", "168h"))

	provider := getEnv("NFS_PROVIDER", "")
	if provider == "" {
		if runtime.GOOS != "linux" {
			provider = "mock"
		} else {
			provider = "linux"
		}
	}

	allowlist := strings.Split(getEnv("NFS_ROOT_ALLOWLIST", "/srv,/data,/export,/mnt"), ",")
	for i := range allowlist {
		allowlist[i] = strings.TrimSpace(allowlist[i])
	}

	db := DatabaseConfig{
		Host:     getEnv("DATABASE_HOST", "localhost"),
		Port:     getEnv("DATABASE_PORT", "5432"),
		User:     getEnv("DATABASE_USER", "nfsmanager"),
		Password: getEnv("DATABASE_PASSWORD", ""),
		Name:     getEnv("DATABASE_NAME", "nfsmanager_v3"),
		SSLMode:  getEnv("DATABASE_SSL_MODE", "disable"),
	}

	nfsServerHost := strings.TrimSpace(getEnv("NFS_SERVER_HOST", ""))
	if nfsServerHost == "" {
		if hostname, err := os.Hostname(); err == nil {
			nfsServerHost = strings.TrimSpace(hostname)
		}
	}

	return &Config{
		AppEnv:             getEnv("APP_ENV", "dev"),
		HTTPPort:           getEnv("API_PORT", "8080"),
		Database:           db,
		JWTAccessSecret:    getEnv("JWT_ACCESS_SECRET", "dev-access-secret-change-in-production-32"),
		JWTRefreshSecret:   getEnv("JWT_REFRESH_SECRET", "dev-refresh-secret-change-in-production-32"),
		JWTAccessTTL:       accessTTL,
		JWTRefreshTTL:      refreshTTL,
		NFSProvider:        provider,
		NFSServerHost:      nfsServerHost,
		NFSRootAllowlist:   allowlist,
		ManagedExportsPath: getEnv("MANAGED_EXPORTS_PATH", "/etc/exports.d/nfs-manager.exports"),
		CORSOrigin:         getEnv("CORS_ORIGIN", "http://localhost:3000"),
	}, nil
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
