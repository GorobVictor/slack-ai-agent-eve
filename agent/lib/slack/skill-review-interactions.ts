import type { SlackContext, SlackInteractionAction } from "eve/channels/slack";

import { requireSkillAdminUserId } from "#lib/auth/skill-admin.js";
import {
  SKILL_REVIEW_APPROVE_ACTION_ID,
  SKILL_REVIEW_DECLINE_ACTION_ID,
} from "#lib/slack/skill-review-notifications.js";
import { approveSkillReviewCandidate, softDeleteSkill, type StoredSkill } from "#lib/storage/skills-repository.js";

export async function handleSkillReviewInteraction(
  action: SlackInteractionAction,
  ctx: SlackContext
) {
  if (
    action.actionId !== SKILL_REVIEW_APPROVE_ACTION_ID &&
    action.actionId !== SKILL_REVIEW_DECLINE_ACTION_ID
  ) {
    return;
  }

  const skillId = action.value?.trim();
  if (!skillId) {
    await ctx.thread.postEphemeral(action.user.id, "This skill review action is missing a skill id.");
    return;
  }

  try {
    const admin = requireSkillAdminUserId(action.user.id);
    const result =
      action.actionId === SKILL_REVIEW_APPROVE_ACTION_ID
        ? await approveSkillReviewCandidate({
            id: skillId,
            approvedBy: admin.userId,
          })
        : await softDeleteSkill({
            id: skillId,
            deletedBy: admin.userId,
            reason: "declined_from_slack_review",
          });

    await updateReviewMessage({
      action,
      ctx,
      skill: result,
      status: action.actionId === SKILL_REVIEW_APPROVE_ACTION_ID ? "approved" : "declined",
      adminUserId: admin.userId,
    });
  } catch (error) {
    await ctx.thread.postEphemeral(action.user.id, formatInteractionError(error));
  }
}

async function updateReviewMessage(input: {
  action: SlackInteractionAction;
  ctx: SlackContext;
  skill: StoredSkill;
  status: "approved" | "declined";
  adminUserId: string;
}) {
  const messageTs = input.action.messageTs;
  const markdown = buildResolvedSkillReviewMarkdown(input);

  if (!messageTs) {
    await input.ctx.thread.post(markdown);
    return;
  }

  const response = await input.ctx.slack.request("chat.update", {
    channel: input.ctx.slack.channelId,
    ts: messageTs,
    markdown_text: markdown,
  });

  if (response.ok !== true) {
    throw new Error(`Slack chat.update failed: ${response.error ?? "unknown_error"}`);
  }
}

function buildResolvedSkillReviewMarkdown(input: {
  skill: StoredSkill;
  status: "approved" | "declined";
  adminUserId: string;
}) {
  const verb = input.status === "approved" ? "Approved" : "Declined";

  return [
    `# ${verb} skill review: ${input.skill.title} v${input.skill.version}`,
    "",
    `- Skill id: \`${input.skill.id}\``,
    `- Slug: \`${input.skill.slug}\``,
    `- Status: \`${input.skill.reviewStatus}\``,
    `- Resolved by: <@${input.adminUserId}>`,
    `- Description: ${input.skill.description ?? "Not provided"}`,
    "",
    "## Skill markdown",
    "",
    input.skill.content,
  ].join("\n");
}

function formatInteractionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `Could not complete this skill review action: ${message.slice(0, 1_000)}`;
}
