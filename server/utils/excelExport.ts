import * as XLSX from 'xlsx';
import { WorkBook, WorkSheet, CellObject } from 'xlsx';

interface ExcelExportOptions {
  filename: string;
  data: any;
  reportType: string;
  templatePath?: string;
  templateSheetName?: string;
}

export function generateExcelBuffer(options: ExcelExportOptions): Buffer {
  const { data, reportType, templatePath, templateSheetName } = options;
  
  // Create a new workbook
  const usingTemplate = !!(templatePath && reportType === 'gantt');
  const workbook = usingTemplate ? XLSX.readFile(templatePath as string) : XLSX.utils.book_new();
  
  if (reportType === 'complete') {
    // Handle complete report with multiple sheets
    createCompleteReport(workbook, data);
  } else {
    // Handle individual reports
    if (reportType === 'gantt' && usingTemplate) {
      // Use template headers and formatting exclusively; do not generate bars programmatically
      populateGanttTemplate(workbook, data, templateSheetName);
    } else if (reportType === 'gantt') {
      // No template provided: fall back to a simple table without custom bars
      createSingleReport(workbook, data, reportType);
    } else {
      createSingleReport(workbook, data, reportType);
    }
  }
  
  // Generate and return buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

function createSingleReport(workbook: XLSX.WorkBook, data: any, reportType: string) {
  let sheetData: any[] = [];
  let sheetName = 'Report';
  let title = 'AppKings Solutions Limited - Report';
  
  // Determine report type and prepare data
  switch (reportType) {
    case 'projects':
      if (data.projects && data.milestones) {
        sheetData = createProjectsWithMilestones(data.projects, data.milestones);
      } else {
        sheetData = data || [];
      }
      sheetName = 'Project Summary';
      title = 'AppKings Solutions Limited - Project Summary Report';
      break;
      
    case 'financial':
      if (data.financial && data.milestones) {
        sheetData = createFinancialWithMilestones(data.financial, data.milestones);
      } else {
        sheetData = data || [];
      }
      sheetName = 'Financial Report';
      title = 'AppKings Solutions Limited - Financial Report';
      break;
      
    case 'milestones':
      sheetData = data || [];
      sheetName = 'Milestone List';
      title = 'AppKings Solutions Limited - Milestone List Report';
      break;
      
    case 'performance':
      sheetData = data || [];
      sheetName = 'Team Performance';
      title = 'AppKings Solutions Limited - Team Performance Report';
      break;
      
    case 'workload':
      sheetData = data || [];
      sheetName = 'Workload Analysis';
      title = 'AppKings Solutions Limited - Workload Analysis Report';
      break;
      
    case 'gantt':
      sheetData = data || [];
      sheetName = 'GanttChart';
      title = 'AppKings Solutions Limited - Gantt Chart Report';
      break;
      
    default:
      sheetData = data || [];
  }
  
  


  if (sheetData.length > 0) {
    let worksheet;
    if (reportType === 'gantt') {
      worksheet = createGanttWorksheet(sheetData, title);
    } else {
      worksheet = createWorksheetWithHeader(sheetData, title);
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
}

function createCompleteReport(workbook: XLSX.WorkBook, data: any) {
  // Add summary sheet first
  if (data) {
    const summaryData = createSummaryData(data);
    const summarySheet = createWorksheetWithHeader(summaryData, 'AppKings Solutions Limited - Complete Report Summary');
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }
  
  // Add individual report sheets
  const reports = [
    { name: 'Projects', data: data.projects, milestones: data.milestones, type: 'projects' },
    { name: 'Milestones', data: data.milestones, type: 'milestones' },
    { name: 'Performance', data: data.performance, type: 'performance' },
    { name: 'Workload', data: data.workload, type: 'workload' },
    { name: 'Financial', data: data.financial, milestones: data.milestones, type: 'financial' }
  ];
  
  reports.forEach(report => {
    if (report.data && report.data.length > 0) {
      let sheetData;
      let title;
      
      if ((report.type === 'projects' || report.type === 'financial') && report.milestones) {
        if (report.type === 'projects') {
          sheetData = createProjectsWithMilestones(report.data, report.milestones);
          title = 'AppKings Solutions Limited - Project Summary Report';
        } else {
          sheetData = createFinancialWithMilestones(report.data, report.milestones);
          title = 'AppKings Solutions Limited - Financial Report';
        }
      } else {
        sheetData = report.data;
        title = `AppKings Solutions Limited - ${report.name} Report`;
      }
      
      const worksheet = createWorksheetWithHeader(sheetData, title);
      XLSX.utils.book_append_sheet(workbook, worksheet, report.name);
    }
  });
}

function createProjectsWithMilestones(projects: any[], milestones: any[]): any[] {
  const result: any[] = [];
  
  projects.forEach(project => {
    // Add project summary row
    result.push({
      'Name': `📁 ${project['Project Name']}`,
      'Type': 'PROJECT',
      'Status': project['Status'],
      'Progress': `${project['Progress (%)']}%`,
      'Budget (KSh)': project['Budget (KSh)'],
      'Client': project['Client'],
      'Manager': project['Manager'],
      'Start Date': project['Start Date'],
      'End Date': project['End Date'],
      'Milestones': project['Total Milestones'] || 0,
      'Completed': project['Completed Milestones'] || 0
    });
    
    // Add milestone rows for this project
    const projectMilestones = milestones.filter(m => m['Project'] === project['Project Name']);
    projectMilestones.forEach(milestone => {
      result.push({
        'Name': `    └─ ${milestone['Milestone Name']}`,
        'Type': 'MILESTONE',
        'Status': milestone['Status'],
        'Progress': `${milestone['Progress (%)']}%`,
        'Budget (KSh)': milestone['Fee Amount (KSh)'],
        'Client': '',
        'Manager': milestone['Assigned User'],
        'Start Date': milestone['Start Date'],
        'End Date': milestone['Due Date'],
        'Milestones': '',
        'Completed': milestone['Billing Status'] === 'paid' ? '✓' : ''
      });
    });
    
    // Add spacing row
    result.push({
      'Name': '',
      'Type': '',
      'Status': '',
      'Progress': '',
      'Budget (KSh)': '',
      'Client': '',
      'Manager': '',
      'Start Date': '',
      'End Date': '',
      'Milestones': '',
      'Completed': ''
    });
  });
  
  return result;
}

function createFinancialWithMilestones(financialData: any[], milestones: any[]): any[] {
  const result: any[] = [];
  
  financialData.forEach(project => {
    // Add project financial summary
    result.push({
      'Project/Milestone': `📁 ${project['Project Name']}`,
      'Type': 'PROJECT',
      'Status': project['Project Status'],
      'Total Value (KSh)': project['Total Project Value (KSh)'],
      'Paid (KSh)': project['Paid Amount (KSh)'],
      'Outstanding (KSh)': project['Outstanding (KSh)'],
      'Payment %': project['Payment Completion (%)'] + '%',
      'Client': project['Client'],
      'Invoices to Send': project['Invoices to Send'],
      'Invoices Sent': project['Invoices Sent']
    });
    
    // Add milestone financial details
    const projectMilestones = milestones.filter(m => m['Project'] === project['Project Name']);
    projectMilestones.forEach(milestone => {
      result.push({
        'Project/Milestone': `    └─ ${milestone['Milestone Name']}`,
        'Type': 'MILESTONE',
        'Status': milestone['Status'],
        'Total Value (KSh)': milestone['Fee Amount (KSh)'],
        'Paid (KSh)': milestone['Billing Status'] === 'paid' ? milestone['Fee Amount (KSh)'] : '0',
        'Outstanding (KSh)': milestone['Billing Status'] !== 'paid' ? milestone['Fee Amount (KSh)'] : '0',
        'Payment %': milestone['Billing Status'] === 'paid' ? '100%' : '0%',
        'Client': '',
        'Invoices to Send': milestone['Billing Status'] === 'to_send' ? '1' : '0',
        'Invoices Sent': milestone['Billing Status'] === 'sent' ? '1' : '0'
      });
    });
    
    // Add spacing row
    result.push({
      'Project/Milestone': '',
      'Type': '',
      'Status': '',
      'Total Value (KSh)': '',
      'Paid (KSh)': '',
      'Outstanding (KSh)': '',
      'Payment %': '',
      'Client': '',
      'Invoices to Send': '',
      'Invoices Sent': ''
    });
  });
  
  return result;
}

function createSummaryData(data: any): any[] {
  return [
    { 'Report Section': 'Projects', 'Count': data.projects?.length || 0 },
    { 'Report Section': 'Milestones', 'Count': data.milestones?.length || 0 },
    { 'Report Section': 'Team Members', 'Count': data.performance?.length || 0 },
    { 'Report Section': 'Teams', 'Count': data.workload?.length || 0 },
    { 'Report Section': '', 'Count': '' },
    { 'Report Section': 'Total Project Value (KSh)', 'Count': calculateTotalValue(data.financial) },
    { 'Report Section': 'Total Paid Amount (KSh)', 'Count': calculateTotalPaid(data.financial) },
    { 'Report Section': 'Average Progress (%)', 'Count': calculateAverageProgress(data.projects) }
  ];
}

function createWorksheetWithHeader(data: any[], title: string): XLSX.WorkSheet {
  // Create the main data worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Add header rows at the top
  const headerData = [
    [''], // Empty row
    [title], // Main title
    [`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`], // Date
    [''], // Empty row
  ];
  
  // Insert header rows at the beginning
  XLSX.utils.sheet_add_aoa(worksheet, headerData, { origin: 'A1' });
  
  // Style the header
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  // Merge title across all columns
  if (!worksheet['!merges']) worksheet['!merges'] = [];
  worksheet['!merges'].push({
    s: { r: 1, c: 0 },
    e: { r: 1, c: range.e.c }
  });
  
  // Merge date across all columns
  worksheet['!merges'].push({
    s: { r: 2, c: 0 },
    e: { r: 2, c: range.e.c }
  });
  
  // Style the title cell
  if (worksheet['A2']) {
    worksheet['A2'].s = {
      font: { bold: true, sz: 14, color: { rgb: '1F4E79' } },
      alignment: { horizontal: 'center' },
      fill: { fgColor: { rgb: 'F0F0F0' } }
    };
  }
  
  // Style the date cell
  if (worksheet['A3']) {
    worksheet['A3'].s = {
      font: { italic: true, sz: 10 },
      alignment: { horizontal: 'center' },
      fill: { fgColor: { rgb: 'F8F8F8' } }
    };
  }
  
  // Auto-size columns
  const colWidths: any[] = [];
  for (let C = 0; C <= range.e.c; C++) {
    let maxWidth = 10;
    for (let R = 0; R <= range.e.r; R++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) {
        maxWidth = Math.max(maxWidth, String(cell.v).length);
      }
    }
    colWidths.push({ width: Math.min(maxWidth + 2, 50) });
  }
  worksheet['!cols'] = colWidths;
  
  return worksheet;
}

// Enhanced Gantt Chart Export with Visual Timeline - Matching Screenshot Structure
function createGanttWorksheet(data: any[], title: string): WorkSheet {
  // Process data in the order it appears (PROJECT, MODULE, SUBTASK, spacing)
  if (data.length === 0) {
    return createWorksheetWithHeader(data, title);
  }

  // Calculate date range for timeline
  const allDates = data.filter(item => item['Start Date'] && item['Start Date'] !== 'N/A' && item['End Date'] && item['End Date'] !== 'N/A')
    .flatMap(item => [
      new Date(item['Start Date']),
      new Date(item['End Date'])
    ]);
    
  if (allDates.length === 0) {
    return createWorksheetWithHeader(data, title);
  }

  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  
  // Generate weekly columns with proper formatting
  const weekColumns = generateWeekColumnsForGantt(minDate, maxDate);
  
  // Create the exact structure from your screenshot
  const ganttRows: any[] = [];
  
  // Process data in order, keeping track of module numbering
  let currentModuleNumber = 0;
  let currentSubtaskNumber = 0;
  let lastModuleIndex = -1;
  
  data.forEach((item, index) => {
    if (item.Type === 'PROJECT') {
      // Add project header
      const projectRow = {
        'WBS': '1', // Projects are always 1
        'TASK': item.Name,
        'LEAD': shortName(item.Manager) || '',
        'DEVELOPER': item.Manager || 'N/A',
        'FUNCTIONAL CONSULTANT': 'N/A',
        'START': item['Start Date'],
        'END': item['End Date'],
        'DAYS': item['Duration (Days)'],
        '% DONE': item['Progress (%)'],
        'WORK DAYS': calculateWorkDays(item['Start Date'], item['End Date']),
        ...createTimelineDataForGantt(item, weekColumns)
      };
      ganttRows.push(projectRow);
    } else if (item.Type === 'MODULE') {
      // Reset subtask numbering for new module
      currentModuleNumber++;
      currentSubtaskNumber = 0;
      lastModuleIndex = index;
      
      const moduleRow = {
        'WBS': currentModuleNumber.toString(),
        'TASK': item.Name.toUpperCase(), // Make module names caps
        // Milestone/module lead: blank or project manager (use manager when provided)
        'LEAD': shortName(item.Manager) || '',
        'DEVELOPER': '', // Empty for modules
        'FUNCTIONAL CONSULTANT': '', // Empty for modules
        'START': item['Start Date'],
        'END': item['End Date'],
        'DAYS': item['Duration (Days)'],
        '% DONE': item['Progress (%)'],
        'WORK DAYS': calculateWorkDays(item['Start Date'], item['End Date']),
        ...createTimelineDataForGantt(item, weekColumns)
      };
      ganttRows.push(moduleRow);
    } else if (item.Type === 'SUBTASK') {
      // Add subtask with proper numbering
      currentSubtaskNumber++;
      const subtaskRow = {
        'WBS': `${currentModuleNumber}.${currentSubtaskNumber}`,
        'TASK': item.Name,
        // Subtask lead: first non-null among Developer, Consultant, Assigned User (short name)
        'LEAD': pickSubtaskLeadShort(item),
        'DEVELOPER': item.Developer || 'N/A',
        'FUNCTIONAL CONSULTANT': item.Consultant || 'N/A',
        'START': item['Start Date'],
        'END': item['End Date'],
        'DAYS': item['Duration (Days)'],
        '% DONE': item['Progress (%)'],
        'WORK DAYS': calculateWorkDays(item['Start Date'], item['End Date']),
        ...createTimelineDataForGantt(item, weekColumns)
      };
      ganttRows.push(subtaskRow);
    } else if (item.Type === '') {
      // Add spacing row
      ganttRows.push({
        'WBS': '',
        'TASK': '',
        'DEVELOPER': '',
        'FUNCTIONAL CONSULTANT': '',
        'START': '',
        'END': '',
        'DAYS': '',
        '% DONE': '',
        'WORK DAYS': '',
        ...Object.fromEntries(weekColumns.map(week => [week.header, '']))
      });
    }
  });

  // Create header rows with timeline structure matching your screenshots
  const headerData = [
    [''], // Empty row
    [title], // Main title
    [`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`], // Date
    [''], // Empty row
    // Column headers row
    ['WBS', 'TASK', 'LEAD', 'DEVELOPER', 'FUNCTIONAL CONSULTANT', 'START', 'END', 'DAYS', '% DONE', 'WORK DAYS', ...weekColumns.map(week => week.header)],
    // Week numbers row
    ['', '', '', '', '', '', '', '', '', ...weekColumns.map((_, index) => `Week ${index + 1}`)],
    // Days of week row
    ['', '', '', '', '', '', '', '', '', ...weekColumns.map(week => 'M T W T F S S')],
    // Day numbers row
    ['', '', '', '', '', '', '', '', '', ...weekColumns.map(week => {
      const days = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(week.startDate);
        day.setDate(day.getDate() + i);
        days.push(day.getDate());
      }
      return days.join(' ');
    })]
  ];
  
  // Add data rows after headers with status information
  const dataRows = ganttRows.map((row, index) => [
    row['WBS'] || '',
    row['TASK'] || '',
    row['LEAD'] || '',
    row['DEVELOPER'] || '',
    row['FUNCTIONAL CONSULTANT'] || '',
    row['START'] || '',
    row['END'] || '',
    row['DAYS'] || '',
    row['% DONE'] || '',
    row['WORK DAYS'] || '',
    ...weekColumns.map(week => row[week.header] || ''),
    row['Status'] || '' // Add status as hidden column for styling reference
  ]);
  
  // Combine headers and data
  const allData = [...headerData, ...dataRows];
  
  // Create worksheet from combined data (no automatic headers)
  const worksheet: WorkSheet = XLSX.utils.aoa_to_sheet(allData);
  
  // Style the worksheet
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  // Merge title across all columns
  if (!worksheet['!merges']) worksheet['!merges'] = [];
  worksheet['!merges'].push({
    s: { r: 1, c: 0 },
    e: { r: 1, c: range.e.c }
  });
  
  // Merge date across all columns
  worksheet['!merges'].push({
    s: { r: 2, c: 0 },
    e: { r: 2, c: range.e.c }
  });
  
  // Apply formatting to timeline cells with colored bars
  applyGanttFormattingForScreenshot(worksheet, range, weekColumns.length);
  
  return worksheet;
}

// Populate an existing template workbook for Gantt export
function populateGanttTemplate(workbook: XLSX.WorkBook, data: any[], templateSheetName?: string) {
  // Always target an existing template sheet; never append a new GanttChart sheet to avoid name conflicts
  // Prefer the 'GanttChart' sheet explicitly if present
  const ganttSheetName = workbook.SheetNames.find(n => n.trim().toLowerCase() === 'ganttcart')
    ? 'GanttChart'
    : (workbook.SheetNames.find(n => n.trim().toLowerCase() === 'ganttchart') || undefined);
  const preferredName = templateSheetName || ganttSheetName || workbook.SheetNames[0];
  const targetSheet = workbook.Sheets[preferredName] || workbook.Sheets[workbook.SheetNames[0]];
  if (!targetSheet) {
    // As a last resort do nothing rather than appending a duplicate sheet
    return;
  }

  // Match the template's column headers exactly (no Developer/Functional Consultant columns)
  const expectedHeaders = ['WBS', 'TASK', 'LEAD', 'START', 'END', 'DAYS', '% DONE', 'WORK DAYS'];
  const headerRowIndex = findHeaderRow(targetSheet, expectedHeaders);

  const rows = buildGanttRowsForTemplate(data);
  if (rows.length === 0) return;

  // If headers found, place rows immediately below; otherwise, write starting at a safe default row (e.g., row 6)
  // If headers detected, write immediately below; else default to row 9 (template common data row)
  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 9; // 0-based row index
  
  // Optional: clear an ample data range below headers to remove sample/template rows
  try {
    const clearRows = Math.max(rows.length, 200);
    const clearData = Array.from({ length: clearRows }, () => Array(8).fill(''));
    XLSX.utils.sheet_add_aoa(targetSheet, clearData, { origin: { r: startRow, c: 0 } });
  } catch {}
  
  XLSX.utils.sheet_add_aoa(targetSheet, rows, { origin: { r: startRow, c: 0 } });
}

function findHeaderRow(worksheet: XLSX.WorkSheet, headers: string[]): number {
  const rangeRef = worksheet['!ref'] || 'A1:Z200';
  const range = XLSX.utils.decode_range(rangeRef);
  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowValues: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
      rowValues.push(cell ? String(cell.v).trim() : '');
    }
    // Look for the sequence of headers in order
    const norm = (s: string) => s.trim().toUpperCase();
    const normalizedRow = rowValues.map(norm);
    const normalizedHeaders = headers.map(norm);
    const startIdx = normalizedRow.findIndex(v => v === normalizedHeaders[0]);
    if (startIdx !== -1) {
      let matches = true;
      for (let i = 0; i < headers.length; i++) {
        if (normalizedRow[startIdx + i] !== normalizedHeaders[i]) {
          matches = false; break;
        }
      }
      if (matches) return r;
    }
  }
  return -1;
}

