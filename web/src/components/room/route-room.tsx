"use client";

import { useState } from "react";
import type { RouteEdit } from "../../domain/commands";
import type { OrientationProjection } from "../../domain/reads";
import type { FollowUpQuestion, QuoteSource, RouteProposalSet } from "../../domain/workspace";
import { ACTOR_NAMES, PROVENANCE_LABELS, ROUTE_LABELS } from "../../content/journey";
import type { RouteNotes } from "../journey/journey-state";
import { FollowUpCard } from "./follow-up-card";
import { RouteCard } from "./route-card";
import { WordsPanel, type WordSlip } from "./words-panel";

interface RouteRoomProps {
  routeSet: RouteProposalSet | null;
  followUp: FollowUpQuestion | null;
  words: WordSlip[];
  orientation: OrientationProjection | null;
  notes: Record<string, RouteNotes>;
  busy: boolean;
  onNotesChange: (routeRef: string, notes: RouteNotes) => void;
  onEdit: (edit: RouteEdit) => Promise<boolean>;
  onSetAside: (routeRef: string) => Promise<boolean>;
  onChoose: (routeRef: string) => Promise<void>;
  onAnswerFollowUp: (text: string) => Promise<void>;
  onSkipFollowUp: () => Promise<void>;
}

export function RouteRoom({
  routeSet,
  followUp,
  words,
  orientation,
  notes,
  busy,
  onNotesChange,
  onEdit,
  onSetAside,
  onChoose,
  onAnswerFollowUp,
  onSkipFollowUp,
}: RouteRoomProps) {
  const [activeQuotes, setActiveQuotes] = useState<QuoteSource[] | null>(null);
  const hasCarries = routeSet?.routes.some((route) => route.carriedFromRouteRef) ?? false;
  const live = routeSet?.routes.filter((route) => route.status !== "rejected") ?? [];
  const aside = routeSet?.routes.filter((route) => route.status === "rejected") ?? [];
  const stateLine = routeSet
    ? aside.length === 0
      ? "Three routes are waiting for you. Edit, set aside, or choose one."
      : orientation?.proposal.available && orientation.proposal.mode === "replace_rejected"
        ? `You set ${listKinds(aside.map((route) => ROUTE_LABELS[route.kind].name))} aside. ${routeSet.createdBy === "participant" ? "You" : ACTOR_NAMES[routeSet.createdBy]} can replace ${aside.length === 1 ? "it" : "them"}; the rest stay as they are.`
        : `You set ${listKinds(aside.map((route) => ROUTE_LABELS[route.kind].name))} aside.`
    : followUp
      ? "One question is waiting for you before routes can be proposed."
      : "";

  return (
    <section className="room" aria-labelledby="room-title">
      <header className="room__head">
        <div>
          <p className="eyebrow">Your Route Room</p>
          <h1 id="room-title" tabIndex={-1}>
            {routeSet ? "Three directions. You pick the one to test." : "One question first"}
          </h1>
          {stateLine ? <p className="room__state">{stateLine}</p> : null}
        </div>
        {routeSet ? (
          <span className={`provenance provenance--${routeSet.createdBy}`} data-testid="provenance">
            {PROVENANCE_LABELS[routeSet.createdBy]}
          </span>
        ) : null}
      </header>

      <div className="room__layout">
        <div className="room__main">
          {followUp && followUp.status === "proposed" ? (
            <FollowUpCard
              followUp={followUp}
              words={words}
              busy={busy}
              onAnswer={onAnswerFollowUp}
              onSkip={onSkipFollowUp}
            />
          ) : null}

          {routeSet ? (
            <div className="route-grid">
              {routeSet.routes.map((route) => (
                <RouteCard
                  key={route.ref}
                  route={route}
                  provenance={routeSet.createdBy}
                  replacement={hasCarries && !route.carriedFromRouteRef}
                  notes={notes[route.ref] ?? { draws: "", worries: "", teaches: "" }}
                  busy={busy}
                  onNotesChange={(next) => onNotesChange(route.ref, next)}
                  onEdit={onEdit}
                  onSetAside={() => onSetAside(route.ref)}
                  onChoose={() => onChoose(route.ref)}
                  onHighlight={setActiveQuotes}
                />
              ))}
            </div>
          ) : null}
          {routeSet && live.length === 1 ? (
            <p className="room__hint">One route is left in the running. You can still choose it, or ask for a replacement.</p>
          ) : null}
        </div>

        <WordsPanel
          words={words}
          activeQuotes={activeQuotes ?? []}
          note="Point at a route to see the exact words it quotes."
        />
      </div>
    </section>
  );
}

function listKinds(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "a route";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
