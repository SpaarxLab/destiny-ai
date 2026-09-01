"use client";

import { useState, type FormEvent } from "react";
import { COPY } from "../../content/journey";
import type { JourneyLimits } from "../journey/journey-state";
import { ActionButton } from "../primitives/action-button";
import { StepShell } from "../primitives/step-shell";

export function LimitsScreen({
  limits,
  busy,
  statusMessage,
  onBack,
  onSubmit,
}: {
  limits: JourneyLimits | undefined;
  busy: boolean;
  statusMessage: string;
  onBack: () => void;
  onSubmit: (limits: JourneyLimits) => void;
}) {
  const [hours, setHours] = useState(limits?.hoursPerWeek ? String(limits.hoursPerWeek) : "");
  const [money, setMoney] = useState(limits ? String(limits.money) : "0");
  const [currency, setCurrency] = useState(limits?.currency ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedHours = Number(hours);
    const parsedMoney = Number(money);
    const parsedCurrency = currency.trim().toUpperCase();
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setError("Give yourself at least a little time each week.");
      return;
    }
    if (!Number.isFinite(parsedMoney) || parsedMoney < 0) {
      setError("Money can be zero, but not negative.");
      return;
    }
    if (!/^[A-Z]{3}$/.test(parsedCurrency)) {
      setError("Use a three-letter currency code, such as INR, USD, or GBP.");
      return;
    }
    setError("");
    onSubmit({ hoursPerWeek: parsedHours, money: parsedMoney, currency: parsedCurrency });
  }

  return (
    <StepShell
      eyebrow="Keep it realistic"
      title="What limits must every small test respect?"
      description="Hard ceilings, not targets. Every route has to fit inside them."
    >
      <form className="answer-form limits-form" onSubmit={submit}>
        <label htmlFor="hours-per-week">Time each week</label>
        <div className="field-with-suffix">
          <input id="hours-per-week" inputMode="decimal" min="0.25" step="0.25" type="number" required value={hours} onChange={(event) => setHours(event.target.value)} />
          <span>hours</span>
        </div>
        <label htmlFor="money-limit">Most you would spend on one test</label>
        <input id="money-limit" inputMode="decimal" min="0" step="0.01" type="number" required value={money} onChange={(event) => setMoney(event.target.value)} />
        <label htmlFor="currency-code">Currency</label>
        <input id="currency-code" autoCapitalize="characters" maxLength={3} placeholder="INR" required value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
        <div className="status-region" role="status" aria-live="polite">{error || statusMessage}</div>
        <div className="step-actions">
          <ActionButton disabled={busy} onClick={onBack}>{COPY.back}</ActionButton>
          <ActionButton disabled={busy} tone="primary" type="submit">{busy ? "Saving…" : "Save my words and limits"}</ActionButton>
        </div>
      </form>
    </StepShell>
  );
}
