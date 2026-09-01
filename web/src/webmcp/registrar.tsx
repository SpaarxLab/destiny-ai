"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkspaceReader } from "../projections/workspace-reader";
import {
  WebMcpRegistrationManager,
  type WebMcpRegistrationState,
} from "./lifecycle";

export function WebMcpRegistrar({ reader }: { reader: WorkspaceReader | null }) {
  const manager = useRef<WebMcpRegistrationManager | null>(null);
  const [state, setState] = useState<WebMcpRegistrationState>({ status: "unsupported" });

  useEffect(() => {
    let cancelled = false;
    const registration = manager.current ?? new WebMcpRegistrationManager();
    manager.current = registration;

    if (!reader) {
      registration.stop();
      queueMicrotask(() => {
        if (!cancelled) setState({ status: "unsupported" });
      });
      return () => {
        cancelled = true;
      };
    }

    void registration.replace(reader).then((nextState) => {
      if (!cancelled && nextState) setState(nextState);
    });

    return () => {
      cancelled = true;
      registration.stop();
    };
  }, [reader]);

  const copy = agentStatusCopy(state);

  return (
    <span
      className="border border-[#a99b87] bg-[#eee8de] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[#5b4a34]"
      data-webmcp-status={state.status}
      title={state.status === "failed" ? state.message : undefined}
    >
      {copy}
    </span>
  );
}

export function agentStatusCopy(state: WebMcpRegistrationState): string {
  return state.status === "registered"
    ? "Agent tools detected"
    : state.status === "failed"
      ? "Agent tools unavailable"
      : "Agent tools not detected · Human mode";
}
