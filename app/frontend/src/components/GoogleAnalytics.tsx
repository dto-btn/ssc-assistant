import { FC, useEffect } from "react";
import { useLocation } from "react-router";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    __gaInitialized?: boolean;
  }
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
const isGaEnabled = import.meta.env.PROD && Boolean(measurementId);
const gtagScriptId = "ga4-gtag-script";

const ensureGaLoaded = (): boolean => {
  if (!isGaEnabled) {
    return false;
  }

  if (!document.getElementById(gtagScriptId)) {
    const script = document.createElement("script");
    script.id = gtagScriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };

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
    if (!ensureGaLoaded()) {
      return;
    }

    const pagePath = `${location.pathname}${location.search}${location.hash}`;

    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: pagePath,
    });
  }, [location.pathname, location.search, location.hash]);

  return null;
};
