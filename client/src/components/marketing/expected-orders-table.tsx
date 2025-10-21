import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Edit, 
  Trash2, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Building2,
  DollarSign,
  Calendar,
  FileText,
  User,
  Phone,
  Mail,
  ArrowRight,
  Target
} from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { ExpectedOrdersFilters } from "./expected-orders-filters";
import { LostReasonModal } from "./lost-reason-modal";

interface ExpectedOrders {
  id: string;
  organisationName: string;
  sector: string;
  product: string;
  revenue: number;
  expectedQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  comments?: string;
  marketerId: string;
  createdAt: string;
  updatedAt: string;
  marketerName?: string;
  marketerEmail?: string;
  contactPerson?: string;
  contactNumber?: string;
  contactEmail?: string;
}

interface ExpectedOrdersResponse {
  expectedOrders: ExpectedOrders[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const quarterColors = {
  Q1: "bg-blue-100 text-blue-800",
  Q2: "bg-green-100 text-green-800",
  Q3: "bg-yellow-100 text-yellow-800",
  Q4: "bg-red-100 text-red-800",
};

const expectedOrdersUpdateSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required").max(200, "Organisation name too long"),
  sector: z.string().min(1, "Sector is required").max(100, "Sector name too long"),
  product: z.string().min(1, "Product is required").max(200, "Product name too long"),
  revenue: z.number().positive("Revenue must be positive"),
  expectedQuarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  comments: z.string().optional(),
  marketerId: z.string().optional(),
});

type ExpectedOrdersUpdateData = z.infer<typeof expectedOrdersUpdateSchema>;

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'marketer';
}

interface MarketingExpectedOrdersTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
  currentUser?: MarketingUser;
}

