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
import { useToast } from "@/hooks/use-toast";

const prospectsSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required"),
  sector: z.string().min(1, "Sector is required"),
  product: z.string().min(1, "Product is required"),
  revenue: z.number().positive("Revenue must be positive"),
  expectedQuarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  comments: z.string().optional(),
});

type ProspectsFormData = z.infer<typeof prospectsSchema>;

interface MarketingProspectsFormProps {
  onSuccess: () => void;
}

export function MarketingProspectsForm({ onSuccess }: MarketingProspectsFormProps) {
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
  } = useForm<ProspectsFormData>({
    resolver: zodResolver(prospectsSchema),
  });

  const onSubmit = async (data: ProspectsFormData) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/prospects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Prospect created successfully!",
        });
        reset();
        setOpen(false);
        onSuccess();
      } else {
        const errorData = await response.json();
        console.error("Failed to create prospects:", errorData);
      }
    } catch (error) {
      console.error("Failed to create prospects:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Prospects
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Prospects</DialogTitle>
          <DialogDescription>
            Enter the details for the new prospects
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organisationName">Organisation Name</Label>
            <Input
              id="organisationName"
              {...register("organisationName")}
              className={errors.organisationName ? "border-red-500" : ""}
              placeholder="Enter organisation name"
            />
            {errors.organisationName && (
              <p className="text-sm text-red-500">{errors.organisationName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sector">Sector</Label>
              <Input
                id="sector"
                {...register("sector")}
                className={errors.sector ? "border-red-500" : ""}
                placeholder="Enter sector"
              />
              {errors.sector && (
                <p className="text-sm text-red-500">{errors.sector.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Input
                id="product"
                {...register("product")}
                className={errors.product ? "border-red-500" : ""}
                placeholder="Enter product name"
              />
              {errors.product && (
                <p className="text-sm text-red-500">{errors.product.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue (KSH)</Label>
              <Input
                id="revenue"
                type="number"
                step="0.01"
                {...register("revenue", { valueAsNumber: true })}
                className={errors.revenue ? "border-red-500" : ""}
                placeholder="0.00"
              />
              {errors.revenue && (
                <p className="text-sm text-red-500">{errors.revenue.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedQuarter">Expected Quarter</Label>
              <Select
                value={watch("expectedQuarter")}
                onValueChange={(value) => setValue("expectedQuarter", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1">Q1</SelectItem>
                  <SelectItem value="Q2">Q2</SelectItem>
                  <SelectItem value="Q3">Q3</SelectItem>
                  <SelectItem value="Q4">Q4</SelectItem>
                </SelectContent>
              </Select>
              {errors.expectedQuarter && (
                <p className="text-sm text-red-500">{errors.expectedQuarter.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              {...register("comments")}
              placeholder="Enter any comments"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Prospects
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
