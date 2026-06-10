package nfs

import "time"

type ValidationError struct {
	Line    int    `json:"line"`
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
}

type ClientInfo struct {
	IP       string `json:"ip"`
	Mount    string `json:"mount"`
	Duration string `json:"duration,omitempty"`
}

type Metrics struct {
	ShareID            *int         `json:"share_id,omitempty"`
	BytesReadPerSec    int64        `json:"bytes_read_per_sec"`
	BytesWritePerSec   int64        `json:"bytes_write_per_sec"`
	BytesReadTotal     int64        `json:"bytes_read_total"`
	BytesWriteTotal    int64        `json:"bytes_write_total"`
	OpsPerSec          float64      `json:"ops_per_sec"`
	ActiveConnections  int          `json:"active_connections"`
	Clients            []ClientInfo `json:"clients"`
	Timestamp          time.Time    `json:"timestamp"`
	Provider           string       `json:"provider"`
}

type ShareForm struct {
	Path         string   `json:"path"`
	Clients      []string `json:"clients"`
	ReadOnly     bool     `json:"read_only"`
	RootSquash   bool     `json:"root_squash"`
	Sync         bool     `json:"sync"`
	Security     string   `json:"security"`
}

type ShareAdvanced struct {
	SubtreeCheck    bool   `json:"subtree_check"`
	NoSubtreeCheck  bool   `json:"no_subtree_check"`
	SecurePorts     bool   `json:"secure_ports"`
	Insecure        bool   `json:"insecure"`
	Wdelay          bool   `json:"wdelay"`
	NoWdelay        bool   `json:"no_wdelay"`
	AnonUID         int    `json:"anon_uid"`
	AnonGID         int    `json:"anon_gid"`
	Crossmnt        bool   `json:"crossmnt"`
	Nohide          bool   `json:"nohide"`
	Mountpoint      bool   `json:"mountpoint"`
	MountpointPath  string `json:"mountpoint_path"`
	AllSquash       bool   `json:"all_squash"`
	Fsid            string `json:"fsid"`
	Refer           string `json:"refer"`
	Replicas        string `json:"replicas"`
	InsecureLocks   bool   `json:"insecure_locks"`
	NoAuthNlm       bool   `json:"no_auth_nlm"`
	Public          bool   `json:"public"`
	Webnfs          bool   `json:"webnfs"`
	Xprtsec         string `json:"xprtsec"`
	ExtraOptions    string `json:"extra_options"`
}
