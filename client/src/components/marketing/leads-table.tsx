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
  Users,
  Target,
  ArrowRight,
  Calendar,
  Building2,
  User,
  Phone,
  Mail,
  DollarSign,
  FileText
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { LeadsFilters } from "./leads-filters";
import { LostReasonModal } from "./lost-reason-modal";

interface Lead {
  id: string;
  date: string;
  client: string;
  contactPerson: string;
  contactNumber: string;
  contactEmail: string;
  remarks?: string;
  revenue?: string | number;
  stage: 'prospect' | 'lead' | 'expected_order' | 'sales_won' | 'lost';
  bdId: string;
  sectorId?: string;
  sharedWithBdId?: string;
  revenueSplit?: string | number;
  createdAt: string;
  updatedAt: string;
  bdName?: string;
  bdEmail?: string;
  sectorName?: string;
}

interface LeadsResponse {
  leads: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const stageColors = {
  prospect: "bg-blue-100 text-blue-800",
  lead: "bg-yellow-100 text-yellow-800",
  expected_order: "bg-purple-100 text-purple-800",
  sales_won: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

const leadUpdateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  client: z.string().min(1, "Client name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  contactEmail: z.string().email("Valid email is required"),
  remarks: z.string().optional(),
  revenue: z.number().positive("Revenue must be positive").optional(),
});

type LeadUpdateData = z.infer<typeof leadUpdateSchema>;

interface MarketingLeadsTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
}

