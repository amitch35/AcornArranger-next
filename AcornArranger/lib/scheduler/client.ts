/**
 * Typed fetch wrapper for the Acorn Arranger scheduler sidecar.
 *
 * The sidecar listens on 127.0.0.1:8001 (override via `ACORN_SCHEDULER_URL`
 * for local development). The Next.js API route is the only intended caller.
 */

import type { SolveRequest, SolveResponse } from "./problem";

const DEFAULT_URL = "http://127.0.0.1:8001";
const DEFAULT_TIMEOUT_MS = 60_000;

export class SchedulerError extends Error {
  readonly code:
    | "SCHEDULER_UNAVAILABLE"
    | "SCHEDULER_TIMEOUT"
    | "SCHEDULER_BAD_RESPONSE"
    | "SCHEDULER_SOLVE_FAILED";
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code: SchedulerError["code"],
    message: string,
    opts?: { status?: number; details?: unknown; cause?: unknown }
  ) {
    super(message, opts?.cause ? { cause: opts.cause } : undefined);
    this.name = "SchedulerError";
    this.code = code;
    this.status = opts?.status;
    this.details = opts?.details;
  }
}

function schedulerBaseUrl(): string {
  return process.env.ACORN_SCHEDULER_URL?.replace(/\/$/, "") ?? DEFAULT_URL;
}

function schedulerTimeoutMs(): number {
  const raw = process.env.ACORN_SCHEDULER_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/** Call `POST /solve` on the sidecar and return a typed SolveResponse. */
export async function solveWithSidecar(
  req: SolveRequest,
  opts?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<SolveResponse> {
  const url = `${schedulerBaseUrl()}/solve`;
  const timeoutMs = opts?.timeoutMs ?? schedulerTimeoutMs();

  const controller = new AbortController();
  if (opts?.signal) {
    if (opts.signal.aborted) controller.abort(opts.signal.reason);
    else opts.signal.addEventListener("abort", () => controller.abort(opts.signal?.reason), { once: true });
  }
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (controller.signal.aborted && controller.signal.reason === "timeout") {
      throw new SchedulerError(
        "SCHEDULER_TIMEOUT",
        `Scheduler sidecar did not respond within ${timeoutMs}ms`,
        { cause: err }
      );
    }
    throw new SchedulerError(
      "SCHEDULER_UNAVAILABLE",
      `Could not reach scheduler sidecar at ${url}`,
      { cause: err }
    );
  }
  clearTimeout(timeout);

  const rawText = await res.text();
  let parsed: unknown;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new SchedulerError(
      "SCHEDULER_BAD_RESPONSE",
      `Scheduler returned non-JSON response (status ${res.status})`,
      { status: res.status, details: rawText.slice(0, 500) }
    );
  }

  if (!res.ok) {
    throw new SchedulerError(
      "SCHEDULER_SOLVE_FAILED",
      `Scheduler rejected solve request with status ${res.status}`,
      { status: res.status, details: parsed }
    );
  }

  if (!isSolveResponse(parsed)) {
    throw new SchedulerError(
      "SCHEDULER_BAD_RESPONSE",
      "Scheduler response did not match the expected shape",
      { status: res.status, details: parsed }
    );
  }

  return parsed;
}

function isSolveResponse(value: unknown): value is SolveResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.plan === "object" &&
    v.plan !== null &&
    typeof v.diagnostics === "object" &&
    v.diagnostics !== null &&
    Array.isArray((v.plan as Record<string, unknown>).teams)
  );
}
