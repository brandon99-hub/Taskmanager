import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Search, Building2, ArrowLeft, FolderOpen, User, Phone, Mail, Settings, FileText, Grid3X3, List, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Sector {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  institution: string;
  leadMarketer: string;
  contactPerson: string;
  contactNumber: string;
  systemInPlace: string;
  needAvailability: string;
  currentVendor?: string;
  remarks?: string;
  sectorId: string;
  createdAt: string;
  updatedAt: string;
}

interface BDUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const projectSchema = z.object({
  institution: z.string().min(1, "Institution name is required"),
  leadMarketer: z.string().optional(),
  contactPerson: z.string().optional(),
  contactNumber: z.string().optional(),
  systemInPlace: z.enum(['navision', '365_bc', 'none', 'open_source', 'oracle', 'sap']).optional(),
  needAvailability: z.enum(['upgrade', 'under_implementation', 'none']).optional(),
  currentVendor: z.string().optional(),
  remarks: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface SectorsManagementProps {
  onSuccess?: () => void;
}

export function SectorsManagement({ onSuccess }: SectorsManagementProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [bdUsers, setBdUsers] = useState<BDUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [isProjectCreateOpen, setIsProjectCreateOpen] = useState(false);
  const [isProjectEditOpen, setIsProjectEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assigningProject, setAssigningProject] = useState<Project | null>(null);
  const [selectedMarketer, setSelectedMarketer] = useState<string>("");
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const {
    register: registerProject,
    handleSubmit: handleProjectSubmit,
    formState: { errors: projectErrors },
    reset: resetProject,
    setValue: setProjectValue,
    watch: watchProject,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      institution: "",
      leadMarketer: "unassigned",
      contactPerson: "",
      contactNumber: "",
      systemInPlace: "none",
      needAvailability: "none",
      currentVendor: "",
      remarks: "",
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadSectors(), loadBdUsers()]);
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
      } else {
        toast({
          title: "Error",
          description: "Failed to load sectors",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to load sectors:", error);
      toast({
        title: "Error",
        description: "Failed to load sectors",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBdUsers = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setBdUsers(data.users?.filter((user: BDUser) => 
          user.role === 'business_development' || user.role === 'marketer'
        ) || []);
      }
    } catch (error) {
      console.error("Failed to load BD users:", error);
    }
  };

  const loadProjects = async (sectorId: string) => {
    try {
      setIsLoadingProjects(true);
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/projects?sectorId=${sectorId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load projects",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/sectors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Sector created successfully",
        });
        setIsCreateOpen(false);
        setFormData({ name: "", description: "" });
        loadSectors();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create sector",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create sector:", error);
      toast({
        title: "Error",
        description: "Failed to create sector",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async () => {
    if (!editingSector) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/sectors/${editingSector.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Sector updated successfully",
        });
        setIsEditOpen(false);
        setEditingSector(null);
        setFormData({ name: "", description: "" });
        loadSectors();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update sector",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update sector:", error);
      toast({
        title: "Error",
        description: "Failed to update sector",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (sectorId: string) => {
    if (!confirm("Are you sure you want to deactivate this sector?")) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/sectors/${sectorId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Sector deactivated successfully",
        });
        loadSectors();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to deactivate sector",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to deactivate sector:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate sector",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (sector: Sector) => {
    setEditingSector(sector);
    setFormData({
      name: sector.name,
      description: sector.description || "",
    });
    setIsEditOpen(true);
  };

  const handleSectorClick = (sector: Sector) => {
    setSelectedSector(sector);
    loadProjects(sector.id);
  };

  const handleBackToSectors = () => {
    setSelectedSector(null);
    setProjects([]);
  };

  const handleProjectCreate = async (data: ProjectFormData) => {
    if (!selectedSector) return;

    setIsSubmittingProject(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const requestData = {
        ...data,
        leadMarketer: data.leadMarketer === "unassigned" ? undefined : data.leadMarketer,
        sectorId: selectedSector.id,
      };
      
      console.log("Sending project data:", requestData);
      
      const response = await fetch("/api/marketing/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Project created successfully",
        });
        setIsProjectCreateOpen(false);
        loadProjects(selectedSector.id);
        resetProject();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create project",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create project:", error);
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleProjectEdit = async (data: ProjectFormData) => {
    if (!editingProject) return;

    setIsEditingProject(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const requestData = {
        ...data,
        leadMarketer: data.leadMarketer === "unassigned" ? undefined : data.leadMarketer,
      };
      
      console.log("Sending project edit data:", requestData);
      
      const response = await fetch(`/api/marketing/projects/${editingProject.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Project updated successfully",
        });
        setIsProjectEditOpen(false);
        if (selectedSector) {
          loadProjects(selectedSector.id);
        }
        setEditingProject(null);
        resetProject();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update project",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update project:", error);
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
    } finally {
      setIsEditingProject(false);
    }
  };

  const handleProjectDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Project deleted successfully",
        });
        if (selectedSector) {
          loadProjects(selectedSector.id);
        }
        onSuccess?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete project",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const openProjectEditDialog = (project: Project) => {
    setEditingProject(project);
    setProjectValue("institution", project.institution);
    setProjectValue("leadMarketer", project.leadMarketer || "unassigned");
    setProjectValue("contactPerson", project.contactPerson || "");
    setProjectValue("contactNumber", project.contactNumber || "");
    setProjectValue("systemInPlace", project.systemInPlace as any);
    setProjectValue("needAvailability", project.needAvailability as any);
    setProjectValue("currentVendor", project.currentVendor || "");
    setProjectValue("remarks", project.remarks || "");
    setIsProjectEditOpen(true);
  };

  const handleAssignProject = (project: Project) => {
    setAssigningProject(project);
    setSelectedMarketer("");
    setIsAssignOpen(true);
  };

  const handleConfirmAssignment = async () => {
    if (!assigningProject || !selectedMarketer) return;

    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/projects/${assigningProject.id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leadMarketer: selectedMarketer,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Project assigned successfully",
        });
        setIsAssignOpen(false);
        setAssigningProject(null);
        setSelectedMarketer("");
        if (selectedSector) {
          loadProjects(selectedSector.id);
        }
        onSuccess?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to assign project",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to assign project:", error);
      toast({
        title: "Error",
        description: "Failed to assign project",
        variant: "destructive",
      });
    }
  };

  const filteredSectors = sectors.filter(sector =>
    sector.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sector.description && sector.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sectors Management</h2>
            <p className="text-gray-600 mt-1">Manage business sectors and categories</p>
          </div>
        </div>
        <div className="text-center py-12">
          <div className="text-gray-500">Loading sectors...</div>
        </div>
      </div>
    );
  }

  // Show projects view if a sector is selected
  if (selectedSector) {
    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToSectors}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sectors
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{selectedSector.name} Projects</h2>
            <p className="text-gray-600 mt-1">Manage projects within this sector</p>
          </div>
        </div>

        {/* Add Project Button */}
        <div className="flex justify-end">
          <Dialog open={isProjectCreateOpen} onOpenChange={setIsProjectCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-semibold">Add New Project</DialogTitle>
                    <DialogDescription className="text-gray-600">
                      Add a new project to the <span className="font-medium text-blue-600">{selectedSector.name}</span> sector.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <form onSubmit={handleProjectSubmit(handleProjectCreate)} className="space-y-6" noValidate>
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="institution" className="text-sm font-medium text-gray-700">
                        Institution Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="institution"
                        {...registerProject("institution")}
                        className={`h-11 ${projectErrors.institution ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                        placeholder="Enter institution name"
                      />
                      {projectErrors.institution && (
                        <p className="text-sm text-red-500 flex items-center">
                          <span className="mr-1">⚠</span>
                          {projectErrors.institution.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="leadMarketer" className="text-sm font-medium text-gray-700">
                        Lead Marketer <span className="text-gray-400">(Optional)</span>
                      </Label>
                      <Select
                        value={watchProject("leadMarketer") || "unassigned"}
                        onValueChange={(value) => setProjectValue("leadMarketer", value)}
                      >
                        <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="Select lead marketer (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">No assignment</SelectItem>
                          {bdUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Contact Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-green-600 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                    <span className="text-sm text-gray-500">(Optional)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="contactPerson" className="text-sm font-medium text-gray-700">
                        Contact Person
                      </Label>
                      <Input
                        id="contactPerson"
                        {...registerProject("contactPerson")}
                        className="h-11 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Enter contact person name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="contactNumber" className="text-sm font-medium text-gray-700">
                        Contact Number
                      </Label>
                      <Input
                        id="contactNumber"
                        {...registerProject("contactNumber")}
                        className="h-11 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Enter contact number"
                      />
                    </div>
                  </div>
                </div>

                {/* System Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">System Information</h3>
                    <span className="text-sm text-gray-500">(Optional)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="systemInPlace" className="text-sm font-medium text-gray-700">
                        System in Place
                      </Label>
                      <Select
                        value={watchProject("systemInPlace") || ""}
                        onValueChange={(value) => setProjectValue("systemInPlace", value as any)}
                      >
                        <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="Select current system" />
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
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="needAvailability" className="text-sm font-medium text-gray-700">
                        Need Availability
                      </Label>
                      <Select
                        value={watchProject("needAvailability") || ""}
                        onValueChange={(value) => setProjectValue("needAvailability", value as any)}
                      >
                        <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="Select need availability" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upgrade">Upgrade</SelectItem>
                          <SelectItem value="under_implementation">Under Implementation</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Additional Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-orange-600 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                    <span className="text-sm text-gray-500">(Optional)</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentVendor" className="text-sm font-medium text-gray-700">
                        Current Vendor
                      </Label>
                      <Input
                        id="currentVendor"
                        {...registerProject("currentVendor")}
                        className="h-11 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Enter current vendor name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">
                        Remarks & Notes
                      </Label>
                      <Textarea
                        id="remarks"
                        {...registerProject("remarks")}
                        className="focus:border-blue-500 focus:ring-blue-500 resize-none"
                        placeholder="Enter any additional remarks or notes about this project..."
                        rows={4}
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    <span className="text-red-500">*</span> Required fields
                  </div>
                  <div className="flex items-center space-x-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsProjectCreateOpen(false)}
                      className="h-11 px-6"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="h-11 px-8 bg-blue-600 hover:bg-blue-700"
                      disabled={isSubmittingProject}
                    >
                      {isSubmittingProject ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Project"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FolderOpen className="h-5 w-5 mr-2" />
              Projects {isLoadingProjects ? '(Loading...)' : `(${projects.length})`}
            </CardTitle>
            <CardDescription>
              Manage projects within the {selectedSector.name} sector
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-gray-600">Loading projects...</p>
                </div>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
                <p className="text-gray-500 mb-4">
                  Get started by adding your first project to this sector.
                </p>
                <Button onClick={() => setIsProjectCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Project
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institution</TableHead>
                    <TableHead>Lead Marketer</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Contact Number</TableHead>
                    <TableHead>System in Place</TableHead>
                    <TableHead>Need Availability</TableHead>
                    <TableHead>Current Vendor</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.institution}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          {project.leadMarketer ? (
                            <span className="text-sm">
                              {bdUsers.find(u => u.id === project.leadMarketer)?.firstName} {bdUsers.find(u => u.id === project.leadMarketer)?.lastName}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Unassigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          {project.contactPerson || (
                            <span className="text-sm text-gray-400 italic">Not provided</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          {project.contactNumber || (
                            <span className="text-sm text-gray-400 italic">Not provided</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {project.systemInPlace ? (
                          <Badge variant="outline">
                            {project.systemInPlace.replace('_', ' ').toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Not specified</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.needAvailability ? (
                          <Badge variant="secondary">
                            {project.needAvailability.replace('_', ' ').toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Not specified</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {project.currentVendor || (
                          <span className="text-sm text-gray-400 italic">Not specified</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 max-w-xs truncate">
                        {project.remarks || (
                          <span className="text-sm text-gray-400 italic">No remarks</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          {!project.leadMarketer && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAssignProject(project)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <User className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openProjectEditDialog(project)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleProjectDelete(project.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Project Dialog */}
        <Dialog open={isProjectEditOpen} onOpenChange={setIsProjectEditOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Edit className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">Edit Project</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Update the project information and details.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <form onSubmit={handleProjectSubmit(handleProjectEdit)} className="space-y-6" noValidate>
              {/* Basic Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-institution" className="text-sm font-medium text-gray-700">
                      Institution Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="edit-institution"
                      {...registerProject("institution")}
                      className={`h-11 ${projectErrors.institution ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-blue-500 focus:ring-blue-500"}`}
                      placeholder="Enter institution name"
                    />
                    {projectErrors.institution && (
                      <p className="text-sm text-red-500 flex items-center">
                        <span className="mr-1">⚠</span>
                        {projectErrors.institution.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-leadMarketer" className="text-sm font-medium text-gray-700">
                      Lead Marketer <span className="text-gray-400">(Optional)</span>
                    </Label>
                    <Select
                      value={watchProject("leadMarketer") || "unassigned"}
                      onValueChange={(value) => setProjectValue("leadMarketer", value)}
                    >
                      <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select lead marketer (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">No assignment</SelectItem>
                        {bdUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-1 h-6 bg-green-600 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                  <span className="text-sm text-gray-500">(Optional)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-contactPerson" className="text-sm font-medium text-gray-700">
                      Contact Person
                    </Label>
                    <Input
                      id="edit-contactPerson"
                      {...registerProject("contactPerson")}
                      className="h-11 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter contact person name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-contactNumber" className="text-sm font-medium text-gray-700">
                      Contact Number
                    </Label>
                    <Input
                      id="edit-contactNumber"
                      {...registerProject("contactNumber")}
                      className="h-11 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter contact number"
                    />
                  </div>
                </div>
              </div>

              {/* System Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900">System Information</h3>
                  <span className="text-sm text-gray-500">(Optional)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-systemInPlace" className="text-sm font-medium text-gray-700">
                      System in Place
                    </Label>
                    <Select
                      value={watchProject("systemInPlace") || ""}
                      onValueChange={(value) => setProjectValue("systemInPlace", value as any)}
                    >
                      <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select current system" />
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
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-needAvailability" className="text-sm font-medium text-gray-700">
                      Need Availability
                    </Label>
                    <Select
                      value={watchProject("needAvailability") || ""}
                      onValueChange={(value) => setProjectValue("needAvailability", value as any)}
                    >
                      <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select need availability" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upgrade">Upgrade</SelectItem>
                        <SelectItem value="under_implementation">Under Implementation</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Additional Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-1 h-6 bg-orange-600 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                  <span className="text-sm text-gray-500">(Optional)</span>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-currentVendor" className="text-sm font-medium text-gray-700">
                      Current Vendor
                    </Label>
                    <Input
                      id="edit-currentVendor"
                      {...registerProject("currentVendor")}
                      className="h-11 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Enter current vendor name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-remarks" className="text-sm font-medium text-gray-700">
                      Remarks & Notes
                    </Label>
                    <Textarea
                      id="edit-remarks"
                      {...registerProject("remarks")}
                      className="focus:border-blue-500 focus:ring-blue-500 resize-none"
                      placeholder="Enter any additional remarks or notes about this project..."
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  <span className="text-red-500">*</span> Required fields
                </div>
                <div className="flex items-center space-x-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsProjectEditOpen(false)}
                    className="h-11 px-6"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="h-11 px-8 bg-green-600 hover:bg-green-700"
                    disabled={isEditingProject}
                  >
                    {isEditingProject ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Project"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Assignment Dialog */}
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">Assign Project</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Assign this project to a marketer or business development team member.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Project Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Project Details</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Institution:</span> {assigningProject?.institution}</p>
                  <p><span className="font-medium">Sector:</span> {selectedSector?.name}</p>
                </div>
              </div>

              {/* Assignment Selection */}
              <div className="space-y-3">
                <Label htmlFor="marketer-select" className="text-sm font-medium text-gray-700">
                  Select Marketer/BD Member <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedMarketer} onValueChange={setSelectedMarketer}>
                  <SelectTrigger className="h-11 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Choose a team member to assign this project" />
                  </SelectTrigger>
                  <SelectContent>
                    {bdUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center space-x-2">
                          <span>{user.firstName} {user.lastName}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.role.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignment Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-blue-600">ℹ</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">What happens when you assign?</p>
                    <p>This project will be moved to the assigned marketer's prospects list and they will be responsible for following up with the client.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAssignOpen(false)}
                className="h-11 px-6"
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleConfirmAssignment}
                disabled={!selectedMarketer}
                className="h-11 px-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
              >
                Assign Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show sectors view (default)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sectors Management</h2>
          <p className="text-gray-600 mt-1">Manage business sectors and their projects</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Sector
            </Button>
          </DialogTrigger>
                <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Sector</DialogTitle>
              <DialogDescription>
                Add a new business sector to organize projects and prospects.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Sector Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Healthcare, Finance, Education"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description of the sector"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Sector</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search sectors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Grid
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sectors Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
            <Building2 className="h-5 w-5 text-blue-600 mr-2" />
            Business Sectors
          </CardTitle>
          <CardDescription>
            {filteredSectors.length} sector{filteredSectors.length !== 1 ? 's' : ''} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSectors.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? "No sectors found" : "No sectors yet"}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm 
                  ? "Try adjusting your search terms."
                  : "Create your first business sector to organize projects."
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Sector
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            // Grid View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSectors.map((sector) => (
                <Card 
                  key={sector.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleSectorClick(sector)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <Badge 
                        variant={sector.isActive ? "default" : "secondary"}
                      >
                        {sector.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {sector.name}
                    </h3>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {sector.description || "No description provided."}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {new Date(sector.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(sector);
                          }}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(sector.id);
                          }}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            ) : (
            // Table View
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sector</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSectors.map((sector) => (
                    <TableRow 
                      key={sector.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSectorClick(sector)}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{sector.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {sector.description || "No description"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={sector.isActive ? "default" : "secondary"}
                        >
                          {sector.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {new Date(sector.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(sector);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(sector.id);
                            }}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sector</DialogTitle>
            <DialogDescription>
              Update the sector information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Sector Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Healthcare, Finance, Education"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of the sector"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Update Sector</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
