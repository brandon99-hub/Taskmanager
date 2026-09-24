import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, Search } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import TicketList from "@/components/tickets/ticket-list";
import CreateTicketDialog from "@/components/tickets/create-ticket-dialog";
import { TICKET_TYPES, TICKET_STATUSES } from "@/lib/ticket-constants";

export default function Tickets() {
  const auth = useAuth() as any;
  const canViewAll = (auth.hasPermission?.('tickets.view_all') || auth.isAdminRole?.()) ?? false;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <PageHeader
        icon={Ticket}
        title="Tickets"
        description="Issues raised by companies whose projects are in their SLA/support period"
        actions={<CreateTicketDialog />}
        filters={
          <>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by ticket #, subject or requester..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-tickets"
              />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full lg:w-40" data-testid="select-filter-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TICKET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full lg:w-40" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {TICKET_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <Tabs defaultValue="created">
        <TabsList variant="underline" className="justify-center">
          <TabsTrigger value="created" data-testid="tab-created-by-me">Created by Me</TabsTrigger>
          <TabsTrigger value="assigned" data-testid="tab-assigned-tickets">
            {canViewAll ? "All Tickets" : "Assigned to Me"}
          </TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">Suggestions & Compliments</TabsTrigger>
        </TabsList>
        <TabsContent value="created" className="pt-6">
          <TicketList view="mine" search={search} type={type} status={status} />
        </TabsContent>
        <TabsContent value="assigned" className="pt-6">
          <TicketList view={canViewAll ? "all" : "assigned"} search={search} type={type} status={status} />
        </TabsContent>
        <TabsContent value="feedback" className="pt-6">
          <TicketList view="feedback" search={search} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
