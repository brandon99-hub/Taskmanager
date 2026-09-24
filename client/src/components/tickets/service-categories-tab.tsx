import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tags, Pencil, Trash2 } from "lucide-react";

interface ServiceCategory {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  type: "complaint" | "enquiry";
}

const CATEGORY_TYPES = [
  { value: "complaint", label: "Complaint" },
  { value: "enquiry", label: "Enquiry" },
] as const;

interface ServiceCategoriesTabProps {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  search?: string;
}

export default function ServiceCategoriesTab({ createOpen, onCreateOpenChange, search = "" }: ServiceCategoriesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth() as any;
  const canManage = auth.hasPermission?.('service_categories.manage') || auth.isAdminRole?.();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"complaint" | "enquiry">("complaint");

  const { data: categories = [], isLoading } = useQuery<ServiceCategory[]>({
    queryKey: ['/api/service-categories'],
    queryFn: async () => {
      const res = await fetch('/api/service-categories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    staleTime: 20 * 60 * 1000,
  });

  const filteredCategories = categories.filter((cat) =>
    !search.trim() || cat.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setType("complaint");
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (createOpen) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen]);

  const openEdit = (cat: ServiceCategory) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description || "");
    setType(cat.type || "complaint");
    setIsFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await apiRequest('PUT', `/api/service-categories/${editing.id}`, { name, description, type });
      } else {
        await apiRequest('POST', '/api/service-categories', { name, description, type });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-categories'] });
      toast({ title: editing ? "Category updated" : "Category created" });
      setIsFormOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to save category", variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (cat: ServiceCategory) => {
      await apiRequest('PUT', `/api/service-categories/${cat.id}`, { isActive: !cat.isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/service-categories'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/service-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-categories'] });
      toast({ title: "Category deleted" });
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to delete category", variant: "destructive" }),
  });

  return (
    <div>
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) onCreateOpenChange(false);
        }}
      >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle>
              <DialogDescription>Categories group tickets so they can be reported on and routed consistently.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Application Error" data-testid="input-category-name" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Type *</label>
                <Select value={type} onValueChange={(v) => setType(v as "complaint" | "enquiry")}>
                  <SelectTrigger data-testid="select-category-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button
                disabled={!name.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                data-testid="button-save-category"
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filteredCategories.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Tags className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {search ? "No categories found" : "No categories yet"}
            </h3>
            <p className="text-gray-600">
              {search ? `No matches for "${search}".` : "Create the first service category to start classifying tickets."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filteredCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{cat.name}</p>
                    <Badge variant="secondary" className="text-xs capitalize">{cat.type}</Badge>
                    {!cat.isActive && <Badge variant="outline" className="text-xs text-gray-500">Inactive</Badge>}
                  </div>
                  {cat.description && <p className="text-sm text-gray-500">{cat.description}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => toggleActiveMutation.mutate(cat)}>
                      {cat.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(cat)} data-testid={`button-edit-category-${cat.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => deleteMutation.mutate(cat.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-category-${cat.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
