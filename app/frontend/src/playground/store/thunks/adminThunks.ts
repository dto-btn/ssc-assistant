/**
 * Admin dashboard thunks
 *
 * Orchestrates data fetching for the playground admin dashboard,
 * using both the custom analytics API and LiteLLM's built-in admin endpoints.
 */

import { AppThunk } from "..";
import {
  setIsAdmin,
  setIsCheckingAdmin,
  setOverview,
  setToolUsage,
  setCallerSystems,
  setCitationTimeline,
  setSpendLogs,
  setSpendTimeline,
  setAdminList,
  setLoading,
  setError,
  AdminUser,
} from "../slices/adminSlice";
import {
  checkAdmin,
  fetchOverview,
  fetchToolUsage,
  fetchCallerSystems,
  fetchCitations,
  fetchSpendTimeline,
  fetchAdminList,
  addAdmin,
  removeAdmin,
} from "../../api/analytics";
import { fetchSpendLogs } from "../../api/litellmAdmin";

/**
 * Check whether the currently authenticated user has admin access.
 * Uses the bearer token from the auth slice if available.
 */
export const checkAdminStatus = (): AppThunk => async (dispatch, getState) => {
  dispatch(setIsCheckingAdmin(true));
  try {
    const token = getState().auth.accessToken ?? undefined;
    const result = await checkAdmin(token);
    dispatch(setIsAdmin(result.is_admin));
  } catch {
    // If check fails, default to non-admin (safe)
    dispatch(setIsAdmin(false));
  }
};

/**
 * Load all dashboard data for the given date range.
 * Fetches analytics and LiteLLM spend logs in parallel.
 */
export const loadDashboardData =
  (start: string, end: string): AppThunk =>
  async (dispatch, getState) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    const token = getState().auth.accessToken ?? undefined;
    try {
      const [overview, toolUsage, callerSystems, citations, spendTimeline, spendLogs] =
        await Promise.allSettled([
          fetchOverview(start, end, token),
          fetchToolUsage(start, end, token),
          fetchCallerSystems(start, end, token),
          fetchCitations(start, end, token),
          fetchSpendTimeline(start, end, token),
          fetchSpendLogs(start, end),
        ]);

      if (overview.status === "fulfilled") {
        dispatch(setOverview(overview.value as any));
      }
      if (toolUsage.status === "fulfilled") {
        dispatch(setToolUsage((toolUsage.value as any).tools ?? []));
      }
      if (callerSystems.status === "fulfilled") {
        dispatch(setCallerSystems((callerSystems.value as any).systems ?? []));
      }
      if (citations.status === "fulfilled") {
        dispatch(setCitationTimeline((citations.value as any).timeline ?? []));
      }
      if (spendTimeline.status === "fulfilled") {
        dispatch(setSpendTimeline((spendTimeline.value as any).timeline ?? []));
      }
      if (spendLogs.status === "fulfilled") {
        dispatch(setSpendLogs((spendLogs.value as any) ?? []));
      }
    } catch (err: any) {
      dispatch(setError(err?.message ?? "Failed to load dashboard data"));
    } finally {
      dispatch(setLoading(false));
    }
  };

/** Load the current list of dashboard admins. */
export const loadAdminList = (): AppThunk => async (dispatch, getState) => {
  const token = getState().auth.accessToken ?? undefined;
  try {
    const result = await fetchAdminList(token);
    dispatch(setAdminList((result as any).admins ?? []));
  } catch (err: any) {
    dispatch(setError(err?.message ?? "Failed to load admin list"));
  }
};

/** Add a new admin by OID. */
export const addAdminUser =
  (oid: string, displayName: string, email: string): AppThunk =>
  async (dispatch, getState) => {
    const token = getState().auth.accessToken ?? undefined;
    try {
      await addAdmin(oid, displayName, email, token);
      dispatch(loadAdminList());
    } catch (err: any) {
      dispatch(setError(err?.message ?? "Failed to add admin"));
    }
  };

/** Remove an admin by OID. */
export const removeAdminUser =
  (oid: string): AppThunk =>
  async (dispatch, getState) => {
    const token = getState().auth.accessToken ?? undefined;
    try {
      await removeAdmin(oid, token);
      // Optimistically remove from local list
      const state = getState();
      const updated = (state.admin?.adminList ?? []).filter(
        (a: AdminUser) => a.oid !== oid
      );
      dispatch(setAdminList(updated));
    } catch (err: any) {
      dispatch(setError(err?.message ?? "Failed to remove admin"));
    }
  };
