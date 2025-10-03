// Read disabled features from env
const disabledFeatures = import.meta.env.VITE_DISABLED_FEATURES
  ? import.meta.env.VITE_DISABLED_FEATURES.split(',').map((f:string) => f.trim())
  : [];

// Utility to check if a feature is enabled
export default function isFeatureEnabled(feature: string) {
  return !disabledFeatures.includes(feature);
}
