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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2, Plus, Pencil, Search } from "lucide-react";
import PageHeader from "@/components/layout/page-header";

interface Company {
  id: string;
  name: string;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  address?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const companyFormSchema = z.object({
  name: z.string().min(1, "Company name is required").max(200, "Company name too long"),
  primaryContactName: z.string().max(200, "Contact name too long").optional(),
  primaryContactEmail: z.string().email("Invalid email").max(200, "Email too long").optional().or(z.literal("")),
  primaryContactPhone: z.string().max(50, "Phone too long").optional(),
  address: z.string().max(500, "Address too long").optional(),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

const emptyFormValues: CompanyFormData = {
  name: "",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  address: "",
};

export default function Companies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth() as any;
  const canManage = auth.hasPermission?.('companies.manage') || auth.isAdminRole?.();
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: emptyFormValues,
  });

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    staleTime: 20 * 60 * 1000,
  });

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, query]);

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyFormValues);
    setIsFormOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditing(company);
    form.reset({
      name: company.name || "",
      primaryContactName: company.primaryContactName || "",
      primaryContactEmail: company.primaryContactEmail || "",
      primaryContactPhone: company.primaryContactPhone || "",
      address: company.address || "",
    });
    setIsFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const payload = {
        name: data.name.trim(),
        primaryContactName: data.primaryContactName?.trim() || undefined,
        primaryContactEmail: data.primaryContactEmail?.trim() || undefined,
        primaryContactPhone: data.primaryContactPhone?.trim() || undefined,
        address: data.address?.trim() || undefined,
      };
      const response = editing
        ? await apiRequest('PUT', `/api/companies/${editing.id}`, payload)
        : await apiRequest('POST', '/api/companies', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: editing ? "Company updated" : "Company created" });
      setIsFormOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to save company", variant: "destructive" });
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <PageHeader
        icon={Building2}
        title="Companies"
        description="The client organizations that projects and tickets belong to"
        actions={
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            {canManage && (
              <DialogTrigger asChild>
                <Button onClick={openCreate} data-testid="button-create-company">
                  <Plus className="h-4 w-4 mr-2" />
                  New Company
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Company" : "New Company"}</DialogTitle>
              <DialogDescription>
                Companies are the organizations a project's client belongs to. Once created, they can be selected when creating or editing a project.
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
                        <Input placeholder="e.g. Acme Corporation" {...field} data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="primaryContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact person" {...field} data-testid="input-company-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="primaryContactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Contact Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@company.com" {...field} data-testid="input-company-contact-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primaryContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="Phone number" {...field} data-testid="input-company-contact-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Company address" {...field} data-testid="input-company-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-company">
                    {saveMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        }
        filters={
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search companies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-companies"
            />
          </div>
        }
      />

      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {query ? "No companies found" : "No companies yet"}
              </h3>
              <p className="text-gray-600 mb-4">
                {query ? "Try adjusting your search terms." : "Create the first company so it can be linked to projects."}
              </p>
              {!query && canManage && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Company
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Primary Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.primaryContactName || <span className="text-sm text-gray-400 italic">Not provided</span>}</TableCell>
                    <TableCell>{company.primaryContactEmail || <span className="text-sm text-gray-400 italic">Not provided</span>}</TableCell>
                    <TableCell>{company.primaryContactPhone || <span className="text-sm text-gray-400 italic">Not provided</span>}</TableCell>
                    <TableCell className="max-w-xs truncate">{company.address || <span className="text-sm text-gray-400 italic">Not provided</span>}</TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(company)}
                          data-testid={`button-edit-company-${company.id}`}
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
