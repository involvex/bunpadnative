import { appendFileSync } from "node:fs";
import { join } from "node:path";

const LOG_PATH = join(process.cwd(), ".cursor", "debug-75c567.log");

/** Debug session logging for agent investigation. */
export const agentLog = (
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = "pre-fix",
): void => {
  const entry = {
    sessionId: "75c567",
    location,
    message,
    data,
    hypothesisId,
    runId,
    timestamp: Date.now(),
  };

  // #region agent log
  try {
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // ignore file errors
  }

  fetch("http://127.0.0.1:7552/ingest/17e5f37c-9d00-4609-bbd8-b2d76ee10fd6", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "75c567",
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
  // #endregion
};
