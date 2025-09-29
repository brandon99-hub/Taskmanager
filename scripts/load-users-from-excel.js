const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
require('dotenv').config();

// Check if we're in the right directory
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

// Database connection
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const db = drizzle(pool);

// Email service setup
let emailTransporter;
try {
  if (process.env.EMAIL_PROVIDER === 'gmail') {
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
      console.log('✅ Gmail email service configured');
    }
  } else {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      console.log('✅ SMTP email service configured');
    }
  }
  
  if (!emailTransporter) {
    console.warn('⚠️ Email service not configured. Check your .env file for email settings.');
  }
} catch (error) {
  console.warn('❌ Email service configuration error:', error.message);
}

// Function to generate random password
function generateRandomPassword(length = 8) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Function to read Excel file and extract user data
async function readExcelFile(filePath) {
  try {
    console.log(`Reading Excel file: ${filePath}`);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    // Get the first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheets found in Excel file');
    }
    
    console.log(`Worksheet name: ${worksheet.name}`);
    console.log(`Total rows: ${worksheet.rowCount}, Total columns: ${worksheet.columnCount}`);
    
    const users = [];
    
    // Start from row 4 (skip headers, Benjamin Ndiku, and existing user)
    for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      
      // Get values from columns A (Full name) and C (Email)
      const fullName = row.getCell(1).value; // Column A
      const email = row.getCell(3).value;    // Column C
      
      // Skip empty rows
      if (!fullName && !email) {
        continue;
      }
      
      // Validate that we have both name and email
      if (!fullName || !email) {
        console.log(`⚠️ Skipping row ${rowNumber}: Missing name or email (Name: ${fullName}, Email: ${email})`);
        continue;
      }
      
      // Convert to string and clean up
      const cleanName = String(fullName).trim();
      const cleanEmail = String(email).trim();
      
      // Basic email validation
      if (!cleanEmail.includes('@')) {
        console.log(`⚠️ Skipping row ${rowNumber}: Invalid email format (${cleanEmail})`);
        continue;
      }
      
      users.push({
        name: cleanName,
        email: cleanEmail
      });
      
      console.log(`📝 Found user: ${cleanName} (${cleanEmail})`);
    }
    
    console.log(`\n✅ Successfully parsed ${users.length} users from Excel file`);
    return users;
    
  } catch (error) {
    console.error('Error reading Excel file:', error);
    throw error;
  }
}

// Function to create user and send credentials
async function createUserAndSendCredentials(userData, assignedBy = 'system') {
  try {
    console.log(`Creating user: ${userData.email}`);
    
    // Check if user already exists
    const existingUser = await db.execute(`
      SELECT id, email, first_name, last_name, role 
      FROM users 
      WHERE email = '${userData.email.replace(/'/g, "''")}'
    `);
    
    if (existingUser.rows.length > 0) {
      console.log(`⚠️ User already exists: ${userData.email} - Skipping creation`);
      
      // Still send email with a new temporary password for existing users
      const temporaryPassword = generateRandomPassword(8);
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
      
      // Update the existing user with new temporary password and hashed password
      await db.execute(`
        UPDATE users 
        SET temporary_password = '${temporaryPassword}',
            password = '${hashedPassword}',
            password_generated_at = '${new Date().toISOString()}',
            must_change_password = true,
            updated_at = '${new Date().toISOString()}'
        WHERE email = '${userData.email.replace(/'/g, "''")}'
      `);
      
      console.log(`🔄 Updated temporary password for existing user: ${userData.email}`);
      
      // Send credentials email
      const loginUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
      const emailSent = await sendCredentialsEmail({
        to: userData.email,
        userName: existingUser.rows[0].first_name || userData.email,
        temporaryPassword: temporaryPassword,
        loginUrl: `${loginUrl}/login`
      });
      
      if (emailSent) {
        console.log(`✅ Credentials email sent to existing user: ${userData.email}`);
      } else {
        console.log(`⚠️ Failed to send credentials email to: ${userData.email}`);
      }
      
      return { user: existingUser.rows[0], temporaryPassword, emailSent };
    }
    
    // Parse the full name into first and last name
    const nameParts = userData.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Generate temporary password
    const temporaryPassword = generateRandomPassword(8);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    
    // Create user in database
    const now = new Date().toISOString();
    const result = await db.execute(`
      INSERT INTO users (
        email, 
        password, 
        first_name, 
        last_name, 
        role, 
        temporary_password, 
        password_generated_at, 
        must_change_password, 
        created_at, 
        updated_at
      ) VALUES (
        '${userData.email.replace(/'/g, "''")}', 
        '${hashedPassword}', 
        '${firstName.replace(/'/g, "''")}', 
        '${lastName.replace(/'/g, "''")}', 
        'employee', 
        '${temporaryPassword}', 
        '${now}', 
        true, 
        '${now}', 
        '${now}'
      )
      RETURNING id, email, first_name, last_name, role
    `);
    
    const user = result.rows[0];
    console.log(`User created successfully: ${user.email}`);
    
    // Send credentials email
    const loginUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
    const emailSent = await sendCredentialsEmail({
      to: user.email,
      userName: user.first_name || user.email,
      temporaryPassword: temporaryPassword,
      loginUrl: `${loginUrl}/login`
    });
    
    if (emailSent) {
      console.log(`✅ Credentials email sent to: ${user.email}`);
    } else {
      console.log(`⚠️ Failed to send credentials email to: ${user.email}`);
    }
    
    return { user, temporaryPassword, emailSent };
    
  } catch (error) {
    console.error(`Error creating user ${userData.email}:`, error);
    throw error;
  }
}

