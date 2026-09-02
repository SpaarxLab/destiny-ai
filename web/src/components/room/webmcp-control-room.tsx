"use client";

import { useEffect, useRef } from "react";
import type { WebMcpInvocationEvent } from "../../webmcp/invocation-log";
import styles from "./webmcp-control-room.module.css";

export function WebMcpControlRoom({ events, open, onOpenChange }: {
  events: readonly WebMcpInvocationEvent[];
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const latest = events[0];

  useEffect(() => {
    if (open) heading.current?.focus();
    else if (wasOpen.current) trigger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onOpenChange, open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls="webmcp-control-room"
        onClick={() => onOpenChange(!open)}
      >
        Technical details
        {latest ? <span>{statusLabel(latest.status)}</span> : null}
      </button>
      {open ? (
        <aside id="webmcp-control-room" className={styles.panel} aria-labelledby="webmcp-control-room-title">
          <header className={styles.header}>
            <div>
              <p>Optional WebMCP details</p>
              <h2 id="webmcp-control-room-title" ref={heading} tabIndex={-1}>How ChatGPT used this page</h2>
              <span>Inspect the structured calls, results and timing behind the experience. You do not need this panel to use the app.</span>
            </div>
            <button type="button" onClick={() => onOpenChange(false)}>Close details</button>
          </header>

          {events.length ? (
            <ol className={styles.timeline}>
              {events.map((event, index) => (
                <li key={event.id}>
                  <details className={styles.event} open={index === 0}>
                    <summary>
                      <span className={styles.sequence}>{String(events.length - index).padStart(2, "0")}</span>
                      <span className={styles.identity}><strong>{toolLabel(event.tool)}</strong><small>{event.tool}</small></span>
                      <span className={styles.status} data-status={event.status}>{statusLabel(event.status)}</span>
                      <span className={styles.metrics}>{versionLabel(event)}{event.durationMs !== undefined ? ` · ${event.durationMs} ms` : ""}</span>
                    </summary>
                    <div className={styles.details}>
                      <section>
                        <h3>Request</h3>
                        <pre>{formatJson(event.request)}</pre>
                      </section>
                      <section>
                        <h3>Response</h3>
                        <pre>{event.response === undefined ? "Waiting for the tool result…" : formatJson(event.response)}</pre>
                      </section>
                      <dl className={styles.receipt}>
                        <div><dt>Persistence</dt><dd>{persistenceLabel(event.persistence)}</dd></div>
                        <div><dt>Receipt</dt><dd>{event.receiptRef ?? "No mutation receipt"}</dd></div>
                        <div><dt>Changed refs</dt><dd>{event.changedRefs?.join(" · ") || "None"}</dd></div>
                        <div><dt>Started</dt><dd><time dateTime={event.startedAt}>{new Date(event.startedAt).toLocaleTimeString()}</time></dd></div>
                      </dl>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.empty}>
              <h3>No page calls yet</h3>
              <p>Ask ChatGPT to begin. Its structured WebMCP requests and results will appear here.</p>
            </div>
          )}
        </aside>
      ) : null}
    </>
  );
}

function statusLabel(status: WebMcpInvocationEvent["status"]): string {
  if (status === "awaiting_participant") return "Waiting for you";
  if (status === "denied") return "Not applied";
  if (status === "completed") return "Done";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function toolLabel(tool: string): string {
  return ({
    inspect_room: "Read the latest responses",
    stage_probe: "Show a new situation",
    run_probe: "Run an interactive situation",
    propose_hypothesis: "Suggest a working idea",
    present_evidence: "Compare the evidence",
    stage_route_auditions: "Show three directions",
    propose_experiment: "Highlight a seven-day test",
  } as Record<string, string>)[tool] ?? "Use the page";
}

function versionLabel(event: WebMcpInvocationEvent): string {
  if (event.expectedVersion === undefined && event.stateVersion === undefined) return "Read only";
  if (event.stateVersion === undefined) return `Expected v${event.expectedVersion}`;
  if (event.expectedVersion === undefined || event.expectedVersion === event.stateVersion) return `v${event.stateVersion}`;
  return `v${event.expectedVersion} → v${event.stateVersion}`;
}

function persistenceLabel(value: WebMcpInvocationEvent["persistence"]): string {
  if (value === "saved") return "Saved to the workspace";
  if (value === "visual_only") return "Visual focus only";
  if (value === "pending") return "Execution in progress";
  return "No workspace change";
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to display this value.";
  }
}
