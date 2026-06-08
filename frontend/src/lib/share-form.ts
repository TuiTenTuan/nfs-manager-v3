export const defaultBasic = {
  path: "/srv/nfs/data",
  clients: ["*"],
  read_only: false,
  root_squash: true,
  sync: true,
  security: "sys",
};

export const defaultAdvanced = {
  subtree_check: false,
  no_subtree_check: false,
  secure_ports: true,
  insecure: false,
  wdelay: false,
  no_wdelay: false,
  anon_uid: 0,
  anon_gid: 0,
  crossmnt: false,
  nohide: false,
  mountpoint: false,
  mountpoint_path: "",
  all_squash: false,
  fsid: "",
  refer: "",
  replicas: "",
  insecure_locks: false,
  no_auth_nlm: false,
  public: false,
  webnfs: false,
  xprtsec: "",
  extra_options: "",
};

export type SquashMode = "root_squash" | "no_root_squash" | "all_squash";
export type SyncMode = "sync" | "async";
export type SubtreeMode = "default" | "subtree_check" | "no_subtree_check";
export type PortSecurity = "secure" | "insecure";
export type WriteDelay = "default" | "wdelay" | "no_wdelay";
export type Xprtsec = "" | "tls" | "mtls";

export function getSquashMode(basic: Record<string, unknown>, adv: Record<string, unknown>): SquashMode {
  if (adv.all_squash) return "all_squash";
  if (!basic.root_squash) return "no_root_squash";
  return "root_squash";
}

export function setSquashMode(mode: SquashMode): {
  basic: Partial<typeof defaultBasic>;
  advanced: Partial<typeof defaultAdvanced>;
} {
  switch (mode) {
    case "no_root_squash":
      return { basic: { root_squash: false }, advanced: { all_squash: false } };
    case "all_squash":
      return { basic: { root_squash: true }, advanced: { all_squash: true } };
    default:
      return { basic: { root_squash: true }, advanced: { all_squash: false } };
  }
}

export function getSyncMode(basic: Record<string, unknown>): SyncMode {
  return basic.sync === false ? "async" : "sync";
}

export function setSyncMode(mode: SyncMode): Partial<typeof defaultBasic> {
  return { sync: mode === "sync" };
}

export function getSubtreeMode(adv: Record<string, unknown>): SubtreeMode {
  if (adv.no_subtree_check) return "no_subtree_check";
  if (adv.subtree_check) return "subtree_check";
  return "default";
}

export function setSubtreeMode(mode: SubtreeMode): Partial<typeof defaultAdvanced> {
  switch (mode) {
    case "subtree_check":
      return { subtree_check: true, no_subtree_check: false };
    case "no_subtree_check":
      return { subtree_check: false, no_subtree_check: true };
    default:
      return { subtree_check: false, no_subtree_check: false };
  }
}

export function getPortSecurity(adv: Record<string, unknown>): PortSecurity {
  return adv.insecure ? "insecure" : "secure";
}

export function setPortSecurity(mode: PortSecurity): Partial<typeof defaultAdvanced> {
  return mode === "insecure"
    ? { secure_ports: false, insecure: true }
    : { secure_ports: true, insecure: false };
}

export function getWriteDelay(adv: Record<string, unknown>): WriteDelay {
  if (adv.wdelay) return "wdelay";
  if (adv.no_wdelay) return "no_wdelay";
  return "default";
}

export function setWriteDelay(mode: WriteDelay): Partial<typeof defaultAdvanced> {
  switch (mode) {
    case "wdelay":
      return { wdelay: true, no_wdelay: false };
    case "no_wdelay":
      return { wdelay: false, no_wdelay: true };
    default:
      return { wdelay: false, no_wdelay: false };
  }
}

export function getXprtsec(adv: Record<string, unknown>): Xprtsec {
  const v = String(adv.xprtsec || "").trim();
  if (v === "tls" || v === "mtls") return v;
  return "";
}

export type ShareFieldInfo = {
  description: string;
  options?: { label: string; description: string }[];
};

