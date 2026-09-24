const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// Seed permission catalog for the dynamic RBAC system. This list is derived directly from
// the requirePermission()/userHasPermission() call sites actually implemented in
// server/routes.ts, server/routes/tickets.ts and server/routes/roles.ts (roles.manage is
// reserved for when roles.ts itself is cut over from its bootstrap-admin gate, which hasn't
// happened yet - keep it here so that flip has something to grant). Run this once you're
// ready: every one of these checks currently rejects everyone until this seed runs, since
// no role has any permissions yet.
const PERMISSIONS = [
  { key: 'projects.create', label: 'Create projects', category: 'Projects' },
  { key: 'projects.edit', label: 'Edit projects (details, billing items/milestones, charter)', category: 'Projects' },
  { key: 'projects.terminate', label: 'Terminate projects', category: 'Projects' },
  { key: 'companies.manage', label: 'Create & edit companies', category: 'Companies' },
  { key: 'segments.manage', label: 'Create, edit & delete segments and segment leaders', category: 'Segments' },
  { key: 'service_categories.manage', label: 'Create, edit & delete service categories', category: 'Tickets' },
  { key: 'tickets.view_all', label: 'View all tickets (not just your own/assigned)', category: 'Tickets' },
  { key: 'tickets.manage', label: "Assign tickets and change any ticket's status", category: 'Tickets' },
  { key: 'teams.manage', label: 'Create & edit teams', category: 'Users' },
  { key: 'users.manage', label: 'Manage employees & admin-role assignments', category: 'Users' },
  { key: 'roles.manage', label: 'Manage roles & permissions', category: 'Users' },
  { key: 'contracts.manage', label: 'View, create & edit contracts', category: 'Admin' },
  { key: 'reports.view', label: 'View reports & dashboards (best-team, project performance, risk & quality)', category: 'Reports' },
  { key: 'reports.manage', label: 'Recalculate monthly targets, trigger finance-deadline notifications', category: 'Reports' },
  { key: 'executive_dashboard.view', label: 'View the Executive Dashboard', category: 'Reports' },
  { key: 'system_logs.view', label: 'View system logs', category: 'Admin' },
  { key: 'system.manage', label: 'Trigger automation & manual notification checks', category: 'Admin' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const perm of PERMISSIONS) {
      await client.query(
        `INSERT INTO permissions (key, label, category)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category`,
        [perm.key, perm.label, perm.category]
      );
    }
    console.log(`Seeded ${PERMISSIONS.length} permissions`);

    const adminRole = await client.query(
      `INSERT INTO roles (name, description, is_system)
       VALUES ('Administrator', 'Full system access. Seeded role, cannot be deleted.', true)
       ON CONFLICT (name) DO UPDATE SET is_system = true
       RETURNING id`
    );
    const adminRoleId = adminRole.rows[0].id;

    const employeeRole = await client.query(
      `INSERT INTO roles (name, description, is_system)
       VALUES ('Employee', 'Baseline access for staff. Seeded role, cannot be deleted.', true)
       ON CONFLICT (name) DO UPDATE SET is_system = true
       RETURNING id`
    );
    const employeeRoleId = employeeRole.rows[0].id;

    const allPerms = await client.query('SELECT id, key FROM permissions');
    for (const perm of allPerms.rows) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [adminRoleId, perm.id]
      );
    }
    console.log(`Granted all ${allPerms.rows.length} permissions to Administrator role`);
    console.log('Employee role seeded with no permissions by default - grant what staff need via Roles & Permissions.');

    // Migrate existing users onto the new role model based on their current legacy flags,
    // without touching the legacy `role` column (a later phase removes reliance on it).
    const adminMigration = await client.query(
      `UPDATE users
       SET role_id = $1
       WHERE role_id IS NULL
         AND (role IN ('admin', 'manager') OR is_project_manager = true OR is_finance_head = true)`,
      [adminRoleId]
    );
    console.log(`Assigned Administrator role to ${adminMigration.rowCount} existing user(s)`);

    const employeeMigration = await client.query(
      `UPDATE users SET role_id = $1 WHERE role_id IS NULL`,
      [employeeRoleId]
    );
    console.log(`Assigned Employee role to ${employeeMigration.rowCount} remaining user(s)`);

    await client.query('COMMIT');
    console.log('RBAC seed complete. Service categories are NOT seeded here by design - create them via the Service Categories admin page once you know what categories you actually want under Complaint/Enquiry.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
