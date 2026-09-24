import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Download, 
  ArrowLeft, 
  Search, 
  Filter, 
  Loader2, 
  FileText, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";

interface ReportDetailProps {
  reportType: string;
}

export default function ReportDetail() {
  const [, setLocation] = useLocation();
  const auth = useAuth() as any;
  const { isAuthenticated, isLoading } = auth;
  const { toast } = useToast();
  
  // Get report type from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const reportType = urlParams.get('type') || '';
  
  // State for data and UI
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [projectsData, setProjectsData] = useState<any[]>([]);
  const [milestonesData, setMilestonesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [exporting, setExporting] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Report type configuration
  const reportConfig = {
    'projects': {
      title: 'Project Summary',
      description: 'Comprehensive overview of all projects',
      icon: BarChart3,
      apiType: 'projects'
    },
    'milestones': {
      title: 'Milestone List',
      description: 'Detailed list of all project milestones',
      icon: FileText,
      apiType: 'milestones'
    },
    'performance': {
      title: 'Team Performance',
      description: 'Individual team member performance metrics',
      icon: TrendingUp,
      apiType: 'performance'
    },
    'workload': {
      title: 'Workload Analysis',
      description: 'Team workload distribution and analysis',
      icon: Users,
      apiType: 'workload'
    },
    'financial': {
      title: 'Financial Report',
      description: 'Financial overview and milestone billing',
      icon: Calendar,
      apiType: 'financial'
    },
    'complete': {
      title: 'Complete Report',
      description: 'Comprehensive report with all data',
      icon: BarChart3,
      apiType: 'complete'
    },
    'gantt': {
      title: 'Gantt Chart',
      description: 'Project timeline and dependencies',
      icon: Calendar,
      apiType: 'gantt'
    }
  };

  const config = reportConfig[reportType as keyof typeof reportConfig];

  // Fetch report data
  const fetchReportData = async () => {
    if (!config) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reportType: config.apiType,
          format: 'json', // Request JSON data instead of Excel
          filters: {}
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', errorData);
        throw new Error(errorData.message || `Failed to fetch report data (${response.status})`);
      }

      const result = await response.json();
      console.log('API Response:', result);
      
      // Handle Project Summary specially - keep projects and milestones separate
      if (config.apiType === 'projects' && typeof result === 'object' && result.projects && result.milestones) {
        setProjectsData(result.projects || []);
        setMilestonesData(result.milestones || []);
        setData([]);
        setFilteredData([]);
      }
      // Handle different data structures for other reports
      else if (Array.isArray(result)) {
        setData(result);
        setFilteredData(result);
      } else if (result.data && Array.isArray(result.data)) {
        setData(result.data);
        setFilteredData(result.data);
      } else if (typeof result === 'object') {
        // For complex reports like complete, flatten the data
        const flattenedData: any[] = [];
        Object.values(result).forEach((section: any) => {
          if (Array.isArray(section)) {
            flattenedData.push(...section);
          }
        });
        setData(flattenedData);
        setFilteredData(flattenedData);
      } else {
        setData([]);
        setFilteredData([]);
      }

    } catch (error: any) {
      console.error('Error fetching report data:', error);
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }

      toast({
        title: "Error",
        description: error.message || "Failed to load report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && reportType) {
      fetchReportData();
    }
  }, [isAuthenticated, reportType]);

  // Filter and search data
  useEffect(() => {
    let filtered = [...data];

    if (searchTerm) {
      filtered = filtered.filter(item => 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (sortField && sortField !== 'none') {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [data, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  // Get table columns dynamically
  const getTableColumns = () => {
    if (currentData.length === 0) return [];
    
    const firstItem = currentData[0];
    const excludeColumns = ['Project Name', 'Project', 'projectName', 'project'];
    
    return Object.keys(firstItem)
      .filter(key => !excludeColumns.includes(key) && !key.startsWith('_'))
      .map(key => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        sortable: true
      }));
  };

  const columns = getTableColumns();

  // Handle export
  const handleExport = async () => {
    if (!config) return;
    
    setExporting(true);
    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reportType: config.apiType,
          format: config.apiType === 'gantt' ? 'excel' : 'pdf',
          filters: {}
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileExtension = config.apiType === 'gantt' ? 'xlsx' : 'pdf';
      link.download = `${config.title} - ${format(new Date(), 'yyyy-MM-dd')}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `${config.title} exported successfully!`,
      });

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export report",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-background-page">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Report Not Found</h2>
              <p className="text-gray-600 mb-6">The requested report type is not available.</p>
              <Button onClick={() => setLocation('/reports')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const IconComponent = config.icon;

  return (
    <div className="min-h-screen bg-background-page">
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/reports')}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-3xl font-medium text-gray-900 flex items-center">
                <IconComponent className="h-8 w-8 mr-3 text-primary" />
                {config.title}
              </h2>
              <p className="text-gray-600 mt-1">{config.description}</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <Button 
              onClick={handleExport}
              disabled={exporting || loading}
              className="flex items-center"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {exporting ? 'Exporting...' : (config.apiType === 'gantt' ? 'Export Excel' : 'Export PDF')}
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search across all fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 border-gray-300 focus:border-primary focus:ring-primary"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={sortField} onValueChange={setSortField}>
                  <SelectTrigger className="w-full md:w-48 h-11 border-gray-300 focus:border-primary focus:ring-primary">
                    <SelectValue placeholder="Sort by column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No sorting</SelectItem>
                    {columns.map(column => (
                      <SelectItem key={column.key} value={column.key}>
                        {column.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sortField && sortField !== 'none' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                    className="h-11 px-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  >
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </Button>
                )}
              </div>
            </div>
            {searchTerm && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {filteredData.length} of {data.length} records match "{searchTerm}"
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Clear search
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="bg-gray-50/50 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Report Data</CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  {config.apiType === 'projects' && projectsData.length > 0
                    ? `${projectsData.length} projects with ${milestonesData.length} milestones`
                    : `${filteredData.length} records found`}
                  {searchTerm && config.apiType !== 'projects' && ` (filtered from ${data.length} total)`}
                </CardDescription>
              </div>
              {config.apiType !== 'projects' && (
                <div className="flex items-center space-x-3">
                  <Badge variant="secondary" className="px-3 py-1">
                    Page {currentPage} of {totalPages}
                  </Badge>
                  <div className="text-sm text-gray-500">
                    {itemsPerPage} per page
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
                  </div>
                  <p className="text-gray-600 font-medium">Loading report data...</p>
                  <p className="text-sm text-gray-500 mt-1">Please wait while we fetch the latest information</p>
                </div>
              </div>
            ) : config.apiType === 'projects' && projectsData.length > 0 ? (
              <div className="space-y-4 py-4">
                {projectsData.map((project: any, index: number) => {
                  const projectMilestones = milestonesData.filter((m: any) => 
                    m.Client === project.Client && m._projectName === project['Project Name']
                  );
                  
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900">{project['Project Name']}</h3>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                              <span><span className="font-medium">Client:</span> {project.Client}</span>
                              <span><span className="font-medium">Status:</span> {project.Status}</span>
                              <span><span className="font-medium">Progress:</span> {project['Progress (%)']}%</span>
                              <span><span className="font-medium">Budget:</span> KSh {project['Budget (KSh)']}</span>
                            </div>
                          </div>
                          <Badge variant="secondary">{projectMilestones.length} Milestones</Badge>
                        </div>
                      </div>
                      
                      {projectMilestones.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-white">
                              <TableHead className="px-6 py-3 text-xs font-bold text-gray-700">Milestone Name</TableHead>
                              <TableHead className="px-6 py-3 text-xs font-bold text-gray-700">Manager</TableHead>
                              <TableHead className="px-6 py-3 text-xs font-bold text-gray-700">Progress</TableHead>
                              <TableHead className="px-6 py-3 text-xs font-bold text-gray-700">Billing Status</TableHead>
                              <TableHead className="px-6 py-3 text-xs font-bold text-gray-700">Fee (KSh)</TableHead>
                              <TableHead className="px-6 py-3 text-xs font-bold text-gray-700">Start Date</TableHead>
                              <TableHead className="px-6 py-3 text-xs font-bold text-gray-700">Due Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {projectMilestones.map((milestone: any, mIndex: number) => (
                              <TableRow key={mIndex} className={mIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <TableCell className="px-6 py-3 text-sm text-gray-900">{milestone['Milestone Name']}</TableCell>
                                <TableCell className="px-6 py-3 text-sm text-gray-700">{milestone['Manager'] || 'Not assigned'}</TableCell>
                                <TableCell className="px-6 py-3 text-sm text-gray-700">{milestone['Progress (%)']}%</TableCell>
                                <TableCell className="px-6 py-3 text-sm text-gray-700">{milestone['Billing Status'] || 'none'}</TableCell>
                                <TableCell className="px-6 py-3 text-sm text-gray-700">{milestone['Fee Amount (KSh)']}</TableCell>
                                <TableCell className="px-6 py-3 text-sm text-gray-700">{milestone['Start Date']}</TableCell>
                                <TableCell className="px-6 py-3 text-sm text-gray-700">{milestone['Due Date']}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="px-6 py-4 text-sm text-gray-500 italic">No milestones for this project</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No data available</p>
                <p className="text-sm">
                  {searchTerm ? 'Try adjusting your search terms' : 'This report contains no data'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                      {columns.map(column => (
                        <TableHead 
                          key={column.key}
                          className={`px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-200 last:border-r-0 ${
                            column.sortable ? 'cursor-pointer hover:bg-gray-200 transition-all duration-200 group' : ''
                          }`}
                          onClick={() => column.sortable && handleSort(column.key)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="group-hover:text-gray-900 transition-colors">{column.label}</span>
                            {column.sortable && (
                              <div className="flex flex-col ml-2">
                                {sortField === column.key ? (
                                  <>
                                    <span className={`text-xs leading-none ${sortDirection === 'asc' ? 'text-primary' : 'text-gray-400'}`}>
                                      ▲
                                    </span>
                                    <span className={`text-xs leading-none ${sortDirection === 'desc' ? 'text-primary' : 'text-gray-400'}`}>
                                      ▼
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-xs leading-none text-gray-300 group-hover:text-gray-400 transition-colors">▲</span>
                                    <span className="text-xs leading-none text-gray-300 group-hover:text-gray-400 transition-colors">▼</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white">
                    {currentData.map((item, index) => (
                      <TableRow 
                        key={index} 
                        className={`hover:bg-gray-50 transition-all duration-200 border-b border-gray-100 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'
                        }`}
                      >
                        {columns.map(column => {
                          const value = item[column.key];
                          const isNumeric = !isNaN(Number(value)) && value !== null && value !== '';
                          const isDate = value && typeof value === 'string' && (value.includes('-') || value.includes('/'));
                          
                          return (
                            <TableCell 
                              key={column.key}
                              className="px-6 py-4 text-sm text-gray-900 border-r border-gray-100 last:border-r-0"
                            >
                              <div className="max-w-xs">
                                {value !== null && value !== undefined ? (
                                  <div className="flex items-center">
                                    {isNumeric && (
                                      <span className="text-right font-mono text-gray-700">
                                        {Number(value).toLocaleString()}
                                      </span>
                                    )}
                                    {isDate && !isNumeric && (
                                      <span className="text-gray-600">
                                        {new Date(value).toLocaleDateString()}
                                      </span>
                                    )}
                                    {!isNumeric && !isDate && (
                                      <span 
                                        className="truncate block" 
                                        title={String(value)}
                                      >
                                        {String(value)}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic text-sm">—</span>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {config.apiType !== 'projects' && totalPages > 1 && (
              <div className="bg-white px-6 py-4 border-t border-gray-200 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-700">
                    <span className="font-medium">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} results
                    </span>
                    {totalPages > 1 && (
                      <span className="ml-2 text-gray-500">
                        • {totalPages} pages total
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-3 text-sm font-medium text-gray-700 bg-white border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {/* Show first page */}
                      {currentPage > 3 && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            className="w-8 h-8 p-0 text-sm font-medium text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
                          >
                            1
                          </Button>
                          {currentPage > 4 && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                        </>
                      )}
                      
                      {/* Show current page and surrounding pages */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        if (pageNum < 1 || pageNum > totalPages) return null;
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 p-0 text-sm font-medium ${
                              currentPage === pageNum
                                ? 'bg-primary text-white border-primary hover:bg-primary/90'
                                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      
                      {/* Show last page */}
                      {currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-8 h-8 p-0 text-sm font-medium text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-3 text-sm font-medium text-gray-700 bg-white border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
