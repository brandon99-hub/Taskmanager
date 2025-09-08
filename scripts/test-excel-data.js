const xlsx = require('xlsx');

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

function testExcelData() {
  console.log('Testing Excel data structure...\n');
  
  try {
    // Read timeline file
    console.log('=== TIMELINE FILE ===');
    const timelineWorkbook = xlsx.readFile('projects_timelines(1).xlsx');
    const timelineSheet = timelineWorkbook.Sheets[timelineWorkbook.SheetNames[0]];
    const timelineData = xlsx.utils.sheet_to_json(timelineSheet, { header: 1 });
    
    console.log('Timeline headers:', timelineData[0]);
    console.log('Sample timeline data:');
    timelineData.slice(1, 4).forEach((row, index) => {
      const projectName = row[0];
      const acronym = row[1];
      const contractDate = row[2];
      const duration = row[3];
      
      const startDate = excelDateToJSDate(contractDate);
      const endDate = addDurationToDate(startDate, duration);
      
      console.log(`  ${index + 1}. ${projectName} (${acronym})`);
      console.log(`     Contract: ${startDate ? startDate.toISOString().split('T')[0] : 'Invalid'}`);
      console.log(`     Duration: ${duration}`);
      console.log(`     End Date: ${endDate ? endDate.toISOString().split('T')[0] : 'Invalid'}`);
    });
    
    // Read segment files
    const segmentFiles = [
      { name: 'Private Projects.xlsx', segment: 'private', teamStartCol: 3 },
      { name: 'Academics Projects.xlsx', segment: 'academic', teamStartCol: 4 },
      { name: 'Parastatal Projects.xlsx', segment: 'parastals', teamStartCol: 4 }
    ];
    
    segmentFiles.forEach(fileInfo => {
      console.log(`\n=== ${fileInfo.name.toUpperCase()} ===`);
      const workbook = xlsx.readFile(fileInfo.name);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      console.log('Headers:', data[0]);
      console.log('Sample data:');
      data.slice(1, 3).forEach((row, index) => {
        const projectName = row[0];
        const acronym = row[1];
        const contractDate = row[2];
        const teamMembers = extractTeamMembers(row, fileInfo.teamStartCol);
        
        console.log(`  ${index + 1}. ${projectName} (${acronym})`);
        console.log(`     Contract: ${excelDateToJSDate(contractDate)?.toISOString().split('T')[0] || 'Invalid'}`);
        console.log(`     Team Members: ${teamMembers.join(', ')}`);
      });
    });
    
    // Test project matching
    console.log('\n=== PROJECT MATCHING TEST ===');
    const timelineProjects = timelineData.slice(1).filter(row => row[0] && row[1]);
    
    const privateData = xlsx.utils.sheet_to_json(xlsx.readFile('Private Projects.xlsx').Sheets[xlsx.readFile('Private Projects.xlsx').SheetNames[0]], { header: 1 });
    const academicData = xlsx.utils.sheet_to_json(xlsx.readFile('Academics Projects.xlsx').Sheets[xlsx.readFile('Academics Projects.xlsx').SheetNames[0]], { header: 1 });
    const parastatalData = xlsx.utils.sheet_to_json(xlsx.readFile('Parastatal Projects.xlsx').Sheets[xlsx.readFile('Parastatal Projects.xlsx').SheetNames[0]], { header: 1 });
    
    let matchedProjects = 0;
    let unmatchedProjects = [];
    
    timelineProjects.slice(0, 10).forEach(timelineRow => {
      const projectName = timelineRow[0];
      const acronym = timelineRow[1];
      const contractDate = timelineRow[2];
      const duration = timelineRow[3];
      
      let segment = 'unknown';
      let teamMembers = [];
      
      // Check segments
      const privateMatch = privateData.find(row => row[0] === projectName);
      if (privateMatch) {
        segment = 'private';
        teamMembers = extractTeamMembers(privateMatch, 3);
      } else {
        const academicMatch = academicData.find(row => row[0] === projectName);
        if (academicMatch) {
          segment = 'academic';
          teamMembers = extractTeamMembers(academicMatch, 4);
        } else {
          const parastatalMatch = parastatalData.find(row => row[0] === projectName);
          if (parastatalMatch) {
            segment = 'parastals';
            teamMembers = extractTeamMembers(parastatalMatch, 4);
          }
        }
      }
      
      if (segment !== 'unknown') {
        matchedProjects++;
        const startDate = excelDateToJSDate(contractDate);
        const endDate = addDurationToDate(startDate, duration);
        
        console.log(`✓ ${projectName} (${acronym}) -> ${segment} segment`);
        console.log(`  Dates: ${startDate?.toISOString().split('T')[0] || 'Invalid'} to ${endDate?.toISOString().split('T')[0] || 'Invalid'}`);
        console.log(`  Team: ${teamMembers.join(', ')}`);
      } else {
        unmatchedProjects.push(projectName);
      }
    });
    
    console.log(`\nMatching Results:`);
    console.log(`  Matched: ${matchedProjects}`);
    console.log(`  Unmatched: ${unmatchedProjects.length}`);
    if (unmatchedProjects.length > 0) {
      console.log(`  Unmatched projects: ${unmatchedProjects.join(', ')}`);
    }
    
  } catch (error) {
    console.error('Error testing Excel data:', error);
  }
}

if (require.main === module) {
  testExcelData();
}

module.exports = { testExcelData };
