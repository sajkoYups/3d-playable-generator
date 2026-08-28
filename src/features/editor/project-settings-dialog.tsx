"use client";

import { useEditorStore } from "@/features/editor/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { isValidHttpUrl } from "@/lib/utils";
import { toast } from "sonner";

export function ProjectSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useEditorStore((s) => s.data);
  const updateData = useEditorStore((s) => s.updateData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Store links</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>App Store URL</Label>
            <Input
              value={data.links.appStoreUrl}
              onChange={(e) =>
                updateData((draft) => {
                  draft.links.appStoreUrl = e.target.value;
                }, false)
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Google Play URL</Label>
            <Input
              value={data.links.googlePlayUrl}
              onChange={(e) =>
                updateData((draft) => {
                  draft.links.googlePlayUrl = e.target.value;
                }, false)
              }
            />
          </div>
          <Button
            onClick={() => {
              if (!isValidHttpUrl(data.links.appStoreUrl) || !isValidHttpUrl(data.links.googlePlayUrl)) {
                toast.error("Invalid URL format");
                return;
              }
              toast.success("Links updated");
              onOpenChange(false);
            }}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
