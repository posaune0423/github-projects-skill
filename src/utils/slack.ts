import type { FetchLike } from "./types.ts";

export async function postSlackMessage(webhookUrl: string, text: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with status ${response.status}.`);
  }
}

export function formatSlackReportMessage(title: string, markdown: string): string {
  return [`*${title}*`, markdown.trim()].filter(Boolean).join("\n\n");
}
