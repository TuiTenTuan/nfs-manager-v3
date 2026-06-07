package nfs

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

var exportLineRe = regexp.MustCompile(`^\s*(\S+)\s+(\S+.*)$`)

type ExportLine struct {
	Path    string
	RawLine string
}

func ParseExportLines(text string) []ExportLine {
	var out []ExportLine
	for _, line := range strings.Split(text, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		m := exportLineRe.FindStringSubmatch(trimmed)
		if m == nil {
			continue
		}
		out = append(out, ExportLine{
			Path:    filepath.Clean(m[1]),
			RawLine: trimmed,
		})
	}
	return out
}

func IsPathAllowlisted(path string, allowlist []string) bool {
	return pathAllowed(filepath.Clean(path), allowlist)
}

func ValidatePathsInText(text string, allowlist []string) []ValidationError {
	var errs []ValidationError
	lines := strings.Split(text, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		m := exportLineRe.FindStringSubmatch(trimmed)
		if m == nil {
			continue
		}
		exportPath := m[1]
		if strings.Contains(exportPath, "..") {
			errs = append(errs, ValidationError{Line: i + 1, Field: "path", Message: "path must not contain .."})
			continue
		}
		clean := filepath.Clean(exportPath)
		if !strings.HasPrefix(clean, "/") {
			errs = append(errs, ValidationError{Line: i + 1, Field: "path", Message: "path must be absolute"})
			continue
		}
		if !pathAllowed(clean, allowlist) {
			errs = append(errs, ValidationError{Line: i + 1, Field: "path", Message: fmt.Sprintf("path %s not in allowlist", clean)})
		}
	}
	return errs
}

func pathAllowed(path string, allowlist []string) bool {
	for _, root := range allowlist {
		if root == "" {
			continue
		}
		root = filepath.Clean(root)
		if path == root || strings.HasPrefix(path, root+"/") {
			return true
		}
	}
	return false
}

func RenderFormLine(path string, basic ShareForm, adv ShareAdvanced) string {
	opts := []string{}
	if basic.ReadOnly {
		opts = append(opts, "ro")
	} else {
		opts = append(opts, "rw")
	}
	if basic.RootSquash {
		opts = append(opts, "root_squash")
	} else {
		opts = append(opts, "no_root_squash")
	}
	if basic.Sync {
		opts = append(opts, "sync")
	} else {
		opts = append(opts, "async")
	}
	if sec := strings.TrimSpace(basic.Security); sec != "" && sec != "sys" {
		opts = append(opts, "sec="+sec)
	}
	if adv.AllSquash {
		opts = append(opts, "all_squash")
	}
	if adv.SubtreeCheck {
		opts = append(opts, "subtree_check")
	}
	if adv.NoSubtreeCheck {
		opts = append(opts, "no_subtree_check")
	}
	if adv.SecurePorts {
		opts = append(opts, "secure")
	}
	if adv.Insecure {
		opts = append(opts, "insecure")
	}
	if adv.Wdelay {
		opts = append(opts, "wdelay")
	}
	if adv.NoWdelay {
		opts = append(opts, "no_wdelay")
	}
	if adv.Crossmnt {
		opts = append(opts, "crossmnt")
	}
	if adv.Nohide {
		opts = append(opts, "nohide")
	}
	if adv.Mountpoint {
		if mp := strings.TrimSpace(adv.MountpointPath); mp != "" {
			opts = append(opts, "mountpoint="+mp)
		} else {
			opts = append(opts, "mountpoint")
		}
	}
	if adv.Fsid != "" {
		opts = append(opts, "fsid="+adv.Fsid)
	}
	if refer := strings.TrimSpace(adv.Refer); refer != "" {
		opts = append(opts, "refer="+refer)
	}
	if replicas := strings.TrimSpace(adv.Replicas); replicas != "" {
		opts = append(opts, "replicas="+replicas)
	}
	if adv.InsecureLocks {
		opts = append(opts, "insecure_locks")
	}
	if adv.NoAuthNlm {
		opts = append(opts, "no_auth_nlm")
	}
	if adv.Public {
		opts = append(opts, "public")
	}
	if adv.Webnfs {
		opts = append(opts, "webnfs")
	}
	if xprt := strings.TrimSpace(adv.Xprtsec); xprt != "" {
		opts = append(opts, "xprtsec="+xprt)
	}
	if adv.AnonUID > 0 {
		opts = append(opts, fmt.Sprintf("anonuid=%d", adv.AnonUID))
	}
	if adv.AnonGID > 0 {
		opts = append(opts, fmt.Sprintf("anongid=%d", adv.AnonGID))
	}
	if adv.ExtraOptions != "" {
		for _, o := range strings.Fields(adv.ExtraOptions) {
			opts = append(opts, o)
		}
	}
	clients := "*"
	if len(basic.Clients) > 0 {
		clients = strings.Join(basic.Clients, ",")
	}
	return fmt.Sprintf("%s %s(%s)", filepath.Clean(path), clients, strings.Join(opts, ","))
}

func ValidateExportSyntax(text string) []ValidationError {
	var errs []ValidationError
	lines := strings.Split(text, "\n")
	seen := map[string]bool{}
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if !exportLineRe.MatchString(trimmed) {
			errs = append(errs, ValidationError{Line: i + 1, Message: "invalid export line syntax"})
			continue
		}
		m := exportLineRe.FindStringSubmatch(trimmed)
		if seen[m[1]] {
			errs = append(errs, ValidationError{Line: i + 1, Field: "path", Message: "duplicate export path"})
		}
		seen[m[1]] = true
	}
	return errs
}

func BuildManagedFile(shares []string) string {
	var b strings.Builder
	b.WriteString("# Managed by nfs-manager-v3\n")
	b.WriteString("# BEGIN NFS-MANAGER\n")
	for _, line := range shares {
		if strings.TrimSpace(line) != "" {
			b.WriteString(line)
			if !strings.HasSuffix(line, "\n") {
				b.WriteString("\n")
			}
		}
	}
	b.WriteString("# END NFS-MANAGER\n")
	return b.String()
}
