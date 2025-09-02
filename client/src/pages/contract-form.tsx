import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  FileSignature, 
  ArrowLeft, 
  Save, 
  Plus,
  X,
  Calendar,
  DollarSign,
  Building,
  User,
  FileText
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

interface Project {
  id: string;
  name: string;
  status: string;
}

interface ContractFormData {
  contractNumber?: string;
  projectId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  contractType: 'fixed_price' | 'time_materials' | 'milestone_based';
  totalValue: number;
  currency: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'completed' | 'terminated';
  projectScope: string;
  deliverables: string[];
  paymentTerms: string;
  specialClauses: string[];
  responsibilities: {
    client: string[];
    contractor: string[];
  };
  timeline: {
    phase: string;
    duration: string;
    deliverables: string[];
  }[];
}

export default function ContractForm() {
  const auth = useAuth() as any;
  const { isAuthenticated, isLoading, user, isAdminRole } = auth;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  // Form state
  const [formData, setFormData] = useState<ContractFormData>({
    projectId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    contractType: 'fixed_price',
    totalValue: 0,
    currency: 'KES',
    startDate: '',
    endDate: '',
    status: 'draft',
    projectScope: '',
    deliverables: [''],
    paymentTerms: '',
    specialClauses: [''],
    responsibilities: {
      client: [''],
      contractor: ['']
    },
    timeline: [{
      phase: '',
      duration: '',
      deliverables: ['']
    }]
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch projects for dropdown
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: !!isAuthenticated,
  });

  // Fetch contract data if editing
  const { data: existingContract } = useQuery<ContractFormData>({
    queryKey: ['/api/contracts', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/contracts/${id}`);
      return response.json();
    },
    enabled: !!isAuthenticated && isEditing,
  });

  // Update form data when existing contract is loaded
  useEffect(() => {
    if (existingContract) {
      setFormData(existingContract);
    }
  }, [existingContract]);

  // Create/Update contract mutation
  const contractMutation = useMutation({
    mutationFn: async (data: ContractFormData) => {
      const url = isEditing ? `/api/contracts/${id}` : '/api/contracts';
      const method = isEditing ? 'PUT' : 'POST';
      const response = await apiRequest(method, url, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      toast({
        title: "Success",
        description: `Contract ${isEditing ? 'updated' : 'created'} successfully`,
      });
      setLocation('/contracts');
    },
    onError: (error: any) => {
      console.error('Contract error:', error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'create'} contract`,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayChange = (field: string, index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field as keyof ContractFormData].map((item: any, i: number) => 
        i === index ? value : item
      )
    }));
  };

  const addArrayItem = (field: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field as keyof ContractFormData], '']
    }));
  };

  const removeArrayItem = (field: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field as keyof ContractFormData].filter((_: any, i: number) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up empty strings from arrays
    const cleanedData = {
      ...formData,
      deliverables: formData.deliverables.filter(item => item.trim() !== ''),
      specialClauses: formData.specialClauses.filter(item => item.trim() !== ''),
      responsibilities: {
        client: formData.responsibilities.client.filter(item => item.trim() !== ''),
        contractor: formData.responsibilities.contractor.filter(item => item.trim() !== '')
      },
      timeline: formData.timeline.map(phase => ({
        ...phase,
        deliverables: phase.deliverables.filter(item => item.trim() !== '')
      }))
    };

    contractMutation.mutate(cleanedData);
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-page">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/contracts')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEditing ? 'Edit Contract' : 'Create New Contract'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isEditing ? 'Update contract details' : 'Fill in the contract information'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileSignature className="h-5 w-5" />
                    <span>Basic Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contractNumber">Contract Number</Label>
                      <Input
                        id="contractNumber"
                        value={formData.contractNumber || ''}
                        onChange={(e) => handleInputChange('contractNumber', e.target.value)}
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                    <div>
                      <Label htmlFor="projectId">Project *</Label>
                      <Select value={formData.projectId} onValueChange={(value) => handleInputChange('projectId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="contractType">Contract Type *</Label>
                      <Select value={formData.contractType} onValueChange={(value) => handleInputChange('contractType', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed_price">Fixed Price</SelectItem>
                          <SelectItem value="time_materials">Time & Materials</SelectItem>
                          <SelectItem value="milestone_based">Milestone Based</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="pending_approval">Pending Approval</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="terminated">Terminated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building className="h-5 w-5" />
                    <span>Client Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="clientName">Client Name *</Label>
                      <Input
                        id="clientName"
                        value={formData.clientName}
                        onChange={(e) => handleInputChange('clientName', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="clientEmail">Client Email *</Label>
                      <Input
                        id="clientEmail"
                        type="email"
                        value={formData.clientEmail}
                        onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="clientPhone">Client Phone</Label>
                      <Input
                        id="clientPhone"
                        value={formData.clientPhone || ''}
                        onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="clientAddress">Client Address</Label>
                      <Textarea
                        id="clientAddress"
                        value={formData.clientAddress || ''}
                        onChange={(e) => handleInputChange('clientAddress', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5" />
                    <span>Financial Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="totalValue">Total Value *</Label>
                      <Input
                        id="totalValue"
                        type="number"
                        value={formData.totalValue}
                        onChange={(e) => handleInputChange('totalValue', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={formData.currency} onValueChange={(value) => handleInputChange('currency', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KES">KES</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Start Date *</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date *</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Project Scope */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Project Scope</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.projectScope}
                    onChange={(e) => handleInputChange('projectScope', e.target.value)}
                    placeholder="Describe the project scope and objectives..."
                    rows={6}
                  />
                </CardContent>
              </Card>

              {/* Deliverables */}
              <Card>
                <CardHeader>
                  <CardTitle>Deliverables</CardTitle>
                  <CardDescription>List all project deliverables</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {formData.deliverables.map((deliverable, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={deliverable}
                        onChange={(e) => handleArrayChange('deliverables', index, e.target.value)}
                        placeholder="Enter deliverable"
                      />
                      {formData.deliverables.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeArrayItem('deliverables', index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addArrayItem('deliverables')}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Deliverable
                  </Button>
                </CardContent>
              </Card>

              {/* Payment Terms */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Terms</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.paymentTerms}
                    onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                    placeholder="Describe payment terms and schedule..."
                    rows={4}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={contractMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {contractMutation.isPending ? 'Saving...' : (isEditing ? 'Update Contract' : 'Create Contract')}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setLocation('/contracts')}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
