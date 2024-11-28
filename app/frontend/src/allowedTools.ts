export const allowedToolsString = import.meta.env.VITE_ALLOWED_TOOLS || '';
export const allowedToolsArray = allowedToolsString.split(',').map((tool: string) => tool.trim());
export const allowedToolsSet = new Set<string>(allowedToolsArray);

export const allowedCorporateFunctionsString = import.meta.env.VITE_ALLOWED_CORPORATE_FUNCTIONS || '';
export const allowedCorporateFunctionsArray = allowedCorporateFunctionsString.split(',').map((tool: string) => tool.trim());
export const allowedCorporateFunctionsSet = new Set<string>(allowedCorporateFunctionsArray);