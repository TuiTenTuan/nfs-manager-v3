"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/toast";
import { Moon, Sun } from "@phosphor-icons/react";
import { api, getHealth, type Health } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { passwordChangeSchema, type PasswordChangeForm } from "@/lib/schemas";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { FormActions } from "@/components/forms/form-actions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [health, setHealth] = useState<Health | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { current: "", new_password: "", confirm_password: "" },
  });

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {});
  }, []);

  async function onPasswordChange(data: PasswordChangeForm) {
    try {
      await api("/users/me/password", {
        method: "POST",
        body: JSON.stringify({ password: data.current, new_password: data.new_password }),
      });
      toast.success("Password updated");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password update failed");
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="Settings" description="Appearance, API info, and account" />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>System preference on first visit, manual toggle persists</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="text-sm capitalize">{theme} mode</span>
              </div>
              <Button variant="outline" size="sm" onClick={toggle} type="button">
                Switch to {theme === "light" ? "dark" : "light"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API</CardTitle>
            <CardDescription>Connection and NFS provider from the API server</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {health ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Provider:</span>
                <Badge variant="secondary" className="capitalize">{health.provider}</Badge>
              </div>
            ) : (
              <Skeleton className="h-5 w-32" />
            )}
            <p className="text-muted-foreground font-mono text-xs break-all">
              {process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/v3"}
            </p>
            <FormField
              label="NFS server host"
              helper={
                health?.nfs_server?.trim()
                  ? "Read-only. Set NFS_SERVER_HOST in the API server environment to change."
                  : "Not configured. Set NFS_SERVER_HOST in the API server .env and restart."
              }
            >
              {health ? (
                <Input
                  value={health.nfs_server?.trim() || "—"}
                  disabled
                  readOnly
                  aria-readonly
                  className="font-mono"
                />
              ) : (
                <Skeleton className="h-9 w-full" />
              )}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onPasswordChange)} className="form-stack">
              <FormField label="Current password" required error={errors.current?.message}>
                <Input
                  type="password"
                  aria-invalid={!!errors.current}
                  minLength={PASSWORD_MIN_LENGTH}
                  {...register("current")}
                />
              </FormField>
              <FormField label="New password" required error={errors.new_password?.message}>
                <Input
                  type="password"
                  aria-invalid={!!errors.new_password}
                  minLength={PASSWORD_MIN_LENGTH}
                  {...register("new_password")}
                />
              </FormField>
              <FormField label="Confirm new password" required error={errors.confirm_password?.message}>
                <Input
                  type="password"
                  aria-invalid={!!errors.confirm_password}
                  minLength={PASSWORD_MIN_LENGTH}
                  {...register("confirm_password")}
                />
              </FormField>
              <FormActions align="start">
                <Button type="submit" disabled={isSubmitting}>Update password</Button>
              </FormActions>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
