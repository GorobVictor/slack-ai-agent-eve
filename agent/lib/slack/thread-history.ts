import { callSlackApi } from "./api.js";

const DEFAULT_MESSAGE_LIMIT = 50;
const DEFAULT_MAX_TRANSCRIPT_CHARS = 12_000;

export type SlackThreadHistoryInput = {
  channelId: string;
  threadTs: string;
  messageTs?: string | null;
  limit?: number;
  maxTranscriptChars?: number;
};

export type SlackThreadHistoryMessage = {
  role: "user" | "assistant" | "bot" | "unknown";
  author: string | null;
  ts: string;
  text: string;
  isTrigger: boolean;
};

export type SlackThreadHistoryResult = {
  messages: SlackThreadHistoryMessage[];
  transcript: string;
  messageCount: number;
  truncated: boolean;
  warnings: string[];
};

type SlackApiResponse = {
  ok?: boolean;
  error?: string;
  messages?: RawSlackMessage[];
};

type RawSlackMessage = {
  ts?: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  text?: string;
  markdown?: string;
};

export async function loadSlackThreadHistory(
  input: SlackThreadHistoryInput
): Promise<SlackThreadHistoryResult> {
  try {
    const response = await callSlackApi("conversations.replies", {
      channel: input.channelId,
      ts: input.threadTs,
      limit: clampLimit(input.limit ?? DEFAULT_MESSAGE_LIMIT),
      inclusive: true,
    });

    if (!response.ok) {
      return emptyHistory(`Slack API conversations.replies failed: ${response.error ?? "unknown"}`);
    }

    const rawMessages = Array.isArray(response.messages) ? response.messages : [];
    const messages = normalizeMessages(rawMessages, input.messageTs);
    return buildHistoryResult(messages, input.maxTranscriptChars ?? DEFAULT_MAX_TRANSCRIPT_CHARS, []);
  } catch (error) {
    return emptyHistory(formatWarning(error));
  }
}

function normalizeMessages(messages: RawSlackMessage[], triggerMessageTs: string | null | undefined) {
  return messages
    .map((message) => {
      const text = (message.markdown || message.text || "").trim();
      const ts = message.ts ?? "";
      return {
        role: inferRole(message),
        author: message.user ?? message.bot_id ?? null,
        ts,
        text,
        isTrigger: Boolean(triggerMessageTs && ts === triggerMessageTs),
      };
    })
    .filter((message) => message.ts && message.text);
}

function inferRole(message: RawSlackMessage): SlackThreadHistoryMessage["role"] {
  if (message.bot_id) return "assistant";
  if (message.user) return "user";
  if (message.subtype === "bot_message") return "bot";
  return "unknown";
}

function buildHistoryResult(
  messages: SlackThreadHistoryMessage[],
  maxTranscriptChars: number,
  warnings: string[]
): SlackThreadHistoryResult {
  let truncated = false;
  const lines: string[] = [];
  let totalChars = 0;

  for (const message of messages) {
    const prefix = `${message.role}${message.author ? `:${message.author}` : ""}@${message.ts}${
      message.isTrigger ? " [trigger]" : ""
    }`;
    const line = `${prefix}: ${message.text}`;
    if (totalChars + line.length > maxTranscriptChars) {
      truncated = true;
      break;
    }

    lines.push(line);
    totalChars += line.length;
  }

  return {
    messages,
    transcript: lines.join("\n"),
    messageCount: messages.length,
    truncated,
    warnings,
  };
}

function emptyHistory(warning: string): SlackThreadHistoryResult {
  return {
    messages: [],
    transcript: "",
    messageCount: 0,
    truncated: false,
    warnings: [warning],
  };
}

function clampLimit(value: number) {
  return Math.max(1, Math.min(value, DEFAULT_MESSAGE_LIMIT));
}

function formatWarning(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
