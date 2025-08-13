import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Calendar, TrendingUp, CheckCircle, Clock } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light/20 to-primary/5">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <BarChart3 className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">AppKings Dashboard</h1>
          </div>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Streamline your project management with powerful task allocation, 
            progress tracking, and team performance analytics.
          </p>
          <Button 
            size="lg" 
            className="px-8 py-3 text-lg bg-primary hover:bg-primary-dark"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login"
          >
            Get Started
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-lg w-fit">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Organize teams, assign roles, and track member workloads efficiently
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-success/10 rounded-lg w-fit">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle>Task Tracking</CardTitle>
              <CardDescription>
                Visual Kanban boards with drag-and-drop functionality for seamless workflow management
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-warning/10 rounded-lg w-fit">
                <Calendar className="h-8 w-8 text-warning" />
              </div>
              <CardTitle>Project Timelines</CardTitle>
              <CardDescription>
                Set deadlines, track progress, and never miss important project milestones
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-error/10 rounded-lg w-fit">
                <Clock className="h-8 w-8 text-error" />
              </div>
              <CardTitle>Real-time Alerts</CardTitle>
              <CardDescription>
                Get notified about overdue tasks, upcoming deadlines, and project updates
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-lg w-fit">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>
                Track productivity metrics and generate detailed reports for better insights
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 p-3 bg-success/10 rounded-lg w-fit">
                <BarChart3 className="h-8 w-8 text-success" />
              </div>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>
                Export comprehensive reports and data in multiple formats for stakeholders
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="bg-primary text-white">
          <CardContent className="text-center py-12">
            <h2 className="text-3xl font-bold mb-4">Ready to boost your team's productivity?</h2>
            <p className="text-xl mb-6 text-primary-foreground/90">
              Join hundreds of teams already using AppKings Dashboard to streamline their projects.
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              className="px-8 py-3 text-lg"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-login-cta"
            >
              Start Your Free Trial
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
