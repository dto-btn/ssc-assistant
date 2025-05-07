import { MUTEX_TOOLS } from "./constants";

export const allowedToolsString = import.meta.env.VITE_ALLOWED_TOOLS || '';
export const allowedToolsArray = allowedToolsString.split(',').map((tool: string) => tool.trim());
export const allowedToolsSet = new Set<string>(allowedToolsArray);

const disabledFeaturesString = import.meta.env.VITE_DISABLED_FEATURES || '';
const disabledFeaturesArray = disabledFeaturesString.split(',').map((tool: string) => tool.trim());
export const disabledFeaturesSet = new Set<string>(disabledFeaturesArray);

export const defaultEnabledTools: { [key: string]: boolean } = {};
allowedToolsSet.forEach((tool) => {
    // Set all tools to true by default. 
    // The only mutex tool that is true should be corporate.
    // archibus is false by default.
    defaultEnabledTools[tool] = true;
    if (tool == "archibus") defaultEnabledTools[tool] = false;
    if (MUTEX_TOOLS.includes(tool)) defaultEnabledTools[tool] = false;
    if (tool === "corporate") defaultEnabledTools[tool] = true;
});