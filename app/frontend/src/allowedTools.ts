export const allowedToolsString = import.meta.env.VITE_ALLOWED_TOOLS || '';
export const allowedToolsArray = allowedToolsString.split(',').map(tool => tool.trim());
export const allowedToolsSet = new Set(allowedToolsArray);