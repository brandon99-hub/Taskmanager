import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Filter, 
  X, 
  Search,
  Calendar,
  User,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Sector {
  id: string;
  name: string;
  description?: string;
}

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'marketer';
}

interface ProspectFiltersProps {
  onFiltersChange: (filters: {
    search?: string;
    year?: string;
    quarter?: string;
    bdId?: string;
    sectorId?: string;
    stage?: string;
  }) => void;
  showMarketerInfo?: boolean;
}

export function ProspectFilters({ onFiltersChange, showMarketerInfo = false }: ProspectFiltersProps) {
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [quarter, setQuarter] = useState("all");
  const [bdId, setBdId] = useState("all");
  const [sectorId, setSectorId] = useState("all");
  const [stage, setStage] = useState("all");
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [marketers, setMarketers] = useState<MarketingUser[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const quarters = [
    { value: 'Q1', label: 'Q1 (Jan-Mar)' },
    { value: 'Q2', label: 'Q2 (Apr-Jun)' },
    { value: 'Q3', label: 'Q3 (Jul-Sep)' },
    { value: 'Q4', label: 'Q4 (Oct-Dec)' },
  ];

  const stages = [
    { value: 'prospect', label: 'Prospect' },
    { value: 'lead', label: 'Lead' },
    { value: 'expected_order', label: 'Expected Order' },
    { value: 'sales_won', label: 'Sales Won' },
  ];

  useEffect(() => {
    loadSectors();
    if (showMarketerInfo) {
      loadMarketers();
    }
  }, [showMarketerInfo]);

  useEffect(() => {
    const filters = {
      ...(search && { search }),
      ...(year && year !== "all" && { year }),
      ...(quarter && quarter !== "all" && { quarter }),
      ...(bdId && bdId !== "all" && { bdId }),
      ...(sectorId && sectorId !== "all" && { sectorId }),
      ...(stage && stage !== "all" && { stage }),
    };
    
    onFiltersChange(filters);
    
    const hasFilters = Object.keys(filters).length > 0;
    setHasActiveFilters(hasFilters);
  }, [search, year, quarter, bdId, sectorId, stage]);

  const loadSectors = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/sectors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSectors(data.sectors || []);
      }
    } catch (error) {
      console.error("Failed to load sectors:", error);
    }
  };

  const loadMarketers = async () => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMarketers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to load marketers:", error);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setYear("all");
    setQuarter("all");
    setBdId("all");
    setSectorId("all");
    setStage("all");
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (search) count++;
    if (year && year !== "all") count++;
    if (quarter && quarter !== "all") count++;
    if (bdId && bdId !== "all") count++;
    if (sectorId && sectorId !== "all") count++;
    if (stage && stage !== "all") count++;
    return count;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search prospects by client name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={`h-10 ${hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}`}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 text-xs font-medium">
              {getActiveFiltersCount()}
            </span>
          )}
        </Button>
      </div>

      {/* Advanced Filters */}
      <div 
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          showFilters ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Year Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Year
                </label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quarter Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Quarter</label>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All quarters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All quarters</SelectItem>
                    {quarters.map((q) => (
                      <SelectItem key={q.value} value={q.value}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stage Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Stage</label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages</SelectItem>
                    {stages.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sector Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <Building2 className="h-4 w-4 mr-1" />
                  Sector
                </label>
                <Select value={sectorId} onValueChange={setSectorId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All sectors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sectors</SelectItem>
                    {sectors.map((sector) => (
                      <SelectItem key={sector.id} value={sector.id}>
                        {sector.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Marketer Filter */}
              {showMarketerInfo && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    Marketer
                  </label>
                  <Select value={bdId} onValueChange={setBdId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="All marketers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All marketers</SelectItem>
                      {marketers.map((marketer) => (
                        <SelectItem key={marketer.id} value={marketer.id}>
                          {marketer.firstName} {marketer.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Clear Filters */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">&nbsp;</label>
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="h-10 w-full"
                  disabled={!hasActiveFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
