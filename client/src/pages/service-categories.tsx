import { useState } from "react";
import { Tags, Plus, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/layout/page-header";
import ServiceCategoriesTab from "@/components/tickets/service-categories-tab";

export default function ServiceCategories() {
  const auth = useAuth() as any;
  const canManage = auth.hasPermission?.('service_categories.manage') || auth.isAdminRole?.();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <PageHeader
        icon={Tags}
        title="Service Categories"
        description="Manage the categories used to classify Complaint and Enquiry tickets"
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)} data-testid="button-create-category">
              <Plus className="h-4 w-4 mr-2" />
              New Category
            </Button>
          )
        }
      />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-categories"
        />
      </div>

      <ServiceCategoriesTab createOpen={createOpen} onCreateOpenChange={setCreateOpen} search={search} />
    </div>
  );
}
