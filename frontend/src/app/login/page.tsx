"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { HardDrives } from "@phosphor-icons/react";
import { api, setTokens } from "@/lib/api";
import { getAuthReturnPath, useAccessToken, useAuthReady } from "@/lib/auth";
import { loginSchema, type LoginForm } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { FormActions } from "@/components/forms/form-actions";

export default function LoginPage() {
  const router = useRouter();
  const authReady = useAuthReady();
  const accessToken = useAccessToken();
  const [loginError, setLoginError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "admin", password: "" },
  });

  useEffect(() => {
    if (!authReady || !accessToken) return;
    router.replace(getAuthReturnPath());
  }, [accessToken, authReady, router]);

  async function onSubmit(data: LoginForm) {
    setLoginError("");
    try {
      const res = await api<{
        access_token: string;
        refresh_token: string;
        role: string;
        username: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setTokens(res.access_token, res.refresh_token);
      localStorage.setItem("role", res.role);
      localStorage.setItem("username", res.username);
      toast.success("Signed in");
      router.push(getAuthReturnPath());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setLoginError(message);
      toast.error(message);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <HardDrives className="h-5 w-5 text-primary" weight="fill" />
          </div>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>NFS Manager v3 admin console</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="form-stack">
            <FormField label="Username" htmlFor="username" required error={errors.username?.message}>
              <Input id="username" autoComplete="username" aria-invalid={!!errors.username} {...register("username")} />
            </FormField>
            <FormField label="Password" htmlFor="password" required error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
            </FormField>
            {loginError && (
              <p className="text-sm text-destructive" role="alert">
                {loginError}
              </p>
            )}
            <FormActions align="start">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </FormActions>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
