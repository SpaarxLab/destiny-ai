"use client";

import { useEffect, useRef } from "react";
import { ActionButton } from "../primitives/action-button";

export function AgentViewPanel({
  open,
  json,
  onClose,
}: {
  open: boolean;
  json: string;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => heading.current?.focus());
  }, [open]);

  if (!open) return null;

  return (
    <aside className="drawer drawer--wide" role="dialog" aria-modal="false" aria-labelledby="agent-view-title">
      <div className="drawer__head">
        <div>
          <p className="eyebrow">See what ChatGPT sees</p>
          <h2 id="agent-view-title" ref={heading} tabIndex={-1}>Everything the agent can read</h2>
        </div>
        <ActionButton onClick={onClose} tone="quiet">Close</ActionButton>
      </div>
      <p className="drawer__note">
        This is the exact view an agent receives when it reads your room. Your private notes are not in it.
      </p>
      <pre className="agent-json" data-testid="agent-view-json"><code>{json}</code></pre>
    </aside>
  );
}
