"use client";

import Link from "next/link";
import { useEditorStore } from "@/features/editor/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AssetUrlField } from "@/features/editor/asset-url-field";
import { isValidHttpUrl } from "@/lib/utils";
import { stampCoinImage } from "@/lib/project-defaults";
import { toast } from "sonner";
import { UNLOCK_COIN_SLOT_ID, UNLOCK_LINKS_SLOT_ID } from "@/types/project";
import { TemplateSlotUnlockControls } from "@/features/editor/template-slot-unlock-controls";
import { isPlayableTemplateLocked } from "@/features/editor/store";

export function ProjectSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useEditorStore((s) => s.data);
  const updateData = useEditorStore((s) => s.updateData);
  const editorMode = useEditorStore((s) => s.editorMode);
  const brandId = useEditorStore((s) => s.brandId);
  const brandName = useEditorStore((s) => s.brandName);
  const unlockedSlotIds = useEditorStore((s) => s.unlockedSlotIds);
  const liveLinked = editorMode === "playable" && Boolean(brandId);
  const linksLocked = isPlayableTemplateLocked(
    editorMode,
    brandId,
    unlockedSlotIds,
    UNLOCK_LINKS_SLOT_ID,
    "asset",
  );
  const coinLocked = isPlayableTemplateLocked(
    editorMode,
    brandId,
    unlockedSlotIds,
    UNLOCK_COIN_SLOT_ID,
    "asset",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Links & coin</DialogTitle>
        </DialogHeader>
        {liveLinked && (
          <p className="text-sm text-muted">
            Destinations come from{" "}
            <Link href={`/templates/${brandId}`} className="text-accent underline">
              {brandName || "the linked template"}
            </Link>
            . Edit them there so every variation updates, or customize on this playable.
          </p>
        )}
        <div className="space-y-3">
          {liveLinked && (
            <TemplateSlotUnlockControls
              slotId={UNLOCK_LINKS_SLOT_ID}
              unlocked={!linksLocked}
            />
          )}
          <div className="space-y-1">
            <Label>App Store URL</Label>
            <Input
              value={data.links.appStoreUrl}
              disabled={linksLocked}
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
              disabled={linksLocked}
              onChange={(e) =>
                updateData((draft) => {
                  draft.links.googlePlayUrl = e.target.value;
                }, false)
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Privacy policy URL</Label>
            <Input
              value={data.links.policyUrl}
              disabled={linksLocked}
              placeholder="https://example.com/privacy"
              onChange={(e) =>
                updateData((draft) => {
                  draft.links.policyUrl = e.target.value;
                }, false)
              }
            />
            <p className="text-[11px] text-muted">Used by the optional Privacy Policy link on the end card.</p>
          </div>
          {liveLinked && (
            <TemplateSlotUnlockControls
              slotId={UNLOCK_COIN_SLOT_ID}
              unlocked={!coinLocked}
            />
          )}
          {coinLocked ? (
            <p className="text-xs text-muted">
              Coin art also comes from the template.
            </p>
          ) : (
            <AssetUrlField
              label="Coin icon"
              accept="image/*"
              value={data.coinImageUrl}
              onChange={(url) => updateData((draft) => stampCoinImage(draft, url))}
            />
          )}
          <Button
            onClick={() => {
              if (
                !isValidHttpUrl(data.links.appStoreUrl) ||
                !isValidHttpUrl(data.links.googlePlayUrl) ||
                !isValidHttpUrl(data.links.policyUrl)
              ) {
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
