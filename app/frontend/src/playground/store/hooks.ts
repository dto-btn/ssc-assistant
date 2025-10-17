/**
 * Typed Redux hooks for the playground store.
 *
 * Wraps the base React-Redux hooks to provide proper typing for
 * dispatch and selector usage tied to the local store types.
 */

import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./index";

/** Returns a typed dispatch function bound to the playground store. */
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();
/** Typed selector hook constrained to the playground `RootState`. */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
