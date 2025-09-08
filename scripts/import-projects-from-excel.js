require('dotenv').config();
const xlsx = require('xlsx');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq } = require('drizzle-orm');

// Import schema using dynamic import for ES modules
let schema;
async function loadSchema() {
  if (!schema) {
    const schemaModule = await import('../shared/schema.ts');
    schema = schemaModule;
  }
  return schema;
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const db = drizzle(pool, { schema });

// Helper function to convert Excel date to JavaScript Date
function excelDateToJSDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) return null;
  // Excel dates are days since 1900-01-01, but Excel incorrectly treats 1900 as a leap year
  const excelEpoch = new Date(1900, 0, 1);
  const jsDate = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
  return jsDate;
}

// Helper function to parse duration string and add to date
function addDurationToDate(startDate, durationStr) {
  if (!startDate || !durationStr) return null;
  
  const duration = durationStr.toString().toLowerCase().trim();
  const date = new Date(startDate);
  
  // Parse different duration formats
  if (duration.includes('month')) {
    const months = parseInt(duration.match(/\d+/)?.[0] || '0');
    date.setMonth(date.getMonth() + months);
  } else if (duration.includes('week')) {
    const weeks = parseInt(duration.match(/\d+/)?.[0] || '0');
    date.setDate(date.getDate() + (weeks * 7));
  } else if (duration.includes('day')) {
    const days = parseInt(duration.match(/\d+/)?.[0] || '0');
    date.setDate(date.getDate() + days);
  } else if (duration.includes('year')) {
    const years = parseInt(duration.match(/\d+/)?.[0] || '0');
    date.setFullYear(date.getFullYear() + years);
  }
  
  return date;
}

// Helper function to extract team member names from row
function extractTeamMembers(row, startColumnIndex) {
  const teamMembers = [];
  for (let i = startColumnIndex; i < row.length; i++) {
    const name = row[i];
    if (name && name.toString().trim() !== '') {
      teamMembers.push(name.toString().trim());
    }
  }
  return teamMembers;
}

