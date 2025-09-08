# Project Import Plan - Excel to Database

## Overview
This document outlines the plan to import project data from Excel files into the TaskFlow database system.

## Data Sources
1. **projects_timelines(1).xlsx** - Master project list with contract dates and durations
2. **Private Projects.xlsx** - Private sector projects with team members
3. **Academics Projects.xlsx** - Academic institution projects with team members  
4. **Parastatal Projects.xlsx** - Government/parastatal projects with team members

## Data Structure Analysis

### Timeline File (Master List)
- **Column A:** PROJECT NAME
- **Column B:** ACRONYM  
- **Column C:** CONTRACT DATE (Excel date format)
- **Column D:** Project duration (e.g., "8 MONTHS", "3 MONTHS", "17 WEEKS")

### Segment Files (Team Members)
All segment files have similar structure:
- **Column A:** PROJECT NAME
- **Column B:** ACRONYM
- **Column C:** CONTRACT DATE
- **Column D:** CATEGORY (for Academic/Parastatal) or TEAM (for Private)
- **Column E+:** Team member names

**Team Member Extraction:**
- **Private Projects:** Team members start at Column D (after CONTRACT DATE)
- **Academic Projects:** Team members start at Column E (after CATEGORY)
- **Parastatal Projects:** Team members start at Column E (after CATEGORY)

## Import Process

### 1. Data Processing
- Read timeline file to get master project list with dates and durations
- For each project, determine segment by matching project names across segment files
- Extract team member names from appropriate columns based on segment
- Calculate project start/end dates using contract date + duration

### 2. Database Operations
- **Create Teams:** One team per project with name format "Team [ACRONYM]"
- **Create Users:** Auto-create user accounts for team members (temporary passwords)
- **Create Projects:** With calculated start/end dates and segment assignment
- **Link Teams to Segments:** Teams are assigned to their respective segments

### 3. Key Calculations
- **Start Date:** CONTRACT DATE from timeline file
- **End Date:** CONTRACT DATE + Duration from timeline file
- **Team Name:** "Team [Project Acronym]"
- **Team Members:** All names from designated columns per segment

## Expected Results

### Teams Created
- Multiple teams (one per project)
- Teams linked to appropriate segments (private/academic/parastals)
- Team members assigned without roles (to be assigned later)

### Projects Created  
- Projects with proper start/end dates
- Projects categorized by segment
- Projects linked to their respective teams

### Users Created
- User accounts for all team members
- Temporary passwords (to be changed on first login)
- Basic role assignment (employee)

## Files Created
1. **scripts/import-projects-from-excel.js** - Main import script
2. **scripts/test-excel-data.js** - Data validation script
3. **PROJECT_IMPORT_PLAN.md** - This documentation

## Commands Available
- `npm run test:excel` - Test Excel data structure and matching
- `npm run import:projects` - Run the actual import process

## Data Validation Results
✅ **Timeline file structure verified**
✅ **Segment file structures verified** 
✅ **Project matching working correctly**
✅ **Date calculations working correctly**
✅ **Team member extraction working correctly**

## Next Steps
1. Review this plan and approve
2. Run `npm run test:excel` to verify data structure
3. Run `npm run import:projects` to import data
4. Verify imported data in the application
5. Assign roles to team members as needed

## Notes
- Projects without durations will get a default 30-day duration
- Team members without existing accounts will be created with temporary passwords
- All projects will be assigned to a default admin manager initially
- Teams are properly linked to their segments from the start
