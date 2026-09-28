import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpCircle } from "lucide-react";

interface EscalateTicketModalProps {
  ticketId: string;
  teamId?: string | null;
  currentAssigneeId?: string | null;
  open: boolean;
  onClose: () => void;
}

export default function EscalateTicketModal({ ticketId, teamId, currentAssigneeId, open, onClose }: EscalateTicketModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [escalateToUserId, setEscalateToUserId] = useState("");
  const [reason, setReason] = useState("");

  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/teams', teamId, 'members-for-escalate'],
    queryFn: async () => {
      if (!teamId) return [];
      const res = await fetch(`/api/teams/${teamId}`, { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.members?.map((m: any) => m.user) ?? [];
    },
    enabled: open && !!teamId,
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/tickets/${ticketId}/escalate`, {
        escalatedToUserId: escalateToUserId,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({ title: "Ticket escalated" });
      setEscalateToUserId("");
      setReason("");
      onClose();
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to escalate ticket", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-amber-600" />
            Escalate Ticket
          </DialogTitle>
          <DialogDescription>Hand this ticket to a teammate, with context on why.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Escalate to</label>
            <Select value={escalateToUserId} onValueChange={setEscalateToUserId}>
              <SelectTrigger data-testid="select-escalate-to">
                <SelectValue placeholder={teamMembers.length ? "Choose someone" : "No team on this project"} />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.filter((m: any) => m.id !== currentAssigneeId).map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Reason *</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being escalated?"
              className="min-h-[80px] text-sm"
              data-testid="textarea-escalate-reason"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!escalateToUserId || !reason.trim() || escalateMutation.isPending}
            onClick={() => escalateMutation.mutate()}
            data-testid="button-confirm-escalate"
          >
            {escalateMutation.isPending ? "Escalating..." : "Escalate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