export const shareFieldInfo: Record<string, ShareFieldInfo> = {
  name: {
    description:
      "A short label for this share in the dashboard. It does not appear in the NFS export line.",
  },
  path: {
    description:
      "Absolute directory path on the NFS server that clients will mount. Must stay within your configured allowlist.",
  },
  clients: {
    description:
      "Hosts or networks allowed to mount this export. Enter comma-separated entries.",
    options: [
      { label: "*", description: "Allows any client to mount. Use only on trusted networks." },
      { label: "192.168.1.0/24", description: "CIDR subnet — all hosts in that range may mount." },
      { label: "hostname", description: "Single host by DNS name or IP address." },
    ],
  },
  enabled: {
    description: "Controls whether this share is included in active NFS exports when applied.",
    options: [
      { label: "On", description: "Share is exported to NFS clients after you save and apply." },
      { label: "Off", description: "Share stays saved but is omitted from exports until re-enabled." },
    ],
  },
  group_id: {
    description: "Optional share group for bulk enable, disable, and apply operations across related exports.",
    options: [
      { label: "None", description: "Share is managed individually, not as part of a group." },
      { label: "Named group", description: "Share joins a group so you can enable, disable, or apply many shares at once." },
    ],
  },
  read_only: {
    description: "Controls whether clients can write files on this export.",
    options: [
      { label: "Read-write", description: "Clients can read and write. Use for normal file shares." },
      { label: "Read-only", description: "Clients can read but not modify files. Use for published or backup exports." },
    ],
  },
  squash_mode: {
    description: "Controls how remote users are mapped to local identities on the server.",
    options: [
      { label: "Root squash", description: "Maps remote root to nobody (anon UID/GID). Safe default for most shares." },
      { label: "No root squash", description: "Remote root keeps root privileges on the server. Only for fully trusted admin clients." },
      { label: "All squash", description: "Maps every remote user to anon UID/GID. Use for anonymous or untrusted clients." },
    ],
  },
  sync_mode: {
    description: "Controls when the server confirms writes to clients.",
    options: [
      { label: "Sync", description: "Waits for data to reach disk before replying. Safer; slower on heavy write workloads." },
      { label: "Async", description: "Replies before data is on disk. Faster; risk of data loss if the server crashes mid-write." },
    ],
  },
  security: {
    description: "RPC security flavor used for client authentication and protection.",
    options: [
      { label: "sys", description: "Uses local UID/GID over the wire. Default for most LAN setups." },
      { label: "krb5", description: "Kerberos authentication without extra integrity or encryption on RPC payloads." },
      { label: "krb5i", description: "Kerberos with integrity checking — detects tampering but does not encrypt payloads." },
      { label: "krb5p", description: "Kerberos with privacy — encrypts RPC payloads. Strongest; requires working Kerberos." },
    ],
  },
  subtree_mode: {
    description: "Controls whether the server verifies that accessed files stay under the exported directory.",
    options: [
      { label: "Default (omit)", description: "Uses the server default subtree-check behavior." },
      { label: "Subtree check", description: "Enforces that clients cannot access files outside the exported tree via symlinks or mounts." },
      { label: "No subtree check", description: "Skips verification. Needed for some nested-mount setups; weaker security." },
    ],
  },
  port_security: {
    description: "Controls which client source ports are accepted for NFS connections.",
    options: [
      { label: "Secure", description: "Clients must use reserved ports (below 1024). Standard and more secure." },
      { label: "Insecure", description: "Allows any client port. Required for some legacy or containerized NFS clients." },
    ],
  },
  write_delay: {
    description: "Controls whether the server batches small writes before flushing to disk.",
    options: [
      { label: "Default (omit)", description: "Uses the server default write-delay behavior." },
      { label: "wdelay", description: "Batches small writes to improve throughput on many small files." },
      { label: "no_wdelay", description: "Writes immediately without batching. Better for databases or latency-sensitive apps." },
    ],
  },
  crossmnt: {
    description: "Controls how nested mount points beneath this export are exposed to clients.",
    options: [
      { label: "On", description: "Clients can traverse into submounts under this export." },
      { label: "Off", description: "Nested filesystems may be hidden or inaccessible through this export." },
    ],
  },
  nohide: {
    description: "Controls visibility of submounts that sit under this export path.",
    options: [
      { label: "On", description: "Submounts remain visible to NFS clients instead of being hidden." },
      { label: "Off", description: "Submounts may be hidden behind the parent export (default behavior)." },
    ],
  },
  mountpoint: {
    description: "Marks this export as an NFSv4 mount point in the pseudo filesystem namespace.",
    options: [
      { label: "On", description: "Export acts as an NFSv4 mount point for namespace layout." },
      { label: "Off", description: "Standard export without NFSv4 mount-point semantics." },
    ],
  },
  mountpoint_path: {
    description: "Optional alternate path shown as the NFSv4 mount point.",
    options: [
      { label: "Empty", description: "Uses the export path as the mount point." },
      { label: "Custom path", description: "Uses the given path in the NFSv4 pseudo-root instead of the export path." },
    ],
  },
  anon_uid: {
    description:
      "UID assigned to squashed remote users. Typically paired with anon GID and squash mode.",
    options: [
      { label: "0", description: "Maps squashed users to root/nobody depending on server defaults. Most common." },
      { label: "65534", description: "Maps to the nobody user on many Linux systems." },
      { label: "Custom UID", description: "Maps squashed users to a specific local account for consistent file ownership." },
    ],
  },
  anon_gid: {
    description:
      "GID assigned to squashed remote users. Should match the group you want squashed files to belong to.",
    options: [
      { label: "0", description: "Maps squashed users to root/nogroup depending on server defaults." },
      { label: "65534", description: "Maps to the nogroup group on many Linux systems." },
      { label: "Custom GID", description: "Maps squashed users to a specific local group." },
    ],
  },
  fsid: {
    description: "Filesystem identifier for NFSv4 and replication. Each export should have a unique value when required.",
    options: [
      { label: "Empty", description: "No explicit FSID; server assigns behavior based on export type." },
      { label: "Numeric ID", description: "Unique number identifying this filesystem across reboots and replicas." },
      { label: "0", description: "Marks a stable NFSv4 root export in multi-export namespaces." },
    ],
  },
  refer: {
    description: "Referral path for NFSv4 namespace redirects. Points clients to another server for part of the tree.",
  },
  replicas: {
    description: "Replica server hostname for NFSv4 referral or replication setups.",
  },
  insecure_locks: {
    description: "Controls whether lock requests are accepted without full credential verification.",
    options: [
      { label: "On", description: "Accepts locks from clients that cannot use secure locking. Reduces lock security." },
      { label: "Off", description: "Requires proper credentials for lock requests. Recommended default." },
    ],
  },
  no_auth_nlm: {
    description: "Controls RPC authentication for network lock manager (NLM) requests.",
    options: [
      { label: "On", description: "Disables RPC auth for NLM. Only for broken legacy clients; weakens lock security." },
      { label: "Off", description: "NLM requests require authentication. Recommended default." },
    ],
  },
  public: {
    description: "Controls whether this export is advertised as a public NFSv4 mount point.",
    options: [
      { label: "On", description: "Export is visible when clients browse the NFSv4 pseudo-root." },
      { label: "Off", description: "Export is not advertised as a public mount point." },
    ],
  },
  webnfs: {
    description: "Enables WebNFS URL-style access for this export.",
    options: [
      { label: "On", description: "Allows HTTP/WebNFS clients to access this export by URL." },
      { label: "Off", description: "Standard NFS access only; no WebNFS URL serving." },
    ],
  },
  xprtsec: {
    description: "Transport-layer security for RPC connections to this export.",
    options: [
      { label: "None (omit)", description: "No transport security option added to the export line." },
      { label: "tls", description: "Encrypts RPC traffic with TLS. Requires server and client TLS support." },
      { label: "mtls", description: "TLS plus mutual certificate authentication for both client and server." },
    ],
  },
  extra_options: {
    description:
      "Additional export flags not covered by the form. Use only for rare options; enter space-separated tokens.",
  },
};

