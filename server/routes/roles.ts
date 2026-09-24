import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { insertRoleSchema } from "../../shared/schema";
import { invalidatePermissionCache } from "../utils/permissions";
import { z } from "zod";

// Bootstrap gate: until roles/permissions have real admin-created data and users have
// been assigned roles, role/permission management itself is still gated on the legacy
// admin check (same one every other admin-only route in server/routes.ts uses). Once
// that data exists and the user signs off, the rest of the app's authorization checks
// can be cut over to requirePermission() from server/utils/permissions.ts.
async function requireBootstrapAdmin(req: any, res: any, next: any) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (['admin', 'manager'].includes(user.role)) {
    return next();
  }
  try {
    const dashboardRole = await storage.getUserDashboardRole(user.id);
    if (!!dashboardRole.assignedSegment) {
      return next();
    }
  } catch (error) {
    console.error('Error checking admin privileges for role management:', error);
  }
  return res.status(403).json({ message: 'Forbidden' });
}

const setRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string()),
});

const assignUserRoleSchema = z.object({
  roleId: z.string().nullable(),
});

export function registerRoleRoutes(app: Express) {
  app.get('/api/roles', isAuthenticated, requireBootstrapAdmin, async (_req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ message: 'Failed to fetch roles' });
    }
  });

  app.post('/api/roles', isAuthenticated, requireBootstrapAdmin, async (req, res) => {
    try {
      const data = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(data);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid role data', errors: error.errors });
      }
      console.error('Error creating role:', error);
      res.status(500).json({ message: 'Failed to create role' });
    }
  });

  app.put('/api/roles/:id', isAuthenticated, requireBootstrapAdmin, async (req, res) => {
    try {
      const data = insertRoleSchema.partial().parse(req.body);
      const role = await storage.updateRole(req.params.id, data);
      invalidatePermissionCache(req.params.id);
      res.json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid role data', errors: error.errors });
      }
      console.error('Error updating role:', error);
      res.status(500).json({ message: 'Failed to update role' });
    }
  });

  app.delete('/api/roles/:id', isAuthenticated, requireBootstrapAdmin, async (req, res) => {
    try {
      await storage.deleteRole(req.params.id);
      invalidatePermissionCache(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      res.status(400).json({ message: error?.message || 'Failed to delete role' });
    }
  });

  app.get('/api/permissions', isAuthenticated, requireBootstrapAdmin, async (_req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  });

  app.get('/api/roles/:id/permissions', isAuthenticated, requireBootstrapAdmin, async (req, res) => {
    try {
      const permissionIds = await storage.getRolePermissionIds(req.params.id);
      res.json(permissionIds);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      res.status(500).json({ message: 'Failed to fetch role permissions' });
    }
  });

  app.put('/api/roles/:id/permissions', isAuthenticated, requireBootstrapAdmin, async (req, res) => {
    try {
      const { permissionIds } = setRolePermissionsSchema.parse(req.body);
      await storage.setRolePermissions(req.params.id, permissionIds);
      invalidatePermissionCache(req.params.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request', errors: error.errors });
      }
      console.error('Error setting role permissions:', error);
      res.status(500).json({ message: 'Failed to set role permissions' });
    }
  });

  app.put('/api/users/:id/role', isAuthenticated, requireBootstrapAdmin, async (req, res) => {
    try {
      const { roleId } = assignUserRoleSchema.parse(req.body);
      const user = await storage.assignUserRole(req.params.id, roleId);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request', errors: error.errors });
      }
      console.error('Error assigning user role:', error);
      res.status(500).json({ message: 'Failed to assign user role' });
    }
  });
}
