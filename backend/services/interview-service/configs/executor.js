import dotenv from "dotenv";
dotenv.config();

// Real code execution for the coding round.
//
// This replaces `new Function(code)` in the browser, which could only ever run
// JavaScript — picking Python, Java or C++ in the editor returned
// "Browser runtime only supports JavaScript" — and evaluated candidate code in
// the same page context as the app.
//
// Provider notes:
//   - Piston's public API became whitelist-only on 2026-02-15 (401s now).
//   - Paiza.IO is free, needs no account, and covers all five editor
//     languages, so it is the default. Set EXECUTOR_URL to a self-hosted
//     Judge0/Piston later without touching callers.

const PAIZA = "https://api.paiza.io";
const API_KEY = process.env.PAIZA_API_KEY || "guest";

// Editor language id -> provider language id
const LANGUAGE_MAP = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python3",
  python3: "python3",
  java: "java",
  cpp: "cpp",
  "c++": "cpp",
  c: "c",
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_MAP);

const MAX_CODE_BYTES = 64 * 1024;
const POLL_INTERVAL_MS = 900;
const MAX_WAIT_MS = 20000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a snippet and return a normalised result.
 * Never throws for ordinary failures (compile errors, runtime errors,
 * timeouts) — those are part of the result so the UI can show them.
 */
export const executeCode = async ({ language, code, stdin = "" }) => {
  const mapped = LANGUAGE_MAP[String(language || "").toLowerCase()];

  if (!mapped) {
    return {
      ok: false,
      error: `Unsupported language: ${language}`,
      output: "",
      stderr: "",
    };
  }

  if (!code || !code.trim()) {
    return { ok: false, error: "No code to run", output: "", stderr: "" };
  }

  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
    return { ok: false, error: "Code is too large to run", output: "", stderr: "" };
  }

  const startedAt = Date.now();

  try {
    const created = await fetch(`${PAIZA}/runners/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        source_code: code,
        language: mapped,
        input: stdin ?? "",
        api_key: API_KEY,
        longpoll: "true", // usually returns already-completed, saving a poll
      }),
      signal: AbortSignal.timeout(15000),
    }).then((r) => r.json());

    if (!created?.id) {
      return {
        ok: false,
        error: created?.error || "Could not reach the code runner",
        output: "",
        stderr: "",
      };
    }

    let result = created;

    while (result.status !== "completed" && Date.now() - startedAt < MAX_WAIT_MS) {
      await wait(POLL_INTERVAL_MS);
      result = await fetch(
        `${PAIZA}/runners/get_details?id=${created.id}&api_key=${API_KEY}`,
        { signal: AbortSignal.timeout(15000) }
      ).then((r) => r.json());
    }

    if (result.status !== "completed") {
      return {
        ok: false,
        error: "Execution timed out",
        output: "",
        stderr: "",
        timeMs: Date.now() - startedAt,
      };
    }

    // A compile failure has no exit code but does have build output — surface
    // that instead of showing the candidate an empty result.
    const buildFailed = result.build_result && result.build_result !== "success";

    return {
      ok: !buildFailed && result.result === "success" && Number(result.exit_code) === 0,
      output: result.stdout || "",
      stderr: buildFailed
        ? result.build_stderr || "Compilation failed"
        : result.stderr || "",
      compileError: Boolean(buildFailed),
      exitCode: result.exit_code === null || result.exit_code === undefined
        ? null
        : Number(result.exit_code),
      timeMs: Date.now() - startedAt,
    };

  } catch (error) {
    return {
      ok: false,
      error:
        error.name === "TimeoutError"
          ? "The code runner did not respond in time"
          : `Code runner error: ${error.message}`,
      output: "",
      stderr: "",
      timeMs: Date.now() - startedAt,
    };
  }
};

export default executeCode;
