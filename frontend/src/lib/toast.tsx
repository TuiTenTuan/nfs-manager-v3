"use client";

import { Copy } from "@phosphor-icons/react";
import {
  toast as sonnerToast,
  type ExternalToast,
  type ToastT,
} from "sonner";

type ToastMessage = ToastT["title"];

function toastPlainText(message: ToastMessage, data?: ExternalToast): string {
  const title = typeof message === "string" ? message : "";
  const description =
    typeof data?.description === "string" ? data.description : "";
  return [title, description].filter((part) => part.length > 0).join("\n");
}

function withCopyAction(message: ToastMessage, data?: ExternalToast): ExternalToast {
  if (data?.action) return data ?? {};

  const text = toastPlainText(message, data);
  if (!text) return data ?? {};

  return {
    ...data,
    action: {
      label: (
        <span className="inline-flex items-center justify-center" title="Copy">
          <Copy className="h-4 w-4" weight="regular" aria-hidden />
          <span className="sr-only">Copy toast content</span>
        </span>
      ),
      onClick: (event) => {
        event.preventDefault();
        void navigator.clipboard.writeText(text);
      },
    },
  };
}

function wrapToastMethod<T extends ToastMessage>(
  method: (message: T, data?: ExternalToast) => string | number,
) {
  return (message: T, data?: ExternalToast) =>
    method(message, withCopyAction(message, data));
}

export const toast = Object.assign(
  (message: ToastMessage, data?: ExternalToast) =>
    sonnerToast(message, withCopyAction(message, data)),
  {
    success: wrapToastMethod(sonnerToast.success),
    error: wrapToastMethod(sonnerToast.error),
    info: wrapToastMethod(sonnerToast.info),
    warning: wrapToastMethod(sonnerToast.warning),
    message: wrapToastMethod(sonnerToast.message),
    loading: wrapToastMethod(sonnerToast.loading),
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    dismiss: sonnerToast.dismiss,
    getHistory: sonnerToast.getHistory,
    getToasts: sonnerToast.getToasts,
  },
);
