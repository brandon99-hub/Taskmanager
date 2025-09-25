import { useState, useEffect } from "react";
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
  Filter
} from "lucide-react";
import { MarketingLeadsTable } from "@/components/marketing/leads-table";
import { MarketingSalesWonTable } from "@/components/marketing/sales-won-table";
import { MarketingExpectedOrdersTable } from "@/components/marketing/expected-orders-table";
import { MarketingProspectsTable } from "@/components/marketing/prospects-table";
import { MarketingLeadForm } from "@/components/marketing/lead-form";
import { MarketingSalesWonForm } from "@/components/marketing/sales-won-form";
import { MarketingExpectedOrdersForm } from "@/components/marketing/expected-orders-form";
import { MarketingProspectsForm } from "@/components/marketing/prospects-form";
import { UserManagement } from "@/components/marketing/user-management";
import { SalesWonChart } from "@/components/marketing/sales-won-chart";
import { ExpectedOrdersPieChart } from "@/components/marketing/expected-orders-pie-chart";
import { MonthlyTrendsChart } from "@/components/marketing/monthly-trends-chart";
import { SalesWonChartSkeleton, PieChartSkeleton, LineChartSkeleton, TableSkeleton } from "@/components/marketing/chart-skeletons";
import MarketingPasswordChangeModal from "@/components/marketing/marketing-password-change-modal";
import { useScreenSize } from "@/hooks/use-mobile";

interface DashboardStats {
  year: number;
  leadsCount: number;
  salesWonTotal: number;
  expectedOrdersTotal: number;
  prospectsTotal: number;
  annualSummary: any;
}