// Function to send credentials email
async function sendCredentialsEmail(data) {
  if (!emailTransporter) {
    console.warn('Email service not configured. Cannot send email.');
    return false;
  }

  try {
    // Load and compile email template
    const templatePath = path.join(__dirname, '..', 'server', 'templates', 'userCredentials.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    
    // Prepare template data
    const templateData = {
      userName: data.userName || 'User',
      email: data.to,
      temporaryPassword: data.temporaryPassword,
      loginUrl: data.loginUrl,
      preferencesUrl: data.loginUrl,
      unsubscribeUrl: data.loginUrl
    };
    
    const htmlContent = template(templateData);
    
    // Send email
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'TaskFlow <noreply@taskflow.com>',
      to: data.to,
      subject: '🎉 Welcome to TaskFlow - Your Account Credentials',
      html: htmlContent,
      text: `
Hi ${data.userName}!

Welcome to TaskFlow! Your account has been created successfully.

Your login credentials:
Email: ${data.to}
Temporary Password: ${data.temporaryPassword}

Login URL: ${data.loginUrl}

IMPORTANT: You must change your password on first login for security.

Keep your credentials secure and do not share them with anyone.

Best regards,
TaskFlow Team
      `.trim()
    };

    await emailTransporter.sendMail(mailOptions);
    return true;
    
  } catch (error) {
    console.error(`Failed to send credentials email to ${data.to}:`, error);
    return false;
  }
}

// Main function to load users
async function loadUsersFromExcel() {
  try {
    console.log('🚀 Starting user import from Excel file...');
    
    const excelFilePath = path.resolve(projectRoot, 'Technicians.xlsx');
    
    // Check if file exists
    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`Excel file not found: ${excelFilePath}`);
    }
    
    console.log(`📁 Excel file found: ${excelFilePath}`);
    
    // Read users from Excel
    const users = await readExcelFile(excelFilePath);
    
    if (users.length === 0) {
      console.log('ℹ️ No users found in Excel file');
      return;
    }
    
    console.log(`📋 Found ${users.length} users to import`);
    
    // Process each user
    const results = [];
    console.log(`\n🚀 Starting to process ${users.length} users...`);
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`\n📝 Processing user ${i + 1}/${users.length}: ${user.email}`);
      
      try {
        const result = await createUserAndSendCredentials(user);
        results.push({ success: true, user: result.user, emailSent: result.emailSent });
      } catch (error) {
        console.error(`❌ Failed to process user ${user.email}:`, error.message);
        results.push({ success: false, user: user, error: error.message });
      }
      
      // Add a small delay to avoid overwhelming the email service
      if (i < users.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const emailsSent = results.filter(r => r.success && r.emailSent).length;
    const emailsFailed = results.filter(r => r.success && !r.emailSent).length;
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Successfully processed: ${successful} users`);
    console.log(`❌ Failed to process: ${failed} users`);
    console.log(`📧 Emails sent successfully: ${emailsSent}`);
    console.log(`⚠️ Emails failed to send: ${emailsFailed}`);
    
    if (failed > 0) {
      console.log('\nFailed users:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.user.email}: ${r.error}`);
      });
    }
    
    console.log('\n🎉 User import process completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during user import:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  loadUsersFromExcel()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { loadUsersFromExcel, createUserAndSendCredentials, readExcelFile };
