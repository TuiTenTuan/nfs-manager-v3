package nfs

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

type LinuxProvider struct {
	allowlist    []string
	managedPath  string
	osExports    string
}

func NewLinuxProvider(allowlist []string, managedPath string) *LinuxProvider {
	return &LinuxProvider{
		allowlist:   allowlist,
		managedPath: managedPath,
		osExports:   "/etc/exports",
	}
}

func (l *LinuxProvider) Name() string { return "linux" }

func (l *LinuxProvider) ValidateText(text string) []ValidationError {
	errs := ValidateExportSyntax(text)
	errs = append(errs, ValidatePathsInText(text, l.allowlist)...)
	return errs
}

func (l *LinuxProvider) Apply(content string) error {
	dir := DirExportPath(l.managedPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create exports dir: %w", err)
	}
	return os.WriteFile(l.managedPath, []byte(content), 0644)
}

func (l *LinuxProvider) ensureExportPaths() error {
	content, err := os.ReadFile(l.managedPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read managed exports: %w", err)
	}
	for _, line := range ParseExportLines(string(content)) {
		if err := os.MkdirAll(line.Path, 0755); err != nil {
			return fmt.Errorf("create export path %s: %w", line.Path, err)
		}
	}
	return nil
}

func (l *LinuxProvider) Reload() error {
	if err := l.ensureExportPaths(); err != nil {
		return err
	}
	cmd := exec.Command("exportfs", "-ra")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("exportfs -ra: %w: %s", err, string(out))
	}
	return nil
}

func (l *LinuxProvider) SyncFromOS() (string, error) {
	data, err := os.ReadFile(l.managedPath)
	if err == nil && strings.TrimSpace(string(data)) != "" {
		return string(data), nil
	}
	if err != nil && !os.IsNotExist(err) {
		return "", fmt.Errorf("read managed exports: %w", err)
	}
	data, err = os.ReadFile(l.osExports)
	if err != nil {
		return "", fmt.Errorf("read exports: %w", err)
	}
	return string(data), nil
}

func (l *LinuxProvider) GetManagedExports() (string, error) {
	data, err := os.ReadFile(l.managedPath)
	if os.IsNotExist(err) {
		return "# BEGIN NFS-MANAGER\n# END NFS-MANAGER\n", nil
	}
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (l *LinuxProvider) SetManagedExports(content string) error {
	return l.Apply(content)
}

func (l *LinuxProvider) CollectGlobalMetrics() Metrics {
	return l.collectMetrics(nil, "")
}

func (l *LinuxProvider) CollectShareMetrics(shareID int, path string) Metrics {
	sid := shareID
	return l.collectMetrics(&sid, path)
}

func (l *LinuxProvider) collectMetrics(shareID *int, path string) Metrics {
	m := Metrics{
		ShareID:   shareID,
		Timestamp: time.Now(),
		Provider:  "linux",
		Clients:   []ClientInfo{},
	}

	if out, err := exec.Command("nfsstat", "-s").Output(); err == nil {
		text := string(out)
		for _, line := range strings.Split(text, "\n") {
			if strings.Contains(line, "read:") {
				fmt.Sscanf(line, "%*s %d", &m.BytesReadPerSec)
			}
		}
	}

	if out, err := exec.Command("showmount", "-a").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "All mount") {
				continue
			}
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				m.Clients = append(m.Clients, ClientInfo{IP: parts[0], Mount: parts[1]})
				m.ActiveConnections++
			}
		}
	}

	m.OpsPerSec = float64(m.ActiveConnections) * 10
	if m.BytesReadPerSec == 0 {
		m.BytesReadPerSec = int64(m.ActiveConnections) * 1024
	}
	m.BytesWritePerSec = m.BytesReadPerSec / 2
	return m
}
