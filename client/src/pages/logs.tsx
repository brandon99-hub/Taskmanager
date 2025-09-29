import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  User,
  Activity,
  Server,
  Database,
  Eye,
  Monitor,
  EyeOff
} from "lucide-react";
import { format } from "date-fns";
import { LogDetailsModal } from "@/components/logs/log-details-modal";

interface LogEntry {
  id: string;
  logType: 'activity' | 'api' | 'system';
  actionType?: string;
  resourceType?: string;
  resourceName?: string;
  userId?: string;
  ipAddress?: string;
  statusCode?: number;
  success?: boolean;
  errorMessage?: string;
  description?: string;
  severity?: string;
  responseTimeMs?: number;
  method?: string;
  endpoint?: string;
  eventType?: string;
  eventCategory?: string;
  createdAt: string;
  sessionId?: string;
}

interface LogsResponse {
  data: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface LogStatistics {
  totalActivities: number;
  successfulActivities: number;
  failedActivities: number;
  successRate: number;
  topActions: Array<{ actionType: string; count: number }>;
  topResources: Array<{ resourceType: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

export default function Logs() {
  const { isAuthenticated, isLoading, isAdminRole } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Redirect if not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdminRole())) {
      toast({
        title: "Access Denied",
        description: "You need admin privileges to access system logs.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/login");
      }, 2000);
    }
  }, [isAuthenticated, isLoading, isAdminRole, toast, setLocation]);

  // Filters state
  const [filters, setFilters] = useState({
    logType: 'all',
    startDate: '',
    endDate: '',
    userId: '',
    severity: '',
    actionType: '',
    resourceType: '',
    search: ''
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch logs
  const { data: logs, isLoading: logsLoading, refetch } = useQuery<LogsResponse>({
    queryKey: ['/api/admin/logs', filters, currentPage],
    enabled: isAuthenticated && isAdminRole(),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters.logType && filters.logType !== 'all') queryParams.append('logType', filters.logType);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.userId) queryParams.append('userId', filters.userId);
      if (filters.severity) queryParams.append('severity', filters.severity);
      if (filters.actionType) queryParams.append('actionType', filters.actionType);
      if (filters.resourceType) queryParams.append('resourceType', filters.resourceType);
      if (filters.search) queryParams.append('search', filters.search);
      queryParams.append('page', currentPage.toString());
      queryParams.append('limit', '50');

      const response = await fetch(`/api/admin/logs?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      return response.json();
    },
  });

  // Fetch statistics
  const { data: statistics } = useQuery<LogStatistics>({
    queryKey: ['/api/admin/logs/statistics', filters],
    enabled: isAuthenticated && isAdminRole(),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters.logType && filters.logType !== 'all') queryParams.append('logType', filters.logType);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.userId) queryParams.append('userId', filters.userId);
      if (filters.severity) queryParams.append('severity', filters.severity);
      if (filters.actionType) queryParams.append('actionType', filters.actionType);
      if (filters.resourceType) queryParams.append('resourceType', filters.resourceType);
      if (filters.search) queryParams.append('search', filters.search);

      const response = await fetch(`/api/admin/logs/statistics?${queryParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      return response.json();
    },
  });

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    refetch();
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      logType: 'all',
      startDate: '',
      endDate: '',
      userId: '',
      severity: '',
      actionType: '',
      resourceType: '',
      search: ''
    });
    setCurrentPage(1);
  };

  // Export logs
  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await fetch(`/api/admin/logs/export?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-logs-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "Logs have been exported to Excel file.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export logs. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Toggle log details
  const toggleDetails = (logId: string) => {
    setShowDetails(prev => ({ ...prev, [logId]: !prev[logId] }));
  };

  // Get log icon based on type
  const getLogIcon = (log: LogEntry) => {
    if (log.logType === 'activity') return <Activity className="h-4 w-4" />;
    if (log.logType === 'api') return <Server className="h-4 w-4" />;
    if (log.logType === 'system') return <Database className="h-4 w-4" />;
    return <Shield className="h-4 w-4" />;
  };

  // Get status badge
  const getStatusBadge = (log: LogEntry) => {
    if (log.success === false || (log.statusCode && log.statusCode >= 400)) {
      return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
    }
    return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />Success</Badge>;
  };

  // Get severity badge
  const getSeverityBadge = (severity: string) => {
    const variants = {
      critical: "destructive",
      error: "destructive", 
      warn: "secondary",
      info: "default",
      debug: "outline"
    } as const;
    
    return (
      <Badge variant={variants[severity as keyof typeof variants] || "default"}>
        {severity?.toUpperCase() || 'INFO'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdminRole()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">System Logs</h1>
            <Badge variant="secondary" className="ml-2">Audit Trail</Badge>
          </div>
          <p className="text-muted-foreground">
            Comprehensive audit trail of all system activities, security events, and API requests
          </p>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalActivities.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.successRate.toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed Activities</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{statistics.failedActivities.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Successful Activities</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{statistics.successfulActivities.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Log Type</label>
                <Select value={filters.logType} onValueChange={(value) => handleFilterChange('logType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select log type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Logs</SelectItem>
                    <SelectItem value="activity">User Activity</SelectItem>
                    <SelectItem value="system">System Events</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search logs..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                  <Button onClick={handleSearch} size="sm">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSearch} className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
              <Button onClick={handleExport} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button onClick={() => refetch()} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>System Logs</CardTitle>
            <CardDescription>
              Showing {logs?.pagination?.total || 0} log entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Machine</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs?.data?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {(() => {
                            try {
                              const date = new Date(log.createdAt);
                              
                              // The server is running in a timezone that's about 2 hours ahead of Kenya
                              // So we need to subtract 2 hours to get the correct Kenya time
                              const kenyaTime = new Date(date.getTime() - (2 * 60 * 60 * 1000));
                              
                              return kenyaTime.toLocaleString('en-GB', {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              });
                            } catch (error) {
                              return new Date(log.createdAt).toLocaleString();
                            }
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getLogIcon(log)}
                            <span className="capitalize">{log.logType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {log.actionType || log.method || log.eventType || 'N/A'}
                          </div>
                          {log.endpoint && (
                            <div className="text-sm text-muted-foreground font-mono">
                              {log.method} {log.endpoint}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {log.resourceName || log.resourceType || 'N/A'}
                          </div>
                          {log.resourceType && (
                            <div className="text-sm text-muted-foreground">
                              {log.resourceType}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span className="font-mono text-sm">
                              {(log.additionalContext?.userEmail) || (log.metadata?.userEmail) || (log.userId ? log.userId.substring(0, 8) + '...' : 'Anonymous')}
                            </span>
                          </div>
                          {log.ipAddress && (
                            <div className="text-sm text-muted-foreground font-mono">
                              {log.ipAddress}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4" />
                            <div className="text-sm">
                              <div className="font-medium">
                                {log.additionalContext?.machineInfo?.clientHostname || 
                                 log.metadata?.machineInfo?.clientHostname || 
                                 'Unknown Client'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {log.additionalContext?.machineInfo?.clientPlatform || 
                                 log.metadata?.machineInfo?.clientPlatform || 
                                 'Unknown Platform'}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {log.additionalContext?.machineInfo?.clientIP || 
                                 log.metadata?.machineInfo?.clientIP || 
                                 log.ipAddress || 
                                 'Unknown IP'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(log)}
                          {log.statusCode && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {log.statusCode}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getSeverityBadge(log.severity || 'info')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLog(log);
                              setIsModalOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {logs?.pagination && logs.pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((logs.pagination.page - 1) * logs.pagination.limit) + 1} to{' '}
                  {Math.min(logs.pagination.page * logs.pagination.limit, logs.pagination.total)} of{' '}
                  {logs.pagination.total} entries
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(logs.pagination.pages, prev + 1))}
                    disabled={currentPage === logs.pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log Details Modal */}
      <LogDetailsModal
        log={selectedLog}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedLog(null);
        }}
      />
    </div>
  );
}
