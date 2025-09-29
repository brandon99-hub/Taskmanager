const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Comprehensive user removal script for TaskFlow system
 * 
 * Usage:
 * 1. Single user: node scripts/remove-users.js user@example.com
 * 2. Multiple users: node scripts/remove-users.js user1@example.com user2@example.com
 * 3. Interactive mode: node scripts/remove-users.js (no arguments)
 * 
 * The script will:
 * - Remove user from all teams
 * - Remove admin roles and segment leader roles
 * - Remove notifications and preferences
 * - Remove calendar settings
 * - Update projects, modules, and subtasks (set assignments to null)
 * - Finally remove the user record
 */

async function getUserInfo(client, email) {
  try {
    const result = await client.query(`
      SELECT id, email, first_name, last_name, role, created_at 
      FROM users 
      WHERE email = $1
    `, [email]);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error(`Error fetching user info for ${email}:`, error.message);
    return null;
  }
}

async function removeUserFromSystem(client, user, options = {}) {
  const { dryRun = false, verbose = false } = options;
  
  console.log(`\n${dryRun ? '🔍 [DRY RUN]' : '🗑️'} Processing user: ${user.email}`);
  console.log(`  Name: ${user.first_name} ${user.last_name}`);
  console.log(`  Role: ${user.role}`);
  console.log(`  Created: ${user.created_at}`);
  
  const results = {
    teamMembers: 0,
    adminRoles: 0,
    segmentLeaders: 0,
    notifications: 0,
    notificationPreferences: 0,
    calendarSettings: 0,
    projectsUpdated: 0,
    modulesUpdated: 0,
    subtasksUpdated: 0,
    userRemoved: false,
    errors: []
  };
  
  // 1. Remove from team members
  try {
    const result = await client.query(`
      DELETE FROM team_members WHERE user_id = $1
    `, [user.id]);
    results.teamMembers = result.rowCount;
    if (verbose) console.log(`  ✅ Removed from ${result.rowCount} team(s)`);
  } catch (error) {
    results.errors.push(`Team members: ${error.message}`);
    if (verbose) console.log(`  ⚠️  Error removing from teams: ${error.message}`);
  }
  
  // 2. Remove admin roles
  try {
    const result = await client.query(`
      DELETE FROM admin_roles WHERE user_id = $1
    `, [user.id]);
    results.adminRoles = result.rowCount;
    if (verbose) console.log(`  ✅ Removed ${result.rowCount} admin role(s)`);
  } catch (error) {
    results.errors.push(`Admin roles: ${error.message}`);
    if (verbose) console.log(`  ⚠️  Error removing admin roles: ${error.message}`);
  }
  
  // 3. Remove segment leader roles (check if table exists)
  try {
    const result = await client.query(`
      DELETE FROM segment_leaders WHERE user_id = $1
    `, [user.id]);
    results.segmentLeaders = result.rowCount;
    if (verbose) console.log(`  ✅ Removed ${result.rowCount} segment leader role(s)`);
  } catch (error) {
    if (!error.message.includes('does not exist')) {
      results.errors.push(`Segment leaders: ${error.message}`);
      if (verbose) console.log(`  ⚠️  Error removing segment leaders: ${error.message}`);
    }
  }
  
  // 4. Remove notifications
  try {
    const result = await client.query(`
      DELETE FROM notifications WHERE user_id = $1
    `, [user.id]);
    results.notifications = result.rowCount;
    if (verbose) console.log(`  ✅ Removed ${result.rowCount} notification(s)`);
  } catch (error) {
    results.errors.push(`Notifications: ${error.message}`);
    if (verbose) console.log(`  ⚠️  Error removing notifications: ${error.message}`);
  }
  
  // 5. Remove user notification preferences
  try {
    const result = await client.query(`
      DELETE FROM user_notification_preferences WHERE user_id = $1
    `, [user.id]);
    results.notificationPreferences = result.rowCount;
    if (verbose) console.log(`  ✅ Removed ${result.rowCount} notification preference(s)`);
  } catch (error) {
    results.errors.push(`Notification preferences: ${error.message}`);
    if (verbose) console.log(`  ⚠️  Error removing notification preferences: ${error.message}`);
  }
  
  // 6. Remove calendar settings
  try {
    const result = await client.query(`
      DELETE FROM user_calendar_settings WHERE user_id = $1
    `, [user.id]);
    results.calendarSettings = result.rowCount;
    if (verbose) console.log(`  ✅ Removed ${result.rowCount} calendar setting(s)`);
  } catch (error) {
    results.errors.push(`Calendar settings: ${error.message}`);
    if (verbose) console.log(`  ⚠️  Error removing calendar settings: ${error.message}`);
  }
  
  // 7. Update projects where user is manager
  try {
    const result = await client.query(`
      UPDATE projects SET manager_id = NULL WHERE manager_id = $1
    `, [user.id]);
    results.projectsUpdated = result.rowCount;
    if (verbose) console.log(`  ✅ Updated ${result.rowCount} project(s) - removed as manager`);
  } catch (error) {
    results.errors.push(`Projects: ${error.message}`);
    if (verbose) console.log(`  ⚠️  Error updating projects: ${error.message}`);
  }
  
  // 8. Update modules assigned to user
  try {
    const result = await client.query(`
      UPDATE modules SET assigned_user_id = NULL WHERE assigned_user_id = $1
    `, [user.id]);
    results.modulesUpdated = result.rowCount;
    if (verbose) console.log(`  ✅ Updated ${result.rowCount} module(s) - removed assignment`);
  } catch (error) {
    results.errors.push(`Modules: ${error.message}`);
    if (verbose) console.log(`  ⚠️  Error updating modules: ${error.message}`);
  }
  
  // 9. Update subtasks assigned to user
  try {
    const result = await client.query(`
      UPDATE subtasks SET 
        assigned_user_id = NULL,
        assigned_dev_id = NULL,
        assigned_consultant_id = NULL
      WHERE assigned_user_id = $1 OR assigned_dev_id = $1 OR assigned_consultant_id = $1
    `, [user.id]);
    results.subtasksUpdated = result.rowCount;
    if (verbose) console.log(`  ✅ Updated ${result.rowCount} subtask(s) - removed assignments`);
  } catch (error) {
    results.errors.push(`Subtasks: ${error.message}`);
    if (verbose) console.log(`  ⚠️  Error updating subtasks: ${error.message}`);
  }
  
  // 10. Finally, remove the user (only if not dry run)
  if (!dryRun) {
    try {
      const result = await client.query(`
        DELETE FROM users WHERE id = $1
      `, [user.id]);
      
      if (result.rowCount > 0) {
        results.userRemoved = true;
        console.log(`  ✅ Successfully removed user: ${user.email}`);
      } else {
        results.errors.push('User removal failed');
        console.log(`  ❌ Failed to remove user: ${user.email}`);
      }
    } catch (error) {
      results.errors.push(`User removal: ${error.message}`);
      console.log(`  ❌ Error removing user: ${error.message}`);
    }
  } else {
    console.log(`  🔍 [DRY RUN] Would remove user: ${user.email}`);
  }
  
  return results;
}

