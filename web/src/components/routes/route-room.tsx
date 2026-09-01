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
  reviewedRoutes: Record<string, boolean>;
  hasComparedRoutes: boolean;
  busy: boolean;
  statusMessage: string;
  onMarksChange: (routeRef: string, marks: RouteMarks) => void;
  onReviewed: (routeRef: string) => void;
  onComparisonSeen: () => void;
  onEdit: (edit: RouteEdit) => Promise<boolean>;
  onReject: (routeRef: string) => Promise<boolean>;
  onChoose: (routeRef: string) => Promise<void>;
}

export function RouteRoom({
  routeSet,
  marks,
  reviewedRoutes,
  hasComparedRoutes,
  busy,
  statusMessage,
  onMarksChange,
  onReviewed,
  onComparisonSeen,
  onEdit,
  onReject,
  onChoose,
}: RouteRoomProps) {
  const [compare, setCompare] = useState(false);
  const activeRoutes = routeSet.routes.filter((route) => route.status !== "rejected");
  const activeCount = activeRoutes.length;
  const canChoose =
    hasComparedRoutes && activeRoutes.every((route) => reviewedRoutes[route.ref] === true);

  function toggleComparison() {
    const next = !compare;
    setCompare(next);
    if (next) onComparisonSeen();
  }

  async function editRoute(edit: RouteEdit) {
    const saved = await onEdit(edit);
    if (saved) setCompare(false);
    return saved;
  }

  async function rejectRoute(routeRef: string) {
    const saved = await onReject(routeRef);
    if (saved) setCompare(false);
    return saved;
  }

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
          onClick={toggleComparison}
        >
          {compare ? "Hide comparison" : "Compare my marks"}
        </ActionButton>
      </header>

      <div className="status-region" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      <p className="scratch-note">
        Your route notes stay in this browser. They are not shared with ChatGPT or included in
        route decisions.
      </p>

      {!canChoose ? (
        <p className="choice-gate-note" id="choice-gate-note">
          Review every active route and open the comparison before choosing one to test.
        </p>
      ) : null}

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
            reviewed={reviewedRoutes[route.ref] === true}
            chooseDisabled={!canChoose}
            busy={busy}
            onMarksChange={(nextMarks) => onMarksChange(route.ref, nextMarks)}
            onReviewed={() => onReviewed(route.ref)}
            onEdit={editRoute}
            onReject={() => rejectRoute(route.ref)}
            onChoose={() => onChoose(route.ref)}
          />
        ))}
      </div>
    </section>
  );
}
