"use client";

import type { JourneyLimits } from "../journey/journey-state";
import { ActionButton } from "../primitives/action-button";
import { StepShell } from "../primitives/step-shell";
import { WordsPanel, type WordSlip } from "../room/words-panel";

export interface AssistantStatus {
  enabled: boolean;
  label: string;
}

export function HandoffScreen({
  words,
  limits,
  capabilityLine,
  agentConnected,
  parkedNote,
  assistant,
  assistantConsent,
  busy,
  statusMessage,
  onConsentChange,
  onAskAssistant,
  onDraftMyOwn,
}: {
  words: WordSlip[];
  limits: JourneyLimits | undefined;
  capabilityLine: string;
  agentConnected: boolean;
  parkedNote: string | null;
  assistant: AssistantStatus | null;
  assistantConsent: boolean;
  busy: boolean;
  statusMessage: string;
  onConsentChange: (value: boolean) => void;
  onAskAssistant: () => void;
  onDraftMyOwn: () => void;
}) {
  return (
    <StepShell
      eyebrow="Your words are ready"
      title="Now three routes can be proposed."
      description={parkedNote ?? "Each route must quote your words, respect your limits, and fit one small test."}
      wide
    >
      <div className="handoff">
        <div className="handoff__paths">
          <section className={`path-card path-card--primary${agentConnected ? " path-card--live" : ""}`} aria-labelledby="path-chatgpt">
            <p className="eyebrow">With ChatGPT</p>
            <h2 id="path-chatgpt">Ask ChatGPT for three routes</h2>
            <p>
              {agentConnected
                ? "ChatGPT is connected to this page. Ask it to read your room and propose three routes. The room updates by itself."
                : "Open this page in ChatGPT's browser and ask it to read your room and propose three routes. The room updates by itself."}
            </p>
            <p className="capability-line" data-testid="capability-line">{capabilityLine}</p>
            <p className="path-card__example">Try: “Read my Destiny room and propose three routes.”</p>
          </section>

          {assistant?.enabled ? (
            <section className="path-card" aria-labelledby="path-assistant">
              <p className="eyebrow">Without ChatGPT</p>
              <h2 id="path-assistant">Ask {assistant.label}</h2>
              <label className="consent">
                <input type="checkbox" checked={assistantConsent} onChange={(event) => onConsentChange(event.target.checked)} />
                <span>Send my confirmed words and limits to {assistant.label} to draft three routes.</span>
              </label>
              <ActionButton disabled={busy || !assistantConsent} onClick={onAskAssistant} fullWidth>
                {busy ? "Drafting…" : "Draft three routes for me"}
              </ActionButton>
            </section>
          ) : null}

          <section className="path-card" aria-labelledby="path-own">
            <p className="eyebrow">By hand</p>
            <h2 id="path-own">Draft my own three routes</h2>
            <p>Three starter drafts you can rewrite before they enter your room.</p>
            <ActionButton disabled={busy} onClick={onDraftMyOwn} fullWidth>Draft my own</ActionButton>
          </section>
          <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
        </div>

        <div className="handoff__side">
          <WordsPanel words={words} activeQuotes={[]} title="Words a route may quote" />
          {limits ? (
            <p className="limits-line">
              Limits: {limits.hoursPerWeek} hours a week · {limits.money} {limits.currency} per test · seven days at most
            </p>
          ) : null}
        </div>
      </div>
    </StepShell>
  );
}