export function MarketingLeadsTable({ 
  showMarketerInfo = false, 
  selectedMarketer = "",
  onMarketerChange 
}: MarketingLeadsTableProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
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
    bdId?: string;
    marketerId?: string;
  }>({});
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  
  // Edit functionality state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Stage change functionality state
  const [isStageChangeOpen, setIsStageChangeOpen] = useState(false);
  const [stageChangeLead, setStageChangeLead] = useState<Lead | null>(null);
  const [newStage, setNewStage] = useState<string>("");
  const [newRevenue, setNewRevenue] = useState<string>("");
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [lostReasonData, setLostReasonData] = useState<{lead: Lead, stage: string, revenue?: string} | null>(null);

  // Form setup
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<LeadUpdateData>({
    resolver: zodResolver(leadUpdateSchema),
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
    bdId?: string;
    marketerId?: string;
  }) => {
    setFilters(newFilters);
  }, []);

  const memoizedFilters = useMemo(() => filters, [
    filters.search,
    filters.year,
    filters.quarter,
    filters.bdId,
    filters.marketerId
  ]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(filters.search && { search: filters.search }),
        ...(filters.year && { year: filters.year }),
        ...(filters.quarter && { quarter: filters.quarter }),
        ...(filters.bdId && { bdId: filters.bdId }),
        ...(filters.marketerId && { marketerId: filters.marketerId }),
        ...(selectedMarketer && { marketerId: selectedMarketer }),
      });

      const response = await fetch(`/api/marketing/leads?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: LeadsResponse = await response.json();
        setLeads(data.leads);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to load leads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [page, search, selectedMarketer, memoizedFilters]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/prospects/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        loadLeads();
      }
    } catch (error) {
      console.error("Failed to delete lead:", error);
    }
  };

  const handleEdit = async (data: LeadUpdateData) => {
    if (!editingLead) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/prospects/${editingLead.id}`, {
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
          description: "Lead updated successfully",
        });
        setIsEditOpen(false);
        setEditingLead(null);
        reset();
        loadLeads();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update lead",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update lead:", error);
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStageChange = async () => {
    if (!stageChangeLead || !newStage) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/prospects/${stageChangeLead.id}/stage`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage: newStage,
          revenue: newRevenue ? parseFloat(newRevenue) : undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Lead stage updated successfully",
        });
        setIsStageChangeOpen(false);
        setStageChangeLead(null);
        setNewStage("");
        setNewRevenue("");
        loadLeads();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update lead stage",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update lead stage:", error);
      toast({
        title: "Error",
        description: "Failed to update lead stage",
        variant: "destructive",
      });
    }
  };

  const handleStageSelection = (stage: string, lead: Lead) => {
    if (stage === 'lost') {
      // Open lost reason modal instead of stage change dialog
      setLostReasonData({
        lead,
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
      const response = await fetch(`/api/marketing/prospects/${lostReasonData.lead.id}/stage`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage: 'lost',
          revenue: lostReasonData.revenue ? parseFloat(lostReasonData.revenue) : undefined,
          lostReason: reason,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Lead marked as lost successfully",
        });
        setIsLostReasonModalOpen(false);
        setLostReasonData(null);
        loadLeads();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to mark lead as lost",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error marking lead as lost:", error);
      toast({
        title: "Error",
        description: "Failed to mark lead as lost",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (lead: Lead) => {
    setEditingLead(lead);
    // Fix date formatting - handle both ISO string and date string formats
    const dateValue = lead.date.includes('T') 
      ? lead.date.split('T')[0] 
      : lead.date.split(' ')[0];
    setValue("date", dateValue);
    setValue("client", lead.client);
    setValue("contactPerson", lead.contactPerson);
    setValue("contactNumber", lead.contactNumber);
    setValue("contactEmail", lead.contactEmail);
    setValue("remarks", lead.remarks || "");
    setValue("revenue", typeof lead.revenue === 'string' ? parseFloat(lead.revenue) : lead.revenue || 0);
    setIsEditOpen(true);
  };

  const openStageChangeDialog = (lead: Lead) => {
    setStageChangeLead(lead);
    setNewStage(lead.stage);
    setNewRevenue(typeof lead.revenue === 'string' ? lead.revenue : lead.revenue?.toString() || "");
    setIsStageChangeOpen(true);
  };

  const formatCurrency = (amount?: string | number) => {
    if (!amount) return "N/A";
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return "N/A";
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(numericAmount);
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
      <LeadsFilters 
        onFiltersChange={handleFiltersChange}
        showMarketerInfo={showMarketerInfo}
      />

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Leads</CardTitle>
              <CardDescription className="text-gray-600">
                Manage your sales leads and track their progress
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      <CardContent className="p-0">
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                {user?.role === 'admin' && showMarketerInfo && (
                  <TableHead className="font-semibold text-gray-700">Marketer</TableHead>
                )}
                <TableHead className="font-semibold text-gray-700">Date</TableHead>
                <TableHead className="font-semibold text-gray-700">Client</TableHead>
                <TableHead className="font-semibold text-gray-700">Contact Details</TableHead>
                <TableHead className="font-semibold text-gray-700">Revenue</TableHead>
                <TableHead className="font-semibold text-gray-700">Stage</TableHead>
                <TableHead className="font-semibold text-gray-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' && showMarketerInfo ? 7 : 6} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No leads found</p>
                      <p className="text-sm text-gray-400">Start by adding your first lead</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-gray-50/50">
                    {user?.role === 'admin' && showMarketerInfo && (
                      <TableCell className="font-medium text-gray-900">
                        <div>
                          <p className="text-sm font-semibold">{lead.bdName || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{lead.bdEmail || ''}</p>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-gray-900">{formatDate(lead.date)}</TableCell>
                    <TableCell className="font-semibold text-gray-900">{lead.client}</TableCell>
                    <TableCell className="max-w-xs truncate text-gray-600">
                      <div className="space-y-1">
                        <div className="font-medium">{lead.contactPerson}</div>
                        <div className="text-sm text-gray-500">{lead.contactNumber}</div>
                        <div className="text-sm text-gray-500">{lead.contactEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">{formatCurrency(lead.revenue)}</TableCell>
                    <TableCell>
                      <Badge className={`${stageColors[lead.stage]} font-medium`}>
                        {lead.stage.replace("_", " ").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                                onClick={() => openEditDialog(lead)}
                              >
                                <Edit className="h-4 w-4 text-gray-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit lead details</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 hover:bg-blue-100"
                                onClick={() => openStageChangeDialog(lead)}
                              >
                                <ArrowRight className="h-4 w-4 text-blue-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Change stage</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-red-100"
                                onClick={() => handleDelete(lead.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete lead</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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

    {/* Edit Lead Dialog */}
    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Edit className="h-6 w-6 text-blue-600" />
            </div>
            Edit Lead Information
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-base">
            Update the lead details and contact information below. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(handleEdit)} className="space-y-6">
          {/* Basic Information Section */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="date" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date *
                </Label>
                <Input
                  id="date"
                  type="date"
                  {...register("date")}
                  className={`h-11 ${errors.date ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {errors.date && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.date.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="client" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Client Name *
                </Label>
                <Input
                  id="client"
                  {...register("client")}
                  placeholder="Enter client name"
                  className={`h-11 ${errors.client ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {errors.client && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.client.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="contactPerson" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact Person *
                </Label>
                <Input
                  id="contactPerson"
                  {...register("contactPerson")}
                  placeholder="Enter contact person name"
                  className={`h-11 ${errors.contactPerson ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {errors.contactPerson && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.contactPerson.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="contactNumber" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contact Number *
                </Label>
                <Input
                  id="contactNumber"
                  {...register("contactNumber")}
                  placeholder="Enter phone number"
                  className={`h-11 ${errors.contactNumber ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {errors.contactNumber && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.contactNumber.message}
                  </p>
                )}
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              <Label htmlFor="contactEmail" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contact Email *
              </Label>
              <Input
                id="contactEmail"
                type="email"
                {...register("contactEmail")}
                placeholder="Enter email address"
                className={`h-11 ${errors.contactEmail ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
              />
              {errors.contactEmail && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                  {errors.contactEmail.message}
                </p>
              )}
            </div>
          </div>

          {/* Financial Information Section */}
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-green-500 rounded-full"></div>
              Financial Information
            </h3>
            <div className="space-y-3">
              <Label htmlFor="revenue" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue (KES)
              </Label>
              <Input
                id="revenue"
                type="number"
                step="0.01"
                {...register("revenue", { valueAsNumber: true })}
                placeholder="Enter revenue amount"
                className={`h-11 ${errors.revenue ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-green-500 focus:ring-green-500"}`}
              />
              {errors.revenue && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                  {errors.revenue.message}
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
              <Label htmlFor="remarks" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Remarks
              </Label>
              <Textarea
                id="remarks"
                {...register("remarks")}
                rows={4}
                placeholder="Enter any additional remarks or notes..."
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
                    Updating Lead...
                  </>
                ) : (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Update Lead
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
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            Change Lead Stage
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-base">
            Update the stage for <strong className="text-gray-900">{stageChangeLead?.client}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current Stage Display */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Current Stage:</span>
              <Badge className={`${stageColors[stageChangeLead?.stage || 'prospect']} font-medium px-3 py-1`}>
                {(stageChangeLead?.stage || 'prospect').replace("_", " ").toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Stage Selection */}
          <div className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="newStage" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                New Stage *
              </Label>
              <Select value={newStage} onValueChange={(value) => handleStageSelection(value, stageChangeLead!)}>
                <SelectTrigger className="h-11 focus:border-purple-500 focus:ring-purple-500">
                  <SelectValue placeholder="Select new stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800 text-xs">PROSPECT</Badge>
                      <span>Initial prospect</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="lead">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">LEAD</Badge>
                      <span>Qualified lead</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="expected_order">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800 text-xs">EXPECTED ORDER</Badge>
                      <span>Expected order</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sales_won">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 text-xs">SALES WON</Badge>
                      <span>Closed sale</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="lost">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800 text-xs">LOST</Badge>
                      <span>Project lost</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="newRevenue" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue (KES) - Optional
              </Label>
              <Input
                id="newRevenue"
                type="number"
                step="0.01"
                value={newRevenue}
                onChange={(e) => setNewRevenue(e.target.value)}
                placeholder="Enter revenue amount"
                className="h-11 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-6 border-t border-gray-200">
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStageChangeOpen(false)}
              className="flex-1 h-11"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStageChange}
              disabled={!newStage}
              className="flex-1 h-11 bg-purple-600 hover:bg-purple-700"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Update Stage
            </Button>
          </div>
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
        projectName={lostReasonData.lead.client}
        projectRevenue={lostReasonData.revenue || lostReasonData.lead.revenue}
      />
    )}
    </div>
  );
}
