package nfs

import (
	"fmt"
	"math"
	"math/rand"
	"strconv"
	"sync"
	"time"
)

const (
	minMockThroughputBytes = 1024
	maxMockThroughputBytes = 5 * 1024 * 1024 * 1024 / 2
)

type mockVolumeState struct {
	readTotal  int64
	writeTotal int64
	lastTick   time.Time
}

type MockProvider struct {
	allowlist []string
	mu        sync.RWMutex
	exports   string
	start     time.Time
	volMu     sync.Mutex
	volumes   map[string]mockVolumeState
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
		volumes:   make(map[string]mockVolumeState),
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

func (m *MockProvider) CheckHealth() error { return nil }

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

func (m *MockProvider) volumeKey(shareID *int) string {
	if shareID == nil {
		return "global"
	}
	return strconv.Itoa(*shareID)
}

func (m *MockProvider) accumulateVolume(key string, readRate, writeRate int64, now time.Time) (readTotal, writeTotal int64) {
	m.volMu.Lock()
	defer m.volMu.Unlock()

	state := m.volumes[key]
	if !state.lastTick.IsZero() {
		elapsed := now.Sub(state.lastTick).Seconds()
		if elapsed > 0 {
			state.readTotal += int64(float64(readRate) * elapsed)
			state.writeTotal += int64(float64(writeRate) * elapsed)
		}
	}
	state.lastTick = now
	m.volumes[key] = state
	return state.readTotal, state.writeTotal
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

	readTotal, writeTotal := m.accumulateVolume(m.volumeKey(shareID), read, write, t)

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
		BytesReadTotal:    readTotal,
		BytesWriteTotal:   writeTotal,
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
