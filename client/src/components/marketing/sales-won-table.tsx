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
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { SalesWonFilters } from "./sales-won-filters";

interface SalesWon {
  id: string;
  organisationName: string;
  sector: string;
  product: string;
  contractAmount: number;
  expectedQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  comments?: string;
  marketerId: string;
  marketerName?: string;
  marketerEmail?: string;
  contactPerson?: string;
  contactNumber?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

interface SalesWonResponse {
  salesWon: SalesWon[];
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

const salesWonUpdateSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required").max(200, "Organisation name too long"),
  sector: z.string().min(1, "Sector is required").max(100, "Sector name too long"),
  product: z.string().min(1, "Product is required").max(200, "Product name too long"),
  contractAmount: z.number().positive("Contract amount must be positive"),
  expectedQuarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  comments: z.string().optional(),
});

type SalesWonUpdateData = z.infer<typeof salesWonUpdateSchema>;

interface MarketingSalesWonTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
}

export function MarketingSalesWonTable({ 
  showMarketerInfo = false, 
  selectedMarketer = "",
  onMarketerChange 
}: MarketingSalesWonTableProps) {
  const [salesWon, setSalesWon] = useState<SalesWon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [user, setUser] = useState<any>(null);
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
  const [editingSalesWon, setEditingSalesWon] = useState<SalesWon | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form setup
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<SalesWonUpdateData>({
    resolver: zodResolver(salesWonUpdateSchema),
  });

  useEffect(() => {
    // Get user info from localStorage
    const userData = localStorage.getItem("marketingUser");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

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

  const loadSalesWon = async () => {
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
        ...(user?.role === 'admin' && selectedMarketer && { marketerId: selectedMarketer }),
      });

      const response = await fetch(`/api/marketing/sales-won?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: SalesWonResponse = await response.json();
        setSalesWon(data.salesWon);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to load sales won:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalesWon();
  }, [page, search, selectedMarketer, memoizedFilters]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sales won record?")) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/sales-won/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        loadSalesWon();
      }
    } catch (error) {
      console.error("Failed to delete sales won:", error);
    }
  };

  const handleEdit = async (data: SalesWonUpdateData) => {
    if (!editingSalesWon) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/sales-won/${editingSalesWon.id}`, {
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
          description: "Sales won record updated successfully",
        });
        setIsEditOpen(false);
        setEditingSalesWon(null);
        reset();
        loadSalesWon();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update sales won record",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update sales won:", error);
      toast({
        title: "Error",
        description: "Failed to update sales won record",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (salesWon: SalesWon) => {
    setEditingSalesWon(salesWon);
    setValue("organisationName", salesWon.organisationName);
    setValue("sector", salesWon.sector);
    setValue("product", salesWon.product);
    setValue("contractAmount", salesWon.contractAmount);
    setValue("expectedQuarter", salesWon.expectedQuarter);
    setValue("comments", salesWon.comments || "");
    setIsEditOpen(true);
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
      <SalesWonFilters 
        onFiltersChange={handleFiltersChange}
        showMarketerInfo={showMarketerInfo}
      />

      <Card>
        <CardHeader>
          <CardTitle>Sales Won</CardTitle>
          <CardDescription>
            Track your successful sales and contract wins
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
                <TableHead>Contract Amount</TableHead>
                <TableHead>Expected Quarter</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesWon.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    No sales won records found
                  </TableCell>
                </TableRow>
              ) : (
                salesWon.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.organisationName}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-blue-400" />
                        <span className="text-sm font-medium text-gray-700">
                          {sale.marketerName || 'Unknown'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {sale.marketerEmail || ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-700">
                          {sale.contactPerson || 'N/A'}
                        </div>
                        <div className="flex items-center text-xs text-gray-600">
                          <Phone className="h-3 w-3 mr-1" />
                          {sale.contactNumber || 'N/A'}
                        </div>
                        <div className="flex items-center text-xs text-gray-600">
                          <Mail className="h-3 w-3 mr-1" />
                          {sale.contactEmail || 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{sale.sector}</TableCell>
                    <TableCell>{sale.product}</TableCell>
                    <TableCell>{formatCurrency(sale.contractAmount)}</TableCell>
                    <TableCell>
                      <Badge className={quarterColors[sale.expectedQuarter]}>
                        {sale.expectedQuarter}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(sale.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openEditDialog(sale)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(sale.id)}
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

    {/* Edit Sales Won Dialog */}
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            Edit Sales Won Record
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-base">
            Update the sales won information below. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(handleEdit)} className="space-y-6">
          {/* Organisation Information Section */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-green-500 rounded-full"></div>
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
                  className={`h-11 ${errors.organisationName ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-green-500 focus:ring-green-500"}`}
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
                  className={`h-11 ${errors.sector ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-green-500 focus:ring-green-500"}`}
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
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-green-500 rounded-full"></div>
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
                  className={`h-11 ${errors.product ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-green-500 focus:ring-green-500"}`}
                />
                {errors.product && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.product.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="contractAmount" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Contract Amount (KES) *
                </Label>
                <Input
                  id="contractAmount"
                  type="number"
                  step="0.01"
                  {...register("contractAmount", { valueAsNumber: true })}
                  placeholder="Enter contract amount"
                  className={`h-11 ${errors.contractAmount ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-green-500 focus:ring-green-500"}`}
                />
                {errors.contractAmount && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.contractAmount.message}
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
                value={editingSalesWon?.expectedQuarter}
                onValueChange={(value) => setValue("expectedQuarter", value as any)}
              >
                <SelectTrigger className={`h-11 ${errors.expectedQuarter ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-green-500 focus:ring-green-500"}`}>
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
                className="flex-1 h-11 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Sales Won...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Update Sales Won
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </div>
  );
}
