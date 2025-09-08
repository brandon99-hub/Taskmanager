require('dotenv').config();
const xlsx = require('xlsx');
const { Pool } = require('pg');

// Database connection (local Postgres)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Helper function to convert Excel date to JavaScript Date
function excelDateToJSDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) return null;
  const excelEpoch = new Date(1900, 0, 1);
  const jsDate = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
  return jsDate;
}

// Helper function to parse duration string and add to date
function addDurationToDate(startDate, durationStr) {
  if (!startDate || !durationStr) return null;
  
  const duration = durationStr.toString().toLowerCase().trim();
  const date = new Date(startDate);
  
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

// Normalize helper
function normalizeText(value) {
  return (value || '')
    .toString()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeKey(value) {
  return normalizeText(value).toUpperCase();
}

// Helper function to create or get user by name
async function createOrGetUser(name, email = null, baseRole = 'employee') {
  if (!name || name.trim() === '') return null;
  
  // Generate email if not provided
  if (!email) {
    const cleanName = name.toLowerCase().replace(/\s+/g, '.');
    email = `${cleanName}@taskflow.com`;
  }
  
  try {
    // Check if user exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      return existingUser.rows[0];
    }
    
    // Create new user
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ') || '';
    
    const newUser = await pool.query(`
      INSERT INTO users (email, password, first_name, last_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [email, 'temp123', firstName || '', lastName || '', baseRole, true]);
    
    console.log(`Created user: ${name} (${email})`);
    return newUser.rows[0];
  } catch (error) {
    console.error(`Error creating user ${name}:`, error.message);
    return null;
  }
}

// Main import function
async function importProjects() {
  try {
    console.log('Starting project import...');
    
    // Read Project Schedule for manager mapping
    console.log('Reading Project_Schedule(1).xlsx for manager assignments...');
    const scheduleWorkbook = xlsx.readFile('Project_Schedule(1).xlsx');
    const scheduleSheet = scheduleWorkbook.Sheets[scheduleWorkbook.SheetNames[0]];
    const scheduleData = xlsx.utils.sheet_to_json(scheduleSheet, { header: 1 });
    const scheduleHeader = (scheduleData[0] || []).map(h => normalizeText(h));
    const colProject = scheduleHeader.findIndex(h => normalizeKey(h) === 'PROJECT NAME' || normalizeKey(h) === 'PROJECT');
    const colManager = scheduleHeader.findIndex(h => normalizeKey(h) === 'KEY LEAD RESPONSIBLE');
    if (colProject === -1 || colManager === -1) {
      throw new Error('Project_Schedule(1).xlsx missing required headers: "Project Name" and/or "Key Lead Responsible"');
    }
    const managerMap = new Map(); // key: PROJECT NAME (normalized) -> manager full name
    for (let i = 1; i < scheduleData.length; i++) {
      const row = scheduleData[i] || [];
      const projName = normalizeText(row[colProject]);
      const mgrName = normalizeText(row[colManager]);
      if (projName && mgrName) {
        managerMap.set(normalizeKey(projName), mgrName);
      }
    }

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
    const timelineProjects = timelineData.slice(1).filter(row => row[0] && row[1]);
    
    console.log(`Found ${timelineProjects.length} projects in timeline file`);
    
    // Fallback admin user (assumed to exist)
    const adminRes = await pool.query("SELECT * FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1");
    if (adminRes.rows.length === 0) {
      throw new Error('Admin user not found. Create an admin before import.');
    }
    const adminUser = adminRes.rows[0];

    const skippedInvalidDate = [];
    
    // Process each project
    for (const timelineRow of timelineProjects) {
      const projectName = timelineRow[0];
      const acronym = timelineRow[1];
      const contractDate = timelineRow[2];
      const duration = timelineRow[3];
      
      if (!projectName || !acronym) continue;
      
      console.log(`\nProcessing project: ${projectName} (${acronym})`);
      const scheduleKey = normalizeKey(projectName);
      const managerName = managerMap.get(scheduleKey);
      
      // Determine segment and get team members
      let segment = 'private';
      let teamMembers = [];
      
      // Check if project exists in private segment
      const privateMatch = privateData.find(row => row[0] === projectName);
      if (privateMatch) {
        segment = 'private';
        teamMembers = extractTeamMembers(privateMatch, 3); // Team members start at column D (index 3)
      } else {
        // Check academic segment
        const academicMatch = academicData.find(row => row[0] === projectName);
        if (academicMatch) {
          segment = 'academic';
          teamMembers = extractTeamMembers(academicMatch, 4); // Team members start after CATEGORY column (index 4)
        } else {
          // Check parastatal segment
          const parastatalMatch = parastatalData.find(row => row[0] === projectName);
          if (parastatalMatch) {
            segment = 'parastals';
            teamMembers = extractTeamMembers(parastatalMatch, 4); // Team members start after CATEGORY column (index 4)
          }
        }
      }
      
      // Calculate dates
      const startDate = excelDateToJSDate(contractDate);
      const endDate = addDurationToDate(startDate, duration);
      
      if (!startDate) {
        console.log(`Skipping ${projectName} - invalid contract date`);
        skippedInvalidDate.push(projectName);
        continue;
      }
      
      // Create/get project manager user (base role: manager) or fallback to admin
      const managerUser = managerName ? await createOrGetUser(managerName, null, 'manager') : adminUser;
      if (!managerUser) {
        console.log(`Skipping ${projectName} - failed to resolve manager user`);
        continue;
      }

      // Create team
      const teamName = `Team ${acronym}`;
      const team = await pool.query(`
        INSERT INTO teams (name, description, segment)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [teamName, `Team for ${projectName}`, segment]);
      
      const teamId = team.rows[0].id;
      console.log(`Created team: ${teamName} (${segment} segment)`);
      
      // Build unique member list including manager (as Project Leader)
      const seen = new Set();
      const uniqueMembers = [];
      const managerDisplay = managerName || (managerUser.firstName && managerUser.lastName ? `${managerUser.firstName} ${managerUser.lastName}` : managerUser.email);
      const managerKey = normalizeKey(managerDisplay);
      seen.add(managerKey);
      uniqueMembers.push({ name: managerDisplay, roleLabel: 'Project Leader', baseRole: 'manager' });
      for (const memberName of teamMembers) {
        if (memberName.trim()) {
          const key = normalizeKey(memberName);
          if (!seen.has(key)) {
            seen.add(key);
            uniqueMembers.push({ name: memberName, roleLabel: 'member', baseRole: 'employee' });
          }
        }
      }

      // Create team members (manager first as Project Leader)
      for (const entry of uniqueMembers) {
        const user = await createOrGetUser(entry.name, null, entry.baseRole);
        if (user) {
          await pool.query(`
            INSERT INTO team_members (team_id, user_id, role)
            VALUES ($1, $2, $3)
          `, [teamId, user.id, entry.roleLabel]);
          console.log(`  Added team member: ${entry.name} (${entry.roleLabel})`);
        }
      }
      
      // Create project
      const project = await pool.query(`
        INSERT INTO projects (name, description, client, start_date, end_date, status, segment, team_id, manager_id, progress)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        projectName,
        `Project for ${projectName}`,
        projectName, // Using project name as client for now
        startDate,
        endDate || new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000), // Default 30 days if no end date
        'planning',
        segment,
        teamId,
        managerUser.id,
        0
      ]);
      
      console.log(`Created project: ${projectName} (${startDate.toISOString().split('T')[0]} - ${endDate ? endDate.toISOString().split('T')[0] : 'TBD'})`);
    }
    
    console.log('\nProject import completed successfully!');
    if (skippedInvalidDate.length > 0) {
      console.log('Projects skipped due to invalid contract date:', skippedInvalidDate);
    }
    
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
