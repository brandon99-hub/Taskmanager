# Database Setup Guide

## Fresh Database Setup

Since we're starting with a fresh database, follow these steps:

### 1. Create New Database
Create a new PostgreSQL database and update your `.env` file with the new `DATABASE_URL`.

### 2. Push Schema to Database
```bash
npm run db:push
```

This will create all the necessary tables:
- `users` - User accounts and authentication
- `teams` - Project teams
- `projects` - Project information
- `project_phases` - Project phases (hardcoded: Initiation, Requirements, Development, Testing, Deployment, Closure)
- `modules` - Work items within phases
- `subtasks` - Detailed tasks within modules
- `milestones` - Billing milestones (independent of phases)
- `module_milestones` - Relationship between modules and milestones
- And other supporting tables

### 3. Create Admin User
```bash
npm run create-admin
```

This creates an admin user with:
- Email: `admin@taskflow.com`
- Password: `admin123`
- Role: `admin`

### 4. Test the Application
Start the application and test:
- Login with admin credentials
- Create a new project
- Add phases, modules, and subtasks
- Add billing milestones

## Database Structure

```
Project
├── Phases (6 hardcoded phases)
│   ├── Modules (work items)
│   │   └── Subtasks (detailed tasks)
│   └── Phase metadata (dates, status, progress)
└── Milestones (billing - independent of phases)
    └── Financial data (fees, dates, status)
```

## Key Features

- **Hardcoded Phases**: 6 standard project phases that are automatically created
- **Flexible Modules**: Add unlimited modules to each phase
- **Detailed Subtasks**: Break down modules into manageable subtasks
- **Billing Milestones**: Separate from phases for financial tracking
- **User Management**: Role-based access control
- **Team Management**: Assign projects to teams

## Troubleshooting

If you encounter issues:

1. **Check Database Connection**: Ensure `DATABASE_URL` is correct
2. **Verify Schema**: Run `npx drizzle-kit generate` to check for schema issues
3. **Reset Database**: If needed, drop all tables and run `npm run db:push` again
4. **Check Logs**: Look at server logs for specific error messages

## Next Steps

After setup:
1. Create additional users as needed
2. Set up teams and assign members
3. Create your first project with phases and modules
4. Test the complete workflow