export function MarketingExpectedOrdersTable({ 
  showMarketerInfo = false, 
  selectedMarketer = "",
  onMarketerChange,
  currentUser
}: MarketingExpectedOrdersTableProps) {
  const [expectedOrders, setExpectedOrders] = useState<ExpectedOrders[]>([]);
  const [marketingUsers, setMarketingUsers] = useState<MarketingUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [filters, setFilters] = useState<{
    search?: string;
    year?: string;
    quarter?: string;
    marketerId?: string;
    sector?: string;
  }>({});
  
  // Edit functionality state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingExpectedOrder, setEditingExpectedOrder] = useState<ExpectedOrders | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStageChangeOpen, setIsStageChangeOpen] = useState(false);
  const [stageChangeExpectedOrder, setStageChangeExpectedOrder] = useState<ExpectedOrders | null>(null);
  const [newStage, setNewStage] = useState<string>("");
  const [newRevenue, setNewRevenue] = useState<string>("");
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [lostReasonData, setLostReasonData] = useState<{expectedOrder: ExpectedOrders, stage: string, revenue?: string} | null>(null);

  // Form setup
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ExpectedOrdersUpdateData>({
    resolver: zodResolver(expectedOrdersUpdateSchema),
  });

  const loadExpectedOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(filters.search && { search: filters.search }),
        ...(filters.year && { year: filters.year }),
        ...(filters.quarter && { quarter: filters.quarter }),
        ...(filters.marketerId && { marketerId: filters.marketerId }),
        ...(filters.sector && { sector: filters.sector }),
        ...(selectedMarketer && { marketerId: selectedMarketer }),
      });

      const response = await fetch(`/api/marketing/expected-orders?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: ExpectedOrdersResponse = await response.json();
        setExpectedOrders(data.expectedOrders);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to load expected orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMarketingUsers = async () => {
    if (currentUser?.role !== 'admin') return;
    
    try {
      setUsersLoading(true);
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/users?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMarketingUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to load marketing users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleFiltersChange = useCallback((newFilters: {
    search?: string;
    year?: string;
    quarter?: string;
    marketerId?: string;
    sector?: string;
  }) => {
    setFilters(newFilters);
  }, []);

  const memoizedFilters = useMemo(() => filters, [
    filters.search,
    filters.year,
    filters.quarter,
    filters.marketerId,
    filters.sector
  ]);

  useEffect(() => {
    loadExpectedOrders();
    loadMarketingUsers();
  }, [page, search, selectedMarketer, memoizedFilters]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expected orders record?")) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/expected-orders/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        loadExpectedOrders();
      }
    } catch (error) {
      console.error("Failed to delete expected orders:", error);
    }
  };

  const handleEdit = async (data: ExpectedOrdersUpdateData) => {
    if (!editingExpectedOrder) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/expected-orders/${editingExpectedOrder.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Expected order updated successfully",
        });
        setIsEditOpen(false);
        setEditingExpectedOrder(null);
        reset();
        loadExpectedOrders();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update expected order",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update expected order:", error);
      toast({
        title: "Error",
        description: "Failed to update expected order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (expectedOrder: ExpectedOrders) => {
    setEditingExpectedOrder(expectedOrder);
    setValue("organisationName", expectedOrder.organisationName);
    setValue("sector", expectedOrder.sector);
    setValue("product", expectedOrder.product);
    setValue("revenue", expectedOrder.revenue);
    setValue("expectedQuarter", expectedOrder.expectedQuarter);
    setValue("comments", expectedOrder.comments || "");
    setValue("marketerId", expectedOrder.marketerId || "");
    setIsEditOpen(true);
  };

  const openStageChangeDialog = (expectedOrder: ExpectedOrders) => {
    setStageChangeExpectedOrder(expectedOrder);
    setNewStage("sales_won");
    setNewRevenue(expectedOrder.revenue.toString());
    setIsStageChangeOpen(true);
  };

  const handleStageChange = async () => {
    if (!stageChangeExpectedOrder || !newStage) return;

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("marketingToken");
      const data = {
        stage: newStage,
        revenue: parseFloat(newRevenue) || 0,
      };

      const response = await fetch(`/api/marketing/expected-orders/${stageChangeExpectedOrder.id}/stage`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Success",
          description: result.message || "Expected order stage changed successfully",
        });
        setIsStageChangeOpen(false);
        setStageChangeExpectedOrder(null);
        setNewStage("");
        setNewRevenue("");
        loadExpectedOrders();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to change stage",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to change stage:", error);
      toast({
        title: "Error",
        description: "Failed to change stage",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStageSelection = (stage: string, expectedOrder: ExpectedOrders) => {
    if (stage === 'lost') {
      // Open lost reason modal instead of stage change dialog
      setLostReasonData({
        expectedOrder,
        stage: 'lost',
        revenue: newRevenue
      });
      setIsLostReasonModalOpen(true);
      setIsStageChangeOpen(false);
    } else {
      // Continue with normal stage change
      setNewStage(stage);
    }
  };

  const handleLostReasonSubmit = async (reason: string) => {
    if (!lostReasonData) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/expected-orders/${lostReasonData.expectedOrder.id}/stage`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage: 'lost',
          revenue: lostReasonData.revenue ? parseFloat(lostReasonData.revenue) : lostReasonData.expectedOrder.revenue,
          lostReason: reason,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Expected order marked as lost successfully",
        });
        setIsLostReasonModalOpen(false);
        setLostReasonData(null);
        loadExpectedOrders();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to mark expected order as lost",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error marking expected order as lost:", error);
      toast({
        title: "Error",
        description: "Failed to mark expected order as lost",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
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
    <div className="space-y-6">
      {/* Filters */}
      <ExpectedOrdersFilters 
        onFiltersChange={handleFiltersChange}
        showMarketerInfo={showMarketerInfo}
      />

      <Card>
        <CardHeader>
          <CardTitle>Expected Orders</CardTitle>
          <CardDescription>
            Track your expected orders and revenue pipeline
          </CardDescription>
        </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Marketer</TableHead>
                <TableHead>Contact Details</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Expected Quarter</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expectedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    No expected orders found
                  </TableCell>
                </TableRow>
              ) : (
                expectedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.organisationName}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-blue-400" />
                        <span className="text-sm font-medium text-gray-700">
                          {order.marketerName || 'Unknown'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {order.marketerEmail || ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-700">
                          {order.contactPerson || 'N/A'}
                        </div>
                        <div className="flex items-center text-xs text-gray-600">
                          <Phone className="h-3 w-3 mr-1" />
                          {order.contactNumber || 'N/A'}
                        </div>
                        <div className="flex items-center text-xs text-gray-600">
                          <Mail className="h-3 w-3 mr-1" />
                          {order.contactEmail || 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{order.sector}</TableCell>
                    <TableCell>{order.product}</TableCell>
                    <TableCell>{formatCurrency(order.revenue)}</TableCell>
                    <TableCell>
                      <Badge className={quarterColors[order.expectedQuarter]}>
                        {order.expectedQuarter}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-sm text-gray-700 truncate" title={order.comments || ''}>
                          {order.comments || 'No comments'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openEditDialog(order)}
                          title="Edit expected order"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStageChangeDialog(order)}
                          title="Change stage to sales won"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(order.id)}
                          title="Delete expected order"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
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

    {/* Edit Expected Orders Dialog */}
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            Edit Expected Order
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-base">
            Update the expected order information below. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(handleEdit)} className="space-y-6">
          {/* Organisation Information Section */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              Organisation Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="organisationName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Organisation Name *
                </Label>
                <Input
                  id="organisationName"
                  {...register("organisationName")}
                  placeholder="Enter organisation name"
                  className={`h-11 ${errors.organisationName ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {errors.organisationName && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.organisationName.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="sector" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Sector *
                </Label>
                <Input
                  id="sector"
                  {...register("sector")}
                  placeholder="Enter sector"
                  className={`h-11 ${errors.sector ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {errors.sector && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.sector.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Product & Financial Information Section */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              Product & Financial Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="product" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Product *
                </Label>
                <Input
                  id="product"
                  {...register("product")}
                  placeholder="Enter product name"
                  className={`h-11 ${errors.product ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {errors.product && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.product.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="revenue" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Expected Revenue (KES) *
                </Label>
                <Input
                  id="revenue"
                  type="number"
                  step="0.01"
                  {...register("revenue", { valueAsNumber: true })}
                  placeholder="Enter expected revenue"
                  className={`h-11 ${errors.revenue ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {errors.revenue && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.revenue.message}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Label htmlFor="expectedQuarter" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Expected Quarter *
              </Label>
              <Select
                value={editingExpectedOrder?.expectedQuarter}
                onValueChange={(value) => setValue("expectedQuarter", value as any)}
              >
                <SelectTrigger className={`h-11 ${errors.expectedQuarter ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}>
                  <SelectValue placeholder="Select expected quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800 text-xs">Q1</Badge>
                      <span>First Quarter</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Q2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 text-xs">Q2</Badge>
                      <span>Second Quarter</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Q3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">Q3</Badge>
                      <span>Third Quarter</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Q4">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800 text-xs">Q4</Badge>
                      <span>Fourth Quarter</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.expectedQuarter && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                  {errors.expectedQuarter.message}
                </p>
              )}
            </div>
          </div>

          {/* User Assignment Section (Admin Only) */}
          {currentUser?.role === 'admin' && (
            <div className="bg-red-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                User Assignment
                <Badge variant="secondary" className="text-xs">Admin Only</Badge>
              </h3>
              <div className="space-y-3">
                <Label htmlFor="marketerId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Assigned User
                </Label>
                <Select
                  value={editingExpectedOrder?.marketerId || ""}
                  onValueChange={(value) => setValue("marketerId", value || "")}
                  disabled={usersLoading}
                >
                  <SelectTrigger className="h-11 focus:border-red-500 focus:ring-red-500">
                    <SelectValue placeholder={usersLoading ? "Loading users..." : "Select assigned user (optional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    {marketingUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{user.firstName} {user.lastName}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Change the user assigned to this expected order. Leave empty to keep current assignment.
                </p>
              </div>
            </div>
          )}

          {/* Additional Information Section */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gray-500 rounded-full"></div>
              Additional Information
            </h3>
            <div className="space-y-3">
              <Label htmlFor="comments" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Comments
              </Label>
              <Textarea
                id="comments"
                {...register("comments")}
                rows={4}
                placeholder="Enter any additional comments or notes..."
                className="focus:border-gray-500 focus:ring-gray-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-6 border-t border-gray-200">
            <div className="flex gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Expected Order...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Update Expected Order
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Stage Change Dialog */}
    <Dialog open={isStageChangeOpen} onOpenChange={setIsStageChangeOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Change Stage
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                Move this expected order to any stage in the sales pipeline
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <span>Project Information</span>
              </h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-700 flex items-center space-x-1 mb-2">
                  <Building2 className="h-4 w-4" />
                  <span>Organization</span>
                </Label>
                <div className="h-11 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 font-medium flex items-center">
                  {stageChangeExpectedOrder?.organisationName}
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700 flex items-center space-x-1 mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Current Revenue</span>
                </Label>
                <div className="h-11 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 font-medium flex items-center">
                  {formatCurrency(Number(stageChangeExpectedOrder?.revenue || 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Stage Change Form */}
          <div className="bg-green-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-green-200">
              <div className="w-1 h-6 bg-green-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Target className="h-5 w-5 text-green-600" />
                <span>New Stage</span>
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newStage" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                  <ArrowRight className="h-4 w-4" />
                  <span>Select New Stage</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={newStage}
                  onValueChange={(value) => handleStageSelection(value, stageChangeExpectedOrder!)}
                >
                  <SelectTrigger className="h-11 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg transition-all duration-200">
                    <SelectValue placeholder="Select new stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-yellow-100 text-yellow-800">Lead</Badge>
                        <span className="text-sm text-gray-600">Move back to lead stage</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="prospect">
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-blue-100 text-blue-800">Prospect</Badge>
                        <span className="text-sm text-gray-600">Move back to prospect stage</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="sales_won">
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-green-100 text-green-800">Sales Won</Badge>
                        <span className="text-sm text-gray-600">Project completed successfully</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="lost">
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-red-100 text-red-800">Lost</Badge>
                        <span className="text-sm text-gray-600">Project was lost</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newRevenue" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                  <DollarSign className="h-4 w-4" />
                  <span>Contract Amount (KES)</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="newRevenue"
                  type="number"
                  step="0.01"
                  value={newRevenue}
                  onChange={(e) => setNewRevenue(e.target.value)}
                  placeholder="Enter final contract amount"
                  className="h-11 border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg transition-all duration-200"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 pt-6 border-t border-gray-200">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setIsStageChangeOpen(false)} 
            disabled={isSubmitting}
            className="flex-1 h-11 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleStageChange}
            disabled={isSubmitting || !newStage || !newRevenue}
            className="flex-1 h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Changing Stage...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Move to Selected Stage
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Lost Reason Modal */}
    {lostReasonData && (
      <LostReasonModal
        isOpen={isLostReasonModalOpen}
        onClose={() => {
          setIsLostReasonModalOpen(false);
          setLostReasonData(null);
        }}
        onSubmit={handleLostReasonSubmit}
        projectName={lostReasonData.expectedOrder.organisationName}
        projectRevenue={lostReasonData.revenue || lostReasonData.expectedOrder.revenue}
      />
    )}
    </div>
  );
}
