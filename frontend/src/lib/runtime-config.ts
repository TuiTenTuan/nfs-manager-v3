export function getApiBase(): string {
  if (typeof window !== "undefined" && window.__RUNTIME_CONFIG__?.apiBase) {
    return window.__RUNTIME_CONFIG__.apiBase;
  }
  return process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/v3";
}
