import { Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { rolePermissions, permissions as permissionsTable } from '@shared/schema';
import { apiResponse } from './errorHandler';

// Short-lived in-memory cache: a role's permission set rarely changes request-to-request,
// but should reflect admin edits within seconds, not require a restart.
const CACHE_TTL_MS = 60_000;
const permissionCache = new Map<string, { keys: Set<string>; expiresAt: number }>();

export async function getRolePermissionKeys(roleId: string | null | undefined): Promise<Set<string>> {
  if (!roleId) return new Set();

  const cached = permissionCache.get(roleId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const rows = await db
    .select({ key: permissionsTable.key })
    .from(rolePermissions)
    .innerJoin(permissionsTable, eq(rolePermissions.permissionId, permissionsTable.id))
    .where(eq(rolePermissions.roleId, roleId));

  const keys = new Set(rows.map((r) => r.key));
  permissionCache.set(roleId, { keys, expiresAt: Date.now() + CACHE_TTL_MS });
  return keys;
}

// Call after any write to roles/permissions/role_permissions, or a user's roleId, so
// requests reflect the change immediately instead of waiting out the cache TTL.
export function invalidatePermissionCache(roleId?: string) {
  if (roleId) {
    permissionCache.delete(roleId);
  } else {
    permissionCache.clear();
  }
}

export async function userHasPermission(user: any, key: string): Promise<boolean> {
  if (!user) return false;
  const keys = await getRolePermissionKeys(user.roleId);
  return keys.has(key);
}

export async function userHasAnyPermission(user: any, keys: string[]): Promise<boolean> {
  if (!user) return false;
  const granted = await getRolePermissionKeys(user.roleId);
  return keys.some((key) => granted.has(key));
}

export const requirePermission = (key: string) => {
  return async (req: any, res: Response, next: NextFunction) => {
    const allowed = await userHasPermission(req.user, key);
    if (!allowed) {
      return apiResponse.error(res, 'Insufficient permissions', 403);
    }
    next();
  };
};

export const requireAnyPermission = (keys: string[]) => {
  return async (req: any, res: Response, next: NextFunction) => {
    const allowed = await userHasAnyPermission(req.user, keys);
    if (!allowed) {
      return apiResponse.error(res, 'Insufficient permissions', 403);
    }
    next();
  };
};
