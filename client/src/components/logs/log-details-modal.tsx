import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Monitor, 
  User, 
  Calendar, 
  MapPin, 
  Globe, 
  Shield, 
  Activity,
  Database,
  Server,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info
} from "lucide-react";

interface LogDetailsModalProps {
  log: any;
  isOpen: boolean;
  onClose: () => void;
}

// Helper function to render changes in a user-friendly format
function renderChanges(oldValues: any, newValues: any) {
  if (!oldValues && !newValues) return null;

  const changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    fieldLabel: string;
  }> = [];

  // Common fields to track changes for
  const importantFields = [
    { key: 'status', label: 'Status' },
    { key: 'billingStatus', label: 'Billing Status' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'priority', label: 'Priority' },
    { key: 'progress', label: 'Progress' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
    { key: 'budget', label: 'Budget' },
    { key: 'client', label: 'Client' },
    { key: 'managerId', label: 'Manager' },
    { key: 'teamId', label: 'Team' }
  ];

  // Check for changes in important fields
  importantFields.forEach(({ key, label }) => {
    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];
    
    if (oldVal !== undefined && newVal !== undefined && oldVal !== newVal) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
        fieldLabel: label
      });
    }
  });

  if (changes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No significant changes detected
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {changes.map((change, index) => (
        <div key={index} className="border rounded-lg p-3 bg-gray-50">
          <div className="text-sm font-medium mb-2">{change.fieldLabel}</div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs break-all">
                {formatValue(change.oldValue)}
              </span>
              <span className="text-muted-foreground hidden sm:inline">→</span>
              <span className="text-muted-foreground sm:hidden text-xs">to</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs break-all">
                {formatValue(change.newValue)}
              </span>
            </div>
          </div>
        </div>
      ))}
      
      {/* Show raw data for debugging */}
      <details className="mt-4">
        <summary className="text-sm text-muted-foreground cursor-pointer">
          View Raw Data
        </summary>
        <div className="mt-2 space-y-2">
          {oldValues && (
            <div>
              <div className="text-xs font-medium mb-1">Previous Values</div>
              <pre className="text-xs bg-yellow-50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(oldValues, null, 2)}
              </pre>
            </div>
          )}
          {newValues && (
            <div>
              <div className="text-xs font-medium mb-1">New Values</div>
              <pre className="text-xs bg-green-50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(newValues, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

// Helper function to format values for display
function formatValue(value: any): string {
  if (value === null || value === undefined) return 'Not Set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object' && value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  return String(value);
}

export function LogDetailsModal({ log, isOpen, onClose }: LogDetailsModalProps) {
  if (!log) return null;

  // Format Kenya time
  const formatKenyaTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      
      // The server is running in a timezone that's about 2 hours ahead of Kenya
      // So we need to subtract 2 hours to get the correct Kenya time
      const kenyaTime = new Date(date.getTime() - (2 * 60 * 60 * 1000));
      
      return kenyaTime.toLocaleString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + ' (Kenya Time)';
    } catch (error) {
      return new Date(timestamp).toLocaleString();
    }
  };

  // Get severity icon and color
  const getSeverityInfo = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'error':
        return { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'warn':
        return { icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
      case 'info':
      default:
        return { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-50' };
    }
  };

  // Get log type icon
  const getLogTypeIcon = (logType: string) => {
    switch (logType) {
      case 'activity':
        return Activity;
      case 'system':
        return Database;
      case 'api':
        return Server;
      default:
        return Shield;
    }
  };

  const severityInfo = getSeverityInfo(log.severity || 'info');
  const LogTypeIcon = getLogTypeIcon(log.logType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] max-w-[95vw] sm:w-full sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogTypeIcon className="h-5 w-5" />
            Log Entry Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Timestamp</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {formatKenyaTime(log.createdAt)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <LogTypeIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Log Type</div>
                    <Badge variant="outline" className="capitalize">
                      {log.logType || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Action</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {log.actionType || log.method || log.eventType || 'N/A'}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium">Resource Type</div>
                  <div className="text-sm text-muted-foreground">
                    {log.resourceType || 'N/A'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Resource Name</div>
                <div className="text-sm text-muted-foreground">
                  {log.resourceName || 'N/A'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">User Email</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {(log.additionalContext?.userEmail) || (log.metadata?.userEmail) || 'Anonymous'}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium">User ID</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {log.userId ? `${log.userId.substring(0, 8)}...` : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Session ID</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {log.sessionId ? `${log.sessionId.substring(0, 8)}...` : 'N/A'}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium">Request ID</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {log.requestId ? `${log.requestId.substring(0, 8)}...` : 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Machine Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Machine Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Server Hostname</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {log.additionalContext?.machineInfo?.serverHostname || 
                     log.metadata?.machineInfo?.serverHostname || 
                     'Unknown Server'}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium">Client Hostname</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {log.additionalContext?.machineInfo?.clientHostname || 
                     log.metadata?.machineInfo?.clientHostname || 
                     'Unknown Client'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Client Platform</div>
                  <div className="text-sm text-muted-foreground">
                    {log.additionalContext?.machineInfo?.clientPlatform || 
                     log.metadata?.machineInfo?.clientPlatform || 
                     'Unknown Platform'}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium">Client Architecture</div>
                  <div className="text-sm text-muted-foreground">
                    {log.additionalContext?.machineInfo?.clientArch || 
                     log.metadata?.machineInfo?.clientArch || 
                     'Unknown Architecture'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Client IP Address</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {log.additionalContext?.machineInfo?.clientIP || 
                     log.metadata?.machineInfo?.clientIP || 
                     log.ipAddress || 
                     'Unknown IP'}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium">User Agent</div>
                  <div className="text-sm text-muted-foreground font-mono break-all">
                    {log.userAgent || 'Unknown User Agent'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status and Severity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Status & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Status</div>
                  <div className="mt-1">
                    {log.success === false || (log.statusCode && log.statusCode >= 400) ? (
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <XCircle className="h-3 w-3" />
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="default" className="flex items-center gap-1 w-fit">
                        <CheckCircle className="h-3 w-3" />
                        Success
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium">Severity</div>
                  <div className="mt-1">
                    <Badge 
                      variant="outline" 
                      className={`flex items-center gap-1 w-fit ${severityInfo.color} ${severityInfo.bgColor}`}
                    >
                      <severityInfo.icon className="h-3 w-3" />
                      {(log.severity || 'info').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>

              {log.statusCode && (
                <div>
                  <div className="text-sm font-medium">HTTP Status Code</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {log.statusCode}
                  </div>
                </div>
              )}

              {log.errorMessage && (
                <div>
                  <div className="text-sm font-medium">Error Message</div>
                  <div className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                    {log.errorMessage}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Context */}
          {(log.additionalContext || log.metadata) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Context</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto">
                  {JSON.stringify({
                    ...log.additionalContext,
                    ...log.metadata
                  }, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Data Changes */}
          {(log.oldValues || log.newValues) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Changes Made</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderChanges(log.oldValues, log.newValues)}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
