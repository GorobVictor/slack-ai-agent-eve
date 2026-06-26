import { connectSlackCredentials } from "@vercel/connect/eve";
import { defaultSlackAuth, loadThreadContextMessages, slackChannel } from "eve/channels/slack";

export default slackChannel({
  credentials: connectSlackCredentials("slack/eve"),
  async onAppMention(ctx, message) {
    const auth = defaultSlackAuth(message, ctx);
    const prior = await loadThreadContextMessages(ctx.thread, message, {
      since: "last-agent-reply",
    });
    if (prior.length === 0) return { auth };
    const transcript = prior
      .map((m) => `${m.isMe ? "you" : (m.user ?? "user")}: ${m.markdown}`)
      .join("\n");
    return { auth, context: [`Recent thread messages since your last reply:\n\n${transcript}`] };
  },
});
