package nfs

import (
	"fmt"
	"strconv"
	"strings"
)

type ParsedExport struct {
	Path    string
	Basic   ShareForm
	Advanced ShareAdvanced
}

func ParseFormLine(line string) (ParsedExport, error) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return ParsedExport{}, fmt.Errorf("empty export line")
	}
	m := exportLineRe.FindStringSubmatch(trimmed)
	if m == nil {
		return ParsedExport{}, fmt.Errorf("invalid export line syntax")
	}

	path := CleanExportPath(m[1])
	rest := strings.TrimSpace(m[2])
	paren := strings.Index(rest, "(")
	if paren < 0 {
		return ParsedExport{}, fmt.Errorf("missing export options")
	}
	clientsRaw := strings.TrimSpace(rest[:paren])
	optsRaw := strings.TrimSuffix(strings.TrimSpace(rest[paren+1:]), ")")

	basic := ShareForm{
		Path:       path,
		Clients:    splitClients(clientsRaw),
		ReadOnly:   false,
		RootSquash: true,
		Sync:       true,
		Security:   "sys",
	}
	adv := ShareAdvanced{
		SecurePorts: true,
	}

	for _, opt := range splitOptions(optsRaw) {
		key, val := splitOption(opt)
		switch key {
		case "ro":
			basic.ReadOnly = true
		case "rw":
			basic.ReadOnly = false
		case "root_squash":
			basic.RootSquash = true
			adv.AllSquash = false
		case "no_root_squash":
			basic.RootSquash = false
		case "all_squash":
			adv.AllSquash = true
			basic.RootSquash = true
		case "sync":
			basic.Sync = true
		case "async":
			basic.Sync = false
		case "subtree_check":
			adv.SubtreeCheck = true
			adv.NoSubtreeCheck = false
		case "no_subtree_check":
			adv.NoSubtreeCheck = true
			adv.SubtreeCheck = false
		case "secure":
			adv.SecurePorts = true
			adv.Insecure = false
		case "insecure":
			adv.Insecure = true
			adv.SecurePorts = false
		case "wdelay":
			adv.Wdelay = true
			adv.NoWdelay = false
		case "no_wdelay":
			adv.NoWdelay = true
			adv.Wdelay = false
		case "crossmnt":
			adv.Crossmnt = true
		case "nohide":
			adv.Nohide = true
		case "mountpoint":
			adv.Mountpoint = true
		case "insecure_locks":
			adv.InsecureLocks = true
		case "no_auth_nlm":
			adv.NoAuthNlm = true
		case "public":
			adv.Public = true
		case "webnfs":
			adv.Webnfs = true
		default:
			if strings.HasPrefix(key, "sec=") {
				basic.Security = strings.TrimPrefix(key, "sec=")
			} else if strings.HasPrefix(key, "anonuid=") {
				if n, err := strconv.Atoi(strings.TrimPrefix(key, "anonuid=")); err == nil {
					adv.AnonUID = n
				}
			} else if strings.HasPrefix(key, "anongid=") {
				if n, err := strconv.Atoi(strings.TrimPrefix(key, "anongid=")); err == nil {
					adv.AnonGID = n
				}
			} else if strings.HasPrefix(key, "fsid=") {
				adv.Fsid = strings.TrimPrefix(key, "fsid=")
			} else if strings.HasPrefix(key, "refer=") {
				adv.Refer = strings.TrimPrefix(key, "refer=")
			} else if strings.HasPrefix(key, "replicas=") {
				adv.Replicas = strings.TrimPrefix(key, "replicas=")
			} else if strings.HasPrefix(key, "xprtsec=") {
				adv.Xprtsec = strings.TrimPrefix(key, "xprtsec=")
			} else if key == "mountpoint" && val != "" {
				adv.Mountpoint = true
				adv.MountpointPath = val
			} else if val != "" {
				switch key {
				case "mountpoint":
					adv.Mountpoint = true
					adv.MountpointPath = val
				case "anonuid":
					if n, err := strconv.Atoi(val); err == nil {
						adv.AnonUID = n
					}
				case "anongid":
					if n, err := strconv.Atoi(val); err == nil {
						adv.AnonGID = n
					}
				case "fsid":
					adv.Fsid = val
				case "refer":
					adv.Refer = val
				case "replicas":
					adv.Replicas = val
				case "xprtsec":
					adv.Xprtsec = val
				case "sec":
					basic.Security = val
				default:
					if adv.ExtraOptions != "" {
						adv.ExtraOptions += " "
					}
					if val != "" {
						adv.ExtraOptions += key + "=" + val
					} else {
						adv.ExtraOptions += key
					}
				}
			} else {
				if adv.ExtraOptions != "" {
					adv.ExtraOptions += " "
				}
				adv.ExtraOptions += key
			}
		}
	}

	return ParsedExport{Path: path, Basic: basic, Advanced: adv}, nil
}

func splitClients(raw string) []string {
	if raw == "" {
		return []string{"*"}
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
}

func splitOptions(raw string) []string {
	var opts []string
	var b strings.Builder
	depth := 0
	for _, ch := range raw {
		switch ch {
		case '(':
			depth++
			b.WriteRune(ch)
		case ')':
			depth--
			b.WriteRune(ch)
		case ',':
			if depth == 0 {
				opts = append(opts, strings.TrimSpace(b.String()))
				b.Reset()
				continue
			}
			b.WriteRune(ch)
		default:
			b.WriteRune(ch)
		}
	}
	if s := strings.TrimSpace(b.String()); s != "" {
		opts = append(opts, s)
	}
	return opts
}

func splitOption(opt string) (string, string) {
	opt = strings.TrimSpace(opt)
	if i := strings.Index(opt, "="); i >= 0 {
		return strings.TrimSpace(opt[:i]), strings.TrimSpace(opt[i+1:])
	}
	return opt, ""
}
