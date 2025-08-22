import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Calendar, Target, ArrowUpRight, ArrowDownRight, BarChart, Table } from "lucide-react";
import { useState } from "react";
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Line, 
  Legend,
  Area,
  ComposedChart
} from 'recharts';

export default function InvoiceReport() {
  const auth = useAuth() as any;
  const { user } = auth;

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [segmentViewMode, setSegmentViewMode] = useState<'table' | 'chart'>('table');
  const [performanceViewMode, setPerformanceViewMode] = useState<'table' | 'chart'>('table');

  // Only show for managers and admins
  if (!['admin', 'manager'].includes(user?.role)) {
    return null;
  }

  const { data: invoiceData, isLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/invoice-report', selectedYear, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear.toString());
      if (selectedMonth) params.append('month', selectedMonth.toString());
      
      const url = `/api/dashboard/invoice-report${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch invoice report');
      
      const data = await response.json();
      return data;
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

  // Use real data from API, with fallback for empty state
  const data = invoiceData || {
    year: selectedYear,
    month: selectedMonth,
    monthlyTargets: { academic: 0, parastals: 0, private: 0, total: 0 },
    actualCollections: { academic: 0, parastals: 0, private: 0, total: 0 },
    segmentBreakdown: [],
    monthlyTrend: []
  };



  // Ensure we have the correct data structure
  const safeData = {
    monthlyTargets: {
      academic: data.monthlyTargets?.academic || 0,
      parastals: data.monthlyTargets?.parastals || 0,
      private: data.monthlyTargets?.private || 0,
      total: data.monthlyTargets?.total || 0
    },
    actualCollections: {
      academic: data.actualCollections?.academic || 0,
      parastals: data.actualCollections?.parastals || 0,
      private: data.actualCollections?.private || 0,
      total: data.actualCollections?.total || 0
    },
    segmentBreakdown: data.segmentBreakdown || [],
    monthlyTrend: data.monthlyTrend || []
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSegmentColor = (segment: string) => {
    switch (segment.toLowerCase()) {
      case 'academic': return 'bg-blue-500';
      case 'parastals': return 'bg-green-500';
      case 'private': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getSegmentIcon = (segment: string) => {
    switch (segment.toLowerCase()) {
      case 'academic': return '🎓';
      case 'parastals': return '🏛️';
      case 'private': return '💼';
      default: return '📊';
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Invoice Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-32 bg-gray-200 rounded-lg"></div>
            <div className="h-48 bg-gray-200 rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }



  // Calculate metrics based on whether month filter is applied
  const isMonthFiltered = selectedMonth !== undefined;
  
  // Get the specific month's data when filter is applied
  const filteredMonthData = isMonthFiltered && data.monthlyTrend.length > 0 
    ? data.monthlyTrend.find((month: any) => {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = monthNames.findIndex(name => month.month.includes(name));
        return monthIndex + 1 === selectedMonth;
      })
    : null;

  // Use filtered month data or yearly totals from monthlyTrend for consistency
  const targetAmount = isMonthFiltered && filteredMonthData 
    ? filteredMonthData.expected || 0
    : safeData.monthlyTrend.reduce((sum: number, month: any) => sum + (month.expected || 0), 0);
    
  const actualAmount = isMonthFiltered && filteredMonthData 
    ? filteredMonthData.paid || 0
    : safeData.monthlyTrend.reduce((sum: number, month: any) => sum + (month.paid || 0), 0);

  const achievementRate = targetAmount > 0 
    ? Math.round((actualAmount / targetAmount) * 100) 
    : 0;
  
  const pendingAmount = targetAmount - actualAmount;
  const isOnTrack = achievementRate >= 80;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart className="h-6 w-6 text-blue-600" />
            Invoice Report & Monthly Targets
          </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Financial performance overview for {selectedYear}
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
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-700">
                  {isMonthFiltered ? 'Monthly Target' : 'Yearly Target'}
                </p>
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-900 mb-1">
                {formatCurrency(targetAmount)}
              </p>
              <p className="text-sm text-blue-600">
                {isMonthFiltered 
                  ? `Target for ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
                  : `Set target for ${selectedYear}`
                }
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-green-500 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-green-700">
                  {isMonthFiltered ? 'Monthly Collections' : 'Yearly Collections'}
                </p>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-900 mb-1">
                {formatCurrency(actualAmount)}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-600">
                  {achievementRate}% of {isMonthFiltered ? 'monthly' : 'yearly'} target
                </span>
                {isOnTrack ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-orange-500 bg-orange-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-orange-700">
                  {isMonthFiltered ? 'Monthly Pending' : 'Yearly Pending'}
                </p>
                <BarChart className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-orange-900 mb-1">
                {formatCurrency(pendingAmount)}
              </p>
              <p className="text-sm text-orange-600">
                {isMonthFiltered 
                  ? `Amount yet to be collected in ${months.find(m => m.value === selectedMonth)?.label}`
                  : 'Amount yet to be collected this year'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Segment Performance */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                              <BarChart className="h-5 w-5 text-blue-600" />
              Monthly Segment Breakdown
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
                  onClick={() => setSegmentViewMode('table')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    segmentViewMode === 'table' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Table className="h-4 w-4" />
                  Table
                </button>
                <button
                  onClick={() => setSegmentViewMode('chart')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    segmentViewMode === 'chart' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BarChart className="h-4 w-4" />
                  Chart
                </button>
              </div>
            </div>
          </div>
          
          {!safeData.monthlyTrend || safeData.monthlyTrend.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-500">
                  <BarChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No monthly data available</p>
                  <p className="text-sm">Monthly segment breakdown will appear here once data is available.</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Debug: monthlyTrend length = {safeData.monthlyTrend?.length || 0}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : segmentViewMode === 'table' ? (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-700 bg-gray-50">Month</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-blue-50">Academic</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-green-50">Parastals</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-purple-50">Private</th>
                    <th className="text-center p-3 font-semibold text-gray-700 bg-gray-100">Monthly Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Show only selected month if month filter is applied, otherwise show all months */}
                  {(selectedMonth ? safeData.monthlyTrend.filter((month: any) => {
                    // Extract month number from month name and compare with selected month
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                      'July', 'August', 'September', 'October', 'November', 'December'];
                    const monthIndex = monthNames.findIndex(name => month.month.includes(name));
                    return monthIndex + 1 === selectedMonth;
                  }) : safeData.monthlyTrend).map((month: any) => {
                    // Use real data from API
                    const academicValue = month.academic || 0;
                    const parastalsValue = month.parastals || 0;
                    const privateValue = month.private || 0;
                    const monthlyTotal = academicValue + parastalsValue + privateValue;
                    
                    return (
                      <tr key={month.month} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">
                          {month.month}
                        </td>
                        <td className="p-3 text-center">
                          <div className="space-y-1">
                            <p className="font-semibold text-blue-900">{formatCurrency(academicValue)}</p>
                            <p className="text-xs text-blue-600">
                              {month.expected > 0 ? Math.round((academicValue / month.expected) * 100) : 0}% of target
                            </p>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="space-y-1">
                            <p className="font-semibold text-green-900">{formatCurrency(parastalsValue)}</p>
                            <p className="text-xs text-green-600">
                              {month.expected > 0 ? Math.round((parastalsValue / month.expected) * 100) : 0}% of target
                            </p>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="space-y-1">
                            <p className="font-semibold text-purple-900">{formatCurrency(privateValue)}</p>
                            <p className="text-xs text-purple-600">
                              {month.expected > 0 ? Math.round((privateValue / month.expected) * 100) : 0}% of target
                            </p>
                          </div>
                        </td>
                        <td className="p-3 text-center bg-gray-50">
                          <div className="space-y-1">
                            <p className="font-bold text-gray-900 text-lg">{formatCurrency(monthlyTotal)}</p>
                            <p className="text-xs text-gray-600">
                              {month.expected > 0 ? Math.round((monthlyTotal / month.expected) * 100) : 0}% of target
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Yearly Totals Row - Only show when no month filter is applied */}
                  {!selectedMonth && (
                    <tr className="border-t-2 border-gray-300 bg-gray-100">
                      <td className="p-3 font-bold text-gray-900 text-lg">Yearly Total</td>
                      <td className="p-3 text-center">
                        <p className="font-bold text-blue-900 text-lg">
                          {formatCurrency(safeData.monthlyTrend.reduce((sum: number, month: any) => sum + (month.academic || 0), 0))}
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <p className="font-bold text-green-900 text-lg">
                          {formatCurrency(safeData.monthlyTrend.reduce((sum: number, month: any) => sum + (month.parastals || 0), 0))}
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <p className="font-bold text-purple-900 text-lg">
                          {formatCurrency(safeData.monthlyTrend.reduce((sum: number, month: any) => sum + (month.private || 0), 0))}
                        </p>
                      </td>
                      <td className="p-3 text-center bg-gray-200">
                        <p className="font-bold text-gray-900 text-xl">
                          {formatCurrency(safeData.monthlyTrend.reduce((sum: number, month: any) => sum + (month.academic || 0) + (month.parastals || 0) + (month.private || 0), 0))}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Chart View - Single Smart Chart */
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-blue-50/30">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <BarChart className="h-5 w-5" />
                  Segment Performance Analysis
                </CardTitle>
                <CardDescription className="text-blue-100">
                  {selectedMonth 
                    ? `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear} - Collections by Segment`
                    : `${selectedYear} - Monthly Collections by Segment`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                                          data={selectedMonth 
                      ? safeData.monthlyTrend.filter((month: any) => {
                          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                            'July', 'August', 'September', 'October', 'November', 'December'];
                          const monthIndex = monthNames.findIndex(name => month.month.includes(name));
                          return monthIndex + 1 === selectedMonth;
                        })
                      : safeData.monthlyTrend
                      }
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="academicGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="parastalsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="privateGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: any) => {
                          const label = typeof name === 'string' ? name : '';
                          return [`${Number(value).toLocaleString()}`, label];
                        }}
                        labelFormatter={(label) => `Month: ${label}`}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                          backdropFilter: 'blur(10px)',
                          padding: '12px 16px'
                        }}
                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                      />
                      <Legend 
                        wrapperStyle={{
                          paddingTop: '20px',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      />
                      
                      {/* Stacked Bars for Segment Breakdown */}
                      <Bar 
                        dataKey="academic" 
                        stackId="a"
                        fill="url(#academicGradient)" 
                        name="Academic" 
                        radius={[6, 6, 0, 0]}
                        opacity={0.9}
                        animationDuration={1500}
                        animationBegin={0}
                      />
                      <Bar 
                        dataKey="parastals" 
                        stackId="a"
                        fill="url(#parastalsGradient)" 
                        name="Parastals" 
                        radius={[6, 6, 0, 0]}
                        opacity={0.9}
                        animationDuration={1500}
                        animationBegin={500}
                      />
                      <Bar 
                        dataKey="private" 
                        stackId="a"
                        fill="url(#privateGradient)" 
                        name="Private" 
                        radius={[6, 6, 0, 0]}
                        opacity={0.9}
                        animationDuration={1500}
                        animationBegin={1000}
                      />
                      
                      {/* Line for Total Monthly Trend */}
                      <Line 
                        type="monotone" 
                        dataKey={(dataPoint: any) => (dataPoint.academic || 0) + (dataPoint.parastals || 0) + (dataPoint.private || 0)}
                        stroke="#f59e0b" 
                        strokeWidth={3}
                        name="Total Monthly"
                        dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
                        strokeDasharray="5 5"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
              <Calendar className="h-5 w-5 text-blue-600" />
              Monthly Performance ({data.year})
            </h3>
            
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setPerformanceViewMode('table')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    performanceViewMode === 'table' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Table className="h-4 w-4" />
                  Table
                </button>
                <button
                  onClick={() => setPerformanceViewMode('chart')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                    performanceViewMode === 'chart' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BarChart className="h-4 w-4" />
                  Chart
                </button>
              </div>
            </div>
          </div>
            
          {performanceViewMode === 'table' ? (
            <div className="grid gap-3 max-h-80 overflow-y-auto">
              {data.monthlyTrend.map((month: any) => {
                                    const monthAchievement = month.expected > 0 ? Math.round((month.paid / month.expected) * 100) : 0;
                const isMonthOnTrack = monthAchievement >= 80;
                
                return (
                  <Card key={month.month} className="border border-gray-100 hover:border-gray-200 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            {/* Removed month abbreviation - just show month name */}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{month.month}</p>
                            <p className="text-xs text-gray-500">
                              Target: {formatCurrency(month.expected)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                                                      <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(month.paid)}
                            </p>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={isMonthOnTrack ? "default" : "secondary"}
                              className={isMonthOnTrack ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                            >
                              {monthAchievement}%
                            </Badge>
                            {isMonthOnTrack ? (
                              <ArrowUpRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Chart View - Single Smart Combined Chart */
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50/30">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-t-lg">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Monthly Performance & Achievement Analysis
                </CardTitle>
                <CardDescription className="text-indigo-100">
                  {selectedYear} - Target vs Actual Collections with Achievement Metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={data.monthlyTrend.map((month: any) => ({
                        ...month,
                                              achievement: month.expected > 0 ? Math.round((month.paid / month.expected) * 100) : 0,
                      gap: month.expected > 0 ? Math.max(0, month.expected - month.paid) : 0
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="targetGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="achievementGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis 
                        yAxisId="left"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickFormatter={(value) => `${value}%`}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <Tooltip 
                        formatter={(value: any, name: any) => {
                          const map: Record<string, string> = {
                            target: 'Target (KES)',
                            actual: 'Actual (KES)',
                            gap: 'Gap to Target (KES)',
                            achievement: 'Achievement %'
                          };
                          const label = map[String(name)] || String(name);
                          const formatted = name === 'achievement' 
                            ? `${Number(value)}%`
                            : `KSh ${Number(value).toLocaleString()}`;
                          return [formatted, label];
                        }}
                        labelFormatter={(label) => `Month: ${label}`}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                          backdropFilter: 'blur(10px)',
                          padding: '12px 16px'
                        }}
                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                      />
                      <Legend 
                        wrapperStyle={{
                          paddingTop: '20px',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      />
                      
                      {/* Target Area - BLUE for Target */}
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="target" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        fill="url(#targetGradient)"
                        name="Target"
                        fillOpacity={0.6}
                        animationDuration={2000}
                        animationBegin={0}
                      />
                      
                      {/* Actual Area - GREEN for Actual */}
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="actual" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        fill="url(#actualGradient)"
                        name="Actual"
                        fillOpacity={0.6}
                        animationDuration={2000}
                        animationBegin={500}
                      />
                      
                      {/* Achievement Bars - PURPLE for Performance Metrics */}
                      <Bar 
                        yAxisId="right"
                        dataKey="achievement" 
                        fill="url(#achievementGradient)" 
                        name="Achievement %" 
                        radius={[6, 6, 0, 0]}
                        maxBarSize={40}
                        opacity={0.8}
                        animationDuration={1500}
                        animationBegin={1000}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
