import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Plus, Ticket as TicketIcon, Check, ChevronsUpDown } from "lucide-react";
import { TICKET_TYPES, type TicketType } from "@/lib/ticket-constants";

interface Project {
  id: string;
  name: string;
  client?: string;
  status: string;
  companyId?: string | null;
}

interface ServiceCategory {
  id: string;
  name: string;
  isActive: boolean;
  type: "complaint" | "enquiry";
}

export default function CreateTicketDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  const [type, setType] = useState<TicketType>("complaint");
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const { data: slaProjects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects', 'on_support'],
    queryFn: async () => {
      const res = await fetch('/api/projects?status=on_support', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.projects || [];
    },
    enabled: isOpen,
  });

  const needsCategory = type === "complaint" || type === "enquiry";

  const { data: categories = [] } = useQuery<ServiceCategory[]>({
    queryKey: ['/api/service-categories', type],
    queryFn: async () => {
      const res = await fetch(`/api/service-categories?type=${type}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen && needsCategory,
    staleTime: 20 * 60 * 1000,
  });

  const activeCategories = categories.filter((c) => c.isActive);
  const selectedCategory = activeCategories.find((c) => c.id === categoryId);

  const reset = () => {
    setType("complaint");
    setProjectId("");
    setCategoryId("");
    setSubject("");
    setDescription("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/tickets', {
        type,
        projectId,
        categoryId: needsCategory ? categoryId : undefined,
        subject,
        description,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({ title: "Ticket created" });
      setIsOpen(false);
      reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create ticket", variant: "destructive" });
    },
  });

  const canSubmit = projectId && (!needsCategory || categoryId) && subject.trim() && description.trim();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) reset(); }}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-ticket">
          <Plus className="h-4 w-4 mr-2" />
          Log Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TicketIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Log a Ticket</DialogTitle>
              <DialogDescription>Log an issue on behalf of a company for a project that's in its SLA/support period.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" data-testid="input-ticket-subject" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Ticket Description *</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's the issue?" className="min-h-[100px]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Ticket Type *</label>
              <Select
                value={type}
                onValueChange={(value) => {
                  setType(value as TicketType);
                  setCategoryId("");
                }}
              >
                <SelectTrigger data-testid="select-ticket-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsCategory && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Category *</label>
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryPopoverOpen}
                      className="w-full justify-between font-normal"
                      data-testid="select-ticket-category"
                    >
                      {selectedCategory
                        ? selectedCategory.name
                        : activeCategories.length
                          ? "Select a category"
                          : "No categories yet"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search categories..." />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          {activeCategories.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setCategoryId(c.id);
                                setCategoryPopoverOpen(false);
                              }}
                            >
                              <Check className={cn("h-4 w-4", categoryId === c.id ? "opacity-100" : "opacity-0")} />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Project (SLA/support) *</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-ticket-project">
                <SelectValue placeholder={slaProjects.length ? "Select a project" : "No projects in support yet"} />
              </SelectTrigger>
              <SelectContent>
                {slaProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name || p.client}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            data-testid="button-submit-ticket"
          >
            {createMutation.isPending ? "Logging..." : "Log Ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
