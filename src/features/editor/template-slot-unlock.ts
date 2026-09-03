"use client";

import { toast } from "sonner";
import { useEditorStore } from "@/features/editor/store";
import type { ProjectData } from "@/types/project";

export async function persistTemplateSlotUnlock(slotId: string, unlocked: boolean) {
  const state = useEditorStore.getState();
  const previous = [...state.unlockedSlotIds];
  const next = unlocked
    ? Array.from(new Set([...previous, slotId]))
    : previous.filter((id) => id !== slotId);
  state.setUnlockedSlotIds(next);

  if (!state.projectId || !state.variationId) return;

  try {
    const res = await fetch(
      `/api/projects/${state.projectId}/variations/${state.variationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectData: state.data,
          overrides: { unlockedSlotIds: next },
        }),
      },
    );
    if (!res.ok) {
      toast.error("Failed to update template lock");
      state.setUnlockedSlotIds(previous);
      return;
    }
    const payload = (await res.json()) as {
      resolved: ProjectData;
      variation: { overrides?: { unlockedSlotIds?: string[] } };
    };
    if (!unlocked && payload.resolved) {
      const selected = state.selectedElementId;
      state.applyBrand({
        brandId: state.brandId,
        brandName: state.brandName,
        data: payload.resolved,
        unlockedSlotIds: payload.variation.overrides?.unlockedSlotIds ?? next,
      });
      if (selected) state.selectElement(selected);
    }
  } catch {
    toast.error("Failed to update template lock");
    state.setUnlockedSlotIds(previous);
  }
}
