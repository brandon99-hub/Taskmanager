import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useScreenSize } from "@/hooks/use-mobile";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  DollarSign,
  BarChart3,
  Calendar,
  Target,
  Activity,
  Zap,
  Award,
  Briefcase,
  FileText,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PieChart,
  LineChart,
  BarChart
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Line, 
  Legend,
  Area,
  ComposedChart,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ReferenceDot
} from 'recharts';
import MilestoneDetailModal from "@/components/dashboard/milestone-detail-modal";


export default function ExecutiveDashboard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const { isMobile, isTablet } = useScreenSize();
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [isTransitioning, setIsTransitioning] = useState(false);


  // Handle month change with smooth transition
  const handleMonthChange = (value: string) => {
    setIsTransitioning(true);
    const newMonth = value === "all" ? undefined : parseInt(value);
    setSelectedMonth(newMonth);
    
    // Add a small delay to show the transition
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  };

  // Check if user has access to executive dashboard
  useEffect(() => {
    if (isAuthenticated && !['admin', 'manager'].includes((user as any)?.role)) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the Executive Dashboard",
        variant: "destructive",
      });
      // Redirect to dashboard
      window.location.href = '/';
    }
  }, [isAuthenticated, user, toast]);



  // Fetch real data from all available endpoints with filter support and better caching
  const { data: metricsData, isLoading: metricsLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/metrics', selectedPeriod, selectedYear, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPeriod !== 'all') params.append('period', selectedPeriod);
      if (selectedYear) params.append('year', selectedYear.toString());
      if (selectedMonth) params.append('month', selectedMonth.toString());
      
      const url = `/api/dashboard/metrics${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { 
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('Failed to fetch metrics data');
      return response.json();
    },
    enabled: isAuthenticated && ['admin', 'manager'].includes((user as any)?.role),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  const { data: workloadData, isLoading: workloadLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/workload'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/workload', { 
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('Failed to fetch workload data');
      return response.json();
    },
    enabled: isAuthenticated && ['admin', 'manager'].includes((user as any)?.role),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/invoice-report', selectedYear, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear.toString());
      if (selectedMonth) params.append('month', selectedMonth.toString());
      const url = `/api/dashboard/invoice-report${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { 
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('Failed to fetch invoice data');
      return response.json();
    },
    enabled: isAuthenticated && ['admin', 'manager'].includes((user as any)?.role),
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects', { 
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('Failed to fetch projects data');
      return response.json();
    },
    enabled: isAuthenticated && ['admin', 'manager'].includes((user as any)?.role),
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const response = await fetch('/api/tasks', { 
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('Failed to fetch tasks data');
      return response.json();
    },
    enabled: isAuthenticated && ['admin', 'manager'].includes((user as any)?.role),
  });

  const { data: teamsData, isLoading: teamsLoading } = useQuery<any[]>({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams', { 
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('Failed to fetch teams data');
      return response.json();
    },
    enabled: isAuthenticated && ['admin', 'manager'].includes((user as any)?.role),
  });

  // Invoice data fallback for charts (replicate main dashboard behavior)
  const invoice = invoiceData || {
    year: selectedYear,
    month: selectedMonth,
    monthlyTargets: { academic: 0, parastals: 0, private: 0, total: 0 },
    actualCollections: { academic: 0, parastals: 0, private: 0, total: 0 },
    segmentBreakdown: [],
    monthlyTrend: []
  };

  // Calculate real metrics from the data
  const calculateMetrics = () => {
    if (!projectsData || !tasksData || !metricsData) return null;

    const projects = filteredProjects; // Use filtered data instead of raw projectsData
    const tasks = filteredTasks; // Use filtered data instead of raw tasksData
    const metrics = metricsData;

    // Project status counts - count ALL projects regardless of status
    const totalProjects = projects.length;
    const onTrackProjects = projects.filter(p => p.status === 'active' && p.progress >= 80).length;
    const atRiskProjects = projects.filter(p => p.status === 'active' && p.progress < 50).length;
    const onHoldProjects = projects.filter(p => p.status === 'on_hold').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const onSLAProjects = projects.filter(p => p.status === 'on_support').length;
    const inactiveProjects = projects.filter(p => p.status === 'inactive').length;
    const activeProjects = projects.filter(p => p.status === 'active').length;

    // Task status counts
    const totalMilestones = tasks.length;
    const completedMilestones = tasks.filter(t => t.status === 'done').length;
    const inProgressMilestones = tasks.filter(t => t.status === 'in_progress').length;
    const overdueMilestones = tasks.filter(t => {
      if (t.dueDate && t.status !== 'done') {
        return new Date(t.dueDate) < new Date();
      }
      return false;
    }).length;

    // Revenue calculations - Use corrected invoice report data for consistency
    // The invoice report now uses milestone due dates (not completion dates) and includes ALL milestones
    const expectedRevenue = invoice?.monthlyTargets?.total || 0; // Total expected revenue for the year
    const totalRevenue = invoice?.invoiceSent?.total || 0; // Total revenue (invoices sent)
    const collectedRevenue = invoice?.actualCollections?.total || 0; // Actually collected revenue
    const pendingRevenue = totalRevenue - collectedRevenue; // Pending revenue (sent but not paid)

    // Use the corrected invoice data for yearly metrics
    const yearlyTarget = invoice?.monthlyTargets?.total || 0;
    const yearlyCollected = invoice?.actualCollections?.total || 0;
    const yearlyRevenue = yearlyTarget; // Use the corrected expected revenue

    // Segment performance - use corrected invoice report data for consistency
    const segmentData = projects.reduce((acc, project) => {
      const segment = project.segment || 'private';
      if (!acc[segment]) {
        acc[segment] = { projects: 0, revenue: 0, completion: 0, collectedRevenue: 0 };
      }
      acc[segment].projects++;
      acc[segment].revenue += parseFloat(project.budget || '0');
      acc[segment].completion += project.progress || 0;
      
      // Use corrected invoice data for segment revenue (based on milestone due dates)
      // This ensures consistency with the invoice report
      const segmentExpected = invoice?.monthlyTargets?.[segment] || 0;
      const segmentCollected = invoice?.actualCollections?.[segment] || 0;
      acc[segment].collectedRevenue = segmentCollected;
      
      return acc;
    }, {} as any);

    // Calculate average completion for each segment
    Object.keys(segmentData).forEach(segment => {
      if (segmentData[segment].projects > 0) {
        segmentData[segment].completion = Math.round(segmentData[segment].completion / segmentData[segment].projects);
      }
    });

    return {
      totalProjects,
      onTrackProjects,
      atRiskProjects,
      onHoldProjects,
      completedProjects,
      onSLAProjects,
      inactiveProjects,
      activeProjects,
      totalMilestones,
      completedMilestones,
      inProgressMilestones,
      overdueMilestones,
      expectedRevenue,
      totalRevenue,
      collectedRevenue,
      pendingRevenue,
      yearlyRevenue,
      yearlyCollected,
      yearlyTarget,
      segmentData,
      // Real metrics from API
      totalBudget: metrics?.totalBudget || 0,
      collectedAmount: metrics?.collectedAmount || 0,
      pendingAmount: metrics?.pendingAmount || 0
    };
  };

  const dashboardLoading = metricsLoading || workloadLoading || invoiceLoading || projectsLoading || tasksLoading || teamsLoading;
  
  // More granular loading states for better UX
  const loadingStates = {
    metrics: metricsLoading,
    workload: workloadLoading,
    invoice: invoiceLoading,
    projects: projectsLoading,
    tasks: tasksLoading,
    teams: teamsLoading
  };
  
  const loadingCount = Object.values(loadingStates).filter(Boolean).length;
  const totalDataSources = Object.keys(loadingStates).length;
  const isFiltering = selectedPeriod !== 'all' || selectedMonth !== undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !['admin', 'manager'].includes((user as any)?.role)) {
    return null;
  }



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number, total: number) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  // Filter data based on selected period, year, and month
  const filterDataByPeriod = (data: any[], period: string, year: number, month?: number) => {
    if (period === 'all') return data;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    return data.filter(item => {
      const itemDate = new Date(item.startDate || item.createdAt || item.date);
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      switch (period) {
        case 'year':
          return itemYear === year;
        case 'quarter':
          const quarter = Math.ceil(currentMonth / 3);
          const itemQuarter = Math.ceil(itemMonth / 3);
          return itemYear === currentYear && itemQuarter === quarter;
        case 'month':
          return itemYear === currentYear && itemMonth === currentMonth;
        default:
          return true;
      }
    });
  };

  // Chart data preparation - Fixed "On Support" logic with filtering
  const filteredProjects = filterDataByPeriod(projectsData || [], selectedPeriod, selectedYear, selectedMonth);
  const filteredTasks = filterDataByPeriod(tasksData || [], selectedPeriod, selectedYear, selectedMonth);
  
  // Calculate metrics after filtering
  const metrics = calculateMetrics();

  // Show loading state while data is being fetched
  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-bounce" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-20 left-1/2 w-40 h-40 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-bounce" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Main loading content */}
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            {/* Animated logo/icon */}
            <div className="relative mb-8">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-2xl flex items-center justify-center animate-pulse">
                <BarChart3 className="h-12 w-12 text-white animate-bounce" />
              </div>
            </div>

            {/* Main loading text */}
            <h1 className="text-3xl font-bold text-gray-800 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Loading Executive Dashboard
            </h1>
            <p className="text-gray-600 text-lg mb-6">Preparing your business insights...</p>

            {/* Progress bar */}
            <div className="w-80 h-3 bg-gray-200 rounded-full mx-auto mb-6 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse" style={{ width: `${(loadingCount / totalDataSources) * 100}%` }}></div>
            </div>

            {/* Loading progress text */}
            <p className="text-gray-700 font-medium mb-6">
              Loading {loadingCount} of {totalDataSources} data sources...
            </p>

            {/* Animated data source indicators */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {Object.entries(loadingStates).map(([key, loading], index) => (
                <div key={key} className="relative group">
                  <div className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                    loading 
                      ? 'border-blue-300 bg-blue-50 shadow-lg scale-105' 
                      : 'border-green-300 bg-green-50'
                  }`}>
                    {/* Animated icon */}
                    <div className="flex items-center justify-center mb-2">
                      {loading ? (
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      )}
                    </div>
                    
                    {/* Label */}
                    <span className={`text-sm font-medium capitalize ${
                      loading ? 'text-blue-700' : 'text-green-700'
                    }`}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    
                    {/* Status */}
                    <div className="text-xs mt-1">
                      {loading ? (
                        <span className="text-blue-600 animate-pulse">Loading...</span>
                      ) : (
                        <span className="text-green-600">Ready</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Hover effect */}
                  {loading && (
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Fun loading message */}
            <div className="mt-8 text-gray-500">
              <p className="text-sm animate-pulse">
                {loadingCount === totalDataSources ? 'Almost there...' : 
                 loadingCount > totalDataSources / 2 ? 'Gathering insights...' : 
                 'Initializing dashboard...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state only if data failed to load after loading is complete
  if (!metrics && !dashboardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Failed to load dashboard data</p>
          <p className="text-gray-500 text-sm mt-2">Please refresh the page or try again later</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
            variant="outline"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  // Ensure metrics exists before proceeding
  if (!metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No dashboard data available</p>
          <p className="text-gray-500 text-sm mt-2">Please check your data sources and try again</p>
        </div>
      </div>
    );
  }
  
    // Invoice data preparation for the new invoice chart - Clean and Simple
  const invoiceChartData = (() => {
    if (!invoiceData || !invoiceData.monthlyTrend) return [];
    
    // Transform the invoice data for the chart
    return invoiceData.monthlyTrend.map((month: any) => ({
      month: month.month,
      sent: month.invoicesSent || 0,
      paid: month.invoicesPaid || 0,
      sentAmount: month.sent || 0,
      paidAmount: month.paid || 0
    })).sort((a: any, b: any) => {
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });
  })();

  const projectStatusData = [
    { name: 'On Track', value: metrics.onTrackProjects, color: '#10B981' },
    { name: 'At Risk', value: metrics.atRiskProjects, color: '#F59E0B' },
    { name: 'On Hold', value: metrics.onHoldProjects, color: '#EF4444' },
    { name: 'Completed', value: metrics.completedProjects, color: '#3B82F6' },
    { name: 'On SLA', value: metrics.onSLAProjects, color: '#8B5CF6' },
    { name: 'Inactive', value: metrics.inactiveProjects, color: '#6B7280' }
  ];

  const revenueData = [
    { name: 'Collected', value: metrics.collectedRevenue, color: '#10B981' },
    { name: 'Pending', value: metrics.pendingRevenue, color: '#F59E0B' }
  ];

  const segmentChartData = Object.entries(metrics.segmentData).map(([segment, data]: [string, any]) => ({
    segment: segment.charAt(0).toUpperCase() + segment.slice(1),
    projects: data.projects,
    revenue: data.revenue,
    completion: data.completion
  }));

  const monthlyRevenueData = [
    { month: 'Jan', revenue: 2500000, collected: 2200000 },
    { month: 'Feb', revenue: 3200000, collected: 2800000 },
    { month: 'Mar', revenue: 2800000, collected: 2500000 },
    { month: 'Apr', revenue: 3500000, collected: 3200000 },
    { month: 'May', revenue: 4000000, collected: 3800000 },
    { month: 'Jun', revenue: 4500000, collected: 4200000 }
  ];

  const taskProgressData = [
    { name: 'Completed', value: metrics.completedMilestones, color: '#10B981' },
    { name: 'In Progress', value: metrics.inProgressMilestones, color: '#3B82F6' },
    { name: 'Overdue', value: metrics.overdueMilestones, color: '#EF4444' }
  ];

  // Prepare data for the new pie chart - use REAL invoice data from API
  const segmentPerformanceData = (() => {
    if (!invoiceData || !invoiceData.segmentBreakdown) return [];
    
    // Use real segment data from invoice API
    const segmentBreakdown = invoiceData.segmentBreakdown;
    
    return segmentBreakdown
      .filter((segment: any) => segment.collected > 0) // Only show segments with actual collections
      .map((segment: any) => ({
        name: segment.segment.charAt(0).toUpperCase() + segment.segment.slice(1),
        value: segment.collected || 0, // Use real collected amount
        color: segment.segment === 'academic' ? '#3B82F6' : 
               segment.segment === 'parastals' ? '#10B981' : 
               segment.segment === 'private' ? '#8B5CF6' : '#6B7280' // Default color for other segments
      }))
      .sort((a: any, b: any) => b.value - a.value); // Sort by revenue descending
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-12">
        
        {/* Executive Dashboard Header */}
        <div className="mb-6">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Executive Dashboard
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Strategic insights and performance metrics for executive decision-making
            </p>
            {isFiltering && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Filters Active
                </Badge>
                <span className="text-slate-700">
                  {selectedPeriod !== 'all' && `${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}`}
                  {selectedMonth && ` - ${new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                </span>
              </div>
            )}
          </div>
          
          {/* Professional Filter Controls */}
          <div className="flex flex-col lg:flex-row items-center justify-center gap-4 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-slate-700 font-medium">Time Period:</span>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40 bg-white border-slate-300 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-slate-700 font-medium">Year:</span>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-32 bg-white border-slate-300 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-slate-700 font-medium">Month:</span>
              <Select 
                value={selectedMonth?.toString() || "all"} 
                onValueChange={handleMonthChange}
              >
                <SelectTrigger className="w-36 bg-white border-slate-300 text-slate-900">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  <SelectItem value="1">January</SelectItem>
                  <SelectItem value="2">February</SelectItem>
                  <SelectItem value="3">March</SelectItem>
                  <SelectItem value="4">April</SelectItem>
                  <SelectItem value="5">May</SelectItem>
                  <SelectItem value="6">June</SelectItem>
                  <SelectItem value="7">July</SelectItem>
                  <SelectItem value="8">August</SelectItem>
                  <SelectItem value="9">September</SelectItem>
                  <SelectItem value="10">October</SelectItem>
                  <SelectItem value="11">November</SelectItem>
                  <SelectItem value="12">December</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 hover:from-blue-700 hover:to-purple-700 shadow-lg">
              <Zap className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            
            {/* Enhanced loading indicator for data refresh */}
            {dashboardLoading && (
              <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 shadow-sm">
                <div className="relative">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 w-5 h-5 border-2 border-purple-400 border-t-purple-600 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>
                <span className="text-sm font-medium text-blue-700">Refreshing Data</span>
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">
          {/* Total Revenue */}
          <Card className="bg-gradient-to-br from-emerald-600 to-green-700 border-0 shadow-2xl transform hover:scale-105 transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-emerald-100 flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                {selectedPeriod === 'all' ? 'Yearly Revenue' : selectedPeriod === 'year' ? 'Yearly Revenue' : selectedPeriod === 'month' ? 'Monthly Revenue' : 'Revenue Target'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">
                  {formatCurrency(metrics.yearlyRevenue)}
                </div>
                <div className="text-lg text-emerald-100 font-medium">
                  {formatCurrency(metrics.yearlyCollected)}
                </div>
                <div className="text-sm text-emerald-200 mt-2">
                  collected
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Projects */}
          <Card className="bg-gradient-to-br from-blue-600 to-cyan-700 border-0 shadow-2xl transform hover:scale-105 transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-blue-100 flex items-center gap-2">
                <Briefcase className="h-6 w-6" />
                Active Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">
                  {metrics.activeProjects}
                </div>
                <div className="text-lg text-blue-100 font-medium">
                  out of {metrics.totalProjects}
                </div>
                <div className="text-sm text-blue-200 mt-2">
                  total projects
                </div>
                <div className="text-xs text-blue-300 mt-1 font-medium">
                  {metrics.totalProjects - metrics.activeProjects} other statuses
                </div>
              </div>
            </CardContent>
          </Card>

          {/* At Risk Milestones */}
          <MilestoneDetailModal
            type="overdue"
            trigger={
              <Card className="bg-gradient-to-br from-orange-600 to-red-700 border-0 shadow-2xl transform hover:scale-105 transition-all duration-300 cursor-pointer">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-semibold text-orange-100 flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6" />
                    At Risk Milestones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white mb-2">
                      {metrics.overdueMilestones}
                    </div>
                    <div className="text-lg text-orange-100 font-medium">
                      overdue
                    </div>
                    <div className="text-sm text-orange-200 mt-2">
                      within 1 week
                    </div>
                  </div>
                </CardContent>
              </Card>
            }
          />

          {/* Completion Rate */}
          <Card className="bg-gradient-to-br from-purple-600 to-violet-700 border-0 shadow-2xl transform hover:scale-105 transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-purple-100 flex items-center gap-2">
                <Target className="h-6 w-6" />
                Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">
                  {formatPercentage(metrics.completedMilestones, metrics.totalMilestones)}%
                </div>
                <div className="text-lg text-purple-100 font-medium">
                  {metrics.completedMilestones}/{metrics.totalMilestones}
                </div>
                <div className="text-sm text-purple-200 mt-2">
                  milestones completed
                </div>
                <div className="text-xs text-purple-300 mt-1 font-medium">
                  {metrics.inProgressMilestones} in progress
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Executive Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Invoice Sent vs Paid Chart - Fresh Start */}
          <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="border-b border-slate-200/50 bg-gradient-to-r from-emerald-50 to-green-100/80">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                Invoice Sent vs Paid
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!invoiceChartData || invoiceChartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <div className="text-sm font-medium">📊 No invoice data available</div>
                    <div className="text-xs text-slate-400 mt-1">Select a different time period</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={invoiceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                        <XAxis 
                          dataKey="month" 
                          stroke="#64748b" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#475569', fontSize: 12 }} 
                        />
                        <YAxis 
                          yAxisId="left"
                          stroke="#64748b" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#475569', fontSize: 12 }}
                          label={{ value: 'Invoice Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b' } }}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke="#64748b" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#475569', fontSize: 12 }}
                          label={{ value: 'Amount (KES)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#64748b' } }}
                        />
                        
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4">
                                  <div className="text-sm font-semibold mb-3 text-slate-800">{data.month}</div>
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-600">Invoices Sent:</span>
                                      <span className="text-blue-600 font-semibold">{data.sent}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-600">Invoices Paid:</span>
                                      <span className="text-green-600 font-semibold">{data.paid}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-600">Amount Sent:</span>
                                      <span className="text-blue-600 font-semibold">KSh {data.sentAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-600">Amount Paid:</span>
                                      <span className="text-green-600 font-semibold">KSh {data.paidAmount.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        
                        <Legend 
                          wrapperStyle={{
                            paddingTop: '20px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        />
                        
                        {/* Invoice Count Bars */}
                        <Bar 
                          yAxisId="left"
                          dataKey="sent" 
                          fill="#3B82F6" 
                          radius={[4, 4, 0, 0]}
                          name="Invoices Sent"
                          maxBarSize={40}
                          opacity={0.8}
                        />
                        <Bar 
                          yAxisId="left"
                          dataKey="paid" 
                          fill="#10B981" 
                          radius={[4, 4, 0, 0]}
                          name="Invoices Paid"
                          maxBarSize={40}
                          opacity={0.8}
                        />
                        
                        {/* Amount Lines */}
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="sentAmount" 
                          stroke="#3B82F6" 
                          strokeWidth={3}
                          name="Amount Sent"
                          dot={{ fill: '#3B82F6', r: 4, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2, fill: '#fff' }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="paidAmount" 
                          stroke="#10B981" 
                          strokeWidth={3}
                          name="Amount Paid"
                          dot={{ fill: '#10B981', r: 4, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2, fill: '#fff' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Summary Metrics */}
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="text-2xl font-bold text-blue-700 mb-1">
                        {invoiceChartData.reduce((sum: any, item: any) => sum + item.sent, 0)}
                      </div>
                      <div className="text-sm text-blue-600 font-medium">Total Sent</div>
                      <div className="text-xs text-blue-500 mt-1">
                        KSh {invoiceChartData.reduce((sum: any, item: any) => sum + item.sentAmount, 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="text-2xl font-bold text-green-700 mb-1">
                        {invoiceChartData.reduce((sum: any, item: any) => sum + item.paid, 0)}
                      </div>
                      <div className="text-sm text-green-600 font-medium">Total Paid</div>
                      <div className="text-xs text-green-500 mt-1">
                        KSh {invoiceChartData.reduce((sum: any, item: any) => sum + item.paidAmount, 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Main Content with Smooth Transitions - Equal width */}
          <div className={`space-y-6 transition-all duration-300 ease-in-out ${isTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
          {/* Revenue Overview - Line Chart with Real Data */}
          <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="border-b border-slate-200/50 bg-gradient-to-r from-emerald-50 to-green-100/80">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg">
                  <LineChart className="h-5 w-5 text-white" />
                </div>
                Revenue Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={invoice.monthlyTrend && invoice.monthlyTrend.length > 0 ? invoice.monthlyTrend.map((month: any) => ({
                    month: month.month,
                    collected: month.paid || 0, // Use 'paid' instead of 'actual'
                    pending: month.expected > 0 ? Math.max(0, month.expected - month.paid) : 0
                  })) : [
                    { month: 'Jan', collected: metrics.collectedRevenue, pending: metrics.pendingRevenue },
                    { month: 'Feb', collected: metrics.collectedRevenue, pending: metrics.pendingRevenue },
                    { month: 'Mar', collected: metrics.collectedRevenue, pending: metrics.pendingRevenue },
                    { month: 'Apr', collected: metrics.collectedRevenue, pending: metrics.pendingRevenue },
                    { month: 'May', collected: metrics.collectedRevenue, pending: metrics.pendingRevenue },
                    { month: 'Jun', collected: metrics.collectedRevenue, pending: metrics.pendingRevenue }
                  ]}>
                    <defs>
                      <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                    <XAxis dataKey="month" stroke="#64748b" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis stroke="#64748b" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(value as number), 'Amount']}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        backdropFilter: 'blur(6px)',
                        padding: '12px 16px'
                      }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="collected" 
                      stroke="#10B981" 
                      strokeWidth={3}
                      fill="url(#collectedGradient)" 
                      name="Collected Revenue"
                      fillOpacity={0.6}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="pending" 
                      stroke="#F59E0B" 
                      strokeWidth={3}
                      fill="url(#pendingGradient)" 
                      name="Pending Revenue"
                      fillOpacity={0.6}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                  <div className="text-xl font-bold text-emerald-700">
                    {formatCurrency(metrics.collectedRevenue)}
                  </div>
                  <p className="text-sm text-emerald-600 font-medium">Collected</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-xl">
                  <div className="text-xl font-bold text-orange-700">
                    {formatCurrency(metrics.pendingRevenue)}
                  </div>
                  <p className="text-sm text-orange-600 font-medium">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

            {/* Strategic Charts Section */}
            <div className="space-y-6">
          {/* Monthly Performance & Achievement Analysis - Full Width */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50/30 w-full">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-t-lg">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Performance & Achievement Analysis
              </CardTitle>
              <CardDescription className="text-indigo-100">
                {selectedYear} - Target vs Actual Collections with Achievement Metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={invoice.monthlyTrend.map((month: any) => ({
                      ...month,
                      target: month.expected, // Use expected instead of target
                      actual: month.paid,      // Use paid instead of actual
                      achievement: month.expected > 0 ? Math.round((month.paid / month.expected) * 100) : 0,
                      gap: month.expected > 0 ? Math.max(0, month.expected - month.paid) : 0
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="targetGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="achievementGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#d1d5db' }}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                      axisLine={{ stroke: '#d1d5db' }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickFormatter={(value) => `${value}%`}
                      axisLine={{ stroke: '#d1d5db' }}
                    />
                    <Tooltip 
                      formatter={(value: any, name: any) => {
                        const map: Record<string, string> = {
                          target: 'Target (KES)',
                          actual: 'Actual (KES)',
                          gap: 'Gap to Target (KES)',
                          achievement: 'Achievement %'
                        };
                        const label = map[String(name)] || String(name);
                        // Ensure achievement shows only percentage, no currency
                        const formatted = String(name) === 'achievement'
                          ? `${Number(value)}%`
                          : `KSh ${Number(value).toLocaleString()}`;
                        return [formatted, label];
                      }}
                      labelFormatter={(label) => `Month: ${label}`}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        backdropFilter: 'blur(10px)',
                        padding: '12px 16px'
                      }}
                      cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                    />
                    <Legend 
                      wrapperStyle={{
                        paddingTop: '20px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    />
                    <Area yAxisId="left" type="monotone" dataKey="target" stroke="#3b82f6" strokeWidth={3} fill="url(#targetGradient)" name="Target" fillOpacity={0.6} animationDuration={2000} animationBegin={0} />
                    <Area yAxisId="left" type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={3} fill="url(#actualGradient)" name="Actual" fillOpacity={0.6} animationDuration={2000} animationBegin={500} />
                    <Bar yAxisId="right" dataKey="achievement" fill="url(#achievementGradient)" name="Achievement %" radius={[6, 6, 0, 0]} maxBarSize={40} opacity={0.8} animationDuration={1500} animationBegin={1000} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Segment Performance Analysis (Pie Chart) */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50/30">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-t-lg">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Segment Performance Analysis
              </CardTitle>
              <CardDescription className="text-indigo-100">
                {selectedYear} - Collections by Segment
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-80 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={segmentPerformanceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent, value }) => `${name}\n${(percent * 100).toFixed(0)}%\nKSh ${(value / 1000000).toFixed(1)}M`}
                      innerRadius={60}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      animationDuration={1500}
                      animationBegin={0}
                    >
                      {segmentPerformanceData.map((entry: any, index: any) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                          formatter={(value: any) => [`${Number(value).toLocaleString()}`, 'Amount']}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        backdropFilter: 'blur(10px)',
                        padding: '12px 16px'
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: 500 }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
                
                {/* Center label showing total collected revenue */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">
                          {(segmentPerformanceData.reduce((sum: any, item: any) => sum + item.value, 0) / 1000000).toFixed(1)}M
                    </div>
                    <div className="text-sm text-gray-600">Total Collected</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
              </div>
      </div>

      {/* Performance & Support Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Task Progress - Pie Chart */}
          <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="border-b border-slate-200/50 bg-gradient-to-r from-indigo-50 to-indigo-100/80">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-lg">
                  <Target className="h-4 w-4 text-white" />
                </div>
                Milestone Progress Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={taskProgressData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      innerRadius={40}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      animationDuration={1500}
                      animationBegin={0}
                    >
                      {taskProgressData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [value, 'Milestones']}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        backdropFilter: 'blur(6px)',
                        padding: '12px 16px'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Support Projects Overview */}
          <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="border-b border-slate-200/50 bg-gradient-to-r from-purple-50 to-purple-100/80">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg">
                  <Eye className="h-4 w-4 text-white" />
                </div>
                Support Projects Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="text-center p-4 bg-purple-50 rounded-2xl">
                      <div className="text-3xl font-bold text-purple-700 mb-2">{metrics.onSLAProjects}</div>
                      <p className="text-base text-purple-600 font-medium">Currently on SLA</p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-2xl">
                  <div className="text-3xl font-bold text-green-700 mb-2">{metrics.completedProjects}</div>
                  <p className="text-base text-green-600 font-medium">Successfully Completed</p>
                </div>
                
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-semibold text-slate-700">Success Rate</span>
                    <span className="text-xl font-bold text-slate-800">
                          {formatPercentage(metrics.onSLAProjects, metrics.completedProjects + metrics.onSLAProjects)}%
                    </span>
                  </div>
                  <Progress 
                        value={formatPercentage(metrics.onSLAProjects, metrics.completedProjects + metrics.onSLAProjects)} 
                    className="h-3 bg-slate-200"
                  />
                  <p className="text-xs text-slate-600 mt-2 text-center font-medium">
                        Projects that moved from completed to SLA
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Executive Actions & Insights */}
          <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="border-b border-slate-200/50 bg-gradient-to-r from-blue-50 to-blue-100/80">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                Executive Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start h-12 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-200 text-blue-800" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Monthly Report
                </Button>
                
                <Button variant="outline" className="w-full justify-start h-12 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border-purple-200 text-purple-800" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Review Team Performance
                </Button>
                
                <Button variant="outline" className="w-full justify-start h-12 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-green-200 text-green-800" size="sm">
                  <DollarSign className="h-4 w-4 mr-3" />
                  Financial Overview
                </Button>
                
                <Button variant="outline" className="w-full justify-start h-12 bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 border-orange-200 text-orange-800" size="sm">
                  <Target className="h-4 w-4 mr-2" />
                  Set Milestone Targets
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Section */}
        <div className="mb-6">
          <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="border-b border-slate-200/50 bg-gradient-to-r from-slate-50 to-slate-100/80">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-slate-500 to-gray-600 rounded-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200/50">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Project Completed</p>
                    <p className="text-xs text-green-600">Academic Portal v2.0 finished successfully</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200/50">
                  <div className="p-2 bg-orange-500 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Milestone Overdue</p>
                    <p className="text-xs text-orange-600">Private Sector CRM - Phase 2 delayed</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200/50">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Payment Received</p>
                    <p className="text-xs text-blue-600">Parastals Project invoice paid</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
