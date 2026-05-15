/**
 * Preflight helper for optional orchestrator route hints.
 *
 * Requests the preflight endpoint and converts its response into a system
 * message that can guide downstream completion routing behavior.
 */
import { CompletionMessage } from "../../services/completionService";
import { Tool } from "openai/resources/responses/responses.mjs";
import {
  buildPreflightRoutingContextMessage,
  extractLastUserText,
  findOrchestratorServer,
  shouldUseOrchestratorPreflight,
  toOrchestratorPreflightUrl,
} from "./assistantThunksHelpers";

export const fetchPreflightRoutingContextMessage = async ({
  completionMessages,
  serversWithAuth,
  accessToken,
}: {
  completionMessages: CompletionMessage[];
  serversWithAuth: Tool.Mcp[];
  accessToken: string;
}): Promise<CompletionMessage | undefined> => {
  // Step 1: Find orchestrator endpoint from the resolved server list.
  const orchestratorServer = findOrchestratorServer(serversWithAuth);
  const orchestratorServerUrl = orchestratorServer?.server_url;

  // Step 2: Exit early when preflight is disabled or no orchestrator URL is available.
  if (!shouldUseOrchestratorPreflight() || !orchestratorServerUrl) {
    return undefined;
  }

  try {
    // Step 3: Send compact user-context payload to preflight endpoint.
    const preflightResponse = await fetch(toOrchestratorPreflightUrl(orchestratorServerUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: extractLastUserText(completionMessages) }],
        max_recommendations: 3,
        require_single_best: false,
        metadata: { source: "playground-preflight" },
      }),
    });

    if (!preflightResponse.ok) {
      return undefined;
    }

    // Step 4: Translate response into a system message consumed by completion.
    const routing = await preflightResponse.json();
    return {
      role: "system",
      content: buildPreflightRoutingContextMessage(routing),
    };
  } catch (preflightError) {
    console.warn("Orchestrator preflight failed, continuing without preflight", preflightError);
    return undefined;
  }
};
