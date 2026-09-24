import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";

interface ReportCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onViewDetails: () => void;
  onExportPdf: () => void;
  isExporting?: boolean;
  testIdSuffix: string;
}

export default function ReportCard({
  icon: Icon,
  title,
  description,
  onViewDetails,
  onExportPdf,
  isExporting,
  testIdSuffix,
}: ReportCardProps) {
  return (
    <div className="group relative bg-white rounded-xl border border-gray-200 hover:border-accent-brand hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-gray-100 rounded-full group-hover:bg-accent-brand/10 transition-colors">
            <Icon className="h-8 w-8 text-primary group-hover:text-accent-brand transition-colors" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-600 text-center mb-4">{description}</p>
        <div className="space-y-2">
          <Button
            onClick={onViewDetails}
            className="w-full bg-accent-brand hover:bg-accent-brand/90 text-white font-medium"
            data-testid={`button-view-${testIdSuffix}`}
          >
            <FileText className="h-4 w-4 mr-2" />
            View Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportPdf}
            className="w-full border-gray-300 hover:border-accent-brand hover:bg-accent-brand/5"
            disabled={isExporting}
            data-testid={`button-export-${testIdSuffix}`}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}
