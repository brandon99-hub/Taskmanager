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
        leadMarketer: data.leadMarketer === "unassigned" ? null : data.leadMarketer,
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
        leadMarketer: data.leadMarketer === "unassigned" ? null : data.leadMarketer,
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
      const response = await fetch(`/api/marketing/projects/${assigningProject.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...assigningProject,
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
              <Button>
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
              Projects ({projects.length})
            </CardTitle>
            <CardDescription>
              Manage projects within the {selectedSector.name} sector
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Enhanced Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl"></div>
          <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <Building2 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-white">
                      Sectors Management
                    </h1>
                    <p className="text-blue-100 text-lg mt-2">
                      Organize and manage business sectors for project assignments
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-white/90">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm font-medium">
                      {sectors.filter(s => s.isActive).length} Active Sectors
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span className="text-sm font-medium">
                      {projects.length} Total Projects
                    </span>
                  </div>
                </div>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm shadow-lg">
                    <Plus className="h-5 w-5 mr-2" />
                    Add New Sector
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
          </div>
        </div>

        {/* Enhanced Search and Controls */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="relative flex-1 max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                placeholder="Search sectors by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 text-lg border-2 border-gray-200 focus:border-blue-500 rounded-xl"
              />
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">View Mode:</span>
              <div className="flex bg-gray-100 rounded-xl p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-lg ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                >
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className={`rounded-lg ${viewMode === 'table' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                >
                  <List className="h-4 w-4 mr-2" />
                  List
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Sectors Display */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-8 py-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Business Sectors
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {filteredSectors.length} sector{filteredSectors.length !== 1 ? 's' : ''} available for project organization
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-6 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {sectors.filter(s => s.isActive).length}
                  </div>
                  <div className="text-gray-500">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {projects.length}
                  </div>
                  <div className="text-gray-500">Projects</div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-8">
            {filteredSectors.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Building2 className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  {searchTerm ? "No sectors found" : "No sectors yet"}
                </h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  {searchTerm 
                    ? "No sectors match your search criteria. Try adjusting your search terms."
                    : "Get started by creating your first business sector to organize projects and prospects."
                  }
                </p>
                {!searchTerm && (
                  <Button 
                    size="lg" 
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl shadow-lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Sector
                  </Button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              // Enhanced Grid View
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredSectors.map((sector) => (
                  <div 
                    key={sector.id} 
                    className="group bg-white border-2 border-gray-200 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-xl transition-all duration-300 cursor-pointer"
                    onClick={() => handleSectorClick(sector)}
                  >
                    {/* Card Header with Gradient */}
                    <div className={`h-2 ${sector.isActive ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-gray-300 to-gray-400'}`}></div>
                    
                    <div className="p-6">
                      {/* Sector Icon and Status */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                          <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <Badge 
                          variant={sector.isActive ? "default" : "secondary"}
                          className={`${sector.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                        >
                          {sector.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      {/* Sector Name */}
                      <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                        {sector.name}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-gray-600 text-sm mb-6 line-clamp-3">
                        {sector.description || "No description provided for this sector."}
                      </p>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Created {new Date(sector.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(sector);
                            }}
                            className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50 hover:border-blue-300"
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
                            className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:border-red-300"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Enhanced Table View
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="font-semibold text-gray-900">Sector Name</TableHead>
                      <TableHead className="font-semibold text-gray-900">Description</TableHead>
                      <TableHead className="font-semibold text-gray-900">Status</TableHead>
                      <TableHead className="font-semibold text-gray-900">Created</TableHead>
                      <TableHead className="text-right font-semibold text-gray-900">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSectors.map((sector) => (
                      <TableRow key={sector.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="font-semibold text-gray-900">{sector.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {sector.description || "No description provided"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={sector.isActive ? "default" : "secondary"}
                            className={`${sector.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                          >
                            {sector.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {new Date(sector.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSectorClick(sector)}
                              className="hover:bg-blue-50 hover:border-blue-300"
                            >
                              View Projects
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(sector)}
                              className="hover:bg-blue-50 hover:border-blue-300"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(sector.id)}
                              className="hover:bg-red-50 hover:border-red-300"
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
          </div>
        </div>

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
    </div>
  );
}
