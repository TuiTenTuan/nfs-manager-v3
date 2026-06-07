package nfs

import (
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"
)

const (
	minMockThroughputBytes = 1024
	maxMockThroughputBytes = 5 * 1024 * 1024 * 1024 / 2
)

type MockProvider struct {
	allowlist []string
	mu        sync.RWMutex
	exports   string
	start     time.Time
}

func NewMockProvider(allowlist []string) *MockProvider {
	initial := `# Sample mock exports
/srv/nfs/data 192.168.1.0/24(rw,sync,root_squash)
/srv/nfs/backup 10.0.0.5(ro,sync,root_squash)
`
	return &MockProvider{
		allowlist: allowlist,
		exports:   initial,
		start:     time.Now(),
	}
}

func (m *MockProvider) Name() string { return "mock" }

func (m *MockProvider) ValidateText(text string) []ValidationError {
	errs := ValidateExportSyntax(text)
	errs = append(errs, ValidatePathsInText(text, m.allowlist)...)
	return errs
}

func (m *MockProvider) Apply(content string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.exports = content
	return nil
}

func (m *MockProvider) Reload() error { return nil }

func (m *MockProvider) SyncFromOS() (string, error) {
	return `# Imported from mock OS /etc/exports
/srv/nfs/imported *(rw,sync,root_squash)
/srv/nfs/legacy 192.168.0.10(ro,sync,root_squash)
`, nil
}

func (m *MockProvider) GetManagedExports() (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.exports == "" {
		return "# BEGIN NFS-MANAGER\n# END NFS-MANAGER\n", nil
	}
	return m.exports, nil
}

func (m *MockProvider) SetManagedExports(content string) error {
	return m.Apply(content)
}

func (m *MockProvider) CollectGlobalMetrics() Metrics {
	return m.generateMetrics(nil)
}

func (m *MockProvider) CollectShareMetrics(shareID int, path string) Metrics {
	sid := shareID
	return m.generateMetrics(&sid)
}

func (m *MockProvider) generateMetrics(shareID *int) Metrics {
	t := time.Now()
	elapsed := t.Sub(m.start).Seconds()
	wave := math.Sin(elapsed/3)*0.5 + 0.5
	r := rand.New(rand.NewSource(t.UnixNano()))

	read := randomMockThroughput(r)
	write := randomMockThroughput(r)
	ops := wave*500 + r.Float64()*200
	conns := int(wave*8) + r.Intn(3) + 1

	clients := []ClientInfo{
		{IP: "192.168.1.42", Mount: "/mnt/nfs/data", Duration: "2h15m"},
		{IP: "10.0.0.15", Mount: "/mnt/backup", Duration: "45m"},
	}
	if shareID != nil {
		clients = []ClientInfo{
			{IP: fmtIP(r), Mount: "/mnt/share", Duration: "1h30m"},
		}
	}

	return Metrics{
		ShareID:           shareID,
		BytesReadPerSec:   read,
		BytesWritePerSec:  write,
		OpsPerSec:         ops,
		ActiveConnections: conns,
		Clients:           clients,
		Timestamp:         t,
		Provider:          "mock",
	}
}

func randomMockThroughput(r *rand.Rand) int64 {
	return r.Int63n(maxMockThroughputBytes-minMockThroughputBytes+1) + minMockThroughputBytes
}

func fmtIP(r *rand.Rand) string {
	return fmt.Sprintf("192.168.%d.%d", r.Intn(254)+1, r.Intn(254)+1)
}

func NewProvider(name string, allowlist []string, managedPath string) Provider {
	switch name {
	case "linux":
		return NewLinuxProvider(allowlist, managedPath)
	default:
		return NewMockProvider(allowlist)
	}
}
