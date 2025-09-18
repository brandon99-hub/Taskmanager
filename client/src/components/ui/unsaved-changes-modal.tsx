import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Save, X, ArrowLeft } from "lucide-react";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiscard: () => void;
  isEditMode?: boolean;
  isSaving?: boolean;
}

export default function UnsavedChangesModal({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  isEditMode = false,
  isSaving = false
}: UnsavedChangesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg border-0 shadow-2xl">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 -m-6 mb-0 p-6 rounded-t-lg">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center shadow-sm">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold text-gray-900 mb-2">
                  Unsaved Changes Detected
                </DialogTitle>
                <DialogDescription className="text-base text-gray-700">
                  {isEditMode 
                    ? 'You have unsaved changes to this project. Choose what you\'d like to do with your work.'
                    : 'You have unsaved changes. Choose what you\'d like to do with your work.'
                  }
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content area */}
        <div className="px-6 py-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Your progress will be lost
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {isEditMode 
                    ? 'All recent edits to milestones, subtasks, modules, and project details will be permanently discarded if you close without saving.'
                    : 'All recent changes will be permanently discarded if you close without saving.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with improved button layout */}
        <DialogFooter className="px-6 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-none order-3 sm:order-1 border-gray-300 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Keep Editing
            </Button>
            
            <div className="flex flex-col sm:flex-row gap-3 flex-1 order-1 sm:order-2">
              <Button
                variant="destructive"
                onClick={onDiscard}
                disabled={isSaving}
                className="flex-1 bg-red-500 hover:bg-red-600 border-red-500 hover:border-red-600"
              >
                <X className="w-4 h-4 mr-2" />
                Discard Changes
              </Button>
              
              <Button
                onClick={onSave}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0 shadow-lg"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
