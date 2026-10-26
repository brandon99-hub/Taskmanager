import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Pencil, Trash2 } from "lucide-react";
import UserFormDialog from "./user-form-dialog";

interface EmployeeUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  roleId?: string | null;
  isActive: boolean;
  openTicketCount?: number;
  resolvedTicketCount?: number;
}

interface EmployeesTabProps {
  search?: string;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

export default function EmployeesTab({ search = "", createOpen, onCreateOpenChange }: EmployeesTabProps) {
  const [editingUser, setEditingUser] = useState<EmployeeUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<EmployeeUser | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "User deleted" });
    },
    onError: (error: any) => {
      // apiRequest errors look like `409: {"message":"..."}`; show just the server message
      let description = error?.message || "Failed to delete user";
      try {
        const body = JSON.parse(description.slice(description.indexOf(':') + 1).trim());
        if (body?.message) description = body.message;
      } catch {
        /* keep raw message */
      }
      toast({ title: "Could not delete user", description, variant: "destructive" });
    },
    onSettled: () => setDeletingUser(null),
  });

  const { data: employees = [], isLoading } = useQuery<EmployeeUser[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
  });

  const filtered = employees.filter((emp) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const fullName = emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : '';
    return fullName.toLowerCase().includes(term) || emp.email.toLowerCase().includes(term);
  });

  return (
    <div>
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
            <p className="text-gray-600">{search ? `No matches for "${search}"` : "No employees have been added yet."}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Open Tickets</TableHead>
                  <TableHead className="text-center">Resolved Tickets</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp) => {
                  const fullName = emp.firstName && emp.lastName ? `${emp.firstName} ${emp.lastName}` : emp.email;
                  return (
                    <TableRow key={emp.id} className="hover:bg-accent-brand/5" data-testid={`row-employee-${emp.id}`}>
                      <TableCell className="font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {fullName}
                          {!emp.isActive && <Badge variant="outline" className="text-xs text-gray-500">Inactive</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{emp.email}</TableCell>
                      <TableCell className="text-center font-semibold text-accent-brand">{emp.openTicketCount ?? 0}</TableCell>
                      <TableCell className="text-center font-semibold text-gray-700">{emp.resolvedTicketCount ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingUser(emp)}
                            data-testid={`button-edit-employee-${emp.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingUser(emp)}
                            data-testid={`button-delete-employee-${emp.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <UserFormDialog mode="create" open={createOpen} onOpenChange={onCreateOpenChange} />
      {editingUser && (
        <UserFormDialog
          mode="edit"
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
        />
      )}

      <AlertDialog open={!!deletingUser} onOpenChange={(o) => !o && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingUser?.email} will be removed completely, along with their notifications and team memberships.
              This cannot be undone. If they own tickets, projects or other records the delete is refused and nothing
              is changed; deactivate them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              data-testid="button-confirm-delete-user"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
