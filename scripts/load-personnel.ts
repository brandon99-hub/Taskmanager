import XLSX from 'xlsx';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

console.log('🚀 Script starting - imports loaded successfully');

interface PersonnelData {
  'No.': string;
  'First Name': string;
  'Middle Name': string;
  'Last Name': string;
  'E-Mail': string;
  'Home Phone Number': string;
  'Work Phone Number': string;
  'ID Number': string;
}

interface ProcessedUser {
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber?: string;
  idNumber?: string;
}

async function loadPersonnelData() {
  try {
    console.log('🚀 Starting personnel data import...');
    
    // Read the Excel file
    const workbook = XLSX.readFile('./Personnels.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet) as PersonnelData[];
    
    console.log(`📊 Found ${rawData.length} personnel records in Excel file`);
    
    // Process and validate data
    const processedUsers: ProcessedUser[] = [];
    
    for (const row of rawData) {
      // Skip rows without essential data
      if (!row['E-Mail'] || !row['First Name'] || !row['Last Name']) {
        console.log(`⚠️  Skipping row with missing data: ${JSON.stringify(row)}`);
        continue;
      }
      
      // Clean and process data
      const user: ProcessedUser = {
        email: row['E-Mail'].trim().toLowerCase(),
        firstName: row['First Name'].trim(),
        lastName: row['Last Name'].trim(),
        middleName: row['Middle Name']?.trim() || undefined,
        phoneNumber: row['Home Phone Number'] || row['Work Phone Number'] || undefined,
        idNumber: row['ID Number'] || undefined
      };
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user.email)) {
        console.log(`⚠️  Skipping invalid email: ${user.email}`);
        continue;
      }
      
      processedUsers.push(user);
    }
    
    console.log(`✅ Processed ${processedUsers.length} valid user records`);
    
    // Check for existing users to avoid duplicates
    const existingEmails = await db
      .select({ email: users.email })
      .from(users)
      .execute();
    
    const existingEmailSet = new Set(existingEmails.map(u => u.email.toLowerCase()));
    const newUsers = processedUsers.filter(user => !existingEmailSet.has(user.email));
    
    console.log(`📝 Found ${newUsers.length} new users to add`);
    
    if (newUsers.length === 0) {
      console.log('✨ No new users to add. All personnel already exist in the system.');
      return;
    }
    
    // Generate default password for all users (they can change it later)
    const defaultPassword = 'Welcome@2024'; // You can change this default password
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);
    
    // Prepare users for insertion
    const usersToInsert = newUsers.map(user => ({
      email: user.email,
      password: hashedPassword,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      idNumber: user.idNumber,
      role: 'employee', // Default role - they can be assigned specific roles in team creation
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Add any additional fields that might exist in your schema
      profileImageUrl: null,
      lastLoginAt: null,
      resetToken: null,
      resetTokenExpiry: null,
      temporaryPassword: null,
      passwordGeneratedAt: null
    }));
    
    // Insert users in batches to avoid overwhelming the database
    const batchSize = 50;
    let insertedCount = 0;
    
    for (let i = 0; i < usersToInsert.length; i += batchSize) {
      const batch = usersToInsert.slice(i, i + batchSize);
      
      try {
        await db.insert(users).values(batch).execute();
        insertedCount += batch.length;
        console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} users`);
      } catch (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        // Continue with next batch
      }
    }
    
    console.log(`🎉 Successfully imported ${insertedCount} new personnel into the system`);
    console.log(`📋 Default password for all users: ${defaultPassword}`);
    console.log(`💡 Users can now be selected in team creation modal and assigned specific roles`);
    
    // Show summary of what was imported
    console.log('\n📊 Import Summary:');
    console.log(`Total records in Excel: ${rawData.length}`);
    console.log(`Valid records: ${processedUsers.length}`);
    console.log(`New users added: ${insertedCount}`);
    console.log(`Existing users skipped: ${processedUsers.length - newUsers.length}`);
    
  } catch (error) {
    console.error('❌ Error during personnel import:', error);
    throw error;
  }
}

// Function to verify the import
async function verifyImport() {
  try {
    console.log('\n🔍 Verifying import...');
    
    const totalUsers = await db.select({ count: users.id }).from(users).execute();
    const employeeUsers = await db
      .select({ count: users.id })
      .from(users)
      .where(eq(users.role, 'employee'))
      .execute();
    
    console.log(`📊 Total users in system: ${totalUsers[0]?.count || 0}`);
    console.log(`👥 Employee users: ${employeeUsers[0]?.count || 0}`);
    
    // Show some sample users
    const sampleUsers = await db
      .select({ email: users.email, firstName: users.firstName, lastName: users.lastName, role: users.role })
      .from(users)
      .where(eq(users.role, 'employee'))
      .limit(5)
      .execute();
    
    console.log('\n👤 Sample imported users:');
    sampleUsers.forEach(user => {
      console.log(`  - ${user.firstName} ${user.lastName} (${user.email}) - ${user.role}`);
    });
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Main execution
async function main() {
  try {
    console.log('🔧 Starting main function...');
    console.log('📊 Attempting to load personnel data...');
    await loadPersonnelData();
    console.log('🔍 Attempting to verify import...');
    await verifyImport();
    console.log('\n✨ Personnel import completed successfully!');
  } catch (error) {
    console.error('\n💥 Personnel import failed:', error);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
console.log('🔧 Checking execution context...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

// Simple check - if we're running this script directly, call main
main();

export { loadPersonnelData, verifyImport };
