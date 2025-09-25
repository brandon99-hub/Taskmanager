import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
  X
} from "lucide-react";
import { MarketingLeadsTable } from "@/components/marketing/leads-table";
import { MarketingSalesWonTable } from "@/components/marketing/sales-won-table";
import { MarketingExpectedOrdersTable } from "@/components/marketing/expected-orders-table";
import { MarketingProspectsTable } from "@/components/marketing/prospects-table";
import { MarketingLeadForm } from "@/components/marketing/lead-form";
import { MarketingSalesWonForm } from "@/components/marketing/sales-won-form";
import { MarketingExpectedOrdersForm } from "@/components/marketing/expected-orders-form";
import { MarketingProspectsForm } from "@/components/marketing/prospects-form";
import { useScreenSize } from "@/hooks/use-mobile";

interface DashboardStats {
  year: number;
  leadsCount: number;
  salesWonTotal: number;
  expectedOrdersTotal: number;
  prospectsTotal: number;
  annualSummary: any;
}

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'marketer';
}

export default function MarketingDashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<MarketingUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      setUser(JSON.parse(userData));
    } catch (error) {
      setLocation("/marketing/login");
      return;
    }

    // Load dashboard stats
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/dashboard/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Marketing Pipeline</h1>
                  <p className="text-sm text-gray-600">
                    Welcome back, {user.firstName} {user.lastName}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="capitalize">
                {user.role}
              </Badge>
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" alt={user.firstName} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex flex-col space-y-1 p-2">
                    <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="sales-won">Sales Won</TabsTrigger>
            <TabsTrigger value="expected-orders">Expected Orders</TabsTrigger>
            <TabsTrigger value="prospects">Prospects</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Leads</CardTitle>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats?.leadsCount || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats?.year} leads tracked
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Sales Won</CardTitle>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    ${(stats?.salesWonTotal || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Contract value secured
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Expected Orders</CardTitle>
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-yellow-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    ${(stats?.expectedOrdersTotal || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Expected revenue
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Prospects</CardTitle>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    ${(stats?.prospectsTotal || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Potential revenue
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
                <CardDescription className="text-gray-600">
                  Common tasks and data export options
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button 
                    onClick={() => setActiveTab("leads")} 
                    className="h-16 flex flex-col items-center justify-center space-y-2 bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-sm font-medium">Add Lead</span>
                  </Button>
                  <Button 
                    onClick={() => setActiveTab("sales-won")} 
                    className="h-16 flex flex-col items-center justify-center space-y-2 bg-primary hover:bg-primary/90"
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
          </TabsContent>

          <TabsContent value="leads" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Leads Management</h2>
                <p className="text-gray-600 mt-1">Track and manage your sales leads</p>
              </div>
              <MarketingLeadForm onSuccess={() => window.location.reload()} />
            </div>
            <MarketingLeadsTable />
          </TabsContent>

          <TabsContent value="sales-won" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Sales Won</h2>
                <p className="text-gray-600 mt-1">Track your successful sales and contract wins</p>
              </div>
              <MarketingSalesWonForm onSuccess={() => window.location.reload()} />
            </div>
            <MarketingSalesWonTable />
          </TabsContent>

          <TabsContent value="expected-orders" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Expected Orders</h2>
                <p className="text-gray-600 mt-1">Track your expected orders and revenue pipeline</p>
              </div>
              <MarketingExpectedOrdersForm onSuccess={() => window.location.reload()} />
            </div>
            <MarketingExpectedOrdersTable />
          </TabsContent>

          <TabsContent value="prospects" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Prospects</h2>
                <p className="text-gray-600 mt-1">Track your prospects and potential opportunities</p>
              </div>
              <MarketingProspectsForm onSuccess={() => window.location.reload()} />
            </div>
            <MarketingProspectsTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
