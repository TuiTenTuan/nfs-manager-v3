"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { userCreateSchema, type UserCreateForm } from "@/lib/schemas";
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
  const [users, setUsers] = useState<User[] | null>(null);
  const currentUsername =
    typeof window !== "undefined" ? localStorage.getItem("username") : null;

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

  const load = () =>
    api<User[] | null>("/users")
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));

  useEffect(() => { load(); }, []);

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
                  <TableCell className="text-right space-x-1">
                    {!u.disabled && u.username !== currentUsername && (
                      <Button variant="ghost" size="sm" onClick={() => onSetStatus(u.id, u.username, true)}>
                        Disable
                      </Button>
                    )}
                    {u.disabled && (
                      <Button variant="ghost" size="sm" onClick={() => onSetStatus(u.id, u.username, false)}>
                        Enable
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(u.id, u.username)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
