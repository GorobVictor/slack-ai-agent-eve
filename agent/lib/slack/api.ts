import { connectSlackCredentials } from "@vercel/connect/eve";

const SLACK_CONNECTOR_ID = "slack/eve";

export type SlackApiResponse = {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
};

const credentials = connectSlackCredentials(SLACK_CONNECTOR_ID);

export async function callSlackApi(operation: string, body: Record<string, unknown>) {
  const response = await fetch(`https://slack.com/api/${operation}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await resolveBotToken()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: encodeSlackApiBody(body),
  });

  return (await response.json()) as SlackApiResponse;
}

export async function postSlackMessage(input: {
  channelId: string;
  markdown: string;
  threadTs?: string | null;
  blocks?: readonly unknown[];
  text?: string | null;
}) {
  const body: Record<string, unknown> = {
    channel: input.channelId,
    unfurl_links: false,
    unfurl_media: false,
  };
  if (input.threadTs) body.thread_ts = input.threadTs;
  if (input.blocks) {
    body.blocks = input.blocks;
    body.text = input.text ?? input.markdown;
  } else {
    body.markdown_text = input.markdown;
  }

  const response = await callSlackApi("chat.postMessage", body);
  if (response.ok !== true) {
    throw new Error(`Slack chat.postMessage failed: ${response.error ?? "unknown_error"}`);
  }

  return {
    channelId: String(response.channel ?? input.channelId),
    messageTs: typeof response.ts === "string" ? response.ts : "",
    raw: response,
  };
}

export async function openSlackDirectMessage(userId: string) {
  const response = await callSlackApi("conversations.open", { users: userId });
  const channel = response.channel;
  const channelId =
    typeof channel === "object" && channel !== null && "id" in channel
      ? String((channel as { id: unknown }).id)
      : "";

  if (response.ok !== true || !channelId) {
    throw new Error(`Slack conversations.open failed: ${response.error ?? "unknown_error"}`);
  }

  return channelId;
}

export async function uploadSlackTextFile(input: {
  channelId: string;
  filename: string;
  content: string;
  threadTs?: string | null;
  initialComment?: string | null;
}) {
  const bytes = new TextEncoder().encode(input.content);
  const uploadUrlResponse = await callSlackApi("files.getUploadURLExternal", {
    filename: input.filename,
    length: bytes.byteLength,
  });

  const uploadUrl =
    typeof uploadUrlResponse.upload_url === "string" ? uploadUrlResponse.upload_url : "";
  const fileId = typeof uploadUrlResponse.file_id === "string" ? uploadUrlResponse.file_id : "";

  if (uploadUrlResponse.ok !== true || !uploadUrl || !fileId) {
    throw new Error(
      `Slack files.getUploadURLExternal failed: ${uploadUrlResponse.error ?? "unknown_error"}`
    );
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await resolveBotToken()}`,
      "content-type": "text/plain; charset=utf-8",
    },
    body: new Blob([bytes], { type: "text/plain; charset=utf-8" }),
  });

  if (!uploadResponse.ok) {
    throw new Error(`Slack upload POST returned HTTP ${uploadResponse.status} for ${input.filename}`);
  }

  const completeBody: Record<string, unknown> = {
    channel_id: input.channelId,
    files: [{ id: fileId, title: input.filename }],
  };
  if (input.threadTs) completeBody.thread_ts = input.threadTs;
  if (input.initialComment) completeBody.initial_comment = input.initialComment;

  const completeResponse = await callSlackApi("files.completeUploadExternal", completeBody);
  if (completeResponse.ok !== true) {
    throw new Error(
      `Slack files.completeUploadExternal failed: ${completeResponse.error ?? "unknown_error"}`
    );
  }

  return {
    fileIds: [fileId],
    raw: completeResponse,
  };
}

async function resolveBotToken() {
  const token = credentials.botToken;
  if (typeof token === "function") return token();
  if (typeof token === "string" && token.length > 0) return token;
  throw new Error("Slack bot token credentials are not configured");
}

function encodeSlackApiBody(body: Record<string, unknown>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }

  return params;
}
