import { useState, useEffect, useCallback } from "react";
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
  User,
  Phone,
  Mail,
  Building2,
  Settings,
  FileText,
  Calendar,
  DollarSign,
  Target,
  AlertCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { ProspectFilters } from "./prospect-filters";
import { LostReasonModal } from "./lost-reason-modal";

interface Prospect {
  id: string;
  date: string;
  client: string;
  contactPerson: string;
  contactNumber: string;
  contactEmail: string;
  systemInPlace: string;
  needAvailability: string;
  currentVendor?: string;
  remarks?: string;
  revenue?: number;
  stage: 'prospect' | 'lead' | 'expected_order' | 'sales_won' | 'lost';
  sectorId: string;
  bdId: string;
  createdAt: string;
  updatedAt: string;
  sectorName?: string;
  bdName?: string;
}

interface Sector {
  id: string;
  name: string;
  description?: string;
}

interface ProspectsResponse {
  prospects: Prospect[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const prospectUpdateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  client: z.string().min(1, "Client name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  contactEmail: z.string().email("Valid email is required"),
  systemInPlace: z.enum(['navision', '365_bc', 'none', 'open_source', 'oracle', 'sap']),
  needAvailability: z.enum(['upgrade', 'under_implementation', 'none']),
  currentVendor: z.string().optional(),
  remarks: z.string().optional(),
  revenue: z.number().positive("Revenue must be positive").optional(),
  stage: z.enum(['prospect', 'lead', 'expected_order', 'sales_won', 'lost']),
  sectorId: z.string().min(1, "Sector is required"),
});

type ProspectUpdateData = z.infer<typeof prospectUpdateSchema>;

const stageColors = {
  prospect: "bg-blue-100 text-blue-800",
  lead: "bg-green-100 text-green-800",
  expected_order: "bg-yellow-100 text-yellow-800",
  sales_won: "bg-purple-100 text-purple-800",
  lost: "bg-red-100 text-red-800",
};

const stageLabels = {
  prospect: "Prospect",
  lead: "Lead",
  expected_order: "Expected Order",
  sales_won: "Sales Won",
  lost: "Lost",
};

interface MarketingProspectsTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
}

