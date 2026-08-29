"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Orientation, PlayableElement, ProjectData, TemplateId } from "@/types/project";
import { ProjectDataSchema } from "@/types/project";
import { createDefaultProjectData } from "@/lib/project-defaults";
import { ensureParkingRounds, syncParkingRound } from "@/playable-runtime/engines/parking-jam/layout";
import { ensureMatchRounds, propagateMatchFoods, syncMatchRound } from "@/playable-runtime/engines/triple-match/rounds";
import { ensureLaneRounds, syncLaneRound } from "@/playable-runtime/engines/lane-runner/rounds";

export type EditorStage = "start" | "gameplay" | "end";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

type HistoryEntry = ProjectData;

function cloneData(data: ProjectData): ProjectData {
  return JSON.parse(JSON.stringify(data)) as ProjectData;
}

function activeRoundCount(templateId: TemplateId, data: ProjectData) {
  if (templateId === "triple-match") return data.gameplay.tripleMatch.rounds.length;
  if (templateId === "parking-jam") return data.gameplay.parkingJam.rounds.length;
  if (templateId === "lane-runner") return data.gameplay.laneRunner.rounds.length;
  return 1;
}

type EditorState = {
  projectId: string;
  projectName: string;
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

  hydrate: (payload: {
    projectId: string;
    projectName: string;
    templateId: TemplateId;
    data: ProjectData;
    defaultOrientation: Orientation;
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
  getStageElements: () => PlayableElement[];
  getSelectedElement: () => PlayableElement | null;
};

function findElements(data: ProjectData, stage: EditorStage): PlayableElement[] {
  if (stage === "start") return data.startScreen.elements;
  if (stage === "end") return data.endScreen.elements;
  return data.gameplay.overlays;
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    projectId: "",
    projectName: "",
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

    hydrate: (payload) =>
      set((state) => {
        state.projectId = payload.projectId;
        state.projectName = payload.projectName;
        state.templateId = payload.templateId;
        const parsed = ProjectDataSchema.safeParse(payload.data);
        state.data = parsed.success ? parsed.data : payload.data;
        const jam = state.data.gameplay.parkingJam;
        ensureParkingRounds(jam);
        state.parkingRoundIndex = 0;
        syncParkingRound(jam, 0);
        if (payload.templateId === "triple-match") {
          const match = state.data.gameplay.tripleMatch;
          ensureMatchRounds(match);
          propagateMatchFoods(match);
          syncMatchRound(match, 0);
        }
        if (payload.templateId === "lane-runner") {
          const runner = state.data.gameplay.laneRunner;
          ensureLaneRounds(runner); // also unifies winDistance across all rounds
          syncLaneRound(runner, 0);
        }
        state.orientation = payload.defaultOrientation;
        state.hydrated = true;
        state.past = [];
        state.future = [];
        state.selectedElementId = null;
        state.stage = "start";
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
      get().updateData((draft) => {
        const elements = findElements(draft, get().stage);
        const el = elements.find((e) => e.id === elementId);
        if (el && !el.permanentlyLocked) updater(el);
      }, recordHistory);
    },

    updateElementLayout: (elementId, orientation, patch, recordHistory = true) => {
      get().updateElement(
        elementId,
        (el) => {
          Object.assign(el.layout[orientation], patch);
        },
        recordHistory,
      );
    },

    getStageElements: () => findElements(get().data, get().stage),

    getSelectedElement: () => {
      const id = get().selectedElementId;
      if (!id) return null;
      return findElements(get().data, get().stage).find((e) => e.id === id) || null;
    },
  })),
);
