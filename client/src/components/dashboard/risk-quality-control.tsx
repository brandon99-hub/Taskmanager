import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Shield, Clock, CheckCircle, Target, TrendingUp, BarChart, Table, AlertCircle, Activity } from "lucide-react";
import { useState } from "react";

export default function RiskQualityControl() {
  const auth = useAuth() as any;
  const { user, getDashboardType } = auth;
  const dashboardType = getDashboardType();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  // Show risk & quality control for project managers
  const shouldShowRiskControl = () => {
    return dashboardType === 'project_manager' || 
           ['admin', 'manager'].includes(user?.role);
  };

  if (!shouldShowRiskControl()) {
    return null;
  }

  const { data: riskData, isLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/risk-quality', selectedYear, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear.toString());
      if (selectedMonth) params.append('month', selectedMonth.toString());
      
      const url = `/api/dashboard/risk-quality${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch risk quality data');
      }
      
      return response.json();
    },
    enabled: !!user,
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const data = riskData || {
    slaMetrics: {
      overallSlaCompliance: 0,
      averageResponseTime: 0,
      criticalIssuesResolved: 0,
      qualityScore: 0
    },
    supportProjects: [],
    riskTrends: []
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`;
  };

  const formatTime = (hours: number) => {
    return `${hours.toFixed(1)} hrs`;
  };

  const getSlaStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'compliant': return 'text-green-700 bg-green-100 border-green-200';
      case 'warning': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'breach': return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low': return 'text-green-700 bg-green-100 border-green-200';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'high': return 'text-red-700 bg-red-100 border-red-200';
      case 'critical': return 'text-red-800 bg-red-200 border-red-300';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getQualityStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    return '★'.repeat(fullStars) + (hasHalfStar ? '☆' : '') + '☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0));
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Management & Quality Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-48 bg-gray-200 rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-6 w-6 text-blue-600" />
              Risk Management & Quality Control
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              SLA compliance and support project management for {selectedYear}
              {selectedMonth ? ` - ${months.find(m => m.value === selectedMonth)?.label}` : ''}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={selectedMonth?.toString() || 'all'} 
              onValueChange={(value) => setSelectedMonth(value === 'all' ? undefined : parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-8">
        {/* Support Projects & SLA Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
              <Activity className="h-5 w-5 text-blue-600" />
              Support Projects & SLA Status
              {selectedMonth && (
                <span className="text-sm font-normal text-gray-600">
                  - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                </span>
              )}
            </h3>
            
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    viewMode === 'table' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Table className="h-4 w-4" />
                  Table
                </button>
                <button
                  onClick={() => setViewMode('chart')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    viewMode === 'chart' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BarChart className="h-4 w-4" />
                  Trends
                </button>
              </div>
            </div>
          </div>
          
          {!data.supportProjects || data.supportProjects.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No support projects found</p>
                  <p className="text-sm">Support projects and SLA tracking will appear here once projects are on support phase.</p>
                </div>
              </CardContent>
            </Card>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-700 bg-gray-50">Project</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-green-50">SLA Status</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-blue-50">Response Time</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-orange-50">Issues</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-purple-50">Quality</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-red-50">Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {data.supportProjects.map((project: any, index: number) => (
                    <tr key={project.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 border-b border-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">{project.name}</p>
                          <p className="text-sm text-gray-500">{project.client}</p>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <Badge 
                          variant="outline" 
                          className={`${getSlaStatusColor(project.slaStatus)} border`}
                        >
                          {project.slaStatus.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <span className="text-sm font-medium">{project.responseTime}</span>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <div className="text-sm">
                          <span className="text-red-600 font-medium">{project.issuesOpen} open</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-green-600">{project.issuesResolved} resolved</span>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <div className="text-sm">
                          <div className="text-yellow-500 text-lg">{getQualityStars(project.qualityRating)}</div>
                          <span className="text-gray-600">{project.qualityRating}/5.0</span>
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-100 text-center">
                        <Badge 
                          variant="outline"
                          className={`${getRiskLevelColor(project.riskLevel)} border text-xs`}
                        >
                          {project.riskLevel.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // Risk Trends Chart View
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Risk Trends Chart Coming Soon</p>
                  <p className="text-sm">Visual risk trend analysis will be available once more data is collected.</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Switch to Table view to see current support project status.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  );
}