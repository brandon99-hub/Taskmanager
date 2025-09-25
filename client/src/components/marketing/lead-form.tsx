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
import { Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
}

export function MarketingLeadForm({ onSuccess }: MarketingLeadFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
      const response = await fetch("/api/marketing/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        reset();
        setOpen(false);
        onSuccess();
      } else {
        const errorData = await response.json();
        console.error("Failed to create lead:", errorData);
      }
    } catch (error) {
      console.error("Failed to create lead:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-semibold">Add New Lead</DialogTitle>
          <DialogDescription className="text-gray-600">
            Enter the details for the new lead
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium text-gray-700">Date</Label>
              <Input
                id="date"
                type="date"
                {...register("date")}
                className={`h-10 ${errors.date ? "border-red-500" : ""}`}
              />
              {errors.date && (
                <p className="text-sm text-red-500">{errors.date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="salesStage" className="text-sm font-medium text-gray-700">Sales Stage</Label>
              <Select
                value={watch("salesStage")}
                onValueChange={(value) => setValue("salesStage", value as any)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="closed_won">Closed Won</SelectItem>
                  <SelectItem value="closed_lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
              {errors.salesStage && (
                <p className="text-sm text-red-500">{errors.salesStage.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client" className="text-sm font-medium text-gray-700">Client Name</Label>
            <Input
              id="client"
              {...register("client")}
              className={`h-10 ${errors.client ? "border-red-500" : ""}`}
              placeholder="Enter client name"
            />
            {errors.client && (
              <p className="text-sm text-red-500">{errors.client.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactDetails" className="text-sm font-medium text-gray-700">Contact Details</Label>
            <Textarea
              id="contactDetails"
              {...register("contactDetails")}
              className={`min-h-[80px] ${errors.contactDetails ? "border-red-500" : ""}`}
              placeholder="Enter contact details"
            />
            {errors.contactDetails && (
              <p className="text-sm text-red-500">{errors.contactDetails.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">Remarks</Label>
            <Textarea
              id="remarks"
              {...register("remarks")}
              placeholder="Enter any remarks"
              className="min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget" className="text-sm font-medium text-gray-700">Budget (USD)</Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                {...register("budget", { valueAsNumber: true })}
                className={`h-10 ${errors.budget ? "border-red-500" : ""}`}
                placeholder="0.00"
              />
              {errors.budget && (
                <p className="text-sm text-red-500">{errors.budget.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="facilitationCost" className="text-sm font-medium text-gray-700">Facilitation Cost (USD)</Label>
              <Input
                id="facilitationCost"
                type="number"
                step="0.01"
                {...register("facilitationCost", { valueAsNumber: true })}
                className={`h-10 ${errors.facilitationCost ? "border-red-500" : ""}`}
                placeholder="0.00"
              />
              {errors.facilitationCost && (
                <p className="text-sm text-red-500">{errors.facilitationCost.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-10">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="h-10 bg-primary hover:bg-primary/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
