"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/toast";
import { api, isAdmin } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import {
  adminPasswordResetSchema,
  userCreateSchema,
  type AdminPasswordResetForm,
  type UserCreateForm,
} from "@/lib/schemas";
import { PASSWORD_MIN_LENGTH, USERNAME_MAX_LENGTH } from "@/lib/validation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { FormActions } from "@/components/forms/form-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInteger } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type User = { id: number; username: string; role: string; disabled: boolean };

export default function UsersPage() {
  const confirm = useConfirm();
  const admin = isAdmin();
  const [users, setUsers] = useState<User[] | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUsername(localStorage.getItem("username"));
    const onAuthChange = () => setCurrentUsername(localStorage.getItem("username"));
    window.addEventListener("auth-change", onAuthChange);
    return () => window.removeEventListener("auth-change", onAuthChange);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateForm>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { username: "", password: "", role: "viewer" },
  });

  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    reset: resetPasswordForm,
    formState: { errors: resetErrors, isSubmitting: resetSubmitting },
  } = useForm<AdminPasswordResetForm>({
    resolver: zodResolver(adminPasswordResetSchema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const load = () =>
    api<User[] | null>("/users")
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));

  useEffect(() => { load(); }, []);

  function openPasswordReset(user: User) {
    resetPasswordForm({ new_password: "", confirm_password: "" });
    setPasswordResetUser(user);
  }

  async function onCreate(data: UserCreateForm) {
    try {
      await api("/users", { method: "POST", body: JSON.stringify(data) });
      reset();
      toast.success("User created");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function onResetPassword(data: AdminPasswordResetForm) {
    if (!passwordResetUser) return;
    try {
      await api(`/users/${passwordResetUser.id}/password`, {
        method: "POST",
        body: JSON.stringify({ new_password: data.new_password }),
      });
      toast.success(`Password updated for ${passwordResetUser.username}`);
      setPasswordResetUser(null);
      resetPasswordForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password reset failed");
    }
  }

  async function onDelete(id: number, username: string) {
    const ok = await confirm({
      title: "Delete user?",
      description: `Permanently delete "${username}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await api(`/users/${id}`, { method: "DELETE" });
      toast.success("User deleted");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function onSetStatus(id: number, username: string, disabled: boolean) {
    const ok = await confirm(
      disabled
        ? {
            title: "Disable user?",
            description: `Disable "${username}"? They will be signed out and unable to log in.`,
            confirmLabel: "Disable",
            variant: "destructive",
          }
        : {
            title: "Enable user?",
            description: `Re-enable "${username}"? They will be able to log in again.`,
            confirmLabel: "Enable",
          }
    );
    if (!ok) return;
    try {
      await api(`/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ disabled }),
      });
      toast.success(disabled ? "User disabled" : "User enabled");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed");
    }
  }

  return (
    <div>
      <PageHeader title="Users" description="Manage admin and viewer accounts" />

      {admin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add user</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onCreate)} className="form-stack">
              <div className="form-row lg:grid-cols-[1fr_1fr_12rem]">
                <FormField label="Username" required error={errors.username?.message}>
                  <Input
                    aria-invalid={!!errors.username}
                    maxLength={USERNAME_MAX_LENGTH}
                    {...register("username")}
                  />
                </FormField>
                <FormField label="Password" required error={errors.password?.message}>
                  <Input
                    type="password"
                    aria-invalid={!!errors.password}
                    minLength={PASSWORD_MIN_LENGTH}
                    {...register("password")}
                  />
                </FormField>
                <FormField label="Role" required error={errors.role?.message}>
                  <Controller
                    control={control}
                    name="role"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-invalid={!!errors.role}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="viewer">viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
              <FormActions>
                <Button type="submit" disabled={isSubmitting}>
                  Create
                </Button>
              </FormActions>
            </form>
          </CardContent>
        </Card>
      )}

      {users === null ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{formatInteger(u.id)}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.disabled ? "destructive" : "success"}>
                      {u.disabled ? "disabled" : "active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {admin && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openPasswordReset(u)}>
                          Reset password
                        </Button>
                        {!u.disabled && u.username !== currentUsername && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSetStatus(u.id, u.username, true)}
                          >
                            Disable
                          </Button>
                        )}
                        {u.disabled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSetStatus(u.id, u.username, false)}
                          >
                            Enable
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(u.id, u.username)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!passwordResetUser}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordResetUser(null);
            resetPasswordForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordResetUser?.username}. The current password is not required.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitReset(onResetPassword)} className="space-y-4 py-2">
            <FormField label="New password" required error={resetErrors.new_password?.message}>
              <Input
                type="password"
                aria-invalid={!!resetErrors.new_password}
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
                {...registerReset("new_password")}
              />
            </FormField>
            <FormField label="Confirm new password" required error={resetErrors.confirm_password?.message}>
              <Input
                type="password"
                aria-invalid={!!resetErrors.confirm_password}
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
                {...registerReset("confirm_password")}
              />
            </FormField>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setPasswordResetUser(null);
                  resetPasswordForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={resetSubmitting}>
                Update password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
