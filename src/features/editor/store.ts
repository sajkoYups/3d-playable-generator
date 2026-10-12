"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Orientation, PlayableElement, ProjectData, TemplateId } from "@/types/project";
import { BRAND_LOGO_SLOT_IDS, END_POLICY_SLOT_ID, isBrandSlotId, isOverridableSlotId, ProjectDataSchema } from "@/types/project";
import { createDefaultProjectData, createEndPolicyElement, ensureAppBrandLayers, ensureParking2DChrome, ensureTripleMatchKitchenChrome, ensureWaterSortChrome } from "@/lib/project-defaults";
import { ensureParkingRounds, syncParkingRound } from "@/playable-runtime/engines/parking-jam/layout";
import { ensureMatchRounds, propagateMatchFoods, syncMatchRound } from "@/playable-runtime/engines/triple-match/rounds";
import { ensureLaneRounds, syncLaneRound } from "@/playable-runtime/engines/lane-runner/rounds";
import { ensureTdRounds } from "@/playable-runtime/engines/tower-defense/rounds";
import { ensureStackRounds, syncStackRound } from "@/playable-runtime/engines/stack-tower/rounds";
import { ensureWaterSortRounds } from "@/playable-runtime/engines/water-sort/rounds";

export type EditorStage = "start" | "gameplay" | "end";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type EditorMode = "playable" | "brand";

type HistoryEntry = ProjectData;

function cloneData(data: ProjectData): ProjectData {
  return JSON.parse(JSON.stringify(data)) as ProjectData;
}

function activeRoundCount(templateId: TemplateId, data: ProjectData) {
  if (templateId === "triple-match") return data.gameplay.tripleMatch.rounds.length;
  if (templateId === "parking-jam") return data.gameplay.parkingJam.rounds.length;
  if (templateId === "parking-2d") return data.gameplay.parking2d.rounds.length;
  if (templateId === "lane-runner") return data.gameplay.laneRunner.rounds.length;
  if (templateId === "tower-defense") return data.gameplay.towerDefense.rounds.length;
  if (templateId === "stack-tower") return data.gameplay.stackTower.rounds.length;
  if (templateId === "solitaire") return data.gameplay.solitaire.rounds.length;
  if (templateId === "domino") return data.gameplay.domino.rounds.length;
  if (templateId === "tappy-plane") return data.gameplay.tappyPlane.rounds.length;
  if (templateId === "racing-lap") return data.gameplay.racingLap.rounds.length;
  if (templateId === "top-down-shooter") return data.gameplay.topDownShooter.rounds.length;
  if (templateId === "water-sort") return data.gameplay.waterSort.rounds.length || data.gameplay.waterSort.roundsToWin || 1;
  return 1;
}

