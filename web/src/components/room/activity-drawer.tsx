"use client";

import { useEffect, useRef } from "react";
import type { ActivityLine } from "../journey/ledger-sentences";
import { ActionButton } from "../primitives/action-button";

export function ActivityDrawer({
  open,
  lines,
  onClose,
}: {
  open: boolean;
  lines: ActivityLine[];
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => heading.current?.focus());
  }, [open]);

  if (!open) return null;

  return (
    <aside className="drawer" role="dialog" aria-modal="false" aria-labelledby="activity-title">
      <div className="drawer__head">
        <div>
          <p className="eyebrow">What happened</p>
          <h2 id="activity-title" ref={heading} tabIndex={-1}>Every change, in order</h2>
        </div>
        <ActionButton onClick={onClose} tone="quiet">Close</ActionButton>
      </div>
      <p className="drawer__note">Each saved change carries a receipt. Reads by ChatGPT are shown for this session only.</p>
      {lines.length === 0 ? <p className="drawer__empty">Nothing has been saved yet.</p> : null}
      <ol className="activity-list">
        {lines.map((line) => (
          <li key={line.id} className={`activity-line activity-line--${line.actor}${line.denied ? " activity-line--denied" : ""}`}>
            <span className="activity-line__actor" aria-hidden="true">{line.actor === "you" ? "You" : "AI"}</span>
            <div>
              <p>{line.sentence}</p>
              <p className="activity-line__meta">
                {line.session ? <span className="tag tag--quiet">this session</span> : null}
                {line.receipt ? <span>{line.receipt}</span> : null}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
