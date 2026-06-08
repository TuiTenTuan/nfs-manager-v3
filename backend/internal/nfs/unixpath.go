package nfs

import (
	"path"
	"strings"
)

// CleanExportPath normalizes a Unix-style NFS export path independent of host OS.
func CleanExportPath(p string) string {
	p = strings.ReplaceAll(strings.TrimSpace(p), "\\", "/")
	if p == "" {
		return ""
	}
	return path.Clean(p)
}

// JoinExportPath joins Unix-style path elements.
func JoinExportPath(elem ...string) string {
	return path.Join(elem...)
}

// DirExportPath returns the parent directory of a Unix-style path.
func DirExportPath(p string) string {
	return path.Dir(CleanExportPath(p))
}

// BaseExportPath returns the last element of a Unix-style path.
func BaseExportPath(p string) string {
	return path.Base(CleanExportPath(p))
}

// IsAbsoluteExportPath reports whether p is an absolute Unix path.
func IsAbsoluteExportPath(p string) bool {
	return strings.HasPrefix(CleanExportPath(p), "/")
}
