import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ResolveTicketModalProps {
  ticketId: string;
  open: boolean;
  onClose: () => void;
}

export default function ResolveTicketModal({ ticketId, open, onClose }: ResolveTicketModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rootCause, setRootCause] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const resolveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PUT', `/api/tickets/${ticketId}/status`, { status: 'resolved', rootCause, resolutionNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({ title: "Ticket resolved" });
      setRootCause("");
      setResolutionNotes("");
      onClose();
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to resolve ticket", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve Ticket</DialogTitle>
          <DialogDescription>Resolving requires a root cause and the steps taken to fix it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Root Cause *</label>
            <Textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="What caused this issue?"
              className="min-h-[80px] text-sm"
              data-testid="textarea-root-cause"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Steps taken to resolve the issue *</label>
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="What was done to resolve it?"
              className="min-h-[80px] text-sm"
              data-testid="textarea-resolution-notes"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!rootCause.trim() || !resolutionNotes.trim() || resolveMutation.isPending}
            onClick={() => resolveMutation.mutate()}
            data-testid="button-confirm-resolve"
          >
            {resolveMutation.isPending ? "Saving..." : "Mark Resolved"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
