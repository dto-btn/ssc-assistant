/**
 * Memory slice for playground.
 *
 * Manages per-user opt-in memory state: consent flag, memory graph data
 * (nodes + edges in cytoscape format), and async operation status.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface MemoryNode {
  data: {
    id: string;
    label: string;
    type: string;
    text: string;
  };
}

export interface MemoryEdge {
  data: {
    id: string;
    source: string;
    target: string;
    label: string;
  };
}

export interface MemoryGraphData {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

export interface MemoryState {
  consentOptIn: boolean;
  consentVersion: string | null;
  consentUpdatedAt: string | null;
  consentLoaded: boolean;
  graphData: MemoryGraphData | null;
  isLoadingConsent: boolean;
  isLoadingGraph: boolean;
  isSaving: boolean;
  error: string | null;
}

const initialState: MemoryState = {
  consentOptIn: false,
  consentVersion: null,
  consentUpdatedAt: null,
  consentLoaded: false,
  graphData: null,
  isLoadingConsent: false,
  isLoadingGraph: false,
  isSaving: false,
  error: null,
};

const memorySlice = createSlice({
  name: "memory",
  initialState,
  reducers: {
    setConsentState: (
      state,
      action: PayloadAction<{ opt_in: boolean; consent_version: string | null; updated_at: string | null }>
    ) => {
      state.consentOptIn = action.payload.opt_in;
      state.consentVersion = action.payload.consent_version;
      state.consentUpdatedAt = action.payload.updated_at;
      state.consentLoaded = true;
    },
    setGraphData: (state, action: PayloadAction<MemoryGraphData>) => {
      state.graphData = action.payload;
    },
    removeNode: (state, action: PayloadAction<string>) => {
      if (!state.graphData) return;
      state.graphData.nodes = state.graphData.nodes.filter(
        (n) => n.data.id !== action.payload
      );
      state.graphData.edges = state.graphData.edges.filter(
        (e) => e.data.source !== action.payload && e.data.target !== action.payload
      );
    },
    clearGraphData: (state) => {
      state.graphData = null;
    },
    setLoadingConsent: (state, action: PayloadAction<boolean>) => {
      state.isLoadingConsent = action.payload;
    },
    setLoadingGraph: (state, action: PayloadAction<boolean>) => {
      state.isLoadingGraph = action.payload;
    },
    setSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    },
    setMemoryError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setConsentState,
  setGraphData,
  removeNode,
  clearGraphData,
  setLoadingConsent,
  setLoadingGraph,
  setSaving,
  setMemoryError,
} = memorySlice.actions;

export default memorySlice.reducer;
