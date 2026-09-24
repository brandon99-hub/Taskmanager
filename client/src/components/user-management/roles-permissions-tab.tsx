import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Trash2, Lock } from "lucide-react";

interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
}

interface Permission {
  id: string;
  key: string;
  label: string;
  category: string;
}

interface RolesPermissionsTabProps {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

export default function RolesPermissionsTab({ createOpen, onCreateOpenChange }: RolesPermissionsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [checkedPermissionIds, setCheckedPermissionIds] = useState<Set<string>>(new Set());

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    queryFn: async () => {
      const res = await fetch('/api/roles', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch roles');
      return res.json();
    },
    staleTime: 20 * 60 * 1000,
  });

  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ['/api/permissions'],
    queryFn: async () => {
      const res = await fetch('/api/permissions', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch permissions');
      return res.json();
    },
    staleTime: 20 * 60 * 1000,
  });

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const { data: rolePermissionIds = [] } = useQuery<string[]>({
    queryKey: ['/api/roles', selectedRoleId, 'permissions'],
    queryFn: async () => {
      const res = await fetch(`/api/roles/${selectedRoleId}/permissions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch role permissions');
      return res.json();
    },
    enabled: !!selectedRoleId,
  });

  useEffect(() => {
    setCheckedPermissionIds(new Set(rolePermissionIds));
  }, [rolePermissionIds]);

  const permissionsByCategory = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    for (const perm of permissions) {
      if (!groups[perm.category]) groups[perm.category] = [];
      groups[perm.category].push(perm);
    }
    return groups;
  }, [permissions]);

  const createRoleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/roles', { name: newRoleName, description: newRoleDescription });
      return res.json();
    },
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      onCreateOpenChange(false);
      setNewRoleName("");
      setNewRoleDescription("");
      setSelectedRoleId(role.id);
      toast({ title: "Role created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create role", variant: "destructive" });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await apiRequest('DELETE', `/api/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      setSelectedRoleId(null);
      toast({ title: "Role deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to delete role", variant: "destructive" });
    },
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoleId) return;
      await apiRequest('PUT', `/api/roles/${selectedRoleId}/permissions`, {
        permissionIds: Array.from(checkedPermissionIds),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles', selectedRoleId, 'permissions'] });
      toast({ title: "Permissions saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save permissions", variant: "destructive" });
    },
  });

  const togglePermission = (permissionId: string) => {
    setCheckedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div>
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
            <DialogDescription>Give the role a name, then assign its permissions after creating it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Role name *</label>
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Support Agent" data-testid="input-role-name" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <Textarea value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)} placeholder="What this role is for" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onCreateOpenChange(false)}>Cancel</Button>
            <Button
              disabled={!newRoleName.trim() || createRoleMutation.isPending}
              onClick={() => createRoleMutation.mutate()}
              data-testid="button-submit-role"
            >
              {createRoleMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-2">
            {rolesLoading ? (
              <div className="space-y-2 p-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : roles.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Shield className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                No roles yet. Create the first one.
              </div>
            ) : (
              <div className="space-y-1">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 ${
                      selectedRoleId === role.id ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-700'
                    }`}
                    data-testid={`button-select-role-${role.id}`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {role.isSystem && <Lock className="h-3 w-3 shrink-0" />}
                      {role.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {!selectedRole ? (
              <div className="text-center py-12 text-gray-500 text-sm">Select or create a role to manage its permissions.</div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      {selectedRole.name}
                      {selectedRole.isSystem && <Badge variant="outline" className="text-xs">System role</Badge>}
                    </h4>
                    {selectedRole.description && <p className="text-sm text-gray-600">{selectedRole.description}</p>}
                  </div>
                  {!selectedRole.isSystem && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => deleteRoleMutation.mutate(selectedRole.id)}
                      disabled={deleteRoleMutation.isPending}
                      data-testid="button-delete-role"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>

                {Object.keys(permissionsByCategory).length === 0 ? (
                  <p className="text-sm text-gray-500">No permissions have been defined yet.</p>
                ) : (
                  <div className="space-y-5">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => (
                      <div key={category}>
                        <h5 className="text-sm font-medium text-gray-900 mb-2">{category}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {perms.map((perm) => (
                            <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-700 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checkedPermissionIds.has(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              {perm.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-6 mt-2 border-t">
                  <Button
                    onClick={() => savePermissionsMutation.mutate()}
                    disabled={savePermissionsMutation.isPending}
                    data-testid="button-save-permissions"
                  >
                    {savePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
