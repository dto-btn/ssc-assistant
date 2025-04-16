export const allowedToolsString = import.meta.env.VITE_ALLOWED_TOOLS || '';
export const allowedToolsArray = allowedToolsString.split(',').map((tool: string) => tool.trim());
export const allowedToolsSet = new Set<string>(allowedToolsArray);

const disabledFeaturesString = import.meta.env.VITE_DISABLED_FEATURES || '';
const disabledFeaturesArray = disabledFeaturesString.split(',').map((tool: string) => tool.trim());
export const disabledFeaturesSet = new Set<string>(disabledFeaturesArray);

export const defaultEnabledTools: { [key: string]: boolean } = {};
allowedToolsSet.forEach((tool) => {
    if (tool == "archibus") defaultEnabledTools[tool] = false;
    else defaultEnabledTools[tool] = true;
});