// Build rows matching template base columns (without timeline columns)
function buildGanttRowsForTemplate(data: any[]): any[][] {
  if (!data || data.length === 0) return [];
  const rows: any[][] = [];
  let currentModuleNumber = 0;
  let currentSubtaskNumber = 0;

  data.forEach(item => {
    if (item.Type === 'PROJECT') {
      // Project row
      rows.push([
        '1',
        item.Name,
        shortName(item.Manager) || '',
        item['Start Date'] || '',
        item['End Date'] || '',
        item['Duration (Days)'] || '',
        item['Progress (%)'] || '',
        calculateWorkDays(item['Start Date'], item['End Date'])
      ]);
    } else if (item.Type === 'MODULE') {
      currentModuleNumber++;
      currentSubtaskNumber = 0;
      rows.push([
        String(currentModuleNumber),
        String(item.Name || '').toUpperCase(),
        shortName(item.Manager) || '',
        item['Start Date'] || '',
        item['End Date'] || '',
        item['Duration (Days)'] || '',
        item['Progress (%)'] || '',
        calculateWorkDays(item['Start Date'], item['End Date'])
      ]);
    } else if (item.Type === 'SUBTASK') {
      currentSubtaskNumber++;
      rows.push([
        `${currentModuleNumber}.${currentSubtaskNumber}`,
        item.Name || '',
        pickSubtaskLeadShort(item),
        item['Start Date'] || '',
        item['End Date'] || '',
        item['Duration (Days)'] || '',
        item['Progress (%)'] || '',
        calculateWorkDays(item['Start Date'], item['End Date'])
      ]);
    } else if (item.Type === '') {
      // spacing row
      rows.push(['', '', '', '', '', '', '', '']);
    }
  });

  return rows;
}

