import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Loader2, 
  User, 
  Calendar, 
  DollarSign, 
  FileText, 
  Phone, 
  Target,
  Building2,
  MessageSquare
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const leadSchema = z.object({
  date: z.string().min(1, "Date is required"),
  client: z.string().min(1, "Client name is required"),
  contactDetails: z.string().min(1, "Contact details are required"),
  remarks: z.string().optional(),
  budget: z.number().positive("Budget must be positive").optional(),
  salesStage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).default('lead'),
  facilitationCost: z.number().positive("Facilitation cost must be positive").optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface MarketingLeadFormProps {
  onSuccess: () => void;
  isOpen?: boolean; // controlled open (for external triggers)
  onClose?: () => void; // called when dialog requests close (controlled)
  hideTrigger?: boolean; // when true, do not render the built-in trigger button
}

export function MarketingLeadForm({ onSuccess, isOpen, onClose, hideTrigger = false }: MarketingLeadFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      salesStage: 'lead',
    },
  });

  const onSubmit = async (data: LeadFormData) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("marketingToken");
      
      // Convert date to datetime format for backend
      const formattedData = {
        ...data,
        date: new Date(data.date).toISOString()
      };
      
      const response = await fetch("/api/marketing/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formattedData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Lead created successfully!",
        });
        reset();
        setOpen(false);
        onSuccess();
      } else {
        const errorData = await response.json();
        console.error("Failed to create lead:", errorData);
        
        // Show user-friendly error message
        if (errorData.details && Array.isArray(errorData.details)) {
          const firstError = errorData.details[0];
          alert(`Validation Error: ${firstError.message || 'Please check your input'}`);
        } else {
          alert(`Error: ${errorData.error || 'Failed to create lead'}`);
        }
      }
    } catch (error) {
      console.error("Failed to create lead:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage: string) => {
    const colors = {
      lead: "bg-blue-100 text-blue-800",
      qualified: "bg-yellow-100 text-yellow-800", 
      proposal: "bg-purple-100 text-purple-800",
      negotiation: "bg-orange-100 text-orange-800",
      closed_won: "bg-green-100 text-green-800",
      closed_lost: "bg-red-100 text-red-800"
    };
    return colors[stage as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog 
      open={isOpen !== undefined ? isOpen : open}
      onOpenChange={(value) => {
        if (isOpen !== undefined) {
          if (!value) {
            onClose?.();
          }
        } else {
          setOpen(value);
        }
      }}
    >
      {!hideTrigger && isOpen === undefined && (
        <DialogTrigger asChild>
          <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">Add New Lead</DialogTitle>
              <DialogDescription className="text-gray-600 mt-1">
                Capture a new potential client and track their journey
          </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          {/* Basic Information Card */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date
                  </Label>
              <Input
                id="date"
                type="date"
                {...register("date")}
                    className={`h-11 ${errors.date ? "border-red-500 focus:border-red-500" : "focus:border-blue-500"}`}
              />
              {errors.date && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-red-500">•</span>
                      {errors.date.message}
                    </p>
              )}
            </div>
            <div className="space-y-2">
                  <Label htmlFor="salesStage" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Sales Stage
                  </Label>
              <Select
                value={watch("salesStage")}
                onValueChange={(value) => setValue("salesStage", value as any)}
              >
                    <SelectTrigger className="h-11 focus:border-blue-500">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                      <SelectItem value="lead">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("lead")} text-xs`}>Lead</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="qualified">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("qualified")} text-xs`}>Qualified</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="proposal">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("proposal")} text-xs`}>Proposal</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="negotiation">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("negotiation")} text-xs`}>Negotiation</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="closed_won">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("closed_won")} text-xs`}>Closed Won</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="closed_lost">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("closed_lost")} text-xs`}>Closed Lost</Badge>
                        </div>
                      </SelectItem>
                </SelectContent>
              </Select>
              {errors.salesStage && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-red-500">•</span>
                      {errors.salesStage.message}
                    </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
                <Label htmlFor="client" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Client Name
                </Label>
            <Input
              id="client"
              {...register("client")}
                  className={`h-11 ${errors.client ? "border-red-500 focus:border-red-500" : "focus:border-blue-500"}`}
                  placeholder="Enter client or company name"
            />
            {errors.client && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="text-red-500">•</span>
                    {errors.client.message}
                  </p>
            )}
          </div>
            </CardContent>
          </Card>

          {/* Contact Information Card */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-emerald-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Phone className="h-5 w-5 text-green-600" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
          <div className="space-y-2">
                <Label htmlFor="contactDetails" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Contact Details
                </Label>
            <Textarea
              id="contactDetails"
              {...register("contactDetails")}
                  className={`min-h-[100px] resize-none ${errors.contactDetails ? "border-red-500 focus:border-red-500" : "focus:border-green-500"}`}
                  placeholder="Enter phone numbers, email addresses, and other contact information"
            />
            {errors.contactDetails && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="text-red-500">•</span>
                    {errors.contactDetails.message}
                  </p>
            )}
          </div>
            </CardContent>
          </Card>

          {/* Financial Information Card */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-yellow-50 to-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-600" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
                  <Label htmlFor="budget" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Budget (KSH)
                  </Label>
                  <div className="relative">
              <Input
                id="budget"
                type="number"
                step="0.01"
                {...register("budget", { valueAsNumber: true })}
                      className={`h-11 ${errors.budget ? "border-red-500 focus:border-red-500" : "focus:border-yellow-500"}`}
                placeholder="0.00"
              />
                  </div>
              {errors.budget && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-red-500">•</span>
                      {errors.budget.message}
                    </p>
              )}
            </div>
            <div className="space-y-2">
                  <Label htmlFor="facilitationCost" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Facilitation Cost (KSH)
                  </Label>
                  <div className="relative">
              <Input
                id="facilitationCost"
                type="number"
                step="0.01"
                {...register("facilitationCost", { valueAsNumber: true })}
                      className={`h-11 ${errors.facilitationCost ? "border-red-500 focus:border-red-500" : "focus:border-yellow-500"}`}
                placeholder="0.00"
              />
                  </div>
              {errors.facilitationCost && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-red-500">•</span>
                      {errors.facilitationCost.message}
                    </p>
              )}
            </div>
          </div>
            </CardContent>
          </Card>

          {/* Additional Notes Card */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-purple-50 to-pink-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Additional Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="remarks" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Remarks
                </Label>
                <Textarea
                  id="remarks"
                  {...register("remarks")}
                  placeholder="Enter any additional notes, requirements, or special considerations"
                  className="min-h-[80px] resize-none focus:border-purple-500"
                />
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="gap-3 pt-6 border-t bg-gray-50 -mx-6 px-6 py-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)} 
              className="h-11 px-6 font-medium"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="h-11 px-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Lead...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
              Add Lead
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
