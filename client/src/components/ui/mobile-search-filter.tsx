import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScreenSize } from "@/hooks/use-mobile";
import { Search, Filter, X } from "lucide-react";

interface FilterOption {
  label: string;
  value: string;
}

interface MobileSearchFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: {
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }[];
  activeFiltersCount?: number;
  onClearFilters?: () => void;
  placeholder?: string;
}

export default function MobileSearchFilter({
  searchValue,
  onSearchChange,
  filters = [],
  activeFiltersCount = 0,
  onClearFilters,
  placeholder = "Search..."
}: MobileSearchFilterProps) {
  const { isMobile } = useScreenSize();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  if (!isMobile) {
    // Desktop layout
    return (
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        {filters.map((filter) => (
          <Select key={filter.label} value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {activeFiltersCount > 0 && onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear ({activeFiltersCount})
          </Button>
        )}
      </div>
    );
  }

  // Mobile layout
  return (
    <div className="space-y-3 mb-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-12"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter button and active filters */}
      <div className="flex items-center justify-between">
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh]">
            <SheetHeader>
              <SheetTitle>Filter Options</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
              {filters.map((filter) => (
                <div key={filter.label} className="space-y-2">
                  <label className="text-sm font-medium">{filter.label}</label>
                  <Select value={filter.value} onValueChange={filter.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {filter.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {activeFiltersCount > 0 && onClearFilters && (
                <Button variant="outline" onClick={onClearFilters} className="w-full">
                  Clear All Filters
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Active filters summary */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">{activeFiltersCount} active</span>
            {onClearFilters && (
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-6 w-6 p-0">
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
