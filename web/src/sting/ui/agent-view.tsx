"use client";

import { useMemo } from "react";
import { START_CHIPS, type Workspace } from "../domain";
import { inspectRoom } from "../webmcp";

/** Plain-English restatement of `inspectRoom(ws)`, with the raw JSON one tap away. */
export function AgentView({ ws }: { ws: Workspace }) {
  const room = useMemo(() => inspectRoom(ws), [ws]);
  const sentence = useMemo(() => describe(ws, room), [ws, room]);

  return (
    <details className="proof agent-view">
      <summary>what the agent sees</summary>
      <p className="sting-small">{sentence}</p>
      <details className="agent-view__raw">
        <summary>raw JSON</summary>
        <pre>{JSON.stringify(room, null, 2)}</pre>
      </details>
    </details>
  );
}

function describe(ws: Workspace, room: ReturnType<typeof inspectRoom>): string {
  const parts: string[] = [];
  parts.push(`Phase: ${room.phase}.`);
  parts.push(`Chips: ${room.record.chips} of ${START_CHIPS} to start.`);
  const duelCount = room.duels.length;
  parts.push(`${duelCount} ${duelCount === 1 ? "duel" : "duels"}, ${room.record.hits} right, ${room.record.misses} wrong.`);
  parts.push("Sealed bets: hidden until you tap.");
  if (ws.kills.length) {
    parts.push(`Killed lines it may never say again: ${ws.kills.map((kill) => `'${kill.text}'`).join(", ")}.`);
  }
  return parts.join(" ");
}
