package filesystem

import (
	"net/http"
	"os"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/middleware"
	"github.com/nfs-manager/nfs-manager-v3/backend/internal/nfs"
)

type Service struct {
	allowlist []string
}

func New(allowlist []string) *Service {
	return &Service{allowlist: allowlist}
}

type BrowseResult struct {
	Path       string   `json:"path"`
	Parent     string   `json:"parent,omitempty"`
	Roots      []string `json:"roots"`
	Entries    []Entry  `json:"entries"`
	Selectable bool     `json:"selectable"`
}

type Entry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Type string `json:"type"`
}

func (s *Service) RegisterRoutes(r gin.IRouter) {
	r.GET("/browse", middleware.RequireAdmin(), s.handleBrowse)
}

func (s *Service) handleBrowse(c *gin.Context) {
	reqPath := strings.TrimSpace(c.Query("path"))
	if reqPath == "" {
		roots := make([]string, 0, len(s.allowlist))
		for _, root := range s.allowlist {
			if root = strings.TrimSpace(root); root != "" {
				roots = append(roots, nfs.CleanExportPath(root))
			}
		}
		sort.Strings(roots)
		c.JSON(http.StatusOK, BrowseResult{Path: "", Roots: roots})
		return
	}

	clean := nfs.CleanExportPath(reqPath)
	if !nfs.IsAbsoluteExportPath(clean) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path must be absolute"})
		return
	}
	if strings.Contains(clean, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path must not contain .."})
		return
	}
	if !nfs.IsPathAllowlisted(clean, s.allowlist) {
		c.JSON(http.StatusForbidden, gin.H{"error": "path not in allowlist"})
		return
	}

	info, err := os.Stat(clean)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "path not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !info.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path is not a directory"})
		return
	}

	entries, err := listDirs(clean, s.allowlist)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	parent := parentWithinAllowlist(clean, s.allowlist)
	c.JSON(http.StatusOK, BrowseResult{
		Path:       clean,
		Parent:     parent,
		Roots:      rootsFromAllowlist(s.allowlist),
		Entries:    entries,
		Selectable: true,
	})
}

func listDirs(dir string, allowlist []string) ([]Entry, error) {
	items, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var entries []Entry
	for _, item := range items {
		if !item.IsDir() {
			continue
		}
		name := item.Name()
		if name == "." || name == ".." {
			continue
		}
		child := nfs.JoinExportPath(dir, name)
		if !nfs.IsPathAllowlisted(child, allowlist) {
			continue
		}
		entries = append(entries, Entry{Name: name, Path: child, Type: "directory"})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name < entries[j].Name })
	return entries, nil
}

func rootsFromAllowlist(allowlist []string) []string {
	roots := make([]string, 0, len(allowlist))
	for _, root := range allowlist {
		if root = strings.TrimSpace(root); root != "" {
			roots = append(roots, nfs.CleanExportPath(root))
		}
	}
	sort.Strings(roots)
	return roots
}

func parentWithinAllowlist(path string, allowlist []string) string {
	clean := nfs.CleanExportPath(path)
	for _, root := range allowlist {
		root = nfs.CleanExportPath(strings.TrimSpace(root))
		if root == "" {
			continue
		}
		if clean == root {
			return ""
		}
	}
	parent := nfs.DirExportPath(clean)
	if parent == clean || parent == "/" {
		return ""
	}
	if nfs.IsPathAllowlisted(parent, allowlist) {
		return parent
	}
	return ""
}