export function MarketingProspectsTable({ showMarketerInfo = false, selectedMarketer, onMarketerChange }: MarketingProspectsTableProps) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [isStageChangeOpen, setIsStageChangeOpen] = useState(false);
  const [stageChangeProspect, setStageChangeProspect] = useState<Prospect | null>(null);
  const [newStage, setNewStage] = useState<string>("");
  const [newRevenue, setNewRevenue] = useState<string>("");
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [lostReasonData, setLostReasonData] = useState<{prospect: Prospect, stage: string, revenue?: string} | null>(null);
  const [filters, setFilters] = useState<{
    search?: string;
    year?: string;
    quarter?: string;
    bdId?: string;
    sectorId?: string;
    stage?: string;
  }>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProspectUpdateData>({
    resolver: zodResolver(prospectUpdateSchema),
  });

  const handleFiltersChange = useCallback((newFilters: {
    search?: string;
    year?: string;
    quarter?: string;
    bdId?: string;
    sectorId?: string;
    stage?: string;
  }) => {
    setFilters(newFilters);
  }, []);

  useEffect(() => {
    loadProspects();
    loadSectors();
  }, [currentPage, filters, selectedMarketer]);

  const loadProspects = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(filters.search && { search: filters.search }),
        ...(filters.year && { year: filters.year }),
        ...(filters.quarter && { quarter: filters.quarter }),
        ...(filters.bdId && { bdId: filters.bdId }),
        ...(filters.sectorId && { sectorId: filters.sectorId }),
        ...(filters.stage && { stage: filters.stage }),
        ...(selectedMarketer && { bdId: selectedMarketer }),
      });

      const response = await fetch(`/api/marketing/prospects?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: ProspectsResponse = await response.json();
        setProspects(data.prospects || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        toast({
          title: "Error",
          description: "Failed to load prospects",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to load prospects:", error);
      toast({
        title: "Error",
        description: "Failed to load prospects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSectors = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/sectors", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSectors(data.sectors || []);
      }
    } catch (error) {
      console.error("Failed to load sectors:", error);
    }
  };

  const handleEdit = async (data: ProspectUpdateData) => {
    if (!editingProspect) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/prospects/${editingProspect.id}`, {
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
          description: "Prospect updated successfully",
        });
        setIsEditOpen(false);
        setEditingProspect(null);
        reset();
    loadProspects();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update prospect",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update prospect:", error);
      toast({
        title: "Error",
        description: "Failed to update prospect",
        variant: "destructive",
      });
    }
  };

  const handleStageChange = async () => {
    if (!stageChangeProspect || !newStage) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/prospects/${stageChangeProspect.id}/stage`, {
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
          description: "Prospect stage updated successfully",
        });
        setIsStageChangeOpen(false);
        setStageChangeProspect(null);
        setNewStage("");
        setNewRevenue("");
        loadProspects();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update prospect stage",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update prospect stage:", error);
      toast({
        title: "Error",
        description: "Failed to update prospect stage",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (prospectId: string) => {
    if (!confirm("Are you sure you want to delete this prospect?")) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/prospects/${prospectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Prospect deleted successfully",
        });
        loadProspects();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete prospect",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to delete prospect:", error);
      toast({
        title: "Error",
        description: "Failed to delete prospect",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (prospect: Prospect) => {
    setEditingProspect(prospect);
    // Fix date formatting - handle both ISO string and date string formats
    const dateValue = prospect.date.includes('T') 
      ? prospect.date.split('T')[0] 
      : prospect.date.split(' ')[0];
    setValue("date", dateValue);
    setValue("client", prospect.client);
    setValue("contactPerson", prospect.contactPerson);
    setValue("contactNumber", prospect.contactNumber);
    setValue("contactEmail", prospect.contactEmail);
    setValue("systemInPlace", prospect.systemInPlace as any);
    setValue("needAvailability", prospect.needAvailability as any);
    setValue("currentVendor", prospect.currentVendor || "");
    setValue("remarks", prospect.remarks || "");
    setValue("revenue", prospect.revenue || 0);
    setValue("stage", prospect.stage);
    setValue("sectorId", prospect.sectorId || undefined);
    setIsEditOpen(true);
  };

  const openStageChangeDialog = (prospect: Prospect) => {
    setStageChangeProspect(prospect);
    setNewStage(prospect.stage);
    setNewRevenue(prospect.revenue?.toString() || "");
    setIsStageChangeOpen(true);
  };

  const handleStageSelection = (stage: string, prospect: Prospect) => {
    if (stage === 'lost') {
      // Open lost reason modal instead of stage change dialog
      setLostReasonData({
        prospect,
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
      const response = await fetch(`/api/marketing/prospects/${lostReasonData.prospect.id}/stage`, {
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
          description: "Prospect marked as lost successfully",
        });
        setIsLostReasonModalOpen(false);
        setLostReasonData(null);
        loadProspects();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to mark prospect as lost",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error marking prospect as lost:", error);
      toast({
        title: "Error",
        description: "Failed to mark prospect as lost",
        variant: "destructive",
      });
    }
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <ProspectFilters 
        onFiltersChange={handleFiltersChange}
        showMarketerInfo={showMarketerInfo}
      />

      {/* Prospects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Prospects ({prospects.length})
          </CardTitle>
          <CardDescription>
            Manage and track your prospects through the sales pipeline
          </CardDescription>
      </CardHeader>
      <CardContent>
          {prospects.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No prospects found</h3>
              <p className="text-gray-500">
                {searchTerm ? "No prospects match your search criteria." : "Get started by adding your first prospect."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Marketer</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>System in Place</TableHead>
                    <TableHead>Need Availability</TableHead>
                    <TableHead>Current Vendor</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Revenue</TableHead>
                <TableHead>Sector</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                  {prospects.map((prospect) => (
                    <TableRow key={prospect.id}>
                      <TableCell className="text-gray-600">
                        {format(new Date(prospect.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{prospect.client}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-blue-400" />
                          <span className="text-sm font-medium text-gray-700">
                            {prospect.bdName || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {prospect.bdEmail || ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          {prospect.contactPerson}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Phone className="h-3 w-3 mr-1 text-gray-400" />
                            {prospect.contactNumber}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="h-3 w-3 mr-1 text-gray-400" />
                            {prospect.contactEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {prospect.systemInPlace.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {prospect.needAvailability.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {prospect.currentVendor || "N/A"}
                  </TableCell>
                    <TableCell>
                        <Badge className={stageColors[prospect.stage]}>
                          {stageLabels[prospect.stage]}
                      </Badge>
                    </TableCell>
                      <TableCell className="text-gray-600">
                        {prospect.revenue ? `KSH ${prospect.revenue.toLocaleString()}` : "N/A"}
                      </TableCell>
                    <TableCell>
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                          {prospect.sectorName || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditDialog(prospect)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit prospect details</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openStageChangeDialog(prospect)}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Change prospect stage</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(prospect.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete prospect</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                    </TableCell>
                  </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
          )}
        </CardContent>
      </Card>

        {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Edit className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-900">Edit Prospect</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Update the prospect information and details.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleEdit)} className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-date" className="text-sm font-medium text-gray-700 flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    Date <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="edit-date"
                    type="date"
                    {...register("date")}
                    className={`h-11 focus:border-blue-500 focus:ring-blue-500 ${errors.date ? "border-red-500" : ""}`}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.date.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-client" className="text-sm font-medium text-gray-700 flex items-center">
                    <Building2 className="h-4 w-4 mr-2 text-gray-500" />
                    Client Name <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="edit-client"
                    {...register("client")}
                    className={`h-11 focus:border-blue-500 focus:ring-blue-500 ${errors.client ? "border-red-500" : ""}`}
                    placeholder="Enter client name"
                  />
                  {errors.client && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.client.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-contactPerson" className="text-sm font-medium text-gray-700 flex items-center">
                    <User className="h-4 w-4 mr-2 text-gray-500" />
                    Contact Person <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="edit-contactPerson"
                    {...register("contactPerson")}
                    className={`h-11 focus:border-blue-500 focus:ring-blue-500 ${errors.contactPerson ? "border-red-500" : ""}`}
                    placeholder="Enter contact person name"
                  />
                  {errors.contactPerson && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.contactPerson.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contactNumber" className="text-sm font-medium text-gray-700 flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-500" />
                    Contact Number <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="edit-contactNumber"
                    {...register("contactNumber")}
                    className={`h-11 focus:border-blue-500 focus:ring-blue-500 ${errors.contactNumber ? "border-red-500" : ""}`}
                    placeholder="Enter contact number"
                  />
                  {errors.contactNumber && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.contactNumber.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contactEmail" className="text-sm font-medium text-gray-700 flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-500" />
                  Contact Email <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  id="edit-contactEmail"
                  type="email"
                  {...register("contactEmail")}
                  className={`h-11 focus:border-blue-500 focus:ring-blue-500 ${errors.contactEmail ? "border-red-500" : ""}`}
                  placeholder="Enter contact email"
                />
                {errors.contactEmail && (
                  <p className="text-sm text-red-500 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.contactEmail.message}
                  </p>
                )}
              </div>
            </div>

            {/* System Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">System Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-systemInPlace" className="text-sm font-medium text-gray-700 flex items-center">
                    <Settings className="h-4 w-4 mr-2 text-gray-500" />
                    System in Place <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select
                    value={watch("systemInPlace")}
                    onValueChange={(value) => setValue("systemInPlace", value as any)}
                  >
                    <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select system" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="navision">Navision</SelectItem>
                      <SelectItem value="365_bc">365 BC</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="open_source">Open Source</SelectItem>
                      <SelectItem value="oracle">Oracle</SelectItem>
                      <SelectItem value="sap">SAP</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.systemInPlace && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.systemInPlace.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-needAvailability" className="text-sm font-medium text-gray-700 flex items-center">
                    <Target className="h-4 w-4 mr-2 text-gray-500" />
                    Need Availability <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select
                    value={watch("needAvailability")}
                    onValueChange={(value) => setValue("needAvailability", value as any)}
                  >
                    <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select need" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upgrade">Upgrade</SelectItem>
                      <SelectItem value="under_implementation">Under Implementation</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.needAvailability && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.needAvailability.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Business Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Business Information</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-currentVendor" className="text-sm font-medium text-gray-700 flex items-center">
                    <Building2 className="h-4 w-4 mr-2 text-gray-500" />
                    Current Vendor <span className="text-gray-400 ml-1">(Optional)</span>
                  </Label>
                  <Input
                    id="edit-currentVendor"
                    {...register("currentVendor")}
                    className={`h-11 focus:border-blue-500 focus:ring-blue-500 ${errors.currentVendor ? "border-red-500" : ""}`}
                    placeholder="Enter current vendor (optional)"
                  />
                  {errors.currentVendor && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.currentVendor.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sectorId" className="text-sm font-medium text-gray-700 flex items-center">
                      <Target className="h-4 w-4 mr-2 text-gray-500" />
                      Sector <span className="text-gray-400 ml-1">(Optional)</span>
                    </Label>
                    <Select
                      value={watch("sectorId") || undefined}
                      onValueChange={(value) => setValue("sectorId", value || undefined)}
                    >
                      <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select sector (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((sector) => (
                          <SelectItem key={sector.id} value={sector.id}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.sectorId && (
                      <p className="text-sm text-red-500 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.sectorId.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-revenue" className="text-sm font-medium text-gray-700 flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 text-gray-500" />
                      Revenue (KSH) <span className="text-gray-400 ml-1">(Optional)</span>
                    </Label>
                    <Input
                      id="edit-revenue"
                      type="number"
                      step="0.01"
                      {...register("revenue", { valueAsNumber: true })}
                      className={`h-11 focus:border-blue-500 focus:ring-blue-500 ${errors.revenue ? "border-red-500" : ""}`}
                      placeholder="0.00 (optional)"
                    />
                    {errors.revenue && (
                      <p className="text-sm text-red-500 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.revenue.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Additional Information</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-remarks" className="text-sm font-medium text-gray-700 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-gray-500" />
                  Remarks <span className="text-gray-400 ml-1">(Optional)</span>
                </Label>
                <Textarea
                  id="edit-remarks"
                  {...register("remarks")}
                  className={`resize-none focus:border-blue-500 focus:ring-blue-500 ${errors.remarks ? "border-red-500" : ""}`}
                  placeholder="Enter any additional remarks (optional)"
                  rows={3}
                />
                {errors.remarks && (
                  <p className="text-sm text-red-500 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.remarks.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex justify-between items-center pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                <span className="text-red-500">*</span> Required fields
              </div>
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditOpen(false)}
                  className="h-11 px-6"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="h-11 px-8 bg-blue-600 hover:bg-blue-700"
                >
                  Update Prospect
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stage Change Dialog */}
      <Dialog open={isStageChangeOpen} onOpenChange={setIsStageChangeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Settings className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-900">Change Prospect Stage</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Update the stage and revenue for this prospect.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Current Prospect Info */}
            {stageChangeProspect && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Current Prospect:</h4>
                <div className="text-sm text-gray-600">
                  <p><strong>Client:</strong> {stageChangeProspect.client}</p>
                  <p><strong>Current Stage:</strong> 
                    <Badge variant="outline" className="ml-2 capitalize">
                      {stageChangeProspect.stage.replace('_', ' ')}
                    </Badge>
                  </p>
                </div>
              </div>
            )}

            {/* Stage Selection */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Stage Update</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stage" className="text-sm font-medium text-gray-700 flex items-center">
                    <Target className="h-4 w-4 mr-2 text-gray-500" />
                    New Stage <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select value={newStage} onValueChange={(value) => handleStageSelection(value, stageChangeProspect!)}>
                    <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select new stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="expected_order">Expected Order</SelectItem>
                      <SelectItem value="sales_won">Sales Won</SelectItem>
                      <SelectItem value="lost" className="text-red-600">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="revenue" className="text-sm font-medium text-gray-700 flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 text-gray-500" />
                    Revenue (KSH) <span className="text-gray-400 ml-1">(Optional)</span>
                  </Label>
                  <Input
                    id="revenue"
                    type="number"
                    step="0.01"
                    value={newRevenue}
                    onChange={(e) => setNewRevenue(e.target.value)}
                    className="h-11 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter revenue amount (optional)"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex justify-between items-center pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              <span className="text-red-500">*</span> Required fields
            </div>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setIsStageChangeOpen(false)}
                className="h-11 px-6"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleStageChange}
                className="h-11 px-8 bg-green-600 hover:bg-green-700"
                disabled={!newStage}
              >
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
          projectName={lostReasonData.prospect.client}
          projectRevenue={lostReasonData.revenue || lostReasonData.prospect.revenue}
        />
      )}
    </div>
  );
}