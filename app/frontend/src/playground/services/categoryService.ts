import { AzureOpenAI } from "openai";
import type { Tool } from "openai/resources/responses/responses.mjs";
import type { Message } from "../store/slices/chatSlice";

export type Category = string;

export const CATEGORY_GENERIC = "generic";

const DEFAULT_CLASSIFIER_MODEL =
  import.meta.env.VITE_PLAYGROUND_CLASSIFIER_MODEL || "gpt-4.1-nano";

const DEFAULT_ALLOWED_MODELS = ["gpt-4.1-nano", "gpt-4o"];

const CATEGORY_MODEL_PREFERENCES: Record<string, string> = {
  [CATEGORY_GENERIC]: "gpt-4.1-nano",
  geds: "gpt-4.1-nano",
  archibus: "gpt-4o",
  bits: "gpt-4o",
  pmcoe: "gpt-4o",
  telecom: "gpt-4o",
  corporate: "gpt-4o",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  [CATEGORY_GENERIC]:
    "General questions or small talk that do not match a specific SSC system or domain.",
  archibus:
    "Workplace and space services such as desk or room booking, floor plans, and workspace reservations.",
  geds:
    "Employee directory lookups such as finding staff, contact details, phone numbers, or email addresses.",
  bits:
    "Business Request (BR) or change request processes, including request IDs and status questions.",
  pmcoe:
    "Project management guidance, templates, charters, and PMCOE resources.",
  telecom:
    "Telecom services including phone lines, mobile devices, SIM cards, or VoIP support.",
  corporate:
    "Corporate services such as intranet content, HR policies, procurement, pay, or travel guidance.",
};

const MAX_CONTEXT_MESSAGES = 8;

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: "archibus",
    keywords: [
      "archibus",
      "workspace",
      "workplace",
      "hotel desk",
      "hoteling",
      "desk booking",
      "reserve desk",
      "desk reservation",
      "desk reservation system",
      "room booking",
      "book a room",
      "book a desk",
      "meeting room",
      "meeting space",
      "room reservation",
      "floor plan",
      "space plan",
      "space planning",
      "office layout",
      "floor map",
      "space management",
      "seat reservation",
      "reserver un bureau",
      "reservation de bureau",
      "reservation de salle",
      "reserver une salle",
      "salle de reunion",
      "plan d'etage",
      "plan des locaux",
      "gestion des espaces",
      "poste de travail",
    ],
  },
  {
    category: "geds",
    keywords: [
      "geds",
      "employee directory",
      "find employee",
      "employee info",
      "contact info",
      "phone number",
      "email address",
      "look up employee",
      "employee search",
      "staff directory",
      "staff lookup",
      "people search",
      "directory search",
      "organizational chart",
      "org chart",
      "manager",
      "reporting line",
      "position number",
      "annuaire",
      "annuaire des employes",
      "trouver un employe",
      "coordonnees",
      "numero de telephone",
      "adresse courriel",
      "recherche d'employe",
      "organigramme",
      "gestionnaire",
      "superviseur",
    ],
  },
  {
    category: "bits",
    keywords: [
      "bits",
      "br",
      "business request",
      "business request id",
      "change request",
      "change ticket",
      "service request",
      "request status",
      "request number",
      "request tracking",
      "workflow request",
      "intake request",
      "demande d'affaires",
      "numero de demande",
      "demande de changement",
      "billet de changement",
      "demande de service",
      "statut de la demande",
      "suivi de la demande",
      "formulaire de demande",
    ],
  },
  {
    category: "pmcoe",
    keywords: [
      "pmcoe",
      "project management",
      "project guidance",
      "project template",
      "project charter",
      "project plan",
      "project schedule",
      "project kickoff",
      "project governance",
      "project lifecycle",
      "benefits management",
      "risk register",
      "stakeholder register",
      "lessons learned",
      "gestion de projet",
      "guide de projet",
      "modele de projet",
      "charte de projet",
      "plan de projet",
      "calendrier de projet",
      "demarrage de projet",
      "gouvernance de projet",
      "cycle de vie du projet",
      "registre des risques",
      "registre des parties prenantes",
      "lecons retenues",
    ],
  },
  {
    category: "telecom",
    keywords: [
      "telecom",
      "phone line",
      "mobile device",
      "sim card",
      "voip",
      "telephone",
      "landline",
      "call forwarding",
      "caller id",
      "extension",
      "desk phone",
      "mobile plan",
      "mobile phone",
      "cell phone",
      "device upgrade",
      "phone number change",
      "ligne telephonique",
      "telephone mobile",
      "carte sim",
      "transfert d'appel",
      "affichage du numero",
      "poste telephonique",
      "numero de poste",
      "changement de numero",
      "forfait mobile",
    ],
  },
  {
    category: "corporate",
    keywords: [
      "myssc",
      "intranet",
      "policy",
      "hr",
      "procurement",
      "pay",
      "travel",
      "benefits",
      "leave",
      "vacation",
      "time off",
      "payroll",
      "expense",
      "reimbursement",
      "forms",
      "handbook",
      "code of conduct",
      "onboarding",
      "offboarding",
      "training",
      "learning",
      "politiques",
      "ressources humaines",
      "approvisionnement",
      "paie",
      "voyage",
      "avantages sociaux",
      "conges",
      "vacances",
      "heures de travail",
      "note de frais",
      "remboursement",
      "formulaires",
      "code de conduite",
      "integration",
      "depart",
      "formation",
    ],
  },
];