export const mountFieldInfo: Record<string, ShareFieldInfo> = {
  server: {
    description:
      "Hostname or IP address of the NFS server that exports this share. Loaded from system config (NFS_SERVER_HOST) and used as the remote host in mount and fstab lines.",
  },
  mount_point: {
    description:
      "Absolute path on the client where this export will be mounted. The directory must exist before mounting.",
  },
  version: {
    description: "NFS protocol version the client should negotiate when mounting this export.",
    options: [
      { label: "3", description: "Classic NFSv3. Uses nfs fstab type; widely compatible with older clients." },
      { label: "4 / 4.0 / 4.1 / 4.2", description: "NFSv4 variants. Uses nfs4 fstab type; 4.1+ supports sessions and nconnect." },
    ],
  },
  rsize: {
    description:
      "Read buffer size in bytes for NFS transfers. Default 1048576 (1 MiB). Set to 0 to omit from the generated mount options.",
  },
  wsize: {
    description:
      "Write buffer size in bytes for NFS transfers. Default 1048576 (1 MiB). Set to 0 to omit from the generated mount options.",
  },
  timeo: {
    description:
      "RPC timeout in tenths of a second before the client retries. Default 600 (60 seconds). Lower values fail faster; higher values tolerate slow networks.",
  },
  retrans: {
    description:
      "Number of RPC retransmissions before a soft mount gives up or a hard mount keeps retrying. Default 2.",
  },
  nconnect: {
    description:
      "Number of TCP connections used for NFSv4.1+ mounts. Improves throughput on high-latency links. Set to 0 to omit from the generated mount options.",
  },
  hard: {
    description: "Controls whether the client keeps retrying I/O after the server stops responding.",
    options: [
      { label: "On (hard)", description: "Retries indefinitely until the server responds. Safer for data integrity; processes may hang if the server is down." },
      { label: "Off (soft)", description: "Returns I/O errors after retrans attempts. Avoid for writable mounts — risk of silent data loss." },
    ],
  },
  intr: {
    description: "Controls whether blocked NFS operations can be interrupted by signals.",
    options: [
      { label: "On", description: "Adds intr so users can interrupt hung mounts or I/O with Ctrl+C. Mostly relevant for NFSv3; limited on NFSv4." },
      { label: "Off", description: "Omits intr from the generated options. Default for most NFSv4 setups." },
    ],
  },
  noatime: {
    description: "Controls whether the client updates file access timestamps on read.",
    options: [
      { label: "On", description: "Adds noatime to skip access-time updates. Reduces metadata writes; good default for file shares." },
      { label: "Off", description: "Uses normal atime behavior. Needed if applications rely on access timestamps." },
    ],
  },
  extra_options: {
    description:
      "Additional client mount options appended to the generated string. Enter comma-separated tokens not covered by the form.",
  },
};

