import { FC, useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Google Analytics integration for SPA navigation tracking.
 *
 * This module lazily loads the GA4 gtag script, initializes GA once,
 * and sends manual `page_view` events whenever React Router location changes.
 * It does not render UI; it is a side-effect-only tracker component.
 */

// Extend the browser Window type with GA fields used by this component.
declare global {
  interface Window {
    // GA command queue used by gtag before/while the external script initializes.
    dataLayer?: unknown[];
    // Global GA event/config function injected by the gtag script (or our local stub).
    gtag?: (...args: unknown[]) => void;
    // App-level flag to ensure GA config runs once per page load.
    __gaInitialized?: boolean;
  }
}

// GA4 measurement ID from Vite environment variables.
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
// Deployment environment label passed by build config (for example: dev, sandbox, uat, prod).
const appEnv = (import.meta.env.VITE_APP_ENV || "").trim().toLowerCase();
// Enable analytics only for prod deployments when a measurement ID is configured.
const isGaEnabled = Boolean(measurementId) && appEnv === "prod";
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
  const dataLayer = window.dataLayer ?? [];
  window.dataLayer = dataLayer;
  const gtag = window.gtag ?? function gtag(...args: unknown[]) {
    dataLayer.push(args);
  };
  window.gtag = gtag;

  // Run one-time GA initialization to avoid duplicate config calls.
  if (!window.__gaInitialized) {
    gtag("js", new Date());
    // Disable automatic first page_view so SPA route changes are tracked consistently.
    gtag("config", measurementId, { send_page_view: false });
    window.__gaInitialized = true;
  }

  return true;
};

/**
 * Tracks page views for the current route tree.
 *
 * Mount this in the playground route so only playground navigations emit
 * GA `page_view` events.
 */
export const GoogleAnalyticsTracker: FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Exit early when GA is disabled or not configured.
    if (!ensureGaLoaded()) {
      return;
    }

    const gtag = window.gtag;
    if (!gtag) {
      return;
    }

    // Emit one manual page_view for each client-side route change.
    gtag("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
    });
    // Depend on route fields so each navigation triggers exactly one event.
  }, [location.pathname, location.search, location.hash]);

  return null;
};
