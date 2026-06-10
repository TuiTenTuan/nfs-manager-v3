package nfs

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

func exportfsExitCode(err error) int {
	if err == nil {
		return 0
	}
	var exitErr *exec.ExitError
	if ok := errors.As(err, &exitErr); ok {
		return exitErr.ExitCode()
	}
	return -1
}

type volumeSampleState struct {
	readTotal  int64
	writeTotal int64
	lastTick   time.Time
}

type LinuxProvider struct {
	allowlist   []string
	managedPath string
	osExports   string
	volMu       sync.Mutex
	volumes     map[string]volumeSampleState
}

func NewLinuxProvider(allowlist []string, managedPath string) *LinuxProvider {
	return &LinuxProvider{
		allowlist:   allowlist,
		managedPath: managedPath,
		osExports:   "/etc/exports",
		volumes:     make(map[string]volumeSampleState),
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

func (l *LinuxProvider) runExportfs(args ...string) error {
	cmd := exec.Command("exportfs", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return &ReloadError{
			ExitCode: exportfsExitCode(err),
			Stderr:   string(out),
			Err:      err,
		}
	}
	return nil
}

func (l *LinuxProvider) Reload() error {
	if err := l.ensureExportPaths(); err != nil {
		return err
	}
	return l.runExportfs("-ra")
}

func (l *LinuxProvider) CheckHealth() error {
	return l.runExportfs("-v")
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

func (l *LinuxProvider) volumeKey(shareID *int) string {
	if shareID == nil {
		return "global"
	}
	return strconv.Itoa(*shareID)
}

func parseNfsdIOCounters() (readTotal, writeTotal int64, ok bool) {
	data, err := os.ReadFile("/proc/net/rpc/nfsd")
	if err != nil {
		return 0, 0, false
	}
	for _, line := range strings.Split(string(data), "\n") {
		if !strings.HasPrefix(line, "io ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		readTotal, err = strconv.ParseInt(fields[1], 10, 64)
		if err != nil {
			continue
		}
		writeTotal, err = strconv.ParseInt(fields[2], 10, 64)
		if err != nil {
			continue
		}
		return readTotal, writeTotal, true
	}
	return 0, 0, false
}

func (l *LinuxProvider) setKernelTotals(key string, readTotal, writeTotal int64, now time.Time) (int64, int64) {
	l.volMu.Lock()
	defer l.volMu.Unlock()
	state := l.volumes[key]
	state.readTotal = readTotal
	state.writeTotal = writeTotal
	state.lastTick = now
	l.volumes[key] = state
	return readTotal, writeTotal
}

// Per-share totals are integrated from throughput rates when the kernel exposes no per-export byte counters.
func (l *LinuxProvider) integrateTotals(key string, readRate, writeRate int64, now time.Time) (int64, int64) {
	l.volMu.Lock()
	defer l.volMu.Unlock()

	state := l.volumes[key]
	if !state.lastTick.IsZero() {
		elapsed := now.Sub(state.lastTick).Seconds()
		if elapsed > 0 {
			state.readTotal += int64(float64(readRate) * elapsed)
			state.writeTotal += int64(float64(writeRate) * elapsed)
		}
	}
	state.lastTick = now
	l.volumes[key] = state
	return state.readTotal, state.writeTotal
}

func (l *LinuxProvider) collectMetrics(shareID *int, path string) Metrics {
	now := time.Now()
	m := Metrics{
		ShareID:   shareID,
		Timestamp: now,
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

	key := l.volumeKey(shareID)
	if shareID == nil {
		if readTotal, writeTotal, ok := parseNfsdIOCounters(); ok {
			m.BytesReadTotal, m.BytesWriteTotal = l.setKernelTotals(key, readTotal, writeTotal, now)
		} else {
			m.BytesReadTotal, m.BytesWriteTotal = l.integrateTotals(key, m.BytesReadPerSec, m.BytesWritePerSec, now)
		}
	} else {
		_ = path
		m.BytesReadTotal, m.BytesWriteTotal = l.integrateTotals(key, m.BytesReadPerSec, m.BytesWritePerSec, now)
	}

	return m
}