type FormBasic = typeof defaultBasic;
type FormAdvanced = typeof defaultAdvanced;

function normalizePath(path: string): string {
  const cleaned = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (cleaned.length > 1 && cleaned.endsWith("/")) return cleaned.slice(0, -1);
  return cleaned || "/";
}

export function renderExportLine(
  path: string,
  basic: Record<string, unknown>,
  advanced: Record<string, unknown>,
  configMode: "form" | "raw" = "form",
  rawExport?: string | null
): string {
  if (configMode === "raw" && rawExport?.trim()) {
    return rawExport.trim();
  }
  const opts: string[] = [];
  if (basic.read_only) opts.push("ro");
  else opts.push("rw");
  if (basic.root_squash) opts.push("root_squash");
  else opts.push("no_root_squash");
  if (basic.sync === false) opts.push("async");
  else opts.push("sync");
  const security = String(basic.security || "sys").trim();
  if (security && security !== "sys") opts.push(`sec=${security}`);
  if (advanced.all_squash) opts.push("all_squash");
  if (advanced.subtree_check) opts.push("subtree_check");
  if (advanced.no_subtree_check) opts.push("no_subtree_check");
  if (advanced.secure_ports) opts.push("secure");
  if (advanced.insecure) opts.push("insecure");
  if (advanced.wdelay) opts.push("wdelay");
  if (advanced.no_wdelay) opts.push("no_wdelay");
  if (advanced.crossmnt) opts.push("crossmnt");
  if (advanced.nohide) opts.push("nohide");
  if (advanced.mountpoint) {
    const mp = String(advanced.mountpoint_path || "").trim();
    opts.push(mp ? `mountpoint=${mp}` : "mountpoint");
  }
  if (advanced.fsid) opts.push(`fsid=${advanced.fsid}`);
  if (advanced.refer) opts.push(`refer=${advanced.refer}`);
  if (advanced.replicas) opts.push(`replicas=${advanced.replicas}`);
  if (advanced.insecure_locks) opts.push("insecure_locks");
  if (advanced.no_auth_nlm) opts.push("no_auth_nlm");
  if (advanced.public) opts.push("public");
  if (advanced.webnfs) opts.push("webnfs");
  const xprtsec = String(advanced.xprtsec || "").trim();
  if (xprtsec) opts.push(`xprtsec=${xprtsec}`);
  const anonUid = Number(advanced.anon_uid) || 0;
  const anonGid = Number(advanced.anon_gid) || 0;
  if (anonUid > 0) opts.push(`anonuid=${anonUid}`);
  if (anonGid > 0) opts.push(`anongid=${anonGid}`);
  const extra = String(advanced.extra_options || "").trim();
  if (extra) opts.push(...extra.split(/\s+/));
  const clients = Array.isArray(basic.clients) && basic.clients.length > 0
    ? (basic.clients as string[]).join(",")
    : "*";
  const exportPath = normalizePath(path || String(basic.path || ""));
  return `${exportPath} ${clients}(${opts.join(",")})`;
}

