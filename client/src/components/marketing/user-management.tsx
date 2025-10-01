import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Edit, 
  Trash2, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Users,
  Plus,
  UserCheck,
  UserX,
  Target,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'marketer';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface UsersResponse {
  users: MarketingUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function UserManagement() {
  const [users, setUsers] = useState<MarketingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  const { toast } = useToast();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<MarketingUser | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    role: "marketer" as 'admin' | 'marketer',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<MarketingUser | null>(null);
  const [targetData, setTargetData] = useState({
    year: new Date().getFullYear(),
    target: "",
    revisedTarget: "",
  });
  const [targetSubmitting, setTargetSubmitting] = useState(false);
  const [targetLoading, setTargetLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(search && { search }),
      });

      const response = await fetch(`/api/marketing/users?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: UsersResponse = await response.json();
        setUsers(data.users);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const url = editingUser 
        ? `/api/marketing/users/${editingUser.id}`
        : "/api/marketing/auth/register";
      
      const method = editingUser ? "PUT" : "POST";
      const body = editingUser 
        ? { ...formData, password: undefined } // Don't send password for updates
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowAddDialog(false);
        setEditingUser(null);
        setFormData({
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          phoneNumber: "",
          role: "marketer",
        });
        loadUsers();
      } else {
        const errorData = await response.json();
        console.error("Failed to save user:", errorData);
      }
    } catch (error) {
      console.error("Failed to save user:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (user: MarketingUser) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: "",
      role: user.role,
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        loadUsers();
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  const handleSetTarget = async (user: MarketingUser) => {
    setSelectedUser(user);
    setTargetLoading(true);
    
    // Set default values first
    setTargetData({
      year: new Date().getFullYear(),
      target: "",
      revisedTarget: "",
    });
    
    // Try to fetch existing target data
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/dashboard/stats?bdId=${user.id}&year=${new Date().getFullYear()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.target || data.revisedTarget) {
          setTargetData({
            year: new Date().getFullYear(),
            target: data.target ? data.target.toString() : "",
            revisedTarget: data.revisedTarget ? data.revisedTarget.toString() : "",
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch existing target data:", error);
      // Continue with empty form if fetch fails
    } finally {
      setTargetLoading(false);
    }
    
    setShowTargetDialog(true);
  };

  const handleTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setTargetSubmitting(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/admin/set-target", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          marketerId: selectedUser.id,
          year: targetData.year,
          target: parseFloat(targetData.target),
          revisedTarget: targetData.revisedTarget ? parseFloat(targetData.revisedTarget) : undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setShowTargetDialog(false);
        setSelectedUser(null);
        setTargetData({
          year: new Date().getFullYear(),
          target: "",
          revisedTarget: "",
        });
        
        // Show success message
        toast({
          title: "Target Set Successfully",
          description: `Target of ${formatCurrency(parseFloat(targetData.target))} has been set for ${selectedUser.firstName} ${selectedUser.lastName} for ${targetData.year}`,
        });
        
        // Reload users to refresh any target-related data
        loadUsers();
      } else {
        const errorData = await response.json();
        toast({
          title: "Failed to Set Target",
          description: errorData.error || "An error occurred while setting the target",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to set target:", error);
    } finally {
      setTargetSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">Marketing Users</CardTitle>
            <CardDescription className="text-gray-600">
              Manage marketing team members and their access
            </CardDescription>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-3 pb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      {editingUser ? (
                        <Edit className="h-6 w-6 text-white" />
                      ) : (
                        <Plus className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-bold text-gray-900">
                        {editingUser ? "Edit User" : "Add New User"}
                      </DialogTitle>
                      <DialogDescription className="text-gray-600 text-base">
                        {editingUser ? "Update user information and permissions" : "Create a new marketing team member with access credentials"}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                      <Users className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                          <span>First Name</span>
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          required
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg transition-all duration-200"
                          placeholder="Enter first name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                          <span>Last Name</span>
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          required
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg transition-all duration-200"
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                        <span>Email Address</span>
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg transition-all duration-200"
                        placeholder="user@company.com"
                      />
                    </div>
                  </div>

                  {/* Security Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Security & Access</h3>
                    </div>
                    
                    {!editingUser && (
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                          <span>Temporary Password</span>
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required={!editingUser}
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg transition-all duration-200"
                          placeholder="Enter temporary password"
                        />
                        <p className="text-xs text-gray-500">
                          User will be required to change this password on first login
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                        <span>User Role</span>
                        <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'marketer' })}
                      >
                        <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg transition-all duration-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="marketer" className="py-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span>Marketer</span>
                              <span className="text-xs text-gray-500">- View own data only</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="admin" className="py-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <span>Admin</span>
                              <span className="text-xs text-gray-500">- Full access</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">What happens next?</p>
                        <ul className="space-y-1 text-blue-700">
                          <li>• User will receive an email with login credentials</li>
                          <li>• They'll be required to change their password on first login</li>
                          <li>• Access will be granted based on their assigned role</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="gap-3 pt-6 border-t border-gray-200">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowAddDialog(false)} 
                      disabled={submitting}
                      className="h-11 px-6 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={submitting}
                      className="h-11 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {editingUser ? "Updating..." : "Adding..."}
                        </>
                      ) : editingUser ? (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          Update User
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add User
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Email</TableHead>
                <TableHead className="font-semibold text-gray-700">Role</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="font-semibold text-gray-700">Last Login</TableHead>
                <TableHead className="font-semibold text-gray-700">Created</TableHead>
                <TableHead className="font-semibold text-gray-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No users found</p>
                      <p className="text-sm text-gray-400">Start by adding your first team member</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell className="text-gray-600">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {user.isActive ? (
                          <>
                            <UserCheck className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">Active</span>
                          </>
                        ) : (
                          <>
                            <UserX className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-red-600">Inactive</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{formatDate(user.lastLoginAt)}</TableCell>
                    <TableCell className="text-gray-600">{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 hover:bg-gray-100"
                          onClick={() => handleEdit(user)}
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4 text-gray-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 hover:bg-blue-100"
                          onClick={() => handleSetTarget(user)}
                          disabled={targetLoading}
                          title="Set targets"
                        >
                          {targetLoading ? (
                            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                          ) : (
                            <Target className="h-4 w-4 text-blue-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-red-100"
                          onClick={() => handleDelete(user.id)}
                          title="Deactivate user"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.pages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Target Management Dialog */}
    <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Set Sales Targets
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                Set annual targets and revised targets for {selectedUser?.firstName} {selectedUser?.lastName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleTargetSubmit} className="space-y-6">
          {/* Year Selection */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Target Year</h3>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="year" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                <span>Year</span>
                <span className="text-red-500">*</span>
              </Label>
              <Select
                value={targetData.year.toString()}
                onValueChange={(value) => setTargetData({ ...targetData, year: parseInt(value) })}
              >
                <SelectTrigger className="h-11 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg transition-all duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() + i;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Target Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                  <span>Initial Target (KES)</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="target"
                  type="number"
                  step="0.01"
                  value={targetData.target}
                  onChange={(e) => setTargetData({ ...targetData, target: e.target.value })}
                  required
                  className="h-11 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg transition-all duration-200"
                  placeholder="Enter initial target amount"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="revisedTarget" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                  <span>Revised Target (KES)</span>
                  <span className="text-gray-400">Optional</span>
                </Label>
                <Input
                  id="revisedTarget"
                  type="number"
                  step="0.01"
                  value={targetData.revisedTarget}
                  onChange={(e) => setTargetData({ ...targetData, revisedTarget: e.target.value })}
                  className="h-11 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg transition-all duration-200"
                  placeholder="Enter revised target amount"
                />
                <p className="text-xs text-gray-500">
                  If not specified, will use initial target
                </p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <div className="text-sm text-green-800">
                <p className="font-medium mb-1">Target Management</p>
                <ul className="space-y-1 text-green-700">
                  <li>• Initial target is the original sales target for the year</li>
                  <li>• Revised target allows for mid-year adjustments</li>
                  <li>• Targets will be used in annual summary calculations</li>
                  <li>• Progress tracking will be based on these targets</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 pt-6 border-t border-gray-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowTargetDialog(false)} 
              disabled={targetSubmitting}
              className="h-11 px-6 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={targetSubmitting}
              className="h-11 px-6 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {targetSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting Target...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  Set Target
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
