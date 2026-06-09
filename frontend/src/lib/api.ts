import { formatApiErrorMessage } from "@/lib/api-errors";

import { getApiBase } from "@/lib/runtime-config";



export type Health = {

  status: string;

  provider: "linux" | "mock";

  nfs_server?: string;

  nfs_port?: string;

};



type RefreshResponse = {

  access_token: string;

  refresh_token: string;

  role: string;

  username: string;

};



function getToken(): string | null {

  if (typeof window === "undefined") return null;

  return localStorage.getItem("access_token");

}



function getRefreshToken(): string | null {

  if (typeof window === "undefined") return null;

  return localStorage.getItem("refresh_token");

}



function isNoRefreshPath(path: string): boolean {

  return path.startsWith("/auth/login") || path.startsWith("/auth/refresh");

}



let refreshPromise: Promise<boolean> | null = null;



async function refreshTokens(): Promise<boolean> {

  const refreshToken = getRefreshToken();

  if (!refreshToken) return false;



  try {

    const res = await fetch(`${getApiBase()}/auth/refresh`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ refresh_token: refreshToken }),

    });

    if (!res.ok) return false;



    const data = (await res.json()) as RefreshResponse;

    setTokens(data.access_token, data.refresh_token);

    if (data.role) localStorage.setItem("role", data.role);

    if (data.username) localStorage.setItem("username", data.username);

    return true;

  } catch {

    return false;

  }

}



function refreshTokensOnce(): Promise<boolean> {

  if (!refreshPromise) {

    refreshPromise = refreshTokens().finally(() => {

      refreshPromise = null;

    });

  }

  return refreshPromise;

}



function logoutAndRedirect(message: string): never {

  clearTokens();

  window.location.replace("/login");

  throw new Error(message || "Session expired");

}



async function fetchWithAuth(

  path: string,

  options: RequestInit,

  retried: boolean

): Promise<Response> {

  const headers: Record<string, string> = {

    "Content-Type": "application/json",

    ...(options.headers as Record<string, string>),

  };

  const token = getToken();

  if (token) headers.Authorization = `Bearer ${token}`;



  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });

  if (res.status !== 401 || isNoRefreshPath(path) || typeof window === "undefined") {

    return res;

  }



  if (retried) {

    const err = await res.json().catch(() => ({ error: "unauthorized" }));

    logoutAndRedirect(formatApiErrorMessage(err.error || "unauthorized"));

  }



  const refreshed = await refreshTokensOnce();

  if (!refreshed) {

    const err = await res.json().catch(() => ({ error: "unauthorized" }));

    logoutAndRedirect(formatApiErrorMessage(err.error || "unauthorized"));

  }



  return fetchWithAuth(path, options, true);

}



/** Auth-aware fetch that retries once after token refresh on 401. */

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {

  const res = await fetchWithAuth(path, options, false);

  if (res.status === 401) {

    const err = await res.json().catch(() => ({ error: "unauthorized" }));

    const message = formatApiErrorMessage(err.error || "unauthorized");

    if (path.startsWith("/auth/login")) {

      throw new Error(message || "Invalid credentials");

    }

    throw new Error(message || "Session expired");

  }

  return res;

}



export async function api<T>(

  path: string,

  options: RequestInit = {}

): Promise<T> {

  const res = await apiFetch(path, options);

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