type EditorState = {
  projectId: string;
  variationId: string;
  projectName: string;
  galleryName: string;
  templateId: TemplateId;
  data: ProjectData;
  stage: EditorStage;
  orientation: Orientation;
  selectedElementId: string | null;
  saveStatus: SaveStatus;
  past: HistoryEntry[];
  future: HistoryEntry[];
  hydrated: boolean;
  parkingRoundIndex: number;
  brandId: string | null;
  brandName: string | null;
  appBrandId: string | null;
  appBrandName: string | null;
  editorMode: EditorMode;
  unlockedSlotIds: string[];

  hydrate: (payload: {
    projectId: string;
    variationId?: string;
    projectName: string;
    galleryName?: string;
    templateId: TemplateId;
    data: ProjectData;
    defaultOrientation: Orientation;
    brandId?: string | null;
    brandName?: string | null;
    appBrandId?: string | null;
    appBrandName?: string | null;
    editorMode?: EditorMode;
    unlockedSlotIds?: string[];
  }) => void;
  applyBrand: (payload: {
    brandId: string | null;
    brandName: string | null;
    data: ProjectData;
    unlockedSlotIds?: string[];
  }) => void;
  applyAppBrand: (payload: {
    appBrandId: string | null;
    appBrandName: string | null;
    data: ProjectData;
  }) => void;
  setStage: (stage: EditorStage) => void;
  setOrientation: (orientation: Orientation) => void;
  selectElement: (id: string | null) => void;
  setProjectName: (name: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  setParkingRoundIndex: (index: number) => void;
  updateData: (updater: (draft: ProjectData) => void, recordHistory?: boolean) => void;
  updateElement: (
    elementId: string,
    updater: (el: PlayableElement) => void,
    recordHistory?: boolean,
  ) => void;
  updateElementLayout: (
    elementId: string,
    orientation: Orientation,
    patch: Partial<PlayableElement["layout"]["portrait"]>,
    recordHistory?: boolean,
  ) => void;
  addEndPolicy: () => void;
  setUnlockedSlotIds: (ids: string[]) => void;
  getStageElements: () => PlayableElement[];
  getSelectedElement: () => PlayableElement | null;
};

function findElements(data: ProjectData, stage: EditorStage): PlayableElement[] {
  if (stage === "start") return data.startScreen.elements;
  if (stage === "end") return data.endScreen.elements;
  return data.gameplay.overlays;
}

function syncLogoSlots(data: ProjectData, imageUrl: string) {
  const lists = [data.startScreen.elements, data.endScreen.elements, data.gameplay.overlays];
  for (const list of lists) {
    for (const el of list) {
      if (BRAND_LOGO_SLOT_IDS.includes(el.id)) el.content.imageUrl = imageUrl;
    }
  }
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    projectId: "",
    variationId: "",
    projectName: "",
    galleryName: "",
    templateId: "stack-tower",
    data: createDefaultProjectData("stack-tower"),
    stage: "start",
    orientation: "portrait",
    selectedElementId: null,
    saveStatus: "idle",
    past: [],
    future: [],
    hydrated: false,
    parkingRoundIndex: 0,
    brandId: null,
    brandName: null,
    appBrandId: null,
    appBrandName: null,
    editorMode: "playable",
    unlockedSlotIds: [],

    hydrate: (payload) =>
      set((state) => {
        state.projectId = payload.projectId;
        state.variationId = payload.variationId ?? "";
        state.projectName = payload.projectName;
        state.galleryName = payload.galleryName ?? payload.projectName;
        state.templateId = payload.templateId;
        const parsed = ProjectDataSchema.safeParse(payload.data);
        state.data = ensureAppBrandLayers(parsed.success ? parsed.data : payload.data);
        const jam = state.data.gameplay.parkingJam;
        ensureParkingRounds(jam);
        state.parkingRoundIndex = 0;
        syncParkingRound(jam, 0);
        if (payload.templateId === "parking-2d") {
          const lot = state.data.gameplay.parking2d;
          ensureParkingRounds(lot);
          syncParkingRound(lot, 0);
          ensureParking2DChrome(state.data);
        }
        if (payload.templateId === "triple-match") {
          const match = state.data.gameplay.tripleMatch;
          ensureMatchRounds(match);
          propagateMatchFoods(match);
          syncMatchRound(match, 0);
          ensureTripleMatchKitchenChrome(state.data);
        }
        if (payload.templateId === "water-sort") {
          ensureWaterSortRounds(state.data.gameplay.waterSort);
          ensureWaterSortChrome(state.data);
        }
        if (payload.templateId === "lane-runner") {
          const runner = state.data.gameplay.laneRunner;
          ensureLaneRounds(runner); // also unifies winDistance across all rounds
          syncLaneRound(runner, 0);
        }
        if (payload.templateId === "tower-defense") {
          ensureTdRounds(state.data.gameplay.towerDefense);
        }
        if (payload.templateId === "stack-tower") {
          const tower = state.data.gameplay.stackTower;
          ensureStackRounds(tower);
          syncStackRound(tower, 0);
        }
        state.orientation = payload.defaultOrientation;
        state.hydrated = true;
        state.past = [];
        state.future = [];
        state.selectedElementId = null;
        state.stage = "start";
        state.brandId = payload.brandId ?? null;
        state.brandName = payload.brandName ?? null;
        state.appBrandId = payload.appBrandId ?? null;
        state.appBrandName = payload.appBrandName ?? null;
        state.editorMode = payload.editorMode ?? "playable";
        state.unlockedSlotIds = payload.unlockedSlotIds ?? [];
      }),

    applyBrand: (payload) =>
      set((state) => {
        const parsed = ProjectDataSchema.safeParse(payload.data);
        state.data = parsed.success ? parsed.data : payload.data;
        state.brandId = payload.brandId;
        state.brandName = payload.brandName;
        state.selectedElementId = null;
        state.past = [];
        state.future = [];
        state.saveStatus = "saved";
        state.unlockedSlotIds = payload.unlockedSlotIds ?? [];
      }),

    applyAppBrand: (payload) =>
      set((state) => {
        const parsed = ProjectDataSchema.safeParse(payload.data);
        state.data = parsed.success ? parsed.data : payload.data;
        state.appBrandId = payload.appBrandId;
        state.appBrandName = payload.appBrandName;
        state.selectedElementId = null;
        state.past = [];
        state.future = [];
        state.saveStatus = "saved";
      }),

    setStage: (stage) =>
      set((state) => {
        state.stage = stage;
        state.selectedElementId = null;
      }),

    setOrientation: (orientation) =>
      set((state) => {
        state.orientation = orientation;
      }),

    selectElement: (id) =>
      set((state) => {
        state.selectedElementId = id;
      }),

    setProjectName: (name) =>
      set((state) => {
        state.projectName = name;
      }),

    setSaveStatus: (status) =>
      set((state) => {
        state.saveStatus = status;
      }),

    setParkingRoundIndex: (index) =>
      set((state) => {
        const n = activeRoundCount(state.templateId, state.data);
        state.parkingRoundIndex = Math.max(0, Math.min(index, Math.max(0, n - 1)));
      }),

    pushHistory: () =>
      set((state) => {
        state.past.push(cloneData(state.data));
        if (state.past.length > 50) state.past.shift();
        state.future = [];
      }),

    undo: () =>
      set((state) => {
        const prev = state.past.pop();
        if (!prev) return;
        state.future.push(cloneData(state.data));
        state.data = prev;
        const n = activeRoundCount(state.templateId, state.data);
        state.parkingRoundIndex = Math.max(0, Math.min(state.parkingRoundIndex, Math.max(0, n - 1)));
      }),

    redo: () =>
      set((state) => {
        const next = state.future.pop();
        if (!next) return;
        state.past.push(cloneData(state.data));
        state.data = next;
        const n = activeRoundCount(state.templateId, state.data);
        state.parkingRoundIndex = Math.max(0, Math.min(state.parkingRoundIndex, Math.max(0, n - 1)));
      }),

    updateData: (updater, recordHistory = true) =>
      set((state) => {
        if (recordHistory) {
          state.past.push(cloneData(state.data));
          if (state.past.length > 50) state.past.shift();
          state.future = [];
        }
        updater(state.data);
      }),

    updateElement: (elementId, updater, recordHistory = true) => {
      const { editorMode, brandId, unlockedSlotIds } = get();
      const brandLocked =
        editorMode === "playable" &&
        Boolean(brandId) &&
        isBrandSlotId(elementId) &&
        !unlockedSlotIds.includes(elementId);
      get().updateData((draft) => {
        const elements = findElements(draft, get().stage);
        const el = elements.find((e) => e.id === elementId);
        if (!el || el.permanentlyLocked) return;
        if (brandLocked) {
          if (!isOverridableSlotId(elementId)) return;
          const snapshot = structuredClone(el);
          updater(el);
          const text = el.content.text;
          const color = el.content.color;
          const backgroundColor = el.style.backgroundColor;
          const textColor = el.style.textColor;
          el.content = snapshot.content;
          el.style = snapshot.style;
          el.layout = snapshot.layout;
          el.action = snapshot.action;
          el.content.text = text;
          el.content.color = color;
          el.style.backgroundColor = backgroundColor;
          el.style.textColor = textColor;
          return;
        }
        updater(el);
        if (editorMode === "brand" && BRAND_LOGO_SLOT_IDS.includes(elementId) && el.content.imageUrl) {
          syncLogoSlots(draft, el.content.imageUrl);
        }
      }, recordHistory);
    },

    updateElementLayout: (elementId, orientation, patch, recordHistory = true) => {
      const { editorMode, brandId, unlockedSlotIds } = get();
      if (
        editorMode === "playable" &&
        brandId &&
        isBrandSlotId(elementId) &&
        !unlockedSlotIds.includes(elementId)
      ) {
        return;
      }
      get().updateElement(
        elementId,
        (el) => {
          Object.assign(el.layout[orientation], patch);
        },
        recordHistory,
      );
    },

    addEndPolicy: () => {
      get().updateData((draft) => {
        const existing = draft.endScreen.elements.find((el) => el.id === END_POLICY_SLOT_ID);
        if (existing) {
          existing.layout.portrait.visible = true;
          existing.layout.landscape.visible = true;
          return;
        }
        draft.endScreen.elements.push(createEndPolicyElement());
      });
      get().setStage("end");
      get().selectElement(END_POLICY_SLOT_ID);
    },

    setUnlockedSlotIds: (ids) =>
      set((state) => {
        state.unlockedSlotIds = ids;
      }),

    getStageElements: () => findElements(get().data, get().stage),

    getSelectedElement: () => {
      const id = get().selectedElementId;
      if (!id) return null;
      return findElements(get().data, get().stage).find((e) => e.id === id) || null;
    },
  })),
);

