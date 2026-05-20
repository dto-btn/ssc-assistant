import { FC, useEffect } from "react";

/**
 * Google Analytics integration for playground page tracking.
 *
 * This module lazily loads the GA4 gtag script, initializes GA once,
 * and sends one manual `page_view` event when the playground route mounts.
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
    // Disable automatic first page_view so we control exactly when it is sent.
    gtag("config", measurementId, { send_page_view: false });
    window.__gaInitialized = true;
  }

  return true;
};

/**
 * Tracks a page view when the playground route mounts.
 *
 * Mount this in the playground route so only playground visits emit
 * GA `page_view` events.
 */
export const GoogleAnalyticsTracker: FC = () => {
  useEffect(() => {
    // Exit early when GA is disabled or not configured.
    if (!ensureGaLoaded()) {
      return;
    }

    const gtag = window.gtag;
    if (!gtag) {
      return;
    }

    // Emit one manual page_view when the playground route mounts.
    gtag("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
    });
  }, []);

  return null;
};
