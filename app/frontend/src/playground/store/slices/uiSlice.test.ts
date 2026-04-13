import { describe, expect, it } from "vitest";

import reducer, {
  closeMobileSidebar,
  openMobileSidebar,
  setIsDeletingAllChats,
  setMobileSidebarOpen,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
} from "./uiSlice";

describe("uiSlice", () => {
  it("toggles desktop sidebar collapsed state", () => {
    const next = reducer(undefined, toggleSidebarCollapsed());
    expect(next.isSidebarCollapsed).toBe(true);

    const afterSecondToggle = reducer(next, toggleSidebarCollapsed());
    expect(afterSecondToggle.isSidebarCollapsed).toBe(false);
  });

  it("opens and closes mobile sidebar", () => {
    const opened = reducer(undefined, openMobileSidebar());
    expect(opened.isMobileSidebarOpen).toBe(true);

    const closed = reducer(opened, closeMobileSidebar());
    expect(closed.isMobileSidebarOpen).toBe(false);
  });

  it("sets desktop collapse state explicitly", () => {
    const collapsed = reducer(undefined, setSidebarCollapsed(true));
    expect(collapsed.isSidebarCollapsed).toBe(true);

    const expanded = reducer(collapsed, setSidebarCollapsed(false));
    expect(expanded.isSidebarCollapsed).toBe(false);
  });

  it("sets mobile sidebar open state explicitly", () => {
    const opened = reducer(undefined, setMobileSidebarOpen(true));
    expect(opened.isMobileSidebarOpen).toBe(true);

    const closed = reducer(opened, setMobileSidebarOpen(false));
    expect(closed.isMobileSidebarOpen).toBe(false);
  });

  it("sets deleting all chats state explicitly", () => {
    const deleting = reducer(undefined, setIsDeletingAllChats(true));
    expect(deleting.isDeletingAllChats).toBe(true);

    const notDeleting = reducer(deleting, setIsDeletingAllChats(false));
    expect(notDeleting.isDeletingAllChats).toBe(false);
  });
});
