import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Pencil } from "lucide-react";
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUser(emp)}
                          data-testid={`button-edit-employee-${emp.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
    </div>
  );
}
