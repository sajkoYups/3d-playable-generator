"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Orientation, PlayableElement, ProjectData, TemplateId } from "@/types/project";
import { ProjectDataSchema } from "@/types/project";
import { createDefaultProjectData } from "@/lib/project-defaults";
import { repairParkingCars } from "@/playable-runtime/engines/parking-jam/layout";

export type EditorStage = "start" | "gameplay" | "end";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

type HistoryEntry = ProjectData;

function cloneData(data: ProjectData): ProjectData {
  return JSON.parse(JSON.stringify(data)) as ProjectData;
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

    hydrate: (payload) =>
      set((state) => {
        state.projectId = payload.projectId;
        state.projectName = payload.projectName;
        state.templateId = payload.templateId;
        const parsed = ProjectDataSchema.safeParse(payload.data);
        state.data = parsed.success ? parsed.data : payload.data;
        const jam = state.data.gameplay.parkingJam;
        jam.cars = repairParkingCars(jam.cars, jam.gridCols, jam.gridRows);
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
      }),

    redo: () =>
      set((state) => {
        const next = state.future.pop();
        if (!next) return;
        state.past.push(cloneData(state.data));
        state.data = next;
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
