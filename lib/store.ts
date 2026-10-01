"use client";

import { create } from "zustand";

/** Client UI state shared across the shell. */
interface UiState {
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  mandateView: "board" | "table";
  setMandateView: (v: "board" | "table") => void;
  propertyView: "map" | "list";
  setPropertyView: (v: "map" | "list") => void;
  /** Breadcrumb labels for dynamic segments, keyed by segment value. */
  crumbs: Record<string, string>;
  setCrumb: (segment: string, label: string) => void;
}

export const useUi = create<UiState>((set) => ({
  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  mandateView: "board",
  setMandateView: (mandateView) => set({ mandateView }),
  propertyView: "list",
  setPropertyView: (propertyView) => set({ propertyView }),
  crumbs: {},
  setCrumb: (segment, label) => set((s) => (s.crumbs[segment] === label ? s : { crumbs: { ...s.crumbs, [segment]: label } })),
}));
