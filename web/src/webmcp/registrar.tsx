"use client";

import { useEffect, useRef, useState } from "react";
import type { WebMcpCommandAdapter } from "../adapters/webmcp-command-adapter";
import type { WorkspaceReader } from "../projections/workspace-reader";
import type { AgentActivityEvent } from "./activity";
import type { Workspace } from "../domain/workspace";
import type { EvidencePresentation } from "./tools/chatgpt-experience";
import type { WebMcpInvocationListener } from "./invocation-log";
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
  catalogueKey?: string | null;
  loadWorkspace?: () => Workspace;
  onWorkspaceChanged?: (stateVersion: number) => void;
  onWorkspaceSyncError?: (error: unknown, stateVersion: number) => void;
  onAgentActivity?: (event: AgentActivityEvent) => void;
  onRegistrationChanged?: (state: WebMcpRegistrationState) => void;
  onEvidencePresented?: (presentation: EvidencePresentation | null) => void;
  onInvocation?: WebMcpInvocationListener;
}

/**
 * Registers the phase-shaped WebMCP catalogue for the current page state and renders a small
 * honest connection badge. Re-registration follows phase-shaped catalogue changes; ordinary
 * state writes leave the active invocation signal intact so staged work can recover cleanly.
 */
export function WebMcpRegistrar({
  reader,
  commandAdapter,
  catalogueKey,
  loadWorkspace,
  onWorkspaceChanged,
  onWorkspaceSyncError,
  onAgentActivity,
  onRegistrationChanged,
  onEvidencePresented,
  onInvocation,
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
      ...(loadWorkspace ? { loadWorkspace } : {}),
      catalogueMode: "chatgpt",
      ...(onEvidencePresented ? { onEvidencePresented } : {}),
      ...(onInvocation ? { onInvocation } : {}),
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
  }, [catalogueKey, commandAdapter, loadWorkspace, onAgentActivity, onEvidencePresented, onInvocation, onWorkspaceChanged, onWorkspaceSyncError, reader]);

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
    ? "ChatGPT connected"
    : state.status === "failed"
      ? "Agent tools unavailable"
      : "Open this from ChatGPT";
}