async function removeUsers(emails, options = {}) {
  const client = await pool.connect();
  const results = [];
  
  try {
    console.log(`\n🚀 Starting user removal process...`);
    console.log(`📧 Emails to process: ${emails.join(', ')}`);
    console.log(`🔍 Dry run: ${options.dryRun ? 'YES' : 'NO'}`);
    
    for (const email of emails) {
      // Get user info
      const user = await getUserInfo(client, email);
      
      if (!user) {
        console.log(`\n❌ User not found: ${email}`);
        results.push({ email, status: 'not_found', user: null });
        continue;
      }
      
      // Remove user
      const removalResult = await removeUserFromSystem(client, user, options);
      results.push({ email, status: 'processed', user, results: removalResult });
    }
    
    // Summary
    console.log(`\n📊 REMOVAL SUMMARY:`);
    console.log(`==================`);
    
    const successful = results.filter(r => r.status === 'processed' && r.results.userRemoved);
    const notFound = results.filter(r => r.status === 'not_found');
    const failed = results.filter(r => r.status === 'processed' && !r.results.userRemoved);
    
    console.log(`✅ Successfully removed: ${successful.length} user(s)`);
    console.log(`❌ Not found: ${notFound.length} user(s)`);
    console.log(`⚠️  Failed: ${failed.length} user(s)`);
    
    if (successful.length > 0) {
      console.log(`\nSuccessfully removed:`);
      successful.forEach(r => console.log(`  - ${r.email} (${r.user.first_name} ${r.user.last_name})`));
    }
    
    if (notFound.length > 0) {
      console.log(`\nNot found:`);
      notFound.forEach(r => console.log(`  - ${r.email}`));
    }
    
    if (failed.length > 0) {
      console.log(`\nFailed:`);
      failed.forEach(r => {
        console.log(`  - ${r.email}`);
        if (r.results.errors.length > 0) {
          r.results.errors.forEach(error => console.log(`    Error: ${error}`));
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error in removal process:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

async function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
  
  try {
    console.log('\n🎯 INTERACTIVE USER REMOVAL MODE');
    console.log('================================');
    
    const emailsInput = await question('\n📧 Enter email addresses (comma-separated): ');
    const emails = emailsInput.split(',').map(email => email.trim()).filter(email => email);
    
    if (emails.length === 0) {
      console.log('❌ No emails provided. Exiting.');
      return;
    }
    
    console.log(`\n📋 You entered: ${emails.join(', ')}`);
    
    // Confirm
    const confirm = await question('\n⚠️  Are you sure you want to remove these users? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled.');
      return;
    }
    
    // Dry run option
    const dryRunInput = await question('\n🔍 Do a dry run first? (yes/no): ');
    const dryRun = dryRunInput.toLowerCase() === 'yes';
    
    if (dryRun) {
      console.log('\n🔍 Running dry run...');
      await removeUsers(emails, { dryRun: true, verbose: true });
      
      const proceed = await question('\n🚀 Proceed with actual removal? (yes/no): ');
      if (proceed.toLowerCase() === 'yes') {
        console.log('\n🚀 Proceeding with actual removal...');
        await removeUsers(emails, { dryRun: false, verbose: true });
      } else {
        console.log('❌ Operation cancelled.');
      }
    } else {
      await removeUsers(emails, { dryRun: false, verbose: true });
    }
    
  } finally {
    rl.close();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Interactive mode
    await interactiveMode();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📖 USER REMOVAL SCRIPT - TaskFlow System

Usage:
  node scripts/remove-users.js [options] [email1] [email2] ...

Options:
  --help, -h          Show this help message
  --dry-run, -d       Perform a dry run (show what would be done)
  --verbose, -v       Show detailed output
  --interactive, -i   Run in interactive mode

Examples:
  # Interactive mode (recommended for first-time use)
  node scripts/remove-users.js
  
  # Remove single user
  node scripts/remove-users.js user@example.com
  
  # Remove multiple users
  node scripts/remove-users.js user1@example.com user2@example.com
  
  # Dry run to see what would happen
  node scripts/remove-users.js --dry-run user@example.com
  
  # Verbose output
  node scripts/remove-users.js --verbose user@example.com

⚠️  WARNING: This will permanently remove users and their data from the system!
🔍 Use --dry-run first to see what will be removed.
    `);
  } else {
    // Parse options
    const options = {
      dryRun: args.includes('--dry-run') || args.includes('-d'),
      verbose: args.includes('--verbose') || args.includes('-v')
    };
    
    // Extract emails (filter out options)
    const emails = args.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
    
    if (emails.length === 0) {
      console.log('❌ No email addresses provided. Use --help for usage information.');
      return;
    }
    
    await removeUsers(emails, options);
  }
}

// Handle errors gracefully
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