interface AdminDashboardStats {
  year: number;
  totalLeadsCount: number;
  totalSalesWon: number;
  totalExpectedOrders: number;
  totalProspects: number;
  marketerStats: Array<{
    marketerId: string;
    marketerName: string;
    leadsCount: number;
    salesWonTotal: number;
    expectedOrdersTotal: number;
    prospectsTotal: number;
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
  topPerformers: Array<{
    marketerId: string;
    marketerName: string;
    totalRevenue: number;
    leadsCount: number;
    conversionRate: number;
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
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showSalesWonModal, setShowSalesWonModal] = useState(false);
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
          setAdminStats(adminData);
          console.log("Admin stats loaded:", adminData);
        } else {
          console.error("Admin stats API failed:", adminResponse.status);
        }

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          setAnalytics(analyticsData);
          console.log("Analytics data loaded:", analyticsData);
        } else {
          const errorText = await analyticsResponse.text();
          console.error("Analytics API failed:", analyticsResponse.status, errorText);
          // Set empty analytics data to prevent loading state
          setAnalytics({
            year: new Date().getFullYear(),
            conversionRates: [],
            quarterlyStats: [],
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
        setStats(data);
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
    { id: "leads", label: "Leads", icon: Users },
    { id: "sales-won", label: "Sales Won", icon: TrendingUp },
    { id: "expected-orders", label: "Expected Orders", icon: Target },
    { id: "prospects", label: "Prospects", icon: Calendar },
    ...(user?.role === 'admin' ? [
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
                  {activeSection === 'leads' && 'Manage your leads and prospects'}
                  {activeSection === 'sales-won' && 'Track successful sales and contracts'}
                  {activeSection === 'expected-orders' && 'Monitor expected orders and revenue'}
                  {activeSection === 'prospects' && 'Track potential opportunities'}
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
            <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {user?.role === 'admin' ? 'Total Leads (All)' : 'Total Leads'}
                  </CardTitle>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {user?.role === 'admin' ? (adminStats?.totalLeadsCount || 0) : (stats?.leadsCount || 0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {user?.role === 'admin' ? 'All marketers combined' : `${stats?.year || new Date().getFullYear()} leads tracked`}
                  </p>
                </CardContent>
              </Card>

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
                      ? formatCurrency(adminStats?.totalSalesWon || 0)
                      : formatCurrency(stats?.salesWonTotal || 0)
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
                      ? formatCurrency(adminStats?.totalExpectedOrders || 0)
                      : formatCurrency(stats?.expectedOrdersTotal || 0)
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
                    {user?.role === 'admin' ? 'Total Prospects (All)' : 'Prospects'}
                  </CardTitle>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {user?.role === 'admin' 
                      ? formatCurrency(adminStats?.totalProspects || 0)
                      : formatCurrency(stats?.prospectsTotal || 0)
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
                      <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <SalesWonChartSkeleton />
                          <PieChartSkeleton />
                        </div>
                        <LineChartSkeleton />
                      </>
                    ) : analytics ? (
                      <>
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
                      </>
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

                {/* Additional Analytics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Conversion Rates */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-900">Conversion Rates by Stage</CardTitle>
                      <CardDescription className="text-gray-600">
                        Lead progression through sales stages
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics?.conversionRates?.map((rate) => (
                          <div key={rate.stage} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="capitalize">
                                {rate.stage.replace('_', ' ')}
                              </Badge>
                              <span className="text-sm text-gray-600">{rate.count} leads</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{rate.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quarterly Stats */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-900">Quarterly Performance</CardTitle>
                      <CardDescription className="text-gray-600">
                        Performance breakdown by quarter
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics?.quarterlyStats?.map((quarter) => (
                          <div key={quarter.quarter} className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{quarter.quarter}</span>
                            <div className="text-right">
                              <div className="text-sm text-gray-600">{quarter.leadsCount} leads</div>
                              <div className="text-sm font-medium text-gray-900">
                                {new Intl.NumberFormat('en-KE', {
                                  style: 'currency',
                                  currency: 'KES',
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                }).format(quarter.salesWonTotal)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Top Performers */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-900">Top Performers</CardTitle>
                    <CardDescription className="text-gray-600">
                      Best performing marketers this year
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics?.topPerformers?.map((performer, index) => (
                        <div key={performer.marketerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{performer.marketerName}</div>
                              <div className="text-sm text-gray-600">{performer.leadsCount} leads</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              {new Intl.NumberFormat('en-KE', {
                                style: 'currency',
                                currency: 'KES',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }).format(performer.totalRevenue)}
                            </div>
                            <div className="text-sm text-gray-600">{performer.conversionRate.toFixed(1)}% conversion</div>
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
                      <>
                        <TableSkeleton />
                        <TableSkeleton />
                        <TableSkeleton />
                      </>
                    ) : analytics ? (
                      <>
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
                      </>
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
                    onClick={() => setShowLeadModal(true)} 
                    className="h-16 flex flex-col items-center justify-center space-y-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-sm font-medium">Add Lead</span>
                  </Button>
                  <Button 
                    onClick={() => setShowSalesWonModal(true)} 
                    className="h-16 flex flex-col items-center justify-center space-y-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-sm font-medium">Add Sales Won</span>
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
            <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Leads Management</h2>
                <p className="text-gray-600 mt-1">Track and manage your sales leads</p>
              </div>
              <MarketingLeadForm onSuccess={() => window.location.reload()} />
            </div>
            <MarketingLeadsTable 
              showMarketerInfo={user?.role === 'admin'} 
              selectedMarketer={selectedMarketer}
              onMarketerChange={setSelectedMarketer}
            />
            </div>
          )}

          {activeSection === 'sales-won' && (
            <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Sales Won</h2>
                <p className="text-gray-600 mt-1">Track your successful sales and contract wins</p>
              </div>
              <MarketingSalesWonForm onSuccess={() => window.location.reload()} />
            </div>
            <MarketingSalesWonTable 
              showMarketerInfo={user?.role === 'admin'} 
              selectedMarketer={selectedMarketer}
              onMarketerChange={setSelectedMarketer}
            />
            </div>
          )}

          {activeSection === 'expected-orders' && (
            <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Expected Orders</h2>
                <p className="text-gray-600 mt-1">Track your expected orders and revenue pipeline</p>
              </div>
              <MarketingExpectedOrdersForm onSuccess={() => window.location.reload()} />
            </div>
            <MarketingExpectedOrdersTable />
            </div>
          )}

          {activeSection === 'prospects' && (
            <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Prospects</h2>
                <p className="text-gray-600 mt-1">Track your prospects and potential opportunities</p>
              </div>
              <MarketingProspectsForm onSuccess={() => window.location.reload()} />
            </div>
            <MarketingProspectsTable />
            </div>
          )}


          {activeSection === 'users' && user?.role === 'admin' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                  <p className="text-gray-600 mt-1">Manage marketing team members and their access</p>
                </div>
                <Button 
                  onClick={() => setShowUserManagement(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Marketer
                </Button>
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
      <MarketingLeadForm 
        isOpen={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        hideTrigger
        onSuccess={() => {
          setShowLeadModal(false);
          loadDashboardStats();
        }}
      />
      
      <MarketingSalesWonForm 
        isOpen={showSalesWonModal}
        onClose={() => setShowSalesWonModal(false)}
        hideTrigger
        onSuccess={() => {
          setShowSalesWonModal(false);
          loadDashboardStats();
        }}
      />
    </div>
  );
}
