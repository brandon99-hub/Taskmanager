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
import { 
  Plus, 
  Loader2, 
  Building2, 
  DollarSign, 
  Calendar, 
  FileText, 
  Target,
  TrendingUp
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const salesWonSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required"),
  sector: z.string().min(1, "Sector is required"),
  product: z.string().min(1, "Product is required"),
  contractAmount: z.number().positive("Contract amount must be positive"),
  expectedQuarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  comments: z.string().optional(),
});

type SalesWonFormData = z.infer<typeof salesWonSchema>;

interface MarketingSalesWonFormProps {
  onSuccess: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  hideTrigger?: boolean;
}

export function MarketingSalesWonForm({ onSuccess, isOpen, onClose, hideTrigger = false }: MarketingSalesWonFormProps) {
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
  } = useForm<SalesWonFormData>({
    resolver: zodResolver(salesWonSchema),
  });

  const onSubmit = async (data: SalesWonFormData) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/sales-won", {
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
          description: "Sales won record created successfully!",
        });
        reset();
        setOpen(false);
        onSuccess();
      } else {
        const errorData = await response.json();
        console.error("Failed to create sales won:", errorData);
      }
    } catch (error) {
      console.error("Failed to create sales won:", error);
    } finally {
      setLoading(false);
    }
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
          <Button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Sales Won
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">Add Sales Won</DialogTitle>
              <DialogDescription className="text-gray-600 mt-1">
                Record a successful sale and track revenue
              </DialogDescription>
            </div>
          </div>
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
              <Label htmlFor="contractAmount">Contract Amount (KSH)</Label>
              <Input
                id="contractAmount"
                type="number"
                step="0.01"
                {...register("contractAmount", { valueAsNumber: true })}
                className={errors.contractAmount ? "border-red-500" : ""}
                placeholder="0.00"
              />
              {errors.contractAmount && (
                <p className="text-sm text-red-500">{errors.contractAmount.message}</p>
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
              Add Sales Won
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
