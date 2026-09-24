import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, UserPlus, Plus, Shield } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import EmployeesTab from "@/components/user-management/employees-tab";
import TeamsTab from "@/components/user-management/teams-tab";
import RolesPermissionsTab from "@/components/user-management/roles-permissions-tab";

interface Segment {
  id: string;
  name: string;
}

const TAB_META: Record<string, { title: string; description: string }> = {
  employees: { title: "Employees", description: "All staff in the system and the role each one has been assigned" },
  teams: { title: "Teams", description: "Create teams and monitor member workloads. This is how tickets get routed to the right person" },
  roles: { title: "Roles & Permissions", description: "Define what each role can access. Roles are created here, not hardcoded in the app" },
};

export default function Team() {
  const auth = useAuth() as any;
  const { user, isAuthenticated, isLoading, isAdminRole } = auth;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"employees" | "teams" | "roles">("employees");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamSegmentFilter, setTeamSegmentFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: sectors = [] } = useQuery<Segment[]>({
    queryKey: ['/api/segments'],
    staleTime: 20 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isAdmin = isAdminRole();
  const meta = TAB_META[activeTab];

  const canShowCreateButton = activeTab !== "teams" || user?.role !== "employee";

  return (
    <div className="min-h-screen bg-background-page">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <PageHeader
          icon={Users}
          title={meta.title}
          description={meta.description}
          actions={
            canShowCreateButton && (
              <Button onClick={() => setCreateOpen(true)} data-testid={`button-create-${activeTab}`}>
                {activeTab === "employees" && <UserPlus className="h-4 w-4 mr-2" />}
                {activeTab === "teams" && <Plus className="h-4 w-4 mr-2" />}
                {activeTab === "roles" && <Shield className="h-4 w-4 mr-2" />}
                {activeTab === "employees" && "New User"}
                {activeTab === "teams" && "Create Team"}
                {activeTab === "roles" && "Create Role"}
              </Button>
            )
          }
          filters={
            activeTab === "employees" ? (
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search employees..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-employees"
                />
              </div>
            ) : activeTab === "teams" ? (
              <>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search teams..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-teams"
                  />
                </div>
                <Select value={teamSegmentFilter} onValueChange={setTeamSegmentFilter}>
                  <SelectTrigger className="lg:w-48" data-testid="select-team-segment">
                    <SelectValue placeholder="Filter by sector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sectors</SelectItem>
                    {sectors.map((sector) => (
                      <SelectItem key={sector.id} value={sector.id}>{sector.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : undefined
          }
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList variant="underline" className="justify-center">
            <TabsTrigger value="employees" data-testid="tab-employees">Employees</TabsTrigger>
            <TabsTrigger value="teams" data-testid="tab-teams">Teams</TabsTrigger>
            {isAdmin && <TabsTrigger value="roles" data-testid="tab-roles">Roles &amp; Permissions</TabsTrigger>}
          </TabsList>
          <TabsContent value="employees" className="pt-6">
            <EmployeesTab search={employeeSearch} createOpen={activeTab === "employees" && createOpen} onCreateOpenChange={setCreateOpen} />
          </TabsContent>
          <TabsContent value="teams" className="pt-6">
            <TeamsTab
              search={teamSearch}
              segmentFilter={teamSegmentFilter}
              createOpen={activeTab === "teams" && createOpen}
              onCreateOpenChange={setCreateOpen}
            />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="roles" className="pt-6">
              <RolesPermissionsTab createOpen={activeTab === "roles" && createOpen} onCreateOpenChange={setCreateOpen} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