// Helper function to create or get user by name
async function createOrGetUser(name, email = null, db, schemaModule) {
  if (!name || name.trim() === '') return null;
  
  // Generate email if not provided
  if (!email) {
    const cleanName = name.toLowerCase().replace(/\s+/g, '.');
    email = `${cleanName}@taskflow.com`;
  }
  
  try {
    // Check if user exists
    const existingUser = await db.select().from(schemaModule.users).where(eq(schemaModule.users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      return existingUser[0];
    }
    
    // Create new user
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ') || '';
    
    const newUser = await db.insert(schemaModule.users).values({
      email,
      password: 'temp123', // Temporary password, should be changed
      firstName: firstName || '',
      lastName: lastName || '',
      role: 'employee',
      isActive: true
    }).returning();
    
    console.log(`Created user: ${name} (${email})`);
    return newUser[0];
  } catch (error) {
    console.error(`Error creating user ${name}:`, error.message);
    return null;
  }
}

// Main import function
async function importProjects() {
  try {
    console.log('Starting project import...');
    
    // Load schema first
    const schemaModule = await loadSchema();
    const db = drizzle(pool, { schema: schemaModule });
    
    // Read the timeline file first (master project list)
    console.log('Reading projects_timelines(1).xlsx...');
    const timelineWorkbook = xlsx.readFile('projects_timelines(1).xlsx');
    const timelineSheet = timelineWorkbook.Sheets[timelineWorkbook.SheetNames[0]];
    const timelineData = xlsx.utils.sheet_to_json(timelineSheet, { header: 1 });
    
    // Read segment files
    console.log('Reading segment files...');
    const privateWorkbook = xlsx.readFile('Private Projects.xlsx');
    const privateSheet = privateWorkbook.Sheets[privateWorkbook.SheetNames[0]];
    const privateData = xlsx.utils.sheet_to_json(privateSheet, { header: 1 });
    
    const academicWorkbook = xlsx.readFile('Academics Projects.xlsx');
    const academicSheet = academicWorkbook.Sheets[academicWorkbook.SheetNames[0]];
    const academicData = xlsx.utils.sheet_to_json(academicSheet, { header: 1 });
    
    const parastatalWorkbook = xlsx.readFile('Parastatal Projects.xlsx');
    const parastatalSheet = parastatalWorkbook.Sheets[parastatalWorkbook.SheetNames[0]];
    const parastatalData = xlsx.utils.sheet_to_json(parastatalSheet, { header: 1 });
    
    // Process timeline data (skip header row)
    // Note: Timeline file has headers in different order: PROJECT NAME, ACRONYM, CONTRACT DATE, DURATION
    const timelineProjects = timelineData.slice(1).filter(row => row[0] && row[1]); // Filter out empty rows
    
    console.log(`Found ${timelineProjects.length} projects in timeline file`);
    
    // Get a default manager (create admin if not exists)
    let defaultManager = await db.select().from(schemaModule.users).where(eq(schemaModule.users.role, 'admin')).limit(1);
    if (defaultManager.length === 0) {
      // Create default admin
      const adminUser = await db.insert(schemaModule.users).values({
        email: 'admin@taskflow.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true
      }).returning();
      defaultManager = adminUser;
    }
    
    const managerId = defaultManager[0].id;
    
    // Process each project
    for (const timelineRow of timelineProjects) {
      const projectName = timelineRow[0];
      const acronym = timelineRow[1];
      const contractDate = timelineRow[2];
      const duration = timelineRow[3];
      
      if (!projectName || !acronym) continue;
      
      console.log(`\nProcessing project: ${projectName} (${acronym})`);
      
      // Determine segment and get team members
      let segment = 'private';
      let teamMembers = [];
      let segmentData = privateData;
      
      // Check if project exists in private segment
      const privateMatch = privateData.find(row => row[0] === projectName);
      if (privateMatch) {
        segment = 'private';
        teamMembers = extractTeamMembers(privateMatch, 3); // Team members start at column D (index 3)
        segmentData = privateData;
      } else {
        // Check academic segment
        const academicMatch = academicData.find(row => row[0] === projectName);
        if (academicMatch) {
          segment = 'academic';
          teamMembers = extractTeamMembers(academicMatch, 4); // Team members start after CATEGORY column (index 4)
          segmentData = academicData;
        } else {
          // Check parastatal segment
          const parastatalMatch = parastatalData.find(row => row[0] === projectName);
          if (parastatalMatch) {
            segment = 'parastals';
            teamMembers = extractTeamMembers(parastatalMatch, 4); // Team members start after CATEGORY column (index 4)
            segmentData = parastatalData;
          }
        }
      }
      
      // Calculate dates
      const startDate = excelDateToJSDate(contractDate);
      const endDate = addDurationToDate(startDate, duration);
      
      if (!startDate) {
        console.log(`Skipping ${projectName} - invalid contract date`);
        continue;
      }
      
      // Create team
      const teamName = `Team ${acronym}`;
      const team = await db.insert(schemaModule.teams).values({
        name: teamName,
        description: `Team for ${projectName}`,
        segment: segment
      }).returning();
      
      const teamId = team[0].id;
      console.log(`Created team: ${teamName} (${segment} segment)`);
      
      // Create team members
      for (const memberName of teamMembers) {
        if (memberName.trim()) {
          const user = await createOrGetUser(memberName, null, db, schemaModule);
          if (user) {
            await db.insert(schemaModule.teamMembers).values({
              teamId: teamId,
              userId: user.id,
              role: 'member'
            });
            console.log(`  Added team member: ${memberName}`);
          }
        }
      }
      
      // Create project
      const project = await db.insert(schemaModule.projects).values({
        name: projectName,
        description: `Project for ${projectName}`,
        client: projectName, // Using project name as client for now
        startDate: startDate,
        endDate: endDate || new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000), // Default 30 days if no end date
        status: 'planning',
        segment: segment,
        teamId: teamId,
        managerId: managerId,
        progress: 0
      }).returning();
      
      console.log(`Created project: ${projectName} (${startDate.toISOString().split('T')[0]} - ${endDate ? endDate.toISOString().split('T')[0] : 'TBD'})`);
    }
    
    console.log('\nProject import completed successfully!');
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    await pool.end();
  }
}

// Run the import
if (require.main === module) {
  importProjects();
}

module.exports = { importProjects };
