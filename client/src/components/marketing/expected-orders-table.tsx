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
import { 
  Edit, 
  Trash2, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ExpectedOrdersFilters } from "./expected-orders-filters";

interface ExpectedOrders {
  id: string;
  organisationName: string;
  sector: string;
  product: string;
  revenue: number;
  expectedQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  comments?: string;
  createdAt: string;
  updatedAt: string;
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

interface MarketingExpectedOrdersTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
}

export function MarketingExpectedOrdersTable({ 
  showMarketerInfo = false, 
  selectedMarketer = "",
  onMarketerChange 
}: MarketingExpectedOrdersTableProps) {
  const [expectedOrders, setExpectedOrders] = useState<ExpectedOrders[]>([]);
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
                <TableHead>Sector</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Expected Quarter</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expectedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No expected orders found
                  </TableCell>
                </TableRow>
              ) : (
                expectedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.organisationName}</TableCell>
                    <TableCell>{order.sector}</TableCell>
                    <TableCell>{order.product}</TableCell>
                    <TableCell>{formatCurrency(order.revenue)}</TableCell>
                    <TableCell>
                      <Badge className={quarterColors[order.expectedQuarter]}>
                        {order.expectedQuarter}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(order.id)}
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
    </div>
  );
}
