import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Settings,
  Unlink
} from "lucide-react";

interface GoogleCalendarSettings {
  isConnected: boolean;
  calendarId?: string;
  calendarName?: string;
  syncDeadlines: boolean;
  reminderMinutes: number;
  lastSync?: string;
}

export default function GoogleCalendarIntegration() {
  const [settings, setSettings] = useState<GoogleCalendarSettings>({
    isConnected: false,
    syncDeadlines: true,
    reminderMinutes: 60
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();

  // Load Google Calendar settings
  const loadSettings = async () => {
    try {
      const response = await fetch('/api/user/calendar-settings', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSettings(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading calendar settings:', error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to load calendar settings",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Connect to Google Calendar
  const connectCalendar = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('/api/user/calendar-connect', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Redirect to Google OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting calendar:', error);
      toast({
        title: "Error",
        description: "Failed to connect calendar",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  // Disconnect Google Calendar
  const disconnectCalendar = async () => {
    try {
      setIsDisconnecting(true);
      const response = await fetch('/api/user/calendar-disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Reload settings to reflect the change
      await loadSettings();
      setIsDisconnecting(false);
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect calendar",
        variant: "destructive",
      });
      setIsDisconnecting(false);
    }
  };

  // Update settings
  const updateSettings = async (newSettings: Partial<GoogleCalendarSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      
      const response = await fetch('/api/user/calendar-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        setSettings(updatedSettings);
        toast({
          title: "Settings Updated",
          description: "Your calendar settings have been saved.",
          variant: "default"
        });
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Update Failed",
        description: "Unable to save settings. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading calendar settings...</span>
        </div>
      </div>
    );
  }

  if (!settings.isConnected) {
    return (
      <div className="space-y-4">
        <div className="text-center sm:text-left">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Connect Google Calendar</h3>
          <p className="text-xs text-gray-500 mb-4">
            Sync your task deadlines with Google Calendar for better time management.
          </p>
        </div>
        
        <Button
          onClick={connectCalendar}
          disabled={isConnecting}
          className="w-full sm:w-auto"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 mr-2" />
              Connect Calendar
            </>
          )}
        </Button>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Connect your Google Calendar to automatically sync task deadlines and get reminders.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connected Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-green-50 rounded-lg border border-green-200 space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium text-green-900">
              Connected to {settings.calendarName || "Google Calendar"}
            </p>
            {settings.lastSync && (
              <p className="text-xs text-green-600">
                Last sync: {new Date(settings.lastSync).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnectCalendar}
          disabled={isDisconnecting}
          className="text-red-600 hover:text-red-800 hover:bg-red-50 w-full sm:w-auto"
        >
          {isDisconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unlink className="h-4 w-4" />
          )}
          <span className="ml-2 sm:hidden">Disconnect</span>
        </Button>
      </div>

      {/* Calendar Settings */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Sync Task Deadlines</Label>
            <p className="text-xs text-gray-500">
              Automatically create calendar events for task due dates
            </p>
          </div>
          <Switch
            checked={settings.syncDeadlines}
            onCheckedChange={(checked) => updateSettings({ syncDeadlines: checked })}
            className="self-start sm:self-center"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Reminder Time</Label>
            <p className="text-xs text-gray-500">
              How early to remind you before deadlines
            </p>
          </div>
          <select 
            value={settings.reminderMinutes}
            onChange={(e) => updateSettings({ reminderMinutes: parseInt(e.target.value) })}
            className="text-sm border border-gray-300 rounded px-2 py-1 w-full sm:w-auto"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
            <option value={1440}>1 day</option>
          </select>
        </div>
      </div>

      {/* Manual Sync Button */}
      <Button
        variant="outline"
        className="w-full justify-start"
        disabled
      >
        <Settings className="h-4 w-4 mr-2" />
        Sync All Tasks
        <Badge variant="secondary" className="ml-auto text-xs">Coming Soon</Badge>
      </Button>

      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Task deadlines will automatically appear in your Google Calendar with reminders based on priority:
          Critical tasks get 2-week notice, others get 1-week notice.
        </AlertDescription>
      </Alert>
    </div>
  );
}