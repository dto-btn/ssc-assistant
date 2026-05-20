import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";

describe("GoogleAnalyticsTracker", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
    delete window.__gaInitialized;
    delete (window as Window & { gtag?: unknown }).gtag;
    delete (window as Window & { dataLayer?: unknown }).dataLayer;
  });

  it("does not initialize GA when app env is not prod", async () => {
    vi.stubEnv("VITE_APP_ENV", "dev");
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST1234");

    const appendChildSpy = vi.spyOn(document.head, "appendChild");
    const { GoogleAnalyticsTracker } = await import("./GoogleAnalytics");

    const router = createMemoryRouter(
      [{ path: "*", element: <GoogleAnalyticsTracker /> }],
      { initialEntries: ["/playground"] }
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(appendChildSpy).not.toHaveBeenCalled();
      expect(window.__gaInitialized).toBeUndefined();
    });
  });

  it("does not initialize GA when measurement id is empty", async () => {
    vi.stubEnv("VITE_APP_ENV", "prod");
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");

    const appendChildSpy = vi.spyOn(document.head, "appendChild");
    const { GoogleAnalyticsTracker } = await import("./GoogleAnalytics");

    const router = createMemoryRouter(
      [{ path: "*", element: <GoogleAnalyticsTracker /> }],
      { initialEntries: ["/playground"] }
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(appendChildSpy).not.toHaveBeenCalled();
      expect(window.__gaInitialized).toBeUndefined();
    });
  });

  it("emits page_view on route changes when GA is enabled", async () => {
    vi.stubEnv("VITE_APP_ENV", "prod");
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST1234");

    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;

    const { GoogleAnalyticsTracker } = await import("./GoogleAnalytics");

    const router = createMemoryRouter(
      [{ path: "*", element: <GoogleAnalyticsTracker /> }],
      { initialEntries: ["/playground"] }
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(gtagSpy).toHaveBeenCalledWith(
        "event",
        "page_view",
        expect.objectContaining({
          page_title: document.title,
          page_location: window.location.href,
        })
      );
    });

    gtagSpy.mockClear();

    await act(async () => {
      await router.navigate("/playground/sessions?tab=all#latest");
    });

    await waitFor(() => {
      expect(gtagSpy).toHaveBeenCalledWith(
        "event",
        "page_view",
        expect.not.objectContaining({ page_path: expect.anything() })
      );
    });
  });
});
