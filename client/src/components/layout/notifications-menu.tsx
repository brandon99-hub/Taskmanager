import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, CheckCheck, Clock, AlertTriangle, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/notifications');
      return response.json();
    },
    staleTime: 30 * 1000,
  });

  const { data: notificationPreferences } = useQuery<any>({
    queryKey: ['/api/user/notification-preferences'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/notification-preferences');
      return response.json();
    },
  });

  const filteredNotifications = notifications.filter((notification) => {
    if (!notificationPreferences) return true;

    switch (notification.type) {
      case 'task_assigned':
        return notificationPreferences.inAppTaskAssigned;
      case 'task_due_soon':
        return notificationPreferences.inAppTaskDueSoon;
      case 'task_overdue':
        return notificationPreferences.inAppTaskOverdue;
      case 'project_deadline':
        return notificationPreferences.inAppProjectDeadline;
      case 'team_update':
        return notificationPreferences.inAppTeamUpdates;
      default:
        return true;
    }
  });

  const unreadCount = filteredNotifications.filter((n: any) => !n.isRead).length;

  useEffect(() => {
    if (notificationPreferences) {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  }, [notificationPreferences, queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest('PUT', `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PUT', '/api/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <Check className="h-4 w-4 text-primary" />;
      case 'task_overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'project_deadline':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatNotificationTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-gray-600 hover:text-gray-900 p-2"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-xs p-0 min-w-0"
              data-testid="badge-notification-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-96">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {notificationPreferences && (
              <Badge variant="outline" className="text-xs text-gray-500">
                Filtered
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs text-primary hover:text-primary-dark p-1 h-auto"
            >
              {markAllAsReadMutation.isPending ? 'Marking...' : 'Mark all read'}
            </Button>
          )}
        </div>

        {notificationPreferences && (
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-xs text-gray-700">
              Showing only notifications you've enabled in your preferences
            </p>
          </div>
        )}

        <ScrollArea className="max-h-96">
          {filteredNotifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">
                {notifications.length === 0
                  ? 'No notifications yet'
                  : 'No notifications match your current preferences'
                }
              </p>
              {notifications.length > 0 && filteredNotifications.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Check your notification preferences in Profile settings
                </p>
              )}
            </div>
          ) : (
            <div className="p-1">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg transition-colors ${
                    notification.isRead
                      ? 'bg-gray-50 hover:bg-gray-100'
                      : 'bg-gray-50 hover:bg-gray-100'
                  } ${!notification.isRead ? 'border-l-4 border-accent-brand' : ''}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <p className={`text-sm font-medium ${
                          notification.isRead ? 'text-gray-700' : 'text-gray-900'
                        }`}>
                          {notification.title}
                        </p>

                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            disabled={markAsReadMutation.isPending}
                            className="text-xs text-primary hover:text-primary-dark p-1 h-auto ml-2"
                          >
                            <CheckCheck className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <p className={`text-sm mt-1 ${
                        notification.isRead ? 'text-gray-600' : 'text-gray-700'
                      }`}>
                        {notification.message}
                      </p>

                      <p className="text-xs text-gray-500 mt-2">
                        {formatNotificationTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
