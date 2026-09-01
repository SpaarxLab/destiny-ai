"use client";

import { useState } from "react";
import type { RouteEdit } from "../../domain/commands";
import type { RouteProposalSet } from "../../domain/workspace";
import type { RouteMarks } from "../journey/journey-state";
import { ActionButton } from "../primitives/action-button";
import { RouteCard } from "./route-card";
import { RouteComparison } from "./route-comparison";

interface RouteRoomProps {
  routeSet: RouteProposalSet;
  marks: Record<string, RouteMarks>;
  busy: boolean;
  statusMessage: string;
  onMarksChange: (routeRef: string, marks: RouteMarks) => void;
  onEdit: (edit: RouteEdit) => Promise<boolean>;
  onReject: (routeRef: string) => Promise<boolean>;
  onChoose: (routeRef: string) => Promise<void>;
}

export function RouteRoom({
  routeSet,
  marks,
  busy,
  statusMessage,
  onMarksChange,
  onEdit,
  onReject,
  onChoose,
}: RouteRoomProps) {
  const [compare, setCompare] = useState(false);
  const activeCount = routeSet.routes.filter((route) => route.status !== "rejected").length;

  return (
    <section className="route-room" aria-labelledby="route-room-title">
      <header className="route-room__header">
        <div>
          <p className="eyebrow">Your Route Room</p>
          <h1 id="route-room-title" tabIndex={-1}>Three directions. No winner picked for you.</h1>
          <p>
            Each route starts from your confirmed words and asks a different question. Edit, set
            aside, and mark them before you choose one small test.
          </p>
        </div>
        <ActionButton
          aria-expanded={compare}
          aria-controls="route-comparison"
          disabled={activeCount < 2}
          onClick={() => setCompare((value) => !value)}
        >
          {compare ? "Hide comparison" : "Compare my marks"}
        </ActionButton>
      </header>

      <div className="status-region" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      {compare ? (
        <div id="route-comparison">
          <RouteComparison routes={routeSet.routes} marks={marks} />
        </div>
      ) : null}

      <div className="route-grid">
        {routeSet.routes.map((route) => (
          <RouteCard
            key={route.ref}
            route={route}
            marks={marks[route.ref] ?? { draws: "", worries: "", teaches: "" }}
            busy={busy}
            onMarksChange={(nextMarks) => onMarksChange(route.ref, nextMarks)}
            onEdit={onEdit}
            onReject={() => onReject(route.ref)}
            onChoose={() => onChoose(route.ref)}
          />
        ))}
      </div>
    </section>
  );
}
