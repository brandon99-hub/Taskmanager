import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Lock, Eye } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-2xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            <span className="text-blue-600">AppKings</span> Access Portal
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Secure role-based access to AppKings internal systems. Please log in with your company credentials.
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'} 
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl"
            data-testid="button-login"
          >
            Sign In to Continue
          </Button>
        </div>

        {/* Role Information */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="text-center">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg w-fit mx-auto mb-2">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-gray-900 dark:text-gray-100">Admin</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Full system control and management
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="text-center">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg w-fit mx-auto mb-2">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle className="text-gray-900 dark:text-gray-100">Manager</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Assign tasks and view team progress
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="text-center">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg w-fit mx-auto mb-2">
                <Lock className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle className="text-gray-900 dark:text-gray-100">Employee</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Update tasks and view assignments
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="text-center">
              <div className="bg-gray-100 dark:bg-gray-700/30 p-3 rounded-lg w-fit mx-auto mb-2">
                <Eye className="w-6 h-6 text-gray-600" />
              </div>
              <CardTitle className="text-gray-900 dark:text-gray-100">Viewer</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Read-only access for management
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Company Info */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0 text-white max-w-xl mx-auto">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-2">AppKings Internal Portal</h2>
              <p className="text-blue-100 mb-4">
                Secure access to company resources and systems
              </p>
              <p className="text-sm text-blue-200">
                If you need help accessing your account, please contact your administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}