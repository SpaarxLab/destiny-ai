"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Player, SceneTag } from "../domain";
import { playerName } from "../kernel";
import { Scene } from "./scenes";

export function Poster({
  line,
  scene,
  tone = "neutral",
  tag,
  state,
  onPick,
  disabled,
  ariaLabel,
}: {
  line: string;
  scene: SceneTag;
  tone?: "warm" | "cold" | "neutral";
  tag?: string;
  state?: "sting" | "secret" | "cold" | "dim" | "burn";
  onPick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const className = ["poster", state ? `poster--${state}` : ""].join(" ").trim();
  const inner = (
    <>
      <div className="poster__scene"><Scene tag={scene} tone={tone} /></div>
      <div className="poster__grain" />
      {tag ? <span className="poster__tag">{tag}</span> : null}
      <span className="poster__line">{line}</span>
    </>
  );
  if (!onPick) return <div className={className}>{inner}</div>;
  return (
    <button type="button" className={className} onClick={onPick} disabled={disabled} aria-label={ariaLabel ?? line} aria-pressed={state === "sting" || state === "secret"}>
      {inner}
    </button>
  );
}

export function Seal({ player, chips, commitment }: { player: Player; chips?: number; commitment?: string }) {
  const house = player === "house";
  return (
    <span className={`seal ${house ? "seal--house" : ""}`} aria-live="polite">
      <span className="seal__coin" aria-hidden="true" />
      {chips ? `${playerName(player)} has bet ${chips} ${chips === 1 ? "chip" : "chips"}` : `${playerName(player)} has sealed a guess`}
      {commitment ? <span style={{ opacity: 0.7, fontWeight: 500 }}>· {commitment}</span> : null}
    </span>
  );
}

export function Chips({ count, max = 24, player }: { count: number; max?: number; player: Player }) {
  const cells = Array.from({ length: Math.max(max, count) }, (_, index) => index < count);
  return (
    <span className="chips" aria-label={`${count} chips`}>
      <span className="chips__stack" aria-hidden="true">
        {cells.slice(0, 24).map((on, index) => <span key={index} className={`chip ${player === "house" ? "chip--house" : ""} ${on ? "" : "chip--gone"}`} />)}
      </span>
      <b style={{ marginLeft: 6 }}>{count}</b>
    </span>
  );
}

export function Thinking({ player, label }: { player: Player; label: string }) {
  return (
    <span className={`thinking ${player === "house" ? "thinking--house" : ""}`} role="status">
      <span className="thinking__dot" />
      {label}
    </span>
  );
}

export function Proof({ lines, details, children }: { lines: string[]; details?: string; children?: ReactNode }) {
  if (!lines.length) return null;
  return (
    <details className="proof">
      <summary>proof · {lines.length} {lines.length === 1 ? "tap" : "taps"}</summary>
      <ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul>
      {children}
      {details ? <div className="proof__details">{details}</div> : null}
    </details>
  );
}

/** Long-press (600 ms) with a visible ✕ fallback. Returns handlers and a pressing flag. */
export function useLongPress(onLongPress: () => void, ms = 600) {
  const timer = useRef<number | null>(null);
  const [pressing, setPressing] = useState(false);
  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setPressing(false);
  }, []);
  const start = useCallback(() => {
    clear();
    setPressing(true);
    timer.current = window.setTimeout(() => {
      setPressing(false);
      onLongPress();
    }, ms);
  }, [clear, ms, onLongPress]);
  useEffect(() => clear, [clear]);
  return {
    pressing,
    handlers: {
      onPointerDown: start,
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    },
  };
}

export function Toast({ text, tone }: { text: string; tone: "cold" | "warm" | "house" | "room" }) {
  return (
    <div className={`toast toast--${tone === "room" ? "cold" : tone}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}
