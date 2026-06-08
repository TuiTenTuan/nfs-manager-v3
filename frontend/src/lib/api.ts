import { formatApiErrorMessage } from "@/lib/api-errors";
import { getApiBase } from "@/lib/runtime-config";

export type Health = {
  status: string;
  provider: "linux" | "mock";
  nfs_server?: string;
  nfs_port?: string;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  if (res.status === 401) {
    const err = await res.json().catch(() => ({ error: "unauthorized" }));
    const message = formatApiErrorMessage(err.error || "unauthorized");
    if (path.startsWith("/auth/login")) {
      throw new Error(message || "Invalid credentials");
    }
    if (typeof window !== "undefined") {
      clearTokens();
      window.location.replace("/login");
    }
    throw new Error(message || "Session expired");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(formatApiErrorMessage(err.error || res.statusText || "Request failed"));
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export async function getHealth(): Promise<Health> {
  const res = await fetch(`${getApiBase()}/health`);
  return res.json();
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-change"));
  }
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("role");
  localStorage.removeItem("username");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-change"));
  }
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role");
}

export function isAdmin(): boolean {
  return getRole() === "admin";
}
