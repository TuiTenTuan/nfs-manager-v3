"use client";

import { useSyncExternalStore } from "react";

const AUTH_RETURN_PATH_KEY = "auth_return_path";

function subscribeAuth(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("auth-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("auth-change", onStoreChange);
  };
}

function getAccessTokenSnapshot() {
  return localStorage.getItem("access_token");
}

/** True once the client has hydrated and localStorage is readable. */
export function useAuthReady() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function useAccessToken() {
  return useSyncExternalStore(
    subscribeAuth,
    getAccessTokenSnapshot,
    () => null
  );
}

export function storeAuthReturnPath(path: string) {
  if (!path || path === "/login") return;
  sessionStorage.setItem(AUTH_RETURN_PATH_KEY, path);
}

export function getAuthReturnPath(): string {
  const fromQuery = new URLSearchParams(window.location.search).get("next");
  const fromStorage = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
  sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);

  const path = fromQuery ?? fromStorage;
  if (!path || path === "/" || path === "/login") return "/dashboard";
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  return path;
}
