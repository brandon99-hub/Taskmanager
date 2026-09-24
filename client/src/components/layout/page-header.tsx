import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  titleBadge?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
}

export default function PageHeader({ icon: Icon, title, description, titleBadge, actions, filters }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900" data-testid="text-title">{title}</h2>
              {titleBadge}
            </div>
            <p className="text-sm text-gray-600" data-testid="text-subtitle">{description}</p>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {filters && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">{filters}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
