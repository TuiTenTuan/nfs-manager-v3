package nfs

type Provider interface {
	Name() string
	ValidateText(text string) []ValidationError
	Apply(content string) error
	Reload() error
	SyncFromOS() (string, error)
	GetManagedExports() (string, error)
	SetManagedExports(content string) error
	CollectGlobalMetrics() Metrics
	CollectShareMetrics(shareID int, path string) Metrics
}
