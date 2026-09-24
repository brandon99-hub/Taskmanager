import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Ticket } from "lucide-react";
import TicketKanban from "@/components/tickets/ticket-kanban";
import PageHeader from "@/components/layout/page-header";

export default function Tasks() {
  const auth = useAuth() as any;
  const { isAuthenticated, isLoading } = auth;
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-page">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <PageHeader
          icon={Ticket}
          title="Tickets"
          description="Support tickets by status"
        />

        <TicketKanban />
      </div>
    </div>
  );
}
