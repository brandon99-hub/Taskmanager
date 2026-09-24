import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus, Pencil, Search } from "lucide-react";
import PageHeader from "@/components/layout/page-header";

interface Segment {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface SegmentLeader {
  segmentId: string;
  leaderId?: string | null;
  leaderEmail: string;
  leaderName: string;
}

interface EmployeeUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

const segmentFormSchema = z.object({
  name: z.string().min(1, "Segment name is required").max(100, "Segment name too long"),
  description: z.string().max(500, "Description too long").optional(),
  isActive: z.boolean().default(true),
  leaderId: z.string().default("none"),
});

type SegmentFormData = z.infer<typeof segmentFormSchema>;

const emptyFormValues: SegmentFormData = {
  name: "",
  description: "",
  isActive: true,
  leaderId: "none",
};

export default function Segments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth() as any;
  const canManage = auth.hasPermission?.('segments.manage') || auth.isAdminRole?.();
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);

  const form = useForm<SegmentFormData>({
    resolver: zodResolver(segmentFormSchema),
    defaultValues: emptyFormValues,
  });

  const { data: rawSegments, isLoading } = useQuery<Segment[]>({
    queryKey: ['/api/segments'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/segments', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error("Failed to load segments:", e);
        return [];
      }
    },
    staleTime: 20 * 60 * 1000,
  });

  const segments = useMemo(() => Array.isArray(rawSegments) ? rawSegments : [], [rawSegments]);

  const { data: rawEmployees = [] } = useQuery<EmployeeUser[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/users', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error("Failed to load users:", e);
        return [];
      }
    },
    enabled: isFormOpen,
    staleTime: 5 * 60 * 1000,
  });

  const employees = useMemo(() => Array.isArray(rawEmployees) ? rawEmployees : [], [rawEmployees]);

  const { data: rawLeaders = [] } = useQuery<SegmentLeader[]>({
    queryKey: ['/api/segment-leaders', segments.map((s) => s.id).join(',')],
    queryFn: async () => {
      if (!segments.length) return [];
      const results = await Promise.all(
        segments.map(async (seg) => {
          try {
            const res = await fetch(`/api/segment-leaders/${seg.id}`, { credentials: 'include' });
            if (!res.ok) return null;
            return await res.json();
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean) as SegmentLeader[];
    },
    enabled: segments.length > 0,
  });

  const leaders = useMemo(() => Array.isArray(rawLeaders) ? rawLeaders : [], [rawLeaders]);

  const filteredSegments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => (s?.name || '').toLowerCase().includes(q));
  }, [segments, query]);

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyFormValues);
    setIsFormOpen(true);
  };

  const openEdit = async (segment: Segment) => {
    setEditing(segment);
    form.reset({
      name: segment.name || "",
      description: segment.description || "",
      isActive: segment.isActive,
      leaderId: "none",
    });
    setIsFormOpen(true);

    try {
      const res = await fetch(`/api/segment-leaders/${segment.id}`, { credentials: 'include' });
      if (res.ok) {
        const leader: SegmentLeader | null = await res.json();
        if (leader?.leaderId) {
          form.setValue("leaderId", leader.leaderId);
        }
      }
    } catch {
      // No leader assigned yet, or fetch failed - leave as "none"
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: SegmentFormData) => {
      const payload = {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        isActive: data.isActive,
      };
      const response = editing
        ? await apiRequest('PUT', `/api/segments/${editing.id}`, payload)
        : await apiRequest('POST', '/api/segments', payload);
      const savedSegment = await response.json();

      await apiRequest('PUT', `/api/segment-leaders/${savedSegment.id}`, {
        leaderId: data.leaderId === "none" ? null : data.leaderId,
      });

      return savedSegment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/segments'] });
      toast({ title: editing ? "Sector updated" : "Sector created" });
      setIsFormOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to save sector", variant: "destructive" });
    },
  });

  const onSubmit = (data: SegmentFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <PageHeader
        icon={Layers}
        title="Sectors"
        description="Business sectors projects are grouped under, and who leads each one"
        actions={
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            {canManage && (
              <DialogTrigger asChild>
                <Button onClick={openCreate} data-testid="button-create-sector">
                  <Plus className="h-4 w-4 mr-2" />
                  New Sector
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Sector" : "New Sector"}</DialogTitle>
              <DialogDescription>
                Sectors group projects for reporting and team assignment. Once created, they're selectable when creating or editing a project.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2" noValidate>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Academic" {...field} data-testid="input-segment-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional description" {...field} data-testid="input-segment-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="leaderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sector Leader</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger data-testid="select-sector-leader">
                            <SelectValue placeholder="No leader assigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No leader assigned</SelectItem>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      {field.value !== "none" && (
                        <p className="text-xs text-gray-500">
                          {employees.find((e) => e.id === field.value)?.email}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Active</FormLabel>
                        <p className="text-sm text-gray-500">Inactive sectors are hidden from new project selection.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-segment-active" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-segment">
                    {saveMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search sectors..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-sectors"
        />
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : filteredSegments.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {query ? "No sectors found" : "No sectors yet"}
              </h3>
              <p className="text-gray-600 mb-4">
                {query ? "Try adjusting your search terms." : "Create a sector so it can be assigned to projects."}
              </p>
              {!query && canManage && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Sector
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSegments.map((segment) => (
                  <TableRow key={segment.id} data-testid={`row-segment-${segment.id}`}>
                    <TableCell className="font-medium">{segment.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{segment.description || <span className="text-sm text-gray-400 italic">Not provided</span>}</TableCell>
                    <TableCell>
                      {leaders.find((l) => l.segmentId === segment.id)?.leaderName || (
                        <span className="text-sm text-gray-400 italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={segment.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                        {segment.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(segment)}
                          data-testid={`button-edit-segment-${segment.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
