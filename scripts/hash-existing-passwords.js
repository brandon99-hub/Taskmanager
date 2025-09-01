#!/usr/bin/env node

/**
 * Script to hash existing plain text passwords in the database
 * This is needed because passwords were initially stored as plain text
 * but the authentication system expects hashed passwords
 */

const bcrypt = require('bcryptjs');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, sql } = require('drizzle-orm');
require('dotenv').config();

// Define users table schema directly (matching actual database schema)
const { pgTable, varchar, timestamp, boolean } = require('drizzle-orm/pg-core');

const users = pgTable('users', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email').unique().notNull(),
  password: varchar('password').notNull(),
  firstName: varchar('first_name'),
  middleName: varchar('middle_name'),
  lastName: varchar('last_name'),
  phoneNumber: varchar('phone_number'),
  idNumber: varchar('id_number'),
  profileImageUrl: varchar('profile_image_url'),
  role: varchar('role', { length: 20 }).notNull().default('employee'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  resetToken: varchar('reset_token'),
  resetTokenExpiry: timestamp('reset_token_expiry'),
  temporaryPassword: varchar('temporary_password'),
  passwordGeneratedAt: timestamp('password_generated_at'),
  mustChangePassword: boolean('must_change_password').default(false),
  lastPasswordChange: timestamp('last_password_change'),
  isProjectManager: boolean('is_project_manager').default(false),
  isFinanceHead: boolean('is_finance_head').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Configure Neon
// neonConfig.fetchConnectionCache = true;

async function hashExistingPasswords() {
  try {
    console.log('🔐 Starting password hashing process...');
    
    // Connect to database
    const sql = postgres(process.env.DATABASE_URL);
    const db = drizzle(sql);
    
    // Get all users with plain text passwords (users who have temporaryPassword set)
    const usersWithPlainPasswords = await db
      .select()
      .from(users)
      .where(eq(users.mustChangePassword, true));
    
    console.log(`📋 Found ${usersWithPlainPasswords.length} users with temporary passwords to process`);
    
    if (usersWithPlainPasswords.length === 0) {
      console.log('✅ No users found with temporary passwords. All passwords are already hashed.');
      return;
    }
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const user of usersWithPlainPasswords) {
      try {
        // Check if password is already hashed (bcrypt hashes start with $2b$)
        if (user.password && user.password.startsWith('$2b$')) {
          console.log(`⏭️  User ${user.email} already has hashed password, skipping`);
          continue;
        }
        
        // Hash the current password (which should be the temporary password)
        const hashedPassword = await bcrypt.hash(user.password, 12);
        
        // Update the user record
        await db
          .update(users)
          .set({
            password: hashedPassword,
            updatedAt: new Date()
          })
          .where(eq(users.id, user.id));
        
        console.log(`✅ Hashed password for user: ${user.email}`);
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing user ${user.email}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully processed: ${processedCount} users`);
    console.log(`   ❌ Errors: ${errorCount} users`);
    console.log(`   📧 Users can now login with their temporary passwords`);
    console.log(`   🔒 Passwords are now properly hashed in the database`);
    
    if (errorCount === 0) {
      console.log(`\n🎉 All passwords have been successfully hashed!`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error during password hashing:', error);
    process.exit(1);
  }
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Run the script
hashExistingPasswords()
  .then(() => {
    console.log('🏁 Password hashing completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });