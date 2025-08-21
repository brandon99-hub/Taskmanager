# TaskFlow Scripts

This directory contains various utility scripts for managing the TaskFlow application.

## Available Scripts

### Database Management
- `seed-data.ts` - Basic database seeding
- `comprehensive-seed.ts` - Comprehensive database seeding with sample data
- `reset-data.ts` - Reset all database data
- `migrate-schema.ts` - Database schema migration
- `migrate-team-segments.ts` - Team segment migration

### User Management
- `setup-admin.ts` - Create initial admin user
- `import-information-sheet.ts` - Import project information from Excel
- `load-personnel.ts` - **NEW** Import personnel data from Excel file

### Team Management
- `migrate-team-segments.ts` - Migrate team segments

## Personnel Import Script

The `load-personnel.ts` script allows you to import personnel data from an Excel file into the system.

### Prerequisites

1. **Excel File**: Place `Personnels.xlsx` in the project root directory
2. **File Format**: The Excel should have these columns:
   - No.
   - First Name
   - Middle Name
   - Last Name
   - E-Mail
   - Home Phone Number
   - Work Phone Number
   - ID Number

### Usage

```bash
# Run the personnel import
npm run import:personnel

# Or directly with tsx
npx tsx scripts/load-personnel.ts
```

### What It Does

1. **Reads Excel File**: Parses the Personnels.xlsx file
2. **Validates Data**: Checks for required fields and valid email formats
3. **Creates Users**: Adds new personnel as 'employee' role users
4. **Default Password**: Sets all users with password 'Welcome@2024'
5. **No Email Notifications**: Users are created silently (no welcome emails)
6. **Duplicate Prevention**: Skips users that already exist in the system

### After Import

- All users will have the 'employee' role
- They can be selected in the team creation modal
- Admins can assign specific job functions (bc dev, consultant, etc.) during team creation
- Users can change their passwords on first login

### Default Password

**Important**: All imported users will have the default password: `Welcome@2024`

Users should be instructed to change this password on their first login.

### Troubleshooting

- **File Not Found**: Ensure `Personnels.xlsx` is in the project root
- **Database Errors**: Check database connection and permissions
- **Validation Errors**: Review Excel data for missing required fields

### Example Excel Structure

| No. | First Name | Middle Name | Last Name | E-Mail | Home Phone Number | Work Phone Number | ID Number |
|-----|------------|-------------|-----------|---------|-------------------|-------------------|-----------|
| ASL-PF001 | Simon | Ouma | Okoth | sokoth@appkings.co.ke | 254712957664 | 254712957664 | 28638155 |
| ASL-PF024 | Simon | Litan | Masida | slitan@appkings.co.ke | 254740905094 | 254740905094 | 36322445 |

## Running Scripts

All scripts can be run using npm scripts or directly with tsx:

```bash
# Using npm scripts
npm run db:seed
npm run import:personnel
npm run setup:admin

# Using tsx directly
npx tsx scripts/seed-data.ts
npx tsx scripts/load-personnel.ts
npx tsx scripts/setup-admin.ts
```