function splitExportOptions(raw: string): string[] {
  const opts: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of raw) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      if (buf.trim()) opts.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) opts.push(buf.trim());
  return opts;
}

export function parseExportLine(line: string): {
  path: string;
  basic: Partial<FormBasic>;
  advanced: Partial<FormAdvanced>;
  error?: string;
} {
  const trimmed = line.trim();
  if (!trimmed) return { path: "", basic: {}, advanced: {}, error: "Empty export line" };
  const match = trimmed.match(/^\s*(\S+)\s+(\S+)\((.*)\)\s*$/);
  if (!match) return { path: "", basic: {}, advanced: {}, error: "Invalid export line syntax" };

  const path = normalizePath(match[1]);
  const clients = match[2].split(",").map((c) => c.trim()).filter(Boolean);
  const basic: Partial<FormBasic> = {
    path,
    clients: clients.length > 0 ? clients : ["*"],
    read_only: false,
    root_squash: true,
    sync: true,
    security: "sys",
  };
  const advanced: Partial<FormAdvanced> = {
    secure_ports: true,
    all_squash: false,
  };
  const extras: string[] = [];

  for (const opt of splitExportOptions(match[3])) {
    const eq = opt.indexOf("=");
    const key = (eq >= 0 ? opt.slice(0, eq) : opt).trim();
    const val = eq >= 0 ? opt.slice(eq + 1).trim() : "";
    switch (key) {
      case "ro": basic.read_only = true; break;
      case "rw": basic.read_only = false; break;
      case "root_squash": basic.root_squash = true; advanced.all_squash = false; break;
      case "no_root_squash": basic.root_squash = false; break;
      case "all_squash": advanced.all_squash = true; basic.root_squash = true; break;
      case "sync": basic.sync = true; break;
      case "async": basic.sync = false; break;
      case "subtree_check": advanced.subtree_check = true; advanced.no_subtree_check = false; break;
      case "no_subtree_check": advanced.no_subtree_check = true; advanced.subtree_check = false; break;
      case "secure": advanced.secure_ports = true; advanced.insecure = false; break;
      case "insecure": advanced.insecure = true; advanced.secure_ports = false; break;
      case "wdelay": advanced.wdelay = true; advanced.no_wdelay = false; break;
      case "no_wdelay": advanced.no_wdelay = true; advanced.wdelay = false; break;
      case "crossmnt": advanced.crossmnt = true; break;
      case "nohide": advanced.nohide = true; break;
      case "mountpoint":
        advanced.mountpoint = true;
        if (val) advanced.mountpoint_path = val;
        break;
      case "insecure_locks": advanced.insecure_locks = true; break;
      case "no_auth_nlm": advanced.no_auth_nlm = true; break;
      case "public": advanced.public = true; break;
      case "webnfs": advanced.webnfs = true; break;
      case "anonuid": advanced.anon_uid = Number(val) || 0; break;
      case "anongid": advanced.anon_gid = Number(val) || 0; break;
      case "fsid": advanced.fsid = val; break;
      case "refer": advanced.refer = val; break;
      case "replicas": advanced.replicas = val; break;
      case "xprtsec": advanced.xprtsec = val; break;
      case "sec": basic.security = val; break;
      default:
        if (key.startsWith("sec=")) basic.security = key.slice(4);
        else extras.push(opt);
    }
  }
  if (extras.length > 0) advanced.extra_options = extras.join(" ");
  return { path, basic, advanced };
}
