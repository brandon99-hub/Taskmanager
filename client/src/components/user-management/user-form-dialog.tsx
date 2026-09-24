import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserPlus, KeyRound, UserX, UserCheck } from "lucide-react";

interface Role {
  id: string;
  name: string;
}

interface EmployeeUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roleId?: string | null;
  isActive: boolean;
}

interface UserFormDialogProps {
  mode: "create" | "edit";
  user?: EmployeeUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserFormDialog({ mode, user, open, onOpenChange }: UserFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<"reset-password" | "deactivate" | "activate" | null>(null);

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    queryFn: async () => {
      const res = await fetch('/api/roles', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
    staleTime: 20 * 60 * 1000,
  });

  useEffect(() => {
    if (open) {
      setFirstName(user?.firstName || "");
      setLastName(user?.lastName || "");
      setEmail(user?.email || "");
      setRoleId(user?.roleId || "");
    }
  }, [open, user]);

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['/api/users'] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/users', { firstName, lastName, email, roleId: roleId || null });
      return res.json();
    },
    onSuccess: () => {
      invalidateUsers();
      toast({ title: "User created", description: "An invite email with a temporary password has been sent." });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to create user", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await apiRequest('PUT', `/api/users/${user.id}`, { firstName, lastName, email });
      if (roleId !== (user.roleId || "")) {
        await apiRequest('PUT', `/api/users/${user.id}/role`, { roleId: roleId || null });
      }
    },
    onSuccess: () => {
      invalidateUsers();
      toast({ title: "User updated" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update user", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const res = await apiRequest('POST', `/api/users/${user.id}/reset-password`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset", description: "A new temporary password has been emailed to the user." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to reset password", variant: "destructive" });
    },
    onSettled: () => setConfirmAction(null),
  });

  const statusMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!user) return;
      const res = await apiRequest('PATCH', `/api/users/${user.id}/status`, { isActive });
      return res.json();
    },
    onSuccess: (_data, isActive) => {
      invalidateUsers();
      toast({ title: isActive ? "User activated" : "User deactivated" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update user status", variant: "destructive" });
    },
    onSettled: () => setConfirmAction(null),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = firstName.trim() && lastName.trim() && email.trim();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>{mode === "create" ? "New User" : "Edit User"}</DialogTitle>
                <DialogDescription>
                  {mode === "create"
                    ? "Creates a login and emails them a temporary password."
                    : "Update this user's details, role, password or access."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">First Name *</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-user-first-name" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Last Name *</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-user-last-name" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-user-email" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Role</label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue placeholder="No role assigned" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === "edit" && user && (
              <div className="border-t pt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmAction("reset-password")}
                  data-testid="button-reset-password"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
                {user.isActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmAction("deactivate")}
                    data-testid="button-deactivate-user"
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmAction("activate")}
                    data-testid="button-activate-user"
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Activate
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={!canSubmit || isPending}
              onClick={() => (mode === "create" ? createMutation.mutate() : updateMutation.mutate())}
              data-testid="button-save-user"
            >
              {isPending ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAction !== null} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "reset-password" && "Reset this user's password?"}
              {confirmAction === "deactivate" && "Deactivate this user?"}
              {confirmAction === "activate" && "Activate this user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "reset-password" &&
                "A new temporary password will be generated and emailed to them. They'll be required to change it on next login."}
              {confirmAction === "deactivate" &&
                "They will no longer be able to log in. Their ticket and project history is preserved and this can be reversed."}
              {confirmAction === "activate" && "They will be able to log in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction === "reset-password") resetPasswordMutation.mutate();
                if (confirmAction === "deactivate") statusMutation.mutate(false);
                if (confirmAction === "activate") statusMutation.mutate(true);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
