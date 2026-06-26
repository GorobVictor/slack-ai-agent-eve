#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const STATE_PATH = path.join(
  process.cwd(),
  ".cursor",
  "hooks",
  ".gen-commits-clean-code-state.json",
);
const MAX_CLEANUP_CYCLES = 3;

function readStdin() {
  return new Promise((resolve) => {
    let input = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      resolve(input);
    });
  });
}

function parseJson(value) {
  if (!value.trim()) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function clearState() {
  try {
    fs.unlinkSync(STATE_PATH);
  } catch {
    // No state to clear.
  }
}

function gitStatus() {
  try {
    return execFileSync("git", ["status", "--porcelain=v1"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function stringValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stringValue).filter(Boolean).join("\n");
  }

  if (value && typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text;
    }

    if (typeof value.content === "string") {
      return value.content;
    }

    if (Array.isArray(value.content)) {
      return value.content.map(stringValue).filter(Boolean).join("\n");
    }
  }

  return "";
}

function getPathValue(object, pathParts) {
  let current = object;

  for (const part of pathParts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return "";
    }

    current = current[part];
  }

  return stringValue(current);
}

function findLatestUserMessage(input) {
  const directPaths = [
    ["last_user_message"],
    ["lastUserMessage"],
    ["user_message"],
    ["userMessage"],
    ["user_prompt"],
    ["userPrompt"],
    ["prompt"],
    ["message"],
    ["request", "prompt"],
    ["input", "prompt"],
    ["arguments", "prompt"],
    ["conversation", "last_user_message"],
    ["conversation", "lastUserMessage"],
  ];

  for (const pathParts of directPaths) {
    const value = getPathValue(input, pathParts);
    if (value) {
      return value;
    }
  }

  const messages = Array.isArray(input.messages)
    ? input.messages
    : Array.isArray(input.conversation?.messages)
      ? input.conversation.messages
      : [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const role = String(message?.role || message?.type || "").toLowerCase();

    if (role === "user") {
      return stringValue(message);
    }
  }

  const transcriptPath =
    input.transcript_path || input.transcriptPath || input.conversation?.transcriptPath;

  if (typeof transcriptPath === "string") {
    const transcriptMessage = findLatestUserMessageInTranscript(transcriptPath);
    if (transcriptMessage) {
      return transcriptMessage;
    }
  }

  return "";
}

function findLatestUserMessageInTranscript(transcriptPath) {
  try {
    const lines = fs.readFileSync(transcriptPath, "utf8").trim().split(/\r?\n/);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const record = parseJson(lines[index]);
      const role = String(record.role || record.type || record.message?.role || "").toLowerCase();

      if (role === "user") {
        return stringValue(record.message || record);
      }
    }
  } catch {
    return "";
  }

  return "";
}

function invokesGenCommits(text) {
  return /(^|\s)\/?gen-commits(\s|$)/i.test(text);
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function main() {
  const input = parseJson(await readStdin());
  const state = readState();

  if (state.phase === "awaiting-clean-code") {
    const before = state.beforeCleanStatus || "";
    const after = gitStatus();
    clearState();

    if (before !== after) {
      const cycle = Number(state.cycle || 0) + 1;

      if (cycle > MAX_CLEANUP_CYCLES) {
        output({});
        return;
      }

      writeState({
        phase: "awaiting-gen-commits",
        cycle,
      });
      output({
        followup_message:
          "The /clean-code pass changed files. Run /gen-commits again to commit those changes, then stop normally.",
      });
      return;
    }

    output({});
    return;
  }

  if (state.phase === "awaiting-gen-commits") {
    writeState({
      phase: "awaiting-clean-code",
      beforeCleanStatus: gitStatus(),
      cycle: Number(state.cycle || 0),
    });
    output({
      followup_message:
        "Run /clean-code now. Keep behavior unchanged and stop normally when the cleanup pass is complete.",
    });
    return;
  }

  if (invokesGenCommits(findLatestUserMessage(input))) {
    writeState({
      phase: "awaiting-clean-code",
      beforeCleanStatus: gitStatus(),
      cycle: 0,
    });
    output({
      followup_message:
        "Run /clean-code now. Keep behavior unchanged and stop normally when the cleanup pass is complete.",
    });
    return;
  }

  output({});
}

main().catch(() => {
  output({});
});
