import { FC, useEffect } from "react";
import { useLocation } from "react-router";

// Extend the browser Window type with GA fields used by this component.
declare global {
  interface Window {
    // GA command queue used by gtag before/while the external script initializes.
    dataLayer: unknown[];
    // Global GA event/config function injected by the gtag script (or our local stub).
    gtag: (...args: unknown[]) => void;
    // App-level flag to ensure GA config runs once per page load.
    __gaInitialized?: boolean;
  }
}

// GA4 measurement ID from Vite environment variables.
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
// Enable analytics only in production builds when a measurement ID is configured.
const isGaEnabled = import.meta.env.PROD && Boolean(measurementId);
// DOM id used to avoid injecting duplicate GA script tags.
const gtagScriptId = "ga4-gtag-script";

const ensureGaLoaded = (): boolean => {
  // Guardrail: only track in production and only when an ID is configured.
  if (!isGaEnabled) {
    return false;
  }

  // Inject the GA script once so gtag is available globally.
  if (!document.getElementById(gtagScriptId)) {
    const script = document.createElement("script");
    script.id = gtagScriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }

  // Create dataLayer/gtag stubs immediately so events can be queued before script load completes.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };

  // Run one-time GA initialization to avoid duplicate config calls.
  if (!window.__gaInitialized) {
    window.gtag("js", new Date());
    // Disable automatic first page_view so SPA route changes are tracked consistently.
    window.gtag("config", measurementId, { send_page_view: false });
    window.__gaInitialized = true;
  }

  return true;
};

export const GoogleAnalyticsTracker: FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Exit early when GA is disabled or not configured.
    if (!ensureGaLoaded()) {
      return;
    }

    // Build a stable SPA path that includes query string and hash fragment.
    const pagePath = `${location.pathname}${location.search}${location.hash}`;

    // Emit one manual page_view for each client-side route change.
    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: pagePath,
    });
    // Depend on route fields so each navigation triggers exactly one event.
  }, [location.pathname, location.search, location.hash]);

  return null;
};