const CATEGORY_SERVER_HINTS: Record<string, string[]> = {
  archibus: ["archibus", "workspace", "booking"],
  geds: ["geds", "directory", "employee"],
  bits: ["bits", "br", "business request"],
  pmcoe: ["pmcoe", "project"],
  telecom: ["telecom", "phone"],
  corporate: ["corporate", "intranet", "myssc"],
};

const classificationCache = new Map<string, string>();
const modelSelectionCache = new Map<string, string>();

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsKeyword(haystack: string, keyword: string): boolean {
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.includes(" ")) {
    return haystack.includes(trimmed);
  }
  const pattern = new RegExp(`\\b${trimmed.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
  return pattern.test(haystack);
}

function buildContextText(messages: Message[], currentContent: string): string {
  const contextMessages = messages
    .filter((message) => message.content && message.content.trim().length > 0)
    .slice(-MAX_CONTEXT_MESSAGES);

  const lines = contextMessages.map(
    (message) => `${message.role.toUpperCase()}: ${message.content.trim()}`
  );
  lines.push(`USER: ${currentContent.trim()}`);

  return lines.join("\n");
}

function formatCategoryDescriptions(categories: string[]): string {
  return categories
    .map((category) => {
      const description = CATEGORY_DESCRIPTIONS[category] || "";
      return description ? `- ${category}: ${description}` : `- ${category}`;
    })
    .join("\n");
}

export function detectCategoryByRules(messages: Message[], currentContent: string): string | null {
  const contextText = normalizeText(buildContextText(messages, currentContent));

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => containsKeyword(contextText, keyword))) {
      return rule.category;
    }
  }

  return null;
}

function getBaseURL(): string {
  return import.meta.env.VITE_API_BACKEND
    ? `${import.meta.env.VITE_API_BACKEND}/proxy/azure`
    : "http://localhost:5001/proxy/azure";
}

function createClient(userToken: string): AzureOpenAI {
  return new AzureOpenAI({
    baseURL: getBaseURL(),
    apiKey: "#no-thank-you",
    apiVersion: "2025-03-01-preview",
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      Authorization: "Bearer " + userToken.trim(),
    },
  });
}

function extractCategoryFromOutput(output: string, allowed: string[]): string | null {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.category === "string") {
      const candidate = parsed.category.toLowerCase().trim();
      if (allowed.includes(candidate)) {
        return candidate;
      }
    }
  } catch (error) {
    // Fallback to string matching
  }

  const lower = trimmed.toLowerCase();
  return allowed.find((category) => lower.includes(category)) ?? null;
}

function extractModelFromOutput(output: string, allowed: string[]): string | null {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.model === "string") {
      const candidate = parsed.model.trim();
      if (allowed.includes(candidate)) {
        return candidate;
      }
    }
  } catch (error) {
    // Fallback to string matching
  }

  const lower = trimmed.toLowerCase();
  return allowed.find((model) => lower.includes(model.toLowerCase())) ?? null;
}

export async function classifyCategoryWithLlm(
  messages: Message[],
  currentContent: string,
  userToken: string,
  categories: string[]
): Promise<string> {
  const contextText = buildContextText(messages, currentContent);
  const cacheKey = `${contextText}`;
  const cached = classificationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = createClient(userToken);
  const systemPrompt = `You are a routing classifier for a chat assistant.\n` +
    `Choose exactly one category from this list: ${categories.join(", ")}.\n` +
    `Use the category descriptions when keywords are unclear.\n` +
    `Categories:\n${formatCategoryDescriptions(categories)}\n` +
    `Return JSON only, with this shape: {"category":"<one of the allowed>","confidence":0-1}.\n` +
    `Only use "${CATEGORY_GENERIC}" when no other category fits.`;

  const userPrompt = `Conversation context:\n${contextText}\n\n` +
    `Pick the best category.`;

  const response = await client.responses.create({
    model: DEFAULT_CLASSIFIER_MODEL,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
  });

  const outputText = ((response as { output_text?: string }).output_text || "").trim();
  const selected = extractCategoryFromOutput(outputText, categories) || CATEGORY_GENERIC;
  classificationCache.set(cacheKey, selected);
  return selected;
}

export async function classifyChatCategory(
  messages: Message[],
  currentContent: string,
  userToken: string | null,
  categories: string[]
): Promise<string> {
  const ruleMatch = detectCategoryByRules(messages, currentContent);
  if (ruleMatch) {
    return ruleMatch;
  }

  if (!userToken) {
    return CATEGORY_GENERIC;
  }

  try {
    return await classifyCategoryWithLlm(messages, currentContent, userToken, categories);
  } catch (error) {
    console.warn("Category classifier failed, defaulting to generic", error);
    return CATEGORY_GENERIC;
  }
}

function parseAllowedModels(rawValue: string | undefined): string[] {
  if (!rawValue) return DEFAULT_ALLOWED_MODELS;
  const parts = rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parts.length ? parts : DEFAULT_ALLOWED_MODELS;
}

export function getAvailableModels(): string[] {
  return parseAllowedModels(import.meta.env.VITE_PLAYGROUND_ALLOWED_MODELS);
}

export async function selectModelWithLlm(
  messages: Message[],
  currentContent: string,
  category: string,
  servers: Tool.Mcp[],
  userToken: string,
  models: string[]
): Promise<string> {
  if (models.length === 1) {
    return models[0];
  }

  const contextText = buildContextText(messages, currentContent);
  const serverSummary = servers.length
    ? servers.map((server) => `${server.server_label}: ${server.server_description}`).join("; ")
    : "none";
  const cacheKey = `${category}:${serverSummary}:${contextText}`;
  const cached = modelSelectionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = createClient(userToken);
  const systemPrompt = `You are selecting the best model for a chat response.\n` +
    `Choose exactly one model from this list: ${models.join(", ")}.\n` +
    `Return JSON only, with this shape: {"model":"<one of the allowed>","confidence":0-1}.`;

  const userPrompt = `Conversation context:\n${contextText}\n\n` +
    `Selected category: ${category}.\n` +
    `Available MCP servers: ${serverSummary}.\n` +
    `Pick the best model to answer and leverage the tools.`;

  const response = await client.responses.create({
    model: DEFAULT_CLASSIFIER_MODEL,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
  });

  const outputText = ((response as { output_text?: string }).output_text || "").trim();
  const selected = extractModelFromOutput(outputText, models) || models[0];
  modelSelectionCache.set(cacheKey, selected);
  return selected;
}

export async function selectChatModel(
  messages: Message[],
  currentContent: string,
  category: string,
  servers: Tool.Mcp[],
  userToken: string | null,
  models: string[]
): Promise<string> {
  const allowedModels = models.length ? models : DEFAULT_ALLOWED_MODELS;
  const normalizedCategory = (category || CATEGORY_GENERIC).toLowerCase();
  const preferred = CATEGORY_MODEL_PREFERENCES[normalizedCategory] || allowedModels[0];
  if (allowedModels.includes(preferred)) {
    return preferred;
  }
  return allowedModels[0];
}

export function resolveMcpServersForCategory(
  category: string,
  servers: Tool.Mcp[]
): Tool.Mcp[] {
  const normalized = (category || "").toLowerCase();
  if (!normalized || normalized === CATEGORY_GENERIC) {
    return [];
  }

  const hints = CATEGORY_SERVER_HINTS[normalized] || [normalized];
  const matches = servers.filter((server) => {
    const haystack = `${server.server_label} ${server.server_description}`.toLowerCase();
    return hints.some((hint) => haystack.includes(hint));
  });

  if (matches.length > 0) {
    return matches;
  }

  // Fall back to the full list to avoid breaking tool access when labels do not match.
  return servers;
}

export function getAvailableCategories(servers: Tool.Mcp[]): string[] {
  const categories = new Set<string>([CATEGORY_GENERIC]);
  CATEGORY_RULES.forEach((rule) => categories.add(rule.category));

  servers.forEach((server) => {
    const label = `${server.server_label} ${server.server_description}`.toLowerCase();
    Object.keys(CATEGORY_SERVER_HINTS).forEach((category) => {
      if (label.includes(category)) {
        categories.add(category);
      }
    });
  });

  return Array.from(categories);
}

export function getCategoryDescription(category: string): string {
  const normalized = (category || CATEGORY_GENERIC).toLowerCase();
  return CATEGORY_DESCRIPTIONS[normalized] || CATEGORY_DESCRIPTIONS[CATEGORY_GENERIC];
}
