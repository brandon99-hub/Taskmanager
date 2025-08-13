import { Badge } from "@/components/ui/badge";

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export default function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'critical':
        return {
          label: 'Critical',
          className: 'bg-error text-error-foreground',
        };
      case 'high':
        return {
          label: 'High',
          className: 'bg-warning text-warning-foreground',
        };
      case 'medium':
        return {
          label: 'Medium',
          className: 'bg-primary text-primary-foreground',
        };
      case 'low':
        return {
          label: 'Low',
          className: 'bg-success text-success-foreground',
        };
      default:
        return {
          label: 'Unknown',
          className: 'bg-gray-500 text-white',
        };
    }
  };

  const config = getPriorityConfig(priority);

  return (
    <Badge 
      className={`text-xs font-medium ${config.className} ${className}`}
      data-testid={`priority-badge-${priority}`}
    >
      {config.label}
    </Badge>
  );
}
