import { postSlackMessage } from "./api.js";
import type { StoredSlackMessageAnalysis } from "#lib/storage/slack-message-analytics-repository.js";
import type { StoredSkill } from "#lib/storage/skills-repository.js";

const SLACK_SKILL_REVIEW_CHANNEL_ID_ENV = "SLACK_SKILL_REVIEW_CHANNEL_ID";
const MAX_ERROR_LENGTH = 2_000;

export const SKILL_REVIEW_APPROVE_ACTION_ID = "skill_review_approve";
export const SKILL_REVIEW_DECLINE_ACTION_ID = "skill_review_decline";

export type SkillReviewNotificationMetadata = {
  notificationStatus: "sent" | "failed";
  notificationChannelId?: string;
  notificationMessageTs?: string;
  notificationActionMessageTs?: string;
  notificationButtonsIncluded?: boolean;
  notificationError?: string;
};

export type SlackReviewLogMetadata = {
  status: "sent" | "failed";
  channelId?: string;
  messageTs?: string;
  error?: string;
};

export function getSlackSkillReviewChannelId() {
  const channelId = process.env[SLACK_SKILL_REVIEW_CHANNEL_ID_ENV]?.trim();
  if (!channelId) {
    throw new Error(`${SLACK_SKILL_REVIEW_CHANNEL_ID_ENV} must be configured for skill review notifications`);
  }

  return channelId;
}

export async function notifySkillReviewCandidate(
  message: StoredSlackMessageAnalysis,
  skill: StoredSkill
): Promise<SkillReviewNotificationMetadata> {
  try {
    const channelId = getSlackSkillReviewChannelId();
    const markdown = buildSkillReviewMarkdown(message, skill);
    const postedReview = await postSlackMessage({
      channelId,
      markdown,
      text: `Skill review candidate: ${skill.title} v${skill.version}`,
    });
    const postedActions = await postSlackMessage({
      channelId,
      threadTs: postedReview.messageTs,
      markdown: `Review actions for skill candidate \`${skill.slug}\` v${skill.version}.`,
      text: `Review actions for skill candidate ${skill.title} v${skill.version}`,
      blocks: buildSkillReviewBlocks(skill),
    });

    return {
      notificationStatus: "sent",
      notificationChannelId: channelId,
      notificationMessageTs: postedReview.messageTs,
      notificationActionMessageTs: postedActions.messageTs,
      notificationButtonsIncluded: true,
    };
  } catch (error) {
    const notificationError = formatNotificationError(error);
    console.warn("Failed to post Slack skill review notification", {
      analyticsId: message.id,
      skillId: skill.id,
      error,
    });

    return {
      notificationStatus: "failed",
      notificationError,
    };
  }
}

export async function notifySlackReviewLog(input: {
  title: string;
  message: StoredSlackMessageAnalysis;
  error: unknown;
  phase: "analysis" | "artifact_generation";
}): Promise<SlackReviewLogMetadata> {
  try {
    const channelId = getSlackSkillReviewChannelId();
    const markdown = buildFailureLogMarkdown(input);
    const posted = await postSlackMessage({
      channelId,
      markdown,
      text: input.title,
    });

    return {
      status: "sent",
      channelId,
      messageTs: posted.messageTs,
    };
  } catch (error) {
    const notificationError = formatNotificationError(error);
    console.warn("Failed to post Slack review log", {
      analyticsId: input.message.id,
      phase: input.phase,
      error,
    });

    return {
      status: "failed",
      error: notificationError,
    };
  }
}

export function buildSkillReviewBlocks(skill: Pick<StoredSkill, "id" | "slug" | "title" | "version">) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Skill review candidate*\n*${escapeSlackText(skill.title)}* \`${skill.slug}\` v${skill.version}\nID: \`${skill.id}\``,
      },
    },
    {
      type: "actions",
      block_id: `skill_review:${skill.id}`,
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Approve",
          },
          style: "primary",
          action_id: SKILL_REVIEW_APPROVE_ACTION_ID,
          value: skill.id,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Decline",
          },
          style: "danger",
          action_id: SKILL_REVIEW_DECLINE_ACTION_ID,
          value: skill.id,
          confirm: {
            title: {
              type: "plain_text",
              text: "Decline skill?",
            },
            text: {
              type: "mrkdwn",
              text: "This will hide the review candidate from skill review lists.",
            },
            confirm: {
              type: "plain_text",
              text: "Decline",
            },
            deny: {
              type: "plain_text",
              text: "Cancel",
            },
          },
        },
      ],
    },
  ];
}

function buildSkillReviewMarkdown(message: StoredSlackMessageAnalysis, skill: StoredSkill) {
  const analysis = getRecord(message.metadata.analysis);
  const generation = getRecord(message.metadata.generation);

  return [
    `# Skill review candidate: ${skill.title} v${skill.version}`,
    "",
    `- Skill id: \`${skill.id}\``,
    `- Slug: \`${skill.slug}\``,
    `- Review status: \`${skill.reviewStatus}\``,
    `- Description: ${skill.description ?? "Not provided"}`,
    `- Source intent: \`${message.intent ?? "unknown"}\``,
    `- Source Slack channel: \`${message.channelId}\``,
    `- Source thread ts: \`${message.threadTs}\``,
    `- Source message ts: \`${message.messageTs}\``,
    `- Source user: <@${message.userId}>`,
    `- Analysis confidence: ${formatMetadataValue(analysis?.confidence)}`,
    `- Analysis rationale: ${formatMetadataValue(analysis?.rationale)}`,
    `- Generation confidence: ${formatMetadataValue(generation?.confidence)}`,
    `- Generation reason: ${formatMetadataValue(generation?.reason)}`,
    "",
    "## Source user message",
    "",
    message.userMessage,
    "",
    "## Generated skill markdown",
    "",
    skill.content,
  ].join("\n");
}

function buildFailureLogMarkdown(input: {
  title: string;
  message: StoredSlackMessageAnalysis;
  error: unknown;
  phase: "analysis" | "artifact_generation";
}) {
  return [
    `# ${input.title}`,
    "",
    `- Phase: \`${input.phase}\``,
    `- Analytics id: \`${input.message.id}\``,
    `- Intent: \`${input.message.intent ?? "unknown"}\``,
    `- Source Slack channel: \`${input.message.channelId}\``,
    `- Source thread ts: \`${input.message.threadTs}\``,
    `- Source message ts: \`${input.message.messageTs}\``,
    `- Source user: <@${input.message.userId}>`,
    "",
    "## User message",
    "",
    input.message.userMessage,
    "",
    "## Error",
    "",
    formatNotificationError(input.error),
  ].join("\n");
}

function formatNotificationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_LENGTH);
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function getRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function escapeSlackText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