// Helpers for LEAD column
function shortName(fullName?: string): string {
  if (!fullName) return '';
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

function pickSubtaskLeadShort(item: any): string {
  const firstNonNull = item.Developer || item.Consultant || item.AssignedUser || item['Assigned User'] || item.Manager || '';
  return shortName(firstNonNull);
}

function generateWeekColumns(startDate: Date, endDate: Date): Array<{header: string, startDate: Date, endDate: Date}> {
  const weeks: Array<{header: string, startDate: Date, endDate: Date}> = [];
  const current = new Date(startDate);
  
  // Start from Monday of the week containing startDate
  current.setDate(current.getDate() - current.getDay() + 1);
  
  while (current <= endDate) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const weekHeader = `${weekStart.getMonth() + 1}/${weekStart.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
    
    weeks.push({
      header: weekHeader,
      startDate: weekStart,
      endDate: weekEnd
    });
    
    current.setDate(current.getDate() + 7);
  }
  
  return weeks;
}

// New function for Gantt chart with proper week formatting
function generateWeekColumnsForGantt(startDate: Date, endDate: Date): Array<{header: string, startDate: Date, endDate: Date}> {
  const weeks: Array<{header: string, startDate: Date, endDate: Date}> = [];
  const current = new Date(startDate);
  
  // Start from Monday of the week containing startDate
  current.setDate(current.getDate() - current.getDay() + 1);
  
  while (current <= endDate) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Format like in your screenshot: "1 Sep 2025"
    const weekHeader = `${weekStart.getDate()} ${weekStart.toLocaleDateString('en-US', { month: 'short' })} ${weekStart.getFullYear()}`;
    
    weeks.push({
      header: weekHeader,
      startDate: weekStart,
      endDate: weekEnd
    });
    
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

// Calculate work days (excluding weekends)
function calculateWorkDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || startDateStr === 'N/A' || !endDateStr || endDateStr === 'N/A') {
    return 0;
  }
  
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  let workDays = 0;
  
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // Count only weekdays (Monday = 1 to Friday = 5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workDays;
}

// Create timeline data for Gantt chart with visual bars
function createTimelineDataForGantt(item: any, weekColumns: Array<{header: string, startDate: Date, endDate: Date}>): Record<string, string> {
  const timelineData: Record<string, string> = {};
  
  if (!item['Start Date'] || item['Start Date'] === 'N/A' || !item['End Date'] || item['End Date'] === 'N/A') {
    // Fill with empty values if no dates
    weekColumns.forEach(week => {
      timelineData[week.header] = '';
    });
    return timelineData;
  }
  
  const itemStart = new Date(item['Start Date']);
  const itemEnd = new Date(item['End Date']);
  const progress = parseInt(item['Progress (%)']) || 0;
  
  weekColumns.forEach(week => {
    // Check if this week overlaps with the item's duration
    const hasOverlap = itemStart <= week.endDate && itemEnd >= week.startDate;
    
    if (hasOverlap) {
      // Create visual bars using Unicode block characters based on status
      const status = item['Status'] || '';
      if (status === 'done' || status === 'finished') {
        timelineData[week.header] = '█'; // Green for completed
      } else if (status === 'client_review' || status === 'qa') {
        timelineData[week.header] = '▓'; // Light green for review
      } else if (status === 'in_progress' || status === 'ongoing' || status === 'fc_review') {
        timelineData[week.header] = '▒'; // Blue for in progress
      } else if (status === 'started') {
        timelineData[week.header] = '░'; // Orange for started
      } else if (status === 'overdue' || status === 'delayed') {
        timelineData[week.header] = '█'; // Red for overdue (will be styled differently)
      } else if (status === 'on_hold' || status === 'cancelled') {
        timelineData[week.header] = '▓'; // Gray for on hold/cancelled
      } else {
        timelineData[week.header] = '░'; // Light gray for planned/not started
      }
    } else {
      timelineData[week.header] = '';
    }
  });
  return timelineData;
}

function createTimelineData(item: any, weekColumns: Array<{header: string, startDate: Date, endDate: Date}>): Record<string, string> {
  const timelineData: Record<string, string> = {};
  
  if (!item['Start Date'] || item['Start Date'] === 'N/A' || !item['End Date'] || item['End Date'] === 'N/A') {
    // Fill with empty values if no dates
    weekColumns.forEach(week => {
      timelineData[week.header] = '';
    });
    return timelineData;
  }
  
  const itemStart = new Date(item['Start Date']);
  const itemEnd = new Date(item['End Date']);
  const progress = parseInt(item['Progress (%)']) || 0;
  
  weekColumns.forEach(week => {
    // Check if this week overlaps with the item's duration
    const hasOverlap = itemStart <= week.endDate && itemEnd >= week.startDate;
    
    if (hasOverlap) {
      // Calculate overlap percentage for this week
      const overlapStart = new Date(Math.max(itemStart.getTime(), week.startDate.getTime()));
      const overlapEnd = new Date(Math.min(itemEnd.getTime(), week.endDate.getTime()));
      const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const weekDays = 7;
      const intensity = Math.min(overlapDays / weekDays, 1);
      
      // Create visual representation based on progress and intensity
      if (progress >= 100) {
        timelineData[week.header] = intensity >= 0.7 ? '████' : intensity >= 0.4 ? '███' : '██';
      } else if (progress >= 50) {
        timelineData[week.header] = intensity >= 0.7 ? '▓▓▓' : intensity >= 0.4 ? '▓▓' : '▓';
      } else if (progress > 0) {
        timelineData[week.header] = intensity >= 0.7 ? '▒▒▒' : intensity >= 0.4 ? '▒▒' : '▒';
      } else {
        timelineData[week.header] = intensity >= 0.7 ? '░░░' : intensity >= 0.4 ? '░░' : '░';
      }
    } else {
      timelineData[week.header] = '';
    }
  });
  
  return timelineData;
}

function applyGanttFormatting(worksheet: WorkSheet, range: XLSX.Range, timelineColumns: number): void {
  // Style header cells
  if (worksheet['A2']) {
    worksheet['A2'].s = {
      font: { bold: true, sz: 14, color: { rgb: '1F4E79' } },
      alignment: { horizontal: 'center' },
      fill: { fgColor: { rgb: 'F0F0F0' } }
    };
  }
  
  if (worksheet['A3']) {
    worksheet['A3'].s = {
      font: { italic: true, sz: 10 },
      alignment: { horizontal: 'center' },
      fill: { fgColor: { rgb: 'F8F8F8' } }
    };
  }
  
  // Style column headers (row 5 contains the data headers)
  for (let c = 0; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 4, c });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center' },
        fill: { fgColor: { rgb: '4472C4' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
  }
  
  // Style timeline columns with different colors based on content
  const timelineStartCol = 8; // Timeline starts after basic columns
  for (let r = 5; r <= range.e.r; r++) {
    for (let c = timelineStartCol; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[cellRef];
      
      if (cell && cell.v) {
        const value = cell.v.toString();
        let fillColor = 'FFFFFF'; // Default white
        let fontColor = '000000';
        
        if (value.includes('█')) {
          fillColor = '2E8B57'; // Dark green for completed
          fontColor = 'FFFFFF';
        } else if (value.includes('▓')) {
          fillColor = '90EE90'; // Light green for in progress
        } else if (value.includes('▒')) {
          fillColor = 'FFD700'; // Gold for started
        } else if (value.includes('░')) {
          fillColor = 'E0E0E0'; // Light gray for planned
        }
        
        cell.s = {
          font: { color: { rgb: fontColor }, sz: 10 },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: fillColor } },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          }
        };
      }
    }
  }
  
  // Set column widths
  worksheet['!cols'] = [
    { width: 8 },  // WBS
    { width: 30 }, // Task Name
    { width: 12 }, // Duration
    { width: 12 }, // Start Date
    { width: 12 }, // End Date
    { width: 10 }, // Progress
    { width: 12 }, // Status
    { width: 20 }, // Assigned To
    ...Array(timelineColumns).fill({ width: 8 }) // Timeline columns
  ];
}

// New formatting function for screenshot-style Gantt chart
function applyGanttFormattingForScreenshot(worksheet: WorkSheet, range: XLSX.Range, timelineColumns: number): void {
  // Style header cells
  if (worksheet['A2']) {
    worksheet['A2'].s = {
      font: { bold: true, sz: 14, color: { rgb: '1F4E79' } },
      alignment: { horizontal: 'center' },
      fill: { fgColor: { rgb: 'F0F0F0' } }
    };
  }
  
  if (worksheet['A3']) {
    worksheet['A3'].s = {
      font: { italic: true, sz: 10 },
      alignment: { horizontal: 'center' },
      fill: { fgColor: { rgb: 'F8F8F8' } }
    };
  }
  
  // Style timeline header rows (rows 5-8, now 4-7 in 0-indexed)
  for (let r = 4; r <= 7; r++) {
    for (let c = 10; c <= range.e.c; c++) { // Timeline starts at column K (index 10) after adding LEAD
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = {
          font: { bold: true, sz: 9, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'E6F3FF' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        };
      }
    }
  }
  
  // Style data column headers (row 5, now 4 in 0-indexed)
  for (let c = 0; c <= 9; c++) { // Columns A through J (added LEAD)
    const cellRef = XLSX.utils.encode_cell({ r: 4, c });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center' },
        fill: { fgColor: { rgb: '4472C4' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
    }
  }
  
  // Style data rows and timeline columns
  const timelineStartCol = 10; // Timeline starts at column K (index 10) after adding LEAD
  for (let r = 7; r <= range.e.r; r++) {
    // Check if this is a module row (WBS column contains only numbers, no dots)
    const wbsCell = worksheet[XLSX.utils.encode_cell({ r, c: 0 })]; // Column A (WBS)
    const taskCell = worksheet[XLSX.utils.encode_cell({ r, c: 1 })]; // Column B (TASK)
    const isModuleRow = wbsCell && wbsCell.v && !wbsCell.v.toString().includes('.') && wbsCell.v.toString() !== '';
    
    // Style data columns (A through J)
    for (let c = 0; c <= 9; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[cellRef];
      
      if (cell && cell.v) {
        if (isModuleRow && c === 1) { // TASK column for modules
          cell.s = {
            font: { bold: true, sz: 11, color: { rgb: '000000' } },
            alignment: { horizontal: 'left' },
            fill: { fgColor: { rgb: 'F0F0F0' } },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          };
        } else {
          cell.s = {
            font: { sz: 10, color: { rgb: '000000' } },
            alignment: { horizontal: 'left' },
            fill: { fgColor: { rgb: 'FFFFFF' } },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          };
        }
      }
    }
    
    // Style timeline columns with colored bars for Gantt chart
    for (let c = timelineStartCol; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[cellRef];
      
      if (cell && cell.v) {
        const value = cell.v.toString();
        let fillColor = 'FFFFFF'; // Default white
        let fontColor = '000000';
        
        // Get the actual status from the hidden status column
        const statusCell = worksheet[XLSX.utils.encode_cell({ r, c: range.e.c })]; // Last column has status
        const actualStatus = statusCell ? statusCell.v.toString() : '';
        
        // Apply colors based on actual status using Excel's built-in color palette
        if (actualStatus === 'done' || actualStatus === 'finished') {
          fillColor = '00B050'; // Green for completed
          fontColor = 'FFFFFF';
          console.log(`Applying GREEN to cell [${r},${c}] with status "${actualStatus}"`);
        } else if (actualStatus === 'client_review' || actualStatus === 'qa') {
          fillColor = '92D050'; // Light green for review
          fontColor = '000000';
          console.log(`Applying LIGHT GREEN to cell [${r},${c}] with status "${actualStatus}"`);
        } else if (actualStatus === 'in_progress' || actualStatus === 'ongoing' || actualStatus === 'fc_review') {
          fillColor = '4472C4'; // Blue for in progress (Excel's built-in blue)
          fontColor = 'FFFFFF';
          console.log(`Applying BLUE to cell [${r},${c}] with status "${actualStatus}"`);
        } else if (actualStatus === 'started') {
          fillColor = 'FFC000'; // Orange for started
          fontColor = '000000';
          console.log(`Applying ORANGE to cell [${r},${c}] with status "${actualStatus}"`);
        } else if (actualStatus === 'overdue' || actualStatus === 'delayed') {
          fillColor = 'FF0000'; // Red for overdue
          fontColor = 'FFFFFF';
          console.log(`Applying RED to cell [${r},${c}] with status "${actualStatus}"`);
        } else if (actualStatus === 'on_hold' || actualStatus === 'cancelled') {
          fillColor = 'A5A5A5'; // Gray for on hold/cancelled
          fontColor = 'FFFFFF';
          console.log(`Applying GRAY to cell [${r},${c}] with status "${actualStatus}"`);
        } else {
          fillColor = 'D9D9D9'; // Light gray for planned/not started
          fontColor = '000000';
          console.log(`Applying LIGHT GRAY to cell [${r},${c}] with status "${actualStatus}"`);
        }
        
        // Apply the styling with a more reliable approach
        if (!cell.s) cell.s = {};
        
        // Set background color using pattern fill (more reliable)
        cell.s.fill = { 
          patternType: 'solid',
          fgColor: { rgb: fillColor }
        };
        
        // Set font color and style
        cell.s.font = { 
          color: { rgb: fontColor }, 
          sz: 10, 
          bold: true 
        };
        
        // Set alignment
        cell.s.alignment = { 
          horizontal: 'center', 
          vertical: 'center' 
        };
        
        // Set borders
        cell.s.border = {
          top: { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left: { style: 'thin', color: { rgb: 'CCCCCC' } },
          right: { style: 'thin', color: { rgb: 'CCCCCC' } }
        };
      }
    }
  }
  
  // Set column widths to match your screenshot
  worksheet['!cols'] = [
    { width: 8 },  // WBS
    { width: 40 }, // TASK
    { width: 14 }, // LEAD
    { width: 15 }, // DEVELOPER
    { width: 20 }, // FUNCTIONAL CONSULTANT
    { width: 12 }, // START
    { width: 12 }, // END
    { width: 8 },  // DAYS
    { width: 8 },  // % DONE
    { width: 10 }, // WORK DAYS
    ...Array(timelineColumns).fill({ width: 6 }), // Timeline columns
    { width: 0, hidden: true } // Hide status column
  ];
}

// Helper calculation functions
function calculateTotalValue(financialData: any[]): string {
  if (!financialData || financialData.length === 0) return '0';
  
  const total = financialData.reduce((sum, project) => {
    const value = String(project['Total Project Value (KSh)'] || '0').replace(/,/g, '');
    return sum + (parseFloat(value) || 0);
  }, 0);
  
  return total.toLocaleString();
}

function calculateTotalPaid(financialData: any[]): string {
  if (!financialData || financialData.length === 0) return '0';
  
  const total = financialData.reduce((sum, project) => {
    const value = String(project['Paid Amount (KSh)'] || '0').replace(/,/g, '');
    return sum + (parseFloat(value) || 0);
  }, 0);
  
  return total.toLocaleString();
}

function calculateAverageProgress(projectsData: any[]): string {
  if (!projectsData || projectsData.length === 0) return '0';
  
  const average = projectsData.reduce((sum, project) => {
    return sum + (project['Progress (%)'] || 0);
  }, 0) / projectsData.length;
  
  return `${Math.round(average)}%`;
}