import { useState, useEffect, Fragment } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Target,
  Plus,
  FileDown,
  LogOut,
  BarChart3,
  User,
  Settings,
  Bell,
  Menu,
  X,
  PieChart,
  Activity,
  Home,
  UserCheck,
  Calendar,
  BarChart2,
  PieChart as PieChartIcon,
  Table as TableIcon,
  LineChart,
  Filter,
  XCircle
} from "lucide-react";
import { MarketingLeadsTable } from "@/components/marketing/leads-table";
import { MarketingSalesWonTable } from "@/components/marketing/sales-won-table";
import { MarketingExpectedOrdersTable } from "@/components/marketing/expected-orders-table";
import { MarketingProspectsTable } from "@/components/marketing/prospects-table";
import { MarketingProspectsForm } from "@/components/marketing/prospects-form";
import { LostProjectsTable } from "@/components/marketing/lost-projects-table";
import { SectorsManagement } from "@/components/marketing/sectors-management";
import { UserManagement } from "@/components/marketing/user-management";
import { SalesWonChart } from "@/components/marketing/sales-won-chart";
import { ExpectedOrdersPieChart } from "@/components/marketing/expected-orders-pie-chart";
import { MonthlyTrendsChart } from "@/components/marketing/monthly-trends-chart";
import { SalesWonChartSkeleton, PieChartSkeleton, LineChartSkeleton, TableSkeleton } from "@/components/marketing/chart-skeletons";
import MarketingPasswordChangeModal from "@/components/marketing/marketing-password-change-modal";
import { useScreenSize } from "@/hooks/use-mobile";

interface DashboardStats {
  year: number;
  prospectsCount: number;
  leadsCount: number;
  expectedOrdersCount: number;
  salesWonCount: number;
  totalRevenue: number;
  target: number;
  revisedTarget: number;
  expectedTarget: number;
  targetAchievement: number;
  annualSummary: any;
}

interface AdminDashboardStats {
  year: number;
  totalProspectsCount: number;
  totalLeadsCount: number;
  totalExpectedOrdersCount: number;
  totalSalesWonCount: number;
  totalRevenue: number;
  bdStats: Array<{
    bdId: string;
    bdName: string;
    prospectsCount: number;
    leadsCount: number;
    expectedOrdersCount: number;
    salesWonCount: number;
    totalRevenue: number;
  }>;
}

interface AnalyticsData {
  year: number;
  conversionRates: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
  quarterlyStats: Array<{
    quarter: string;
    leadsCount: number;
    salesWonTotal: number;
  }>;
  bdStats: Array<{
    bdId: string;
    bdName: string;
    prospectsCount: number;
    leadsCount: number;
    expectedOrdersCount: number;
    salesWonCount: number;
    totalRevenue: number;
    target: number;
  }>;
  topPerformers: Array<{
    marketerId: string;
    marketerName: string;
    salesWonAmount: number;
    expectedOrdersAmount: number;
    leadsCount: number;
    totalProspectsHandled: number;
    target: number;
    conversionRate: number;
    weightedScore: number;
    totalRevenue: number; // For backward compatibility
  }>;
  salesWonPerMarketer: Array<{
    marketerId: string;
    marketerName: string;
    salesWon: number;
    target: number;
    achievementRate: number;
  }>;
  expectedOrdersShare: Array<{
    marketerId: string;
    marketerName: string;
    expectedOrders: number;
    percentage: number;
    color: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    leads: number;
    salesWon: number;
    expectedOrders: number;
  }>;
}

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'marketer';
  mustChangePassword?: boolean;
}

