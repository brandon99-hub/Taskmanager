import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText, Save, Edit, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProjectCharter {
  id?: string;
  projectId: string;
  projectObjectives: string;
  successCriteria: string;
  riskAssessment: string;
  stakeholderList: string;
  businessCase: string;
  scopeStatement: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProjectCharterProps {
  projectId: string;
  charter: ProjectCharter | null;
  onSave: (charter: Partial<ProjectCharter>) => Promise<void>;
  isReadOnly?: boolean;
}

export default function ProjectCharter({ 
  projectId, 
  charter, 
  onSave, 
  isReadOnly = false 
}: ProjectCharterProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<ProjectCharter>>({
    projectObjectives: '',
    successCriteria: '',
    riskAssessment: '',
    stakeholderList: '',
    businessCase: '',
    scopeStatement: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (charter) {
      setFormData({
        projectObjectives: charter.projectObjectives || '',
        successCriteria: charter.successCriteria || '',
        riskAssessment: charter.riskAssessment || '',
        stakeholderList: charter.stakeholderList || '',
        businessCase: charter.businessCase || '',
        scopeStatement: charter.scopeStatement || '',
      });
    }
  }, [charter]);

  const handleInputChange = (field: keyof ProjectCharter, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.projectObjectives?.trim()) {
      toast({
        title: "Error",
        description: "Project objectives are required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Project charter saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save project charter",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (charter) {
      setFormData({
        projectObjectives: charter.projectObjectives || '',
        successCriteria: charter.successCriteria || '',
        riskAssessment: charter.riskAssessment || '',
        stakeholderList: charter.stakeholderList || '',
        businessCase: charter.businessCase || '',
        scopeStatement: charter.scopeStatement || '',
      });
    } else {
      setFormData({
        projectObjectives: '',
        successCriteria: '',
        riskAssessment: '',
        stakeholderList: '',
        businessCase: '',
        scopeStatement: '',
      });
    }
    setIsEditing(false);
  };

  const hasContent = charter && (
    charter.projectObjectives ||
    charter.successCriteria ||
    charter.riskAssessment ||
    charter.stakeholderList ||
    charter.businessCase ||
    charter.scopeStatement
  );

  if (!hasContent && !isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Project Charter</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Charter</h3>
            <p className="text-gray-600 mb-4">
              Create a project charter to define objectives, success criteria, and project scope.
            </p>
            {!isReadOnly && (
              <Button onClick={() => setIsEditing(true)}>
                Create Project Charter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Project Charter</span>
            {charter && (
              <Badge variant="outline" className="ml-2">
                {charter.updatedAt ? 'Updated' : 'Created'}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {charter && !isEditing && !isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    'Saving...'
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Project Objectives */}
          <div className="space-y-2">
            <Label htmlFor="objectives" className="text-sm font-medium">
              Project Objectives *
            </Label>
            {isEditing ? (
              <Textarea
                id="objectives"
                placeholder="Define the main objectives and goals of this project..."
                value={formData.projectObjectives || ''}
                onChange={(e) => handleInputChange('projectObjectives', e.target.value)}
                rows={4}
                className="resize-none"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                {charter?.projectObjectives || 'No objectives defined'}
              </div>
            )}
          </div>

          {/* Success Criteria */}
          <div className="space-y-2">
            <Label htmlFor="criteria" className="text-sm font-medium">
              Success Criteria
            </Label>
            {isEditing ? (
              <Textarea
                id="criteria"
                placeholder="Define measurable success criteria for this project..."
                value={formData.successCriteria || ''}
                onChange={(e) => handleInputChange('successCriteria', e.target.value)}
                rows={3}
                className="resize-none"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                {charter?.successCriteria || 'No success criteria defined'}
              </div>
            )}
          </div>

          {/* Business Case */}
          <div className="space-y-2">
            <Label htmlFor="businessCase" className="text-sm font-medium">
              Business Case
            </Label>
            {isEditing ? (
              <Textarea
                id="businessCase"
                placeholder="Describe the business justification for this project..."
                value={formData.businessCase || ''}
                onChange={(e) => handleInputChange('businessCase', e.target.value)}
                rows={3}
                className="resize-none"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                {charter?.businessCase || 'No business case defined'}
              </div>
            )}
          </div>

          {/* Scope Statement */}
          <div className="space-y-2">
            <Label htmlFor="scope" className="text-sm font-medium">
              Scope Statement
            </Label>
            {isEditing ? (
              <Textarea
                id="scope"
                placeholder="Define the project scope, what is included and excluded..."
                value={formData.scopeStatement || ''}
                onChange={(e) => handleInputChange('scopeStatement', e.target.value)}
                rows={3}
                className="resize-none"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                {charter?.scopeStatement || 'No scope statement defined'}
              </div>
            )}
          </div>

          {/* Risk Assessment */}
          <div className="space-y-2">
            <Label htmlFor="risks" className="text-sm font-medium">
              Risk Assessment
            </Label>
            {isEditing ? (
              <Textarea
                id="risks"
                placeholder="Identify potential risks and mitigation strategies..."
                value={formData.riskAssessment || ''}
                onChange={(e) => handleInputChange('riskAssessment', e.target.value)}
                rows={3}
                className="resize-none"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                {charter?.riskAssessment || 'No risk assessment defined'}
              </div>
            )}
          </div>

          {/* Stakeholder List */}
          <div className="space-y-2">
            <Label htmlFor="stakeholders" className="text-sm font-medium">
              Stakeholder List
            </Label>
            {isEditing ? (
              <Textarea
                id="stakeholders"
                placeholder="List key stakeholders and their roles in the project..."
                value={formData.stakeholderList || ''}
                onChange={(e) => handleInputChange('stakeholderList', e.target.value)}
                rows={3}
                className="resize-none"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                {charter?.stakeholderList || 'No stakeholders defined'}
              </div>
            )}
          </div>

          {/* Charter Status */}
          {charter && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center space-x-4">
                  {charter.createdAt && (
                    <span>Created: {new Date(charter.createdAt).toLocaleDateString()}</span>
                  )}
                  {charter.updatedAt && (
                    <span>Updated: {new Date(charter.updatedAt).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Charter Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
