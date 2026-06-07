package nfs

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

type MountClientOptions struct {
	Server       string `json:"server"`
	MountPoint   string `json:"mount_point"`
	Version      string `json:"version"`
	Rsize        *int   `json:"rsize"`
	Wsize        *int   `json:"wsize"`
	Timeo        int    `json:"timeo"`
	Retrans      int    `json:"retrans"`
	Hard         bool   `json:"hard"`
	Intr         bool   `json:"intr"`
	Nconnect     int    `json:"nconnect"`
	Noatime      bool   `json:"noatime"`
	NFSVers      string `json:"nfsvers"`
	ExtraOptions string `json:"extra_options"`
}

type MountConfigResult struct {
	MountCommand  string `json:"mount_command"`
	FstabLine     string `json:"fstab_line"`
	OptionsString string `json:"options_string"`
}

func ApplyMountDefaults(opts *MountClientOptions) {
	if opts.Version == "" {
		opts.Version = "4.1"
	}
	if opts.NFSVers == "" {
		opts.NFSVers = opts.Version
	}
	if opts.Rsize == nil {
		v := 1048576
		opts.Rsize = &v
	}
	if opts.Wsize == nil {
		v := 1048576
		opts.Wsize = &v
	}
	if opts.Timeo == 0 {
		opts.Timeo = 600
	}
	if opts.Retrans == 0 {
		opts.Retrans = 2
	}
}

func RenderMountConfig(server, exportPath string, opts MountClientOptions) (MountConfigResult, error) {
	server = strings.TrimSpace(server)
	mountPoint := strings.TrimSpace(opts.MountPoint)
	if server == "" {
		return MountConfigResult{}, errors.New("server is required")
	}
	if mountPoint == "" {
		return MountConfigResult{}, errors.New("mount_point is required")
	}

	ApplyMountDefaults(&opts)

	var parts []string
	if v := strings.TrimSpace(opts.NFSVers); v != "" {
		parts = append(parts, "nfsvers="+v)
	}
	if opts.Rsize != nil && *opts.Rsize > 0 {
		parts = append(parts, fmt.Sprintf("rsize=%d", *opts.Rsize))
	}
	if opts.Wsize != nil && *opts.Wsize > 0 {
		parts = append(parts, fmt.Sprintf("wsize=%d", *opts.Wsize))
	}
	if opts.Timeo > 0 {
		parts = append(parts, fmt.Sprintf("timeo=%d", opts.Timeo))
	}
	if opts.Retrans > 0 {
		parts = append(parts, fmt.Sprintf("retrans=%d", opts.Retrans))
	}
	if opts.Hard {
		parts = append(parts, "hard")
	} else {
		parts = append(parts, "soft")
	}
	if opts.Intr {
		parts = append(parts, "intr")
	}
	if opts.Nconnect > 0 {
		parts = append(parts, fmt.Sprintf("nconnect=%d", opts.Nconnect))
	}
	if opts.Noatime {
		parts = append(parts, "noatime")
	}
	if extra := strings.TrimSpace(opts.ExtraOptions); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				parts = append(parts, o)
			}
		}
	}

	optsStr := strings.Join(parts, ",")
	remote := server + ":" + filepath.Clean(exportPath)
	fstabType := "nfs"
	if strings.HasPrefix(strings.TrimSpace(opts.Version), "4") {
		fstabType = "nfs4"
	}

	return MountConfigResult{
		MountCommand:  fmt.Sprintf("sudo mount -t nfs -o %s %s %s", optsStr, remote, mountPoint),
		FstabLine:     fmt.Sprintf("%s %s %s %s 0 0", remote, mountPoint, fstabType, optsStr),
		OptionsString: optsStr,
	}, nil
}
