package shares

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/nfs-manager/nfs-manager-v3/backend/internal/nfs"
)

type SyncMode int

const (
	StartupAdditive SyncMode = iota
	ManualReconcile
)

type SyncResult struct {
	Added     int `json:"added"`
	Updated   int `json:"updated"`
	Deleted   int `json:"deleted"`
	Skipped   int `json:"skipped"`
	Unchanged int `json:"unchanged"`
}

func (s *Service) SyncFromOS(ctx context.Context, mode SyncMode) (*SyncResult, error) {
	content, err := s.provider.SyncFromOS()
	if err != nil {
		return nil, err
	}

	lines := nfs.ParseExportLines(content)
	osPaths := make(map[string]string, len(lines))
	allowlistedLines := make([]nfs.ExportLine, 0, len(lines))
	seenPath := make(map[string]bool)
	for _, line := range lines {
		osPaths[line.Path] = line.RawLine
		if seenPath[line.Path] {
			continue
		}
		seenPath[line.Path] = true
		allowlistedLines = append(allowlistedLines, line)
	}

	dbShares, err := s.List(ctx)
	if err != nil {
		return nil, err
	}

	byPath := make(map[string]Share, len(dbShares))
	names := make(map[string]bool, len(dbShares))
	for _, sh := range dbShares {
		byPath[nfs.CleanExportPath(sh.Path)] = sh
		names[sh.Name] = true
	}

	result := &SyncResult{}

	for _, line := range allowlistedLines {
		if !nfs.IsPathAllowlisted(line.Path, s.allowlist) {
			log.Printf("sync: skipping non-allowlisted export path %s", line.Path)
			result.Skipped++
			continue
		}

		existing, ok := byPath[line.Path]
		if !ok {
			name := deriveShareName(line.Path, names)
			raw := line.RawLine
			sh := Share{
				Name:         name,
				Path:         line.Path,
				ConfigMode:   "raw",
				BasicJSON:    []byte("{}"),
				AdvancedJSON: []byte("{}"),
				RawExport:    &raw,
				Enabled:      true,
			}
			created, err := s.Create(ctx, sh)
			if err != nil {
				return result, fmt.Errorf("insert share %s: %w", line.Path, err)
			}
			byPath[line.Path] = *created
			result.Added++
			continue
		}

		rawLine := strings.TrimSpace(line.RawLine)
		existingRaw := ""
		if existing.RawExport != nil {
			existingRaw = strings.TrimSpace(*existing.RawExport)
		}

		if mode == ManualReconcile && existingRaw != rawLine {
			raw := line.RawLine
			updated, err := s.Update(ctx, existing.ID, Share{
				Name:         existing.Name,
				Path:         line.Path,
				GroupID:      existing.GroupID,
				ConfigMode:   "raw",
				BasicJSON:    existing.BasicJSON,
				AdvancedJSON: existing.AdvancedJSON,
				RawExport:    &raw,
				Enabled:      existing.Enabled,
			})
			if err != nil {
				return result, fmt.Errorf("update share %s: %w", line.Path, err)
			}
			byPath[line.Path] = *updated
			result.Updated++
			continue
		}

		result.Unchanged++
	}

	if mode == ManualReconcile {
		for _, sh := range dbShares {
			if _, inOS := osPaths[nfs.CleanExportPath(sh.Path)]; !inOS {
				if err := s.Delete(ctx, sh.ID); err != nil {
					return result, fmt.Errorf("delete share %s: %w", sh.Path, err)
				}
				result.Deleted++
			}
		}
	}

	return result, nil
}

func (s *Service) SyncToOSOnStartup(ctx context.Context) error {
	return s.exports.RebuildAndApply(ctx, 0, "system", "shares.sync_startup_db", nil)
}

func deriveShareName(path string, taken map[string]bool) string {
	base := nfs.BaseExportPath(path)
	if base == "" || base == "." || base == "/" {
		base = "share"
	}
	name := base
	if !taken[name] {
		taken[name] = true
		return name
	}
	for i := 2; ; i++ {
		candidate := fmt.Sprintf("%s-%d", base, i)
		if !taken[candidate] {
			taken[candidate] = true
			return candidate
		}
	}
}