export default function MarketingDashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<MarketingUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedMarketer, setSelectedMarketer] = useState<string>("");
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('chart');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  const { isMobile, isTablet } = useScreenSize();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("marketingToken");
    const userData = localStorage.getItem("marketingUser");

    if (!token || !userData) {
      setLocation("/marketing/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Show password change modal if required
      if (parsedUser.mustChangePassword) {
        setShowPasswordChangeModal(true);
      }
    } catch (error) {
      setLocation("/marketing/login");
      return;
    }

    // Load dashboard stats
    loadDashboardStats();
  }, []);

  useEffect(() => {
    if (user?.role) {
      loadDashboardStats();
    }
  }, [user?.role]);

  const loadDashboardStats = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      
      if (user?.role === 'admin') {
        setAnalyticsLoading(true);
        
        // Build analytics URL with filters
        const analyticsParams = new URLSearchParams();
        if (selectedYear) analyticsParams.append('year', selectedYear);
        if (selectedMonth && selectedMonth !== 'all') analyticsParams.append('month', selectedMonth);
        
        // Load admin dashboard stats
        const [adminResponse, analyticsResponse] = await Promise.all([
          fetch("/api/marketing/admin/dashboard/stats", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/marketing/admin/analytics?${analyticsParams.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);

        if (adminResponse.ok) {
          const adminData = await adminResponse.json();
          setAdminStats({
            year: adminData.year || new Date().getFullYear(),
            totalProspectsCount: adminData.totalProspectsCount || 0,
            totalLeadsCount: adminData.totalLeadsCount || 0,
            totalExpectedOrdersCount: adminData.totalExpectedOrdersCount || 0,
            totalSalesWonCount: adminData.totalSalesWonCount || 0,
            totalRevenue: adminData.totalRevenue || 0,
            bdStats: adminData.bdStats || [],
          });
        } else {
          console.error("Admin stats API failed:", adminResponse.status);
        }

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          setAnalytics(analyticsData);
        } else {
          const errorText = await analyticsResponse.text();
          console.error("Analytics API failed:", analyticsResponse.status, errorText);
          // Set empty analytics data to prevent loading state
          setAnalytics({
            year: new Date().getFullYear(),
            conversionRates: [],
            quarterlyStats: [],
            bdStats: [],
            topPerformers: [],
            salesWonPerMarketer: [],
            expectedOrdersShare: [],
            monthlyTrends: []
          });
        }
        
        setAnalyticsLoading(false);
      } else {
        // Load regular marketer stats
      const response = await fetch("/api/marketing/dashboard/stats", {
          headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          year: data.year || new Date().getFullYear(),
          prospectsCount: data.prospectsCount || 0,
          leadsCount: data.leadsCount || 0,
          expectedOrdersCount: data.expectedOrdersCount || 0,
          salesWonCount: data.salesWonCount || 0,
          totalRevenue: data.totalRevenue || 0,
          target: data.target || 0,
          revisedTarget: data.revisedTarget || 0,
          expectedTarget: data.expectedTarget || 0,
          targetAchievement: data.targetAchievement || 0,
          annualSummary: data.annualSummary || null,
        });
        }
      }
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    } finally {
      setLoading(false);
      setAnalyticsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("marketingToken");
    localStorage.removeItem("marketingUser");
    setLocation("/marketing/login");
  };

  const handleExport = async (type: string) => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/export?type=${type}&format=excel`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}_export.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Marketing Pipeline...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navigationItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "prospects", label: "Prospects", icon: UserCheck },
    { id: "leads", label: "Leads", icon: Users },
    { id: "expected-orders", label: "Expected Orders", icon: Target },
    { id: "sales-won", label: "Sales Won", icon: TrendingUp },
    { id: "lost-projects", label: "Lost Projects", icon: XCircle },
    ...(user?.role === 'admin' ? [
      { id: "sectors", label: "Sectors", icon: PieChart },
      { id: "users", label: "Users", icon: UserCheck },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center space-x-3 p-6 border-b border-gray-200">
            <img 
              src="/Appkings.png" 
              alt="AppKings Logo" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Marketing</h1>
              <p className="text-xs text-gray-600">Pipeline Dashboard</p>
            </div>
                </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    if (isMobile) setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 mb-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
                <AvatarFallback className="bg-primary text-white">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-600 truncate">{user?.email}</p>
                <Badge variant="secondary" className="text-xs mt-1">
                  {user?.role}
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                localStorage.removeItem("marketingToken");
                localStorage.removeItem("marketingUser");
                setLocation("/marketing/login");
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
                </div>
              </div>
            </div>
            
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Mobile menu button */}
              <div className="lg:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                  {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </div>

              {/* Page Title */}
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 capitalize">
                  {activeSection.replace('-', ' ')}
                </h2>
                <p className="text-sm text-gray-600">
                  {activeSection === 'overview' && 'Your marketing performance overview with analytics'}
                  {activeSection === 'prospects' && 'Track potential opportunities and initial client interest'}
                  {activeSection === 'leads' && 'Manage qualified leads and interested clients'}
                  {activeSection === 'expected-orders' && 'Monitor expected orders and revenue'}
                  {activeSection === 'sales-won' && 'Track successful sales and contracts'}
                  {activeSection === 'lost-projects' && 'Review projects that didn\'t proceed and analyze reasons for loss'}
                  {activeSection === 'sectors' && 'Manage business sectors and their projects'}
                  {activeSection === 'users' && 'Manage marketing team members'}
                </p>
              </div>

              {/* Header Actions */}
            <div className="flex items-center space-x-4">
                <Button variant="outline" size="sm" className="h-9">
                  <FileDown className="h-4 w-4 mr-2" />
                  Export
                </Button>
                
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                      <Bell className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <div className="p-4">
                      <h4 className="font-semibold text-gray-900">Notifications</h4>
                      <p className="text-sm text-gray-600 mt-1">You have no new notifications</p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

        {/* Main Content Area */}
        <div className="flex-1 p-6">

          {activeSection === 'overview' && (
            <div key="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {user?.role === 'admin' ? (
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                      Total Prospects (All)
                  </CardTitle>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                      {adminStats?.totalProspectsCount || 0}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                      All marketers combined
                  </p>
                </CardContent>
              </Card>
              ) : (
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Target Achievement
                    </CardTitle>
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Target className="h-4 w-4 text-orange-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-900">
                      {formatCurrency(stats?.totalRevenue || 0)}
                    </div>
                    <p className="text-xs text-green-600 font-medium mt-1">
                      {stats && (stats.revisedTarget > 0 || stats.target > 0) ? (
                        <>
                          of {formatCurrency(stats.revisedTarget > 0 ? stats.revisedTarget : stats.target)} {stats.revisedTarget > 0 ? 'revised ' : ''}target
                        </>
                      ) : (
                        'No target set for this year'
                      )}
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {user?.role === 'admin' ? 'Total Sales Won (All)' : 'Sales Won'}
                  </CardTitle>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {user?.role === 'admin' 
                      ? (adminStats?.totalSalesWonCount || 0)
                      : (stats?.salesWonCount || 0)
                    }
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {user?.role === 'admin' ? 'All marketers combined' : 'Contract value secured'}
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {user?.role === 'admin' ? 'Total Expected Orders (All)' : 'Expected Orders'}
                  </CardTitle>
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-yellow-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {user?.role === 'admin' 
                      ? (adminStats?.totalExpectedOrdersCount || 0)
                      : (stats?.expectedOrdersCount || 0)
                    }
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {user?.role === 'admin' ? 'All marketers combined' : 'Expected revenue'}
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {user?.role === 'admin' ? 'Contract Value (All)' : 'Contract Value'}
                  </CardTitle>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {user?.role === 'admin' 
                      ? formatCurrency(adminStats?.totalRevenue || 0)
                      : formatCurrency(stats?.totalRevenue || 0)
                    }
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {user?.role === 'admin' ? 'All marketers combined' : 'Potential revenue'}
                  </p>
                </CardContent>
              </Card>
            </div>


            {/* Admin Analytics Charts in Overview */}
            {user?.role === 'admin' && (
              <div className="space-y-6">
                {/* View Toggle and Filters */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Analytics Dashboard</h3>
                    <p className="text-sm text-gray-600">
                      Performance insights and visualizations
                      {selectedMonth !== 'all' && (
                        <span className="ml-2 text-blue-600 font-medium">
                          • {new Date(0, parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'long' })} {selectedYear}
                        </span>
                      )}
                      {selectedMonth === 'all' && (
                        <span className="ml-2 text-blue-600 font-medium">
                          • {selectedYear}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* Filters */}
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 5 }, (_, i) => {
                            const year = new Date().getFullYear() - i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
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
                      
                      {(selectedYear !== new Date().getFullYear().toString() || selectedMonth !== 'all') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedYear(new Date().getFullYear().toString());
                            setSelectedMonth('all');
                          }}
                          className="h-8 text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    
                    {/* View Toggle */}
                    <div className="flex items-center space-x-2">
                      <Button
                        variant={viewMode === 'chart' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('chart')}
                        className="h-8"
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Charts
                      </Button>
                      <Button
                        variant={viewMode === 'table' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                        className="h-8"
                      >
                        <TableIcon className="h-4 w-4 mr-1" />
                        Tables
                      </Button>
                    </div>
                  </div>
                </div>

                {viewMode === 'chart' ? (
                  <div className="space-y-6">
                    {analyticsLoading ? (
                      <Fragment key="loading-charts">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <SalesWonChartSkeleton />
                          <PieChartSkeleton />
                        </div>
                        <LineChartSkeleton />
                      </Fragment>
                    ) : analytics ? (
                      <Fragment key="analytics-charts">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <SalesWonChart 
                            data={analytics.salesWonPerMarketer}
                            title="Sales Won vs Target"
                            description="Individual marketer performance against targets"
                          />
                          <ExpectedOrdersPieChart 
                            data={analytics.expectedOrdersShare}
                            title="Expected Orders Share"
                            description="Distribution of expected orders by marketer"
                          />
                        </div>
                        
                        <MonthlyTrendsChart 
                          data={analytics.monthlyTrends}
                          title="Monthly Performance Trends"
                          description="Performance trends over the past months"
                        />
                      </Fragment>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-gray-500 mb-4">
                          <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-lg font-medium">No Analytics Data Available</p>
                          <p className="text-sm">Analytics data could not be loaded. Please try refreshing the page.</p>
                        </div>
                        <Button onClick={() => loadDashboardStats()} variant="outline">
                          Retry Loading
                        </Button>
                      </div>
                    )}

                {/* Annual Summary Table */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
                      <BarChart3 className="h-5 w-5 text-green-600 mr-2" />
                      Annual Summary
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Business development performance overview
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsLoading ? (
                      <TableSkeleton />
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="font-semibold text-gray-700">Sales Executive</TableHead>
                              <TableHead className="font-semibold text-gray-700 text-right">Won</TableHead>
                              <TableHead className="font-semibold text-gray-700 text-right">Target</TableHead>
                              <TableHead className="font-semibold text-gray-700 text-right">Target Achieved</TableHead>
                              <TableHead className="font-semibold text-gray-700 text-right">Expected Orders</TableHead>
                              <TableHead className="font-semibold text-gray-700 text-right">Status Quo</TableHead>
                              <TableHead className="font-semibold text-gray-700 text-right">Deviation from Target</TableHead>
                              <TableHead className="font-semibold text-gray-700 text-right">Sum of Sales + Expected Orders</TableHead>
                              <TableHead className="font-semibold text-gray-700 text-right">Expected Target</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analytics?.bdStats && analytics.bdStats.length > 0 ? (
                              analytics.bdStats.map((bd: any, index: number) => {
                                const won = bd.salesWonAmount || 0;
                                const target = bd.target || 0;
                                const expectedOrders = bd.expectedOrdersAmount || 0;
                                const targetAchieved = target > 0 ? ((won / target) * 100).toFixed(2) : '0.00';
                                const deviation = won - target;
                                const sumSalesExpected = won + expectedOrders;
                                const expectedTarget = target; // Expected target is same as target
                                
                                return (
                                  <TableRow key={bd.bdId || index}>
                                    <TableCell className="font-medium">{bd.bdName || 'Unknown'}</TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatCurrency(won)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatCurrency(target)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {targetAchieved}%
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatCurrency(expectedOrders)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatCurrency(bd.totalRevenue || 0)}
                                    </TableCell>
                                    <TableCell className={`text-right font-mono ${deviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {deviation >= 0 ? '+' : ''}{formatCurrency(deviation)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatCurrency(sumSalesExpected)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatCurrency(expectedTarget)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                  No annual summary data available
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Performers */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-900">Top Performers</CardTitle>
                    <CardDescription className="text-gray-600">
                      Ranked by weighted performance score (Sales Won 40%, Expected Orders 25%, Leads 20%, Conversion 15%)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics?.topPerformers?.map((performer, index) => (
                        <div key={performer.marketerId} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-100">
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                              index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                              index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500' :
                              index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                              'bg-gradient-to-r from-blue-500 to-blue-600'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{performer.marketerName}</div>
                              <div className="text-xs text-gray-600 flex items-center space-x-3 mt-1">
                                <span className="flex items-center">
                                  <DollarSign className="w-3 h-3 mr-1 text-green-600" />
                                  {formatCurrency(performer.salesWonAmount)}
                                </span>
                                <span className="flex items-center">
                                  <TrendingUp className="w-3 h-3 mr-1 text-blue-600" />
                                  {formatCurrency(performer.expectedOrdersAmount)}
                                </span>
                                <span className="flex items-center">
                                  <Users className="w-3 h-3 mr-1 text-purple-600" />
                                  {performer.leadsCount} leads
                                </span>
                                {performer.target > 0 && (
                                  <span className="flex items-center">
                                    <Target className="w-3 h-3 mr-1 text-orange-600" />
                                    {formatCurrency(performer.target)} target
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center space-x-2 mb-1">
                              <div className="text-lg font-bold text-gray-900">
                                {performer.weightedScore.toFixed(1)}
                            </div>
                              <div className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                                Score
                              </div>
                            </div>
                            <div className="text-xs text-gray-600">
                              {performer.conversionRate.toFixed(1)}% conversion
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {analyticsLoading ? (
                      <Fragment key="loading-tables">
                        <TableSkeleton />
                        <TableSkeleton />
                        <TableSkeleton />
                      </Fragment>
                    ) : analytics ? (
                      <Fragment key="analytics-tables">
                        {/* Sales Won vs Target Table */}
                        <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                          <BarChart3 className="h-5 w-5 text-blue-600" />
                          <span>Sales Won vs Target Performance</span>
                        </CardTitle>
                        <CardDescription className="text-gray-600">Individual marketer performance against targets with achievement rates</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50">
                                <TableHead className="font-semibold text-gray-700">Marketer</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Sales Won</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Target</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Achievement Rate</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analytics?.salesWonPerMarketer?.map((marketer) => {
                                const achievementRate = marketer.target > 0 ? (marketer.salesWon / marketer.target) * 100 : 0;
                                const isAchieved = achievementRate >= 100;
                                return (
                                  <TableRow key={marketer.marketerId} className="hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="font-medium text-gray-900">{marketer.marketerName}</TableCell>
                                    <TableCell className="text-center font-semibold text-green-600">
                                      {formatCurrency(marketer.salesWon)}
                                    </TableCell>
                                    <TableCell className="text-center text-gray-600">
                                      {formatCurrency(marketer.target)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center space-x-2">
                                        <div className="w-16 bg-gray-200 rounded-full h-2">
                                          <div 
                                            className={`h-2 rounded-full transition-all duration-500 ${
                                              isAchieved ? 'bg-green-500' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${Math.min(achievementRate, 100)}%` }}
                                          />
                                        </div>
                                        <span className={`font-semibold ${isAchieved ? 'text-green-600' : 'text-red-600'}`}>
                                          {achievementRate.toFixed(1)}%
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={isAchieved ? "default" : "destructive"} className="capitalize">
                                        {isAchieved ? "Achieved" : "Pending"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Expected Orders Share Table */}
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                          <PieChart className="h-5 w-5 text-purple-600" />
                          <span>Expected Orders Distribution</span>
                        </CardTitle>
                        <CardDescription className="text-gray-600">Share of expected orders by marketer with percentages</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gradient-to-r from-purple-50 to-pink-50">
                                <TableHead className="font-semibold text-gray-700">Marketer</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Expected Orders</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Percentage</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Visual</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analytics?.expectedOrdersShare?.map((marketer) => (
                                <TableRow key={marketer.marketerId} className="hover:bg-gray-50/50 transition-colors">
                                  <TableCell className="font-medium text-gray-900">{marketer.marketerName}</TableCell>
                                  <TableCell className="text-center font-semibold text-purple-600">
                                    {formatCurrency(marketer.expectedOrders)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="font-semibold text-gray-700">{marketer.percentage.toFixed(1)}%</span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center space-x-2">
                                      <div className="w-20 bg-gray-200 rounded-full h-2">
                                        <div 
                                          className="h-2 rounded-full transition-all duration-500"
                                          style={{ 
                                            width: `${marketer.percentage}%`,
                                            backgroundColor: marketer.color
                                          }}
                                        />
                                      </div>
                                      <div 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: marketer.color }}
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Monthly Trends Table */}
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                          <Activity className="h-5 w-5 text-green-600" />
                          <span>Monthly Performance Trends</span>
                        </CardTitle>
                        <CardDescription className="text-gray-600">Performance metrics over time with trend indicators</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gradient-to-r from-green-50 to-emerald-50">
                                <TableHead className="font-semibold text-gray-700">Month</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Leads</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Sales Won</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Expected Orders</TableHead>
                                <TableHead className="font-semibold text-gray-700 text-center">Total Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analytics?.monthlyTrends?.map((trend, index) => {
                                const totalValue = trend.salesWon + trend.expectedOrders;
                                const prevTrend = index > 0 ? analytics.monthlyTrends[index - 1] : null;
                                const leadsChange = prevTrend ? trend.leads - prevTrend.leads : 0;
                                const salesChange = prevTrend ? trend.salesWon - prevTrend.salesWon : 0;
                                
                                return (
                                  <TableRow key={trend.month} className="hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="font-medium text-gray-900">{trend.month}</TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center space-x-1">
                                        <span className="font-semibold text-blue-600">{trend.leads}</span>
                                        {leadsChange !== 0 && (
                                          <span className={`text-xs ${leadsChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            ({leadsChange > 0 ? '+' : ''}{leadsChange})
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center space-x-1">
                                        <span className="font-semibold text-green-600">{formatCurrency(trend.salesWon)}</span>
                                        {salesChange !== 0 && (
                                          <span className={`text-xs ${salesChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            ({salesChange > 0 ? '+' : ''}{formatCurrency(salesChange)})
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center font-semibold text-purple-600">
                                      {formatCurrency(trend.expectedOrders)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <span className="font-bold text-gray-900">{formatCurrency(totalValue)}</span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                      </Fragment>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-gray-500 mb-4">
                          <TableIcon className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-lg font-medium">No Analytics Data Available</p>
                          <p className="text-sm">Analytics data could not be loaded. Please try refreshing the page.</p>
                        </div>
                        <Button onClick={() => loadDashboardStats()} variant="outline">
                          Retry Loading
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
                <CardDescription className="text-gray-600">
                  Add new records or export data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button 
                    onClick={() => setShowProspectModal(true)} 
                    className="h-16 flex flex-col items-center justify-center space-y-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-sm font-medium">Add Prospect</span>
                  </Button>
                  <Button 
                    onClick={() => handleExport("leads")} 
                    variant="outline" 
                    className="h-16 flex flex-col items-center justify-center space-y-2 border-gray-200 hover:bg-gray-50"
                  >
                    <FileDown className="h-5 w-5" />
                    <span className="text-sm font-medium">Export Leads</span>
                  </Button>
                  <Button 
                    onClick={() => handleExport("sales-won")} 
                    variant="outline" 
                    className="h-16 flex flex-col items-center justify-center space-y-2 border-gray-200 hover:bg-gray-50"
                  >
                    <FileDown className="h-5 w-5" />
                    <span className="text-sm font-medium">Export Sales</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
            </div>
          )}

          {activeSection === 'leads' && (
            <div key="leads" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Leads Management</h2>
                <p className="text-gray-600 mt-1">Track and manage your sales leads. Edit prospects to change their stage to leads.</p>
              </div>
            </div>
            <MarketingLeadsTable 
              showMarketerInfo={user?.role === 'admin'} 
              selectedMarketer={selectedMarketer}
              onMarketerChange={setSelectedMarketer}
            />
            </div>
          )}

          {activeSection === 'sales-won' && (
            <div key="sales-won" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Sales Won</h2>
                <p className="text-gray-600 mt-1">Track your successful sales and contract wins. Edit prospects to change their stage to sales won.</p>
              </div>
            </div>
            <MarketingSalesWonTable 
              showMarketerInfo={user?.role === 'admin'} 
              selectedMarketer={selectedMarketer}
              onMarketerChange={setSelectedMarketer}
            />
            </div>
          )}

          {activeSection === 'lost-projects' && (
            <div key="lost-projects" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Lost Projects</h2>
                <p className="text-gray-600 mt-1">Review projects that didn't proceed and analyze reasons for loss. Projects can be revived back to prospects if needed.</p>
              </div>
            </div>
            <LostProjectsTable 
              showMarketerInfo={user?.role === 'admin'} 
              selectedMarketer={selectedMarketer}
              onMarketerChange={setSelectedMarketer}
            />
            </div>
          )}

          {activeSection === 'expected-orders' && (
            <div key="expected-orders" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Expected Orders</h2>
                <p className="text-gray-600 mt-1">Track your expected orders and revenue pipeline. Edit prospects to change their stage to expected orders.</p>
              </div>
            </div>
            <MarketingExpectedOrdersTable 
              showMarketerInfo={user?.role === 'admin'} 
              selectedMarketer={selectedMarketer}
              onMarketerChange={setSelectedMarketer}
            />
            </div>
          )}

          {activeSection === 'prospects' && (
            <div key="prospects" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Prospects</h2>
                <p className="text-gray-600 mt-1">Track your prospects and potential opportunities. Edit prospects to change their stage (prospect → lead → expected order → sales won).</p>
              </div>
              <Button 
                onClick={() => setShowProspectModal(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Prospect
              </Button>
            </div>
            <MarketingProspectsTable 
              showMarketerInfo={user?.role === 'admin'} 
              selectedMarketer={selectedMarketer}
              onMarketerChange={setSelectedMarketer}
            />
            </div>
          )}


          {activeSection === 'sectors' && user?.role === 'admin' && (
            <div key="sectors" className="space-y-6">
              <SectorsManagement onSuccess={() => loadDashboardStats()} />
            </div>
          )}


          {activeSection === 'users' && user?.role === 'admin' && (
            <div key="users" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                  <p className="text-gray-600 mt-1">Manage marketing team members and their access</p>
                </div>
              </div>

              <UserManagement />
            </div>
          )}
      </div>
      </div>

      {/* Password Change Modal */}
      <MarketingPasswordChangeModal
        isOpen={showPasswordChangeModal}
        onClose={() => setShowPasswordChangeModal(false)}
        onPasswordChanged={() => {
          // Refresh user data after password change
          const userData = localStorage.getItem("marketingUser");
          if (userData) {
            try {
              const updatedUser = JSON.parse(userData);
              setUser(updatedUser);
            } catch (error) {
              console.error("Failed to refresh user data:", error);
            }
          }
        }}
        isForced={user?.mustChangePassword}
      />

      {/* Quick Action Modals (controlled, triggers hidden) */}
      <MarketingProspectsForm 
        isOpen={showProspectModal}
        onClose={() => setShowProspectModal(false)}
        hideTrigger={true}
        onSuccess={() => {
          setShowProspectModal(false);
          loadDashboardStats();
        }}
      />
    </div>
  );
}
