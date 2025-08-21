import { useEffect, useState } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Target, 
  Activity,
  CheckCircle,
  Loader2
} from "lucide-react";

interface DataSource {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'loading' | 'ready' | 'error';
  progress: number;
}

export default function ExecutiveLoading() {
  const [currentLoadingIndex, setCurrentLoadingIndex] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);

  const dataSources: DataSource[] = [
    { id: 'metrics', name: 'Metrics', icon: <BarChart3 className="h-6 w-6" />, status: 'loading', progress: 0 },
    { id: 'workload', name: 'Workload', icon: <Activity className="h-6 w-6" />, status: 'ready', progress: 100 },
    { id: 'invoice', name: 'Invoice', icon: <DollarSign className="h-6 w-6" />, status: 'ready', progress: 100 },
    { id: 'projects', name: 'Projects', icon: <Target className="h-6 w-6" />, status: 'ready', progress: 100 },
    { id: 'tasks', name: 'Tasks', icon: <TrendingUp className="h-6 w-6" />, status: 'ready', progress: 100 },
    { id: 'teams', name: 'Teams', icon: <Users className="h-6 w-6" />, status: 'ready', progress: 100 }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setOverallProgress(prev => {
        if (prev >= 100) return 100;
        return prev + Math.random() * 8 + 2; // More realistic progress
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentLoadingIndex < dataSources.length - 1) {
        setCurrentLoadingIndex(prev => prev + 1);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [currentLoadingIndex]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
            <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-50 animate-ping"></div>
                  <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-full p-4">
                    <BarChart3 className="h-12 w-12 text-white" />
                  </div>
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-3">
                Executive Dashboard
              </h1>
              <p className="text-xl text-slate-600 font-medium">
                Preparing your business insights...
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-slate-700">Overall Progress</span>
            <span className="text-2xl font-bold text-blue-600">{Math.round(overallProgress)}%</span>
          </div>
          <div className="relative">
            <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${overallProgress}%` }}
              >
                <div className="h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse rounded-full"></div>
          </div>
        </div>

        {/* Data Sources Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {dataSources.map((source, index) => (
            <div 
              key={source.id}
              className={`relative group transition-all duration-500 ${
                index <= currentLoadingIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/30 hover:shadow-2xl transition-all duration-300 hover:scale-105">
                <div className="flex items-center justify-center mb-4">
                  {source.status === 'loading' ? (
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-50 animate-ping"></div>
                      <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-full p-3">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      </div>
                    </div>
                  ) : source.status === 'ready' ? (
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-full p-3 shadow-lg">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-full p-3">
                      <div className="h-6 w-6 text-white">!</div>
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
                  {source.name}
                </h3>
                
                <div className="text-center">
                  {source.status === 'loading' ? (
                    <div className="space-y-2">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
                      </div>
                      <span className="text-sm text-slate-600 font-medium">Loading...</span>
                    </div>
                  ) : (
                    <span className="text-sm text-green-600 font-medium">Ready</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20 inline-block">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-slate-600 font-medium">Initializing dashboard components...</span>
            </div>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-20 w-40 h-40 bg-gradient-to-r from-indigo-400/20 to-pink-400/20 rounded-full blur-3xl animate-float-delayed"></div>
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-r from-green-400/20 to-blue-400/20 rounded-full blur-2xl animate-float-slow"></div>
        </div>
      </div>
    </div>
  );
}
