/**
 * Canonical validation limits.
 * Gin `binding` tags in backend handlers are authoritative for API requests;
 * DB column sizes (backend/migrations/000001_init.up.sql) apply where the API has no max.
 */

/** backend/internal/users/users.go — password fields use binding:"required,min=8" */
export const PASSWORD_MIN_LENGTH = 8;

/** users.username VARCHAR(255) */
export const USERNAME_MAX_LENGTH = 255;

/** nfs_shares.name, share_groups.name VARCHAR(255) */
export const NAME_MAX_LENGTH = 255;

/** nfs_shares.path VARCHAR(1024) */
export const SHARE_PATH_MAX_LENGTH = 1024;

/** export_templates.category VARCHAR(100) */
export const CATEGORY_MAX_LENGTH = 100;

export const USER_ROLES = ["admin", "viewer"] as const;

export function requiredMessage(label: string): string {
  return `${label} is required`;
}

export function minLengthMessage(label: string, min: number): string {
  return `${label} must be at least ${min} characters`;
}

export function maxLengthMessage(label: string, max: number): string {
  return `${label} must be at most ${max} characters`;
}
