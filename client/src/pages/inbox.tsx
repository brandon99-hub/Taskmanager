import { useState } from "react";
import DOMPurify from "dompurify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/layout/page-header";
import { Mail, Search, RefreshCw, Link2, Send, Plug, Unplug } from "lucide-react";

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body?: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export default function Inbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const { data: connection, isLoading: connectionLoading } = useQuery<any>({
    queryKey: ['/api/inbox/connection-status'],
    queryFn: async () => {
      const res = await fetch('/api/inbox/connection-status', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch connection status');
      return res.json();
    },
  });

  const { data: threads = [], isLoading: threadsLoading } = useQuery<GraphMessage[]>({
    queryKey: ['/api/inbox/threads'],
    queryFn: async () => {
      const res = await fetch('/api/inbox/threads', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch threads');
      return res.json();
    },
    enabled: !!connection?.connected,
    staleTime: 30 * 1000,
  });

  const { data: thread, isLoading: threadLoading } = useQuery<{ messages: GraphMessage[]; linkedTicketId: string | null }>({
    queryKey: ['/api/inbox/threads', selectedConversationId],
    queryFn: async () => {
      const res = await fetch(`/api/inbox/threads/${selectedConversationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch conversation');
      return res.json();
    },
    enabled: !!selectedConversationId,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('GET', '/api/auth/microsoft');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) window.location.href = data.authUrl;
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to start Microsoft 365 connection", variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/user/microsoft-disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/connection-status'] });
      toast({ title: "Microsoft 365 disconnected" });
    },
  });

  const syncNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/inbox/sync-now');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/connection-status'] });
      toast({ title: "Sync complete", description: `${data.processed} message(s) processed, ${data.created} ticket(s) created, ${data.linked} linked to existing tickets.` });
    },
    onError: (error: any) => toast({ title: "Sync failed", description: error?.message, variant: "destructive" }),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!thread?.messages?.length || !selectedConversationId) return;
      const lastMessage = thread.messages[thread.messages.length - 1];
      await apiRequest('POST', `/api/inbox/threads/${selectedConversationId}/reply`, {
        messageId: lastMessage.id,
        bodyHtml: replyBody,
      });
    },
    onSuccess: () => {
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/threads', selectedConversationId] });
      toast({ title: "Reply sent" });
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "Failed to send reply", variant: "destructive" }),
  });

  const filteredThreads = threads.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (t.subject || '').toLowerCase().includes(q) || (t.from?.emailAddress?.address || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <PageHeader
        icon={Mail}
        title="Inbox"
        description="Microsoft 365 support mailbox, with AI-assisted auto-ticketing"
      />

      <Tabs defaultValue="messages" className="mt-6">
        <TabsList variant="underline">
          <TabsTrigger value="messages" data-testid="tab-inbox-messages">Messages</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-inbox-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="pt-6">
          {!connectionLoading && !connection?.connected ? (
            <Card>
              <CardContent className="text-center py-12">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No mailbox connected</h3>
                <p className="text-gray-600 mb-4">Connect your Microsoft 365 mailbox from the Settings tab to see messages here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <Card className="lg:col-span-2">
                <CardContent className="p-0">
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search subject or sender..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                        data-testid="input-search-inbox"
                      />
                    </div>
                  </div>
                  <div className="divide-y max-h-[70vh] overflow-y-auto">
                    {threadsLoading ? (
                      <div className="p-4 space-y-2">
                        {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
                      </div>
                    ) : filteredThreads.length === 0 ? (
                      <div className="text-center py-12 text-sm text-gray-500">No messages</div>
                    ) : (
                      filteredThreads.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedConversationId(m.conversationId)}
                          className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${selectedConversationId === m.conversationId ? 'bg-indigo-50' : ''}`}
                          data-testid={`inbox-thread-${m.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm truncate ${!m.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {m.from?.emailAddress?.name || m.from?.emailAddress?.address}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0">{new Date(m.receivedDateTime).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-gray-900 truncate">{m.subject || '(no subject)'}</p>
                          <p className="text-xs text-gray-500 truncate">{m.bodyPreview}</p>
                        </button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardContent className="p-4">
                  {!selectedConversationId ? (
                    <div className="text-center py-16 text-sm text-gray-500">Select a message to view the conversation</div>
                  ) : threadLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />)}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {thread?.linkedTicketId && (
                        <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2">
                          <Link2 className="w-3.5 h-3.5" />
                          Linked to ticket — see the Tickets page for full details.
                        </div>
                      )}
                      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                        {thread?.messages?.map((m) => (
                          <div key={m.id} className="border rounded-md p-3">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span className="font-medium text-gray-900">{m.from?.emailAddress?.name || m.from?.emailAddress?.address}</span>
                              <span>{new Date(m.receivedDateTime).toLocaleString()}</span>
                            </div>
                            <div
                              className="text-sm text-gray-700 [&_img]:max-w-full"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.body?.content || m.bodyPreview || '') }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t space-y-2">
                        <Textarea
                          placeholder="Write a reply..."
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          rows={4}
                          data-testid="textarea-inbox-reply"
                        />
                        <div className="flex justify-end">
                          <Button
                            onClick={() => replyMutation.mutate()}
                            disabled={!replyBody.trim() || replyMutation.isPending}
                            data-testid="button-send-reply"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {replyMutation.isPending ? "Sending..." : "Send via Microsoft 365"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="pt-6">
          <Card className="max-w-2xl">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Microsoft 365 connection</h3>
                  <p className="text-sm text-gray-500">
                    {connection?.connected ? `Connected as ${connection.mailboxEmail}` : "Not connected"}
                  </p>
                </div>
                {connection?.connected ? (
                  <Button variant="outline" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending} data-testid="button-disconnect-microsoft">
                    <Unplug className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending} data-testid="button-connect-microsoft">
                    <Plug className="w-4 h-4 mr-2" />
                    Connect Microsoft 365
                  </Button>
                )}
              </div>

              {connection?.connected && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-900 font-medium">Sync</p>
                      <p className="text-xs text-gray-500">
                        {connection.lastSyncAt ? `Last synced ${new Date(connection.lastSyncAt).toLocaleString()}` : "Never synced yet"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => syncNowMutation.mutate()} disabled={syncNowMutation.isPending} data-testid="button-sync-now">
                      <RefreshCw className={`w-4 h-4 mr-2 ${syncNowMutation.isPending ? 'animate-spin' : ''}`} />
                      Sync now
                    </Button>
                  </div>
                  {connection.lastSyncError && (
                    <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
                      Last sync error: {connection.lastSyncError}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    New tickets are created automatically from qualifying emails on a 5-minute cycle, or immediately via "Sync now".
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
