import { MUTUALLY_EXCLUSIVE_TOOLS } from "./constants";

export const allowedToolsString = import.meta.env.VITE_ALLOWED_TOOLS || '';
export const allowedToolsArray = allowedToolsString.split(',').map((tool: string) => tool.trim());
export const allowedToolsSet = new Set<string>(allowedToolsArray);

const disabledFeaturesString = import.meta.env.VITE_DISABLED_FEATURES || '';
const disabledFeaturesArray = disabledFeaturesString.split(',').map((tool: string) => tool.trim());
export const disabledFeaturesSet = new Set<string>(disabledFeaturesArray);

export const defaultEnabledTools: { [key: string]: boolean } = {};
allowedToolsSet.forEach((tool) => {
    // Set all tools to active beside the mutually exclusive tools.
    defaultEnabledTools[tool] = !MUTUALLY_EXCLUSIVE_TOOLS.includes(tool);
});