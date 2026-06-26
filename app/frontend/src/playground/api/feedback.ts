/**
 * Playground-native feedback client.
 *
 * Submits feedback to the playground backend (`/api/playground/feedback`) so the
 * playground no longer depends on the legacy chat API (`/api/1.0/feedback`).
 */

const FEEDBACK_ENDPOINT = "/api/playground/feedback";

export interface SendPlaygroundFeedbackOptions {
  feedback: string;
  positive: boolean;
  uuid: string;
  accessToken?: string;
  source?: string;
}

/**
 * Persist playground feedback via the playground backend.
 *
 * Mirrors the auth pattern of the other playground API clients by attaching the
 * caller's MSAL bearer token when available.
 */
export async function sendPlaygroundFeedback({
  feedback,
  positive,
  uuid,
  accessToken,
  source = "playground",
}: SendPlaygroundFeedbackOptions): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken?.trim()) {
    headers.Authorization = `Bearer ${accessToken.trim()}`;
  }

  const response = await fetch(FEEDBACK_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ feedback, positive, uuid, source }),
  });

  if (!response.ok) {
    throw new Error("Failed to send feedback");
  }
}
