import { AzureOpenAI } from "openai";
import type { Tool } from "openai/resources/responses/responses.mjs";
import type { Message } from "../store/slices/chatSlice";

export type Category = string;

export const CATEGORY_GENERIC = "generic";

const DEFAULT_CLASSIFIER_MODEL =
  import.meta.env.VITE_PLAYGROUND_CLASSIFIER_MODEL || "gpt-4.1-nano";

const MAX_CONTEXT_MESSAGES = 8;

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: "archibus",
    keywords: [
      "archibus",
      "workspace",
      "desk booking",
      "reserve desk",
      "room booking",
      "book a room",
      "book a desk",
      "floor plan",
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
    `Return JSON only, with this shape: {"category":"<one of the allowed>","confidence":0-1}.\n` +
    `If none apply, use "${CATEGORY_GENERIC}".`;

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
