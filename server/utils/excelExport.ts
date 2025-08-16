import * as XLSX from 'xlsx';

interface ExcelExportOptions {
  filename: string;
  data: any;
  reportType: string;
}

export function generateExcelBuffer(options: ExcelExportOptions): Buffer {
  const { data, reportType } = options;
  
  // Create a new workbook
  const workbook = XLSX.utils.book_new();
  
  if (reportType === 'complete') {
    // Handle complete report with multiple sheets
    createCompleteReport(workbook, data);
  } else {
    // Handle individual reports
    createSingleReport(workbook, data, reportType);
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
      
    default:
      sheetData = data || [];
  }
  
  if (sheetData.length > 0) {
    const worksheet = createWorksheetWithHeader(sheetData, title);
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