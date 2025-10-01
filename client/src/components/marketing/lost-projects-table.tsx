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
  Search, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Eye,
  Filter,
  X,
  FileText,
  TrendingDown
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LostProject {
  id: string;
  organisationName: string;
  sector: string;
  product: string;
  revenue?: string | number;
  expectedQuarter: string;
  comments?: string;
  marketerId: string;
  contactPerson?: string;
  contactNumber?: string;
  contactEmail?: string;
  lostReason: string;
  lostDate: string;
  canRevive: boolean;
  createdAt: string;
  updatedAt: string;
  marketerName?: string;
  marketerEmail?: string;
}

interface Sector {
  id: string;
  name: string;
  description?: string;
}

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'marketer';
}

interface LostProjectsResponse {
  lostProjects: LostProject[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface LostProjectsTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
}

export function LostProjectsTable({
  showMarketerInfo = false,
  selectedMarketer = "",
  onMarketerChange
}: LostProjectsTableProps) {
  const [lostProjects, setLostProjects] = useState<LostProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(10);

  // Filter states
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState("all");
  const [marketerId, setMarketerId] = useState(selectedMarketer || "all");
  const [sectorId, setSectorId] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReviveModalOpen, setIsReviveModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<LostProject | null>(null);
  const [editReason, setEditReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data states
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [marketers, setMarketers] = useState<MarketingUser[]>([]);

  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const quarters = [
    { value: 'Q1', label: 'Q1 (Jan-Mar)' },
    { value: 'Q2', label: 'Q2 (Apr-Jun)' },
    { value: 'Q3', label: 'Q3 (Jul-Sep)' },
    { value: 'Q4', label: 'Q4 (Oct-Dec)' },
  ];

  const formatCurrency = (amount: string | number | undefined) => {
    if (amount === undefined || amount === null) return "KES 0";
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return "KES 0";
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  const loadLostProjects = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams();
      
      params.append('page', currentPage.toString());
      params.append('limit', limit.toString());
      
      if (search) params.append('search', search);
      if (year) params.append('year', year);
      if (quarter && quarter !== "all") params.append('quarter', quarter);
      if (marketerId && marketerId !== "all") params.append('marketerId', marketerId);
      if (sectorId && sectorId !== "all") params.append('sectorId', sectorId);

      const response = await fetch(`/api/marketing/lost-projects?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch lost projects');
      }

      const data: LostProjectsResponse = await response.json();
      setLostProjects(data.lostProjects);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch (error) {
      console.error('Error loading lost projects:', error);
      toast({
        title: "Error",
        description: "Failed to load lost projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, year, quarter, marketerId, sectorId, toast]);

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

  const loadMarketers = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMarketers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to load marketers:", error);
    }
  };

  useEffect(() => {
    loadLostProjects();
  }, [loadLostProjects]);

  useEffect(() => {
    loadSectors();
    if (showMarketerInfo) {
      loadMarketers();
    }
  }, [showMarketerInfo]);

  useEffect(() => {
    const filters = {
      ...(search && { search }),
      ...(year && year !== "all" && { year }),
      ...(quarter && quarter !== "all" && { quarter }),
      ...(marketerId && marketerId !== "all" && { marketerId }),
      ...(sectorId && sectorId !== "all" && { sectorId }),
    };
    
    const hasFilters = Object.keys(filters).length > 0;
    setHasActiveFilters(hasFilters);
  }, [search, year, quarter, marketerId, sectorId]);

  useEffect(() => {
    if (onMarketerChange && marketerId !== "all") {
      onMarketerChange(marketerId);
    }
  }, [marketerId, onMarketerChange]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleReviveProject = async (projectId: string, stage: string = 'prospect') => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/lost-projects/${projectId}/revive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revive project');
      }

      toast({
        title: "Success",
        description: "Project revived successfully",
      });

      setIsReviveModalOpen(false);
      setSelectedProject(null);
      loadLostProjects();
    } catch (error: any) {
      console.error('Error reviving project:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to revive project",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditReason = async () => {
    if (!selectedProject || !editReason.trim()) return;

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/lost-projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lostReason: editReason.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update reason');
      }

      toast({
        title: "Success",
        description: "Lost reason updated successfully",
      });

      setIsEditModalOpen(false);
      setSelectedProject(null);
      setEditReason('');
      loadLostProjects();
    } catch (error: any) {
      console.error('Error updating reason:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update reason",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openViewModal = (project: LostProject) => {
    setSelectedProject(project);
    setIsViewModalOpen(true);
  };

  const openEditModal = (project: LostProject) => {
    setSelectedProject(project);
    setEditReason(project.lostReason);
    setIsEditModalOpen(true);
  };

  const openReviveModal = (project: LostProject) => {
    setSelectedProject(project);
    setIsReviveModalOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setYear(new Date().getFullYear().toString());
    setQuarter("all");
    setMarketerId(selectedMarketer || "all");
    setSectorId("all");
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (search) count++;
    if (year && year !== new Date().getFullYear().toString()) count++;
    if (quarter && quarter !== "all") count++;
    if (marketerId && marketerId !== "all" && marketerId !== selectedMarketer) count++;
    if (sectorId && sectorId !== "all") count++;
    return count;
  };

  if (loading && lostProjects.length === 0) {
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
      <div className="space-y-4">
        {/* Search and Filter Toggle */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by organization or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 ${hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 text-xs font-medium">
                {getActiveFiltersCount()}
              </span>
            )}
          </Button>
        </div>

        {/* Advanced Filters */}
        <div 
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            showFilters ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Year Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Year
                  </label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quarter Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Quarter</label>
                  <Select value={quarter} onValueChange={setQuarter}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="All quarters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All quarters</SelectItem>
                      {quarters.map((q) => (
                        <SelectItem key={q.value} value={q.value}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sector Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <Building2 className="h-4 w-4 mr-1" />
                    Sector
                  </label>
                  <Select value={sectorId} onValueChange={setSectorId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="All sectors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sectors</SelectItem>
                      {sectors.map((sector) => (
                        <SelectItem key={sector.id} value={sector.id}>
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Marketer Filter */}
                {showMarketerInfo && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <User className="h-4 w-4 mr-1" />
                      Marketer
                    </label>
                    <Select value={marketerId} onValueChange={setMarketerId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All marketers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All marketers</SelectItem>
                        {marketers.map((marketer) => (
                          <SelectItem key={marketer.id} value={marketer.id}>
                            {marketer.firstName} {marketer.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Clear Filters */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">&nbsp;</label>
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="h-10 w-full"
                    disabled={!hasActiveFilters}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
                <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
                Lost Projects
              </CardTitle>
              <CardDescription>
                Projects that didn't proceed - {totalCount} total projects
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              Page {currentPage} of {totalPages}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  {showMarketerInfo && <TableHead>Marketer</TableHead>}
                  <TableHead>Contact Details</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Lost Date</TableHead>
                  <TableHead>Reason (Preview)</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lostProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showMarketerInfo ? 8 : 7} className="h-24 text-center text-gray-500">
                      <div className="flex flex-col items-center space-y-2">
                        <AlertTriangle className="h-8 w-8 text-gray-300" />
                        <p>No lost projects found</p>
                        <p className="text-sm text-gray-400">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  lostProjects.map((project) => (
                    <TableRow key={project.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <span>{project.organisationName}</span>
                        </div>
                      </TableCell>
                      {showMarketerInfo && (
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <div>
                              <p className="font-medium">{project.marketerName}</p>
                              <p className="text-xs text-gray-500">{project.marketerEmail}</p>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="space-y-1">
                          {project.contactPerson && (
                            <div className="flex items-center space-x-1 text-sm">
                              <User className="h-3 w-3 text-gray-400" />
                              <span>{project.contactPerson}</span>
                            </div>
                          )}
                          {project.contactNumber && (
                            <div className="flex items-center space-x-1 text-sm">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span>{project.contactNumber}</span>
                            </div>
                          )}
                          {project.contactEmail && (
                            <div className="flex items-center space-x-1 text-sm">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <span className="truncate max-w-[150px]">{project.contactEmail}</span>
                            </div>
                          )}
                          {!project.contactPerson && !project.contactNumber && !project.contactEmail && (
                            <span className="text-gray-400 text-sm">No contact details</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {project.sector}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCurrency(project.revenue)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{formatDate(project.lostDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-pointer hover:underline text-sm">
                                {project.lostReason.length > 50
                                  ? project.lostReason.substring(0, 50) + "..."
                                  : project.lostReason}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-3 bg-gray-800 text-white rounded-md shadow-lg">
                              <p className="text-sm">{project.lostReason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openViewModal(project)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Details</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditModal(project)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit Reason</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openReviveModal(project)}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Revive Project</p>
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Project Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <span>Project Details</span>
            </DialogTitle>
            <DialogDescription>
              Complete information about the lost project
            </DialogDescription>
          </DialogHeader>
          
          {selectedProject && (
            <div className="space-y-6">
              {/* Project Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Organization</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">{selectedProject.organisationName}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Sector</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <Badge variant="outline">{selectedProject.sector}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Product</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p>{selectedProject.product}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Revenue</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p className="font-mono">{formatCurrency(selectedProject.revenue)}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Expected Quarter</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p>{selectedProject.expectedQuarter}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Lost Date</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p>{formatDate(selectedProject.lostDate)}</p>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Contact Details</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-lg space-y-2">
                  {selectedProject.contactPerson && (
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span>{selectedProject.contactPerson}</span>
                    </div>
                  )}
                  {selectedProject.contactNumber && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{selectedProject.contactNumber}</span>
                    </div>
                  )}
                  {selectedProject.contactEmail && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{selectedProject.contactEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comments */}
              {selectedProject.comments && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Comments</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm">{selectedProject.comments}</p>
                  </div>
                </div>
              )}

              {/* Lost Reason */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Lost Reason</Label>
                <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-gray-700">{selectedProject.lostReason}</p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Reason Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Lost Reason</DialogTitle>
            <DialogDescription>
              Update the reason why this project was lost
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="editReason">Lost Reason</Label>
              <Textarea
                id="editReason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this project was lost..."
                className="min-h-[120px] mt-1"
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1">
                {editReason.length}/500 characters
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditReason}
              disabled={isSubmitting || !editReason.trim() || editReason.trim().length < 10}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Reason'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revive Project Modal */}
      <Dialog open={isReviveModalOpen} onOpenChange={setIsReviveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <RotateCcw className="h-5 w-5 text-green-600" />
              <span>Revive Project</span>
            </DialogTitle>
            <DialogDescription>
              Move this project back to the active pipeline
            </DialogDescription>
          </DialogHeader>
          
          {selectedProject && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Are you sure?</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      This will move "{selectedProject.organisationName}" back to prospects. 
                      The project will be available for further processing.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Target Stage</Label>
                <Select defaultValue="prospect">
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviveModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedProject && handleReviveProject(selectedProject.id)}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reviving...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Revive Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}