/** Hidden from HUD editing; still present in data for older projects. Runtime also skips it. */
const HIDDEN_GAMEPLAY_OVERLAY_IDS = new Set(["gameplay-cta"]);

export function useStageElements(): PlayableElement[] {
  const stage = useEditorStore((s) => s.stage);
  const start = useEditorStore((s) => s.data.startScreen.elements);
  const end = useEditorStore((s) => s.data.endScreen.elements);
  const overlays = useEditorStore((s) => s.data.gameplay.overlays);
  return useMemo(() => {
    if (stage === "start") return start;
    if (stage === "end") return end;
    return overlays.filter((el) => !HIDDEN_GAMEPLAY_OVERLAY_IDS.has(el.id));
  }, [stage, start, end, overlays]);
}

export function useSelectedElement(): PlayableElement | null {
  const id = useEditorStore((s) => s.selectedElementId);
  const stage = useEditorStore((s) => s.stage);
  const start = useEditorStore((s) => s.data.startScreen.elements);
  const end = useEditorStore((s) => s.data.endScreen.elements);
  const overlays = useEditorStore((s) => s.data.gameplay.overlays);
  return useMemo(() => {
    if (!id) return null;
    const list = stage === "start" ? start : stage === "end" ? end : overlays;
    return list.find((e) => e.id === id) ?? null;
  }, [id, stage, start, end, overlays]);
}

export function isPlayableTemplateLocked(
  editorMode: EditorMode,
  brandId: string | null,
  unlockedSlotIds: string[],
  slotId: string,
  kind: "element" | "asset" = "element",
) {
  if (editorMode !== "playable" || !brandId) return false;
  if (kind === "element" && !isBrandSlotId(slotId)) return false;
  return !unlockedSlotIds.includes(slotId);
}
