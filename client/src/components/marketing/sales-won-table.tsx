import { useState, useEffect } from "react";
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

  useEffect(() => {
    // Get user info from localStorage
    const userData = localStorage.getItem("marketingUser");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const loadSalesWon = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(search && { search }),
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
  }, [page, search]);

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
    <Card>
      <CardHeader>
        <CardTitle>Sales Won</CardTitle>
        <CardDescription>
          Track your successful sales and contract wins
        </CardDescription>
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sales won..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {user?.role === 'admin' && showMarketerInfo && (
                  <TableHead>Marketer</TableHead>
                )}
                <TableHead>Organisation</TableHead>
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
                  <TableCell colSpan={user?.role === 'admin' && showMarketerInfo ? 8 : 7} className="text-center py-8">
                    No sales won records found
                  </TableCell>
                </TableRow>
              ) : (
                salesWon.map((sale) => (
                  <TableRow key={sale.id}>
                    {user?.role === 'admin' && showMarketerInfo && (
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{sale.marketerName || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{sale.marketerEmail || ''}</div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{sale.organisationName}</TableCell>
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
                        <Button variant="outline" size="sm">
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
  );
}
