/**
 * Memory thunks for the playground Redux store.
 *
 * All thunks pull the user's AAD accessToken from state.auth and the list
 * of configured MCP servers from state.tools to call memoryService.
 */

import type { AppThunk } from "../index";
import {
  setConsentState,
  setGraphData,
  removeNode,
  clearGraphData,
  setLoadingConsent,
  setLoadingGraph,
  setMemoryError,
  type MemoryGraphData,
} from "../slices/memorySlice";
import * as memoryService from "../../services/memoryService";

// ── Load consent ──────────────────────────────────────────────────────────────

export const loadConsent = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { accessToken } = getState().auth;
  const servers = getState().tools.mcpServers;
  dispatch(setLoadingConsent(true));
  try {
    const result = await memoryService.getConsent(servers, accessToken ?? undefined);
    if (result) {
      dispatch(setConsentState(result));
    } else {
      dispatch(setConsentState({ opt_in: false, consent_version: null, updated_at: null }));
    }
  } catch (err) {
    dispatch(setMemoryError(String(err)));
  } finally {
    dispatch(setLoadingConsent(false));
  }
};

// ── Update consent (opt-in toggle) ───────────────────────────────────────────

export const updateConsent =
  (optIn: boolean): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const { accessToken } = getState().auth;
    const servers = getState().tools.mcpServers;
    dispatch(setLoadingConsent(true));
    dispatch(setMemoryError(null));
    try {
      await memoryService.setConsent(servers, accessToken ?? undefined, optIn);
      // Reload from server to get the stored consent_version + updated_at
      const result = await memoryService.getConsent(servers, accessToken ?? undefined);
      if (result) {
        dispatch(setConsentState(result));
      }
      if (!optIn) {
        dispatch(clearGraphData());
      }
    } catch (err) {
      dispatch(setMemoryError(String(err)));
    } finally {
      dispatch(setLoadingConsent(false));
    }
  };

// ── Load memory graph ─────────────────────────────────────────────────────────

export const loadMemoryGraph = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { accessToken } = getState().auth;
  const servers = getState().tools.mcpServers;
  dispatch(setLoadingGraph(true));
  dispatch(setMemoryError(null));
  try {
    const result = await memoryService.getMemoryGraph(servers, accessToken ?? undefined);
    if (result) {
      dispatch(setGraphData(result as MemoryGraphData));
    }
  } catch (err) {
    dispatch(setMemoryError(String(err)));
  } finally {
    dispatch(setLoadingGraph(false));
  }
};

// ── Delete a single memory node ───────────────────────────────────────────────

export const deleteMemoryNode =
  (nodeId: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const { accessToken } = getState().auth;
    const servers = getState().tools.mcpServers;
    dispatch(setMemoryError(null));
    try {
      await memoryService.deleteMemory(servers, accessToken ?? undefined, nodeId);
      dispatch(removeNode(nodeId));
    } catch (err) {
      dispatch(setMemoryError(String(err)));
      throw err;
    }
  };

// ── Delete all memories ───────────────────────────────────────────────────────

export const deleteAllMemories = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { accessToken } = getState().auth;
  const servers = getState().tools.mcpServers;
  dispatch(setMemoryError(null));
  try {
    await memoryService.deleteAllMemories(servers, accessToken ?? undefined);
    dispatch(clearGraphData());
    dispatch(setConsentState({ opt_in: false, consent_version: null, updated_at: null }));
  } catch (err) {
    dispatch(setMemoryError(String(err)));
    throw err;
  }
};

// ── Save memory (called post-turn, best-effort) ───────────────────────────────

export const saveMemoryForTurn =
  (userMessage: string, assistantResponse: string): AppThunk<Promise<void>> =>
  async (_dispatch, getState) => {
    const { accessToken } = getState().auth;
    const servers = getState().tools.mcpServers;
    const { consentOptIn } = getState().memory;
    if (!consentOptIn) return;
    // Best-effort: swallow all errors so a memory failure never breaks the chat
    try {
      await memoryService.saveMemory(
        servers,
        accessToken ?? undefined,
        userMessage,
        assistantResponse
      );
    } catch {
      // intentionally silent — memory save is non-blocking
    }
  };
