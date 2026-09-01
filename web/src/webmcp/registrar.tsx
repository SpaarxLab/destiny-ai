"use client";

import { useEffect, useRef, useState } from "react";
import type { WebMcpCommandAdapter } from "../adapters/webmcp-command-adapter";
import type { WorkspaceReader } from "../projections/workspace-reader";
import type { AgentActivityEvent } from "./activity";
import {
  WebMcpRegistrationManager,
  type WebMcpRegistrationState,
} from "./lifecycle";

export type { AgentActivityEvent } from "./activity";
export { agentCapabilityCopy } from "./contracts";
export type { WebMcpRegistrationState } from "./lifecycle";

export interface WebMcpRegistrarProps {
  reader: WorkspaceReader | null;
  commandAdapter?: WebMcpCommandAdapter | null;
  stateVersion?: number | null;
  onWorkspaceChanged?: (stateVersion: number) => void;
  onWorkspaceSyncError?: (error: unknown, stateVersion: number) => void;
  onAgentActivity?: (event: AgentActivityEvent) => void;
  onRegistrationChanged?: (state: WebMcpRegistrationState) => void;
}

/**
 * Registers the phase-shaped WebMCP catalogue for the current page state and renders a small
 * honest connection badge. Re-registration happens whenever the authoritative state version
 * changes, so the catalogue always matches what the participant sees.
 */
export function WebMcpRegistrar({
  reader,
  commandAdapter,
  stateVersion,
  onWorkspaceChanged,
  onWorkspaceSyncError,
  onAgentActivity,
  onRegistrationChanged,
}: WebMcpRegistrarProps) {
  const manager = useRef<WebMcpRegistrationManager | null>(null);
  const [state, setState] = useState<WebMcpRegistrationState>({ status: "unsupported" });
  const notify = useRef(onRegistrationChanged);

  useEffect(() => {
    notify.current = onRegistrationChanged;
  }, [onRegistrationChanged]);

  useEffect(() => {
    let cancelled = false;
    const registration = manager.current ?? new WebMcpRegistrationManager();
    manager.current = registration;

    if (!reader) {
      registration.stop();
      queueMicrotask(() => {
        if (!cancelled) {
          setState({ status: "unsupported" });
          notify.current?.({ status: "unsupported" });
        }
      });
      return () => {
        cancelled = true;
      };
    }

    void registration.replace(reader, {
      ...(commandAdapter ? { commandAdapter } : {}),
      ...(onWorkspaceChanged ? { onWorkspaceChanged } : {}),
      ...(onWorkspaceSyncError ? { onWorkspaceSyncError } : {}),
      ...(onAgentActivity ? { onAgentActivity } : {}),
    }).then((nextState) => {
      if (!cancelled && nextState) {
        setState(nextState);
        notify.current?.(nextState);
      }
    });

    return () => {
      cancelled = true;
      registration.stop();
    };
  }, [commandAdapter, onAgentActivity, onWorkspaceChanged, onWorkspaceSyncError, reader, stateVersion]);

  const copy = agentStatusCopy(state);

  return (
    <span
      className="agent-status"
      data-webmcp-status={state.status}
      data-webmcp-tools={state.status === "registered" ? state.toolNames.join(" ") : ""}
      title={state.status === "failed" ? state.message : undefined}
    >
      {copy}
    </span>
  );
}

export function agentStatusCopy(state: WebMcpRegistrationState): string {
  return state.status === "registered"
    ? "Agent connected"
    : state.status === "failed"
      ? "Agent tools unavailable"
      : "Human mode";
}
