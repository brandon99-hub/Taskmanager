import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  Mail,
  Save,
  Loader2
} from "lucide-react";

interface NotificationPreferences {
  // Email preferences
  emailTaskAssigned: boolean;
  emailProjectDeadline: boolean;
  emailTeamUpdates: boolean;

  // In-app preferences
  inAppTaskAssigned: boolean;
  inAppProjectDeadline: boolean;
  inAppTeamUpdates: boolean;
}

const defaultPreferences: NotificationPreferences = {
  emailTaskAssigned: true,
  emailProjectDeadline: true,
  emailTeamUpdates: false,
  inAppTaskAssigned: true,
  inAppProjectDeadline: true,
  inAppTeamUpdates: true,
};

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load existing preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/user/notification-preferences', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setPreferences(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading notification preferences:', error);
        setIsLoading(false);
        toast({
          title: "Error",
          description: "Failed to load preferences",
          variant: "destructive",
        });
      }
    };

    loadPreferences();
  }, []);

  // Save preferences
  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/user/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        toast({
          title: "Preferences Saved",
          description: "Your notification preferences have been updated successfully.",
          variant: "default"
        });
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast({
        title: "Save Failed",
        description: "There was an error saving your preferences. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update preference
  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Bell className="h-5 w-5 mr-2 text-blue-600" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading preferences...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-0 space-y-6">
        {/* Email Notifications */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Email Notifications</h3>
          </div>
          
          <div className="space-y-4 ml-4 sm:ml-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Task Assignments</Label>
                <p className="text-xs text-gray-500">Get notified when tasks are assigned to you</p>
              </div>
              <Switch
                checked={preferences.emailTaskAssigned}
                onCheckedChange={(checked) => updatePreference('emailTaskAssigned', checked)}
                className="self-start sm:self-center"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Project Deadlines</Label>
                <p className="text-xs text-gray-500">Notifications about project deadlines</p>
              </div>
              <Switch
                checked={preferences.emailProjectDeadline}
                onCheckedChange={(checked) => updatePreference('emailProjectDeadline', checked)}
                className="self-start sm:self-center"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* In-App Notifications */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Bell className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">In-App Notifications</h3>
          </div>
          
          <div className="space-y-4 ml-4 sm:ml-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Task Assignments</Label>
                <p className="text-xs text-gray-500">Show in notification dropdown</p>
              </div>
              <Switch
                checked={preferences.inAppTaskAssigned}
                onCheckedChange={(checked) => updatePreference('inAppTaskAssigned', checked)}
                className="self-start sm:self-center"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Team Updates</Label>
                <p className="text-xs text-gray-500">Show team activity notifications</p>
              </div>
              <Switch
                checked={preferences.inAppTeamUpdates}
                onCheckedChange={(checked) => updatePreference('inAppTeamUpdates', checked)}
                className="self-start sm:self-center"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button 
            onClick={savePreferences} 
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
