package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin required"})
			return
		}
		c.Next()
	}
}

func RequireViewerOrAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" && role != "viewer" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

func GetUserID(c *gin.Context) int {
	id, _ := c.Get("user_id")
	if v, ok := id.(int); ok {
		return v
	}
	return 0
}

func GetUsername(c *gin.Context) string {
	u, _ := c.Get("username")
	if v, ok := u.(string); ok {
		return v
	}
	return ""
}
