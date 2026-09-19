import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";

import stripAnsi from "strip-ansi";

import { AGENT_PROMPT } from "../config.js";
import { createAgentLogWriter } from "../utils/agent-runtime.js";
import type { AgentKind } from "../canvas/session.js";
import type { AgentEmit } from "./types.js";

type ExternalAgentKind = Exclude<AgentKind, "codex">;
type ExternalTurnOptions = { cwd: string; threadId: string; sourceClientId: string };

let activeProcess: { agent: ExternalAgentKind; child: ChildProcess } | null = null;

/** 只在用户已选择并发送任务后启动 ZCode 或 Claude CLI。 */
export async function runExternalTurn(agent: ExternalAgentKind, prompt: string, emit: AgentEmit, options: ExternalTurnOptions) {
    const turnId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const scope = { agent, threadId: options.threadId, turnId, sourceClientId: options.sourceClientId };
    const fullPrompt = `${AGENT_PROMPT}\n\n用户请求：${prompt.trim()}`;
    const child = spawn(executable(agent), argumentsFor(agent, fullPrompt), { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    activeProcess = { agent, child };
    emit("agent_event", { ...scope, type: "turn.started" });

    let stdout = "";
    let claudeBuffer = "";
    let claudeResult = "";
    const stderr = createAgentLogWriter((text) => emit("agent_log", { ...scope, text }));
    child.stdout?.on("data", (chunk) => {
        const text = chunk.toString();
        stdout += text;
        if (agent !== "claude") return;
        claudeBuffer += text;
        const lines = claudeBuffer.split(/\r?\n/);
        claudeBuffer = lines.pop() || "";
        lines.forEach((line) => {
            try {
                const event = JSON.parse(line) as { type?: string; result?: unknown };
                if (event.type === "result" && typeof event.result === "string") claudeResult = event.result;
            } catch {}
        });
    });
    child.stderr?.on("data", (chunk) => stderr.write(chunk.toString()));

    await new Promise<void>((resolve, reject) => {
        let settled = false;
        child.once("error", (error) => {
            if (settled) return;
            settled = true;
            reject(error);
        });
        child.once("close", (code, signal) => {
            if (settled) return;
            settled = true;
            if (code && signal !== "SIGTERM") return reject(new Error(`${displayName(agent)} CLI exited with code ${code}`));
            resolve();
        });
    }).then(() => {
        const text = stripAnsi(agent === "claude" ? claudeResult || claudeFallback(stdout) : stdout).trim();
        if (text) emit("agent_event", { ...scope, type: "item.completed", item: { id: itemId, type: "agent_message", text } });
        emit("agent_event", { ...scope, type: "turn.completed", status: "completed" });
    }).catch((error: Error) => {
        emit("agent_error", { ...scope, message: error.message });
        emit("agent_event", { ...scope, type: "turn.completed", status: "failed", error: { message: error.message } });
        throw error;
    }).finally(() => {
        stderr.flush();
        if (activeProcess?.child === child) activeProcess = null;
    });

    return { turnId };
}

export function interruptExternalTurn(agent: ExternalAgentKind) {
    if (!activeProcess || activeProcess.agent !== agent) return false;
    return activeProcess.child.kill();
}

function executable(agent: ExternalAgentKind) {
    const name = agent === "claude" ? "claude" : "zcode";
    return process.platform === "win32" ? `${name}.cmd` : name;
}

function argumentsFor(agent: ExternalAgentKind, prompt: string) {
    return agent === "claude"
        ? ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--allowedTools", "mcp__infinite-canvas__*", prompt]
        : ["--print", prompt, "--no-color"];
}

function claudeFallback(output: string) {
    return output.split(/\r?\n/).flatMap((line) => {
        try {
            const event = JSON.parse(line) as { type?: string; message?: { content?: Array<{ type?: string; text?: string }> } };
            return event.type === "assistant" ? event.message?.content?.flatMap((item) => item.type === "text" && item.text ? [item.text] : []) || [] : [];
        } catch {
            return [];
        }
    }).join("\n");
}

function displayName(agent: ExternalAgentKind) {
    return agent === "claude" ? "Claude" : "ZCode";
}
