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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle>Unsaved Changes</DialogTitle>
              <DialogDescription>
                {isEditMode 
                  ? 'You have unsaved changes to this project.'
                  : 'You have unsaved changes.'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 mb-1">
                Your progress will be lost
              </p>
              <p className="text-xs text-amber-700">
                {isEditMode 
                  ? 'All recent edits to milestones, subtasks, modules, and project details will be permanently discarded if you close without saving.'
                  : 'All recent changes will be permanently discarded if you close without saving.'
                }
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Keep Editing
          </Button>
          <Button variant="destructive" onClick={onDiscard} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Discard
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}