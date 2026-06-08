import { z } from "zod";
import {
  minLengthMessage,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  requiredMessage,
  SHARE_PATH_MAX_LENGTH,
  USER_ROLES,
  USERNAME_MAX_LENGTH,
} from "@/lib/validation";

export const loginSchema = z.object({
  username: z.string().min(1, requiredMessage("Username")),
  password: z.string().min(1, requiredMessage("Password")),
});

export const shareBasicSchema = z.object({
  name: z
    .string()
    .min(1, requiredMessage("Name"))
    .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`),
  path: z
    .string()
    .min(1, requiredMessage("Path"))
    .max(SHARE_PATH_MAX_LENGTH, `Path must be at most ${SHARE_PATH_MAX_LENGTH} characters`)
    .refine((p) => !p.includes(".."), "Path cannot contain '..'"),
  enabled: z.boolean(),
  group_id: z.number().int().positive().nullable().optional(),
  clients: z.string().min(1, "At least one client is required"),
  read_only: z.boolean(),
  root_squash: z.boolean(),
  sync: z.boolean(),
  security: z.enum(["sys", "krb5", "krb5i", "krb5p"]),
});

export const shareAdvancedSchema = z.object({
  subtree_check: z.boolean(),
  no_subtree_check: z.boolean(),
  secure_ports: z.boolean(),
  insecure: z.boolean(),
  wdelay: z.boolean(),
  no_wdelay: z.boolean(),
  anon_uid: z.coerce.number().int().min(0),
  anon_gid: z.coerce.number().int().min(0),
  crossmnt: z.boolean(),
  nohide: z.boolean(),
  mountpoint: z.boolean(),
  mountpoint_path: z.string(),
  all_squash: z.boolean(),
  fsid: z.string().max(64),
  refer: z.string().max(256),
  replicas: z.string().max(256),
  insecure_locks: z.boolean(),
  no_auth_nlm: z.boolean(),
  public: z.boolean(),
  webnfs: z.boolean(),
  xprtsec: z.enum(["", "tls", "mtls"]),
  extra_options: z.string().max(512),
});

export const rawExportSchema = z.object({
  content: z.string().min(1, "Export content cannot be empty"),
});

export const userCreateSchema = z.object({
  username: z
    .string()
    .min(1, requiredMessage("Username"))
    .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters`),
  password: z
    .string()
    .min(1, requiredMessage("Password"))
    .min(PASSWORD_MIN_LENGTH, minLengthMessage("Password", PASSWORD_MIN_LENGTH)),
  role: z.enum(USER_ROLES),
});

export const groupSchema = z.object({
  name: z
    .string()
    .min(1, requiredMessage("Name"))
    .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`),
  description: z.string().max(512),
});

export const passwordChangeSchema = z
  .object({
    current: z
      .string()
      .min(1, requiredMessage("Current password"))
      .min(PASSWORD_MIN_LENGTH, minLengthMessage("Current password", PASSWORD_MIN_LENGTH)),
    new_password: z
      .string()
      .min(1, requiredMessage("New password"))
      .min(PASSWORD_MIN_LENGTH, minLengthMessage("New password", PASSWORD_MIN_LENGTH)),
    confirm_password: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type LoginForm = z.infer<typeof loginSchema>;
export type ShareBasicForm = z.infer<typeof shareBasicSchema>;
export type UserCreateForm = z.infer<typeof userCreateSchema>;
export type GroupForm = z.infer<typeof groupSchema>;
export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

export const adminPasswordResetSchema = z
  .object({
    new_password: z
      .string()
      .min(1, requiredMessage("New password"))
      .min(PASSWORD_MIN_LENGTH, minLengthMessage("New password", PASSWORD_MIN_LENGTH)),
    confirm_password: z.string().min(1, "Please confirm the new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type AdminPasswordResetForm = z.infer<typeof adminPasswordResetSchema>;
