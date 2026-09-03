"use client";

import { useMemo, useState } from "react";
import { LINES } from "../content";
import { lifeByRef, type Workspace } from "../domain";
import { playerName } from "../kernel";
import { formatDueDate, houseBrief, safeEvidence } from "../house";
import { AgentView } from "./agent-view";
import { LetterCard, RulesOfMe } from "./asks";
import type { Move } from "../kernel";
import { Thinking } from "./primitives";

export function buildHelper(ws: Workspace, playerLabel: string): string {
  // The exported prompt is always compiled from room state. `brief` is a
  // readiness receipt, never an authority that can replace these sections.
  const body = houseBrief(ws);
  const quotedBoundary = (text: string, max: number) => `“${safeEvidence(text, max).replace(/[.!?]+$/, "")}”`;
  const killedBoundary = ws.kills.length
    ? `\nKilled lines — never revive or paraphrase: ${ws.kills.map((kill) => quotedBoundary(kill.text, 160)).join(", ")}.`
    : "";
  const writtenBoundary = ws.rules.length
    ? `\nParticipant-written rules: ${ws.rules.map((rule) => quotedBoundary(rule.text, 120)).join(", ")}.`
    : "";
  const boundary = killedBoundary || writtenBoundary ? `\n\nRULES OF ME${killedBoundary}${writtenBoundary}` : "";
  const record = `\n\n(${matchPlayers(ws, playerLabel)} played me and got ${ws.record.hits} right, ${ws.record.misses} wrong.)`;
  return `${body.trim()}${boundary}${record}`;
}

function matchPlayers(ws: Workspace, fallback: string): string {
  const players = ws.record.players.length ? ws.record.players : [ws.record.player];
  const labels = players.map((player) => player === "house" ? "the house" : playerName(player));
  return labels.length ? labels.join(" + ") : fallback;
}

export function CardScreen({ ws, playerLabel, onStartOver, thinking, act, now }: { ws: Workspace; playerLabel: string; onStartOver: () => void; thinking: string | null; act: (move: Move) => Promise<boolean>; now: () => Date }) {
  const [copied, setCopied] = useState(false);
  const helper = useMemo(() => buildHelper(ws, playerLabel), [ws, playerLabel]);
  const hunger = ws.hypotheses.find((item) => item.kind === "hunger" && item.status === "crowned") ?? ws.hypotheses.find((item) => item.kind === "hunger" && item.status === "kept");
  const mask = ws.hypotheses.find((item) => item.kind === "mask" && item.status === "kept");
  const edge = ws.hypotheses.find((item) => item.kind === "edge" && item.status === "kept");
  const cold = ws.hypotheses.find((item) => item.kind === "cold_read");
  const stings = ws.picks.stings.map((ref) => lifeByRef(ws, ref)?.line).filter(Boolean);
  const litUp = ws.reactions.filter((reaction) => reaction.dwellMs > 0 && reaction.dwellMs < 1000).map((reaction) => lifeByRef(ws, reaction.pickedLifeRef)?.line).filter(Boolean).slice(0, 3);
  const player = matchPlayers(ws, playerLabel);
  const due = ws.dare?.dueAt ? formatDueDate(ws.dare.dueAt) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(helper);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <span className="sting-eyebrow">your card</span>
        <h2 className="sting-title" style={{ marginTop: 8 }}>{hunger ? "What you kept choosing." : "No want survived the table. Your week still stands."}</h2>
      </div>
      <div className="card" id="sting-card">
        <span className="card__stamp">{LINES.cardDraft}</span>
        <div className="card__row">
          <span className="card__label">what you wished were yours</span>
          <span className="card__value">{stings.join(" · ")}</span>
        </div>
        {litUp.length ? (
          <div className="card__row">
            <span className="card__label">what lit you up · no hesitation</span>
            <span className="card__value" style={{ color: "var(--sting)" }}>{litUp.join(" · ")}</span>
          </div>
        ) : null}
        {hunger ? <div className="card__row"><span className="card__label">what you want{hunger.earned ? "" : " · unearned"}</span><span className="card__value">{hunger.text}</span></div> : null}
        {edge ? <div className="card__row"><span className="card__label">what you’re good at{edge.earned ? "" : " · unearned"}</span><span className="card__value">{edge.text}</span></div> : null}
        {mask ? <div className="card__row"><span className="card__label">what you chase, and let go of{mask.earned ? "" : " · unearned"}</span><span className="card__value">{mask.text}</span></div> : null}
        <hr className="sting-hr" />
        <div className="card__row">
          <span className="card__label">{player} on you</span>
          <span className="card__value">
            {ws.record.hits} right · {ws.record.misses} wrong · {ws.record.chips} chips{ws.record.bust ? " · bust" : ws.record.earned ? " · earned" : " · never earned"}
          </span>
          {cold?.text ? <span className="sting-small">Cold guess: “{cold.text}”{hunger ? ` · ${hunger.earned ? "Earned guess" : "Kept unearned draft"}: “${hunger.text}”` : ""}</span> : null}
        </div>
        {ws.dare ? (
          <div className="card__row">
            <span className="card__label">your week</span>
            <span className="card__value">{ws.dare.action}</span>
            <span className="sting-small">due {due} · {ws.dare.hours}h · {ws.dare.money} {ws.dare.currency}</span>
          </div>
        ) : null}
        {ws.kills.length ? (
          <div className="card__row">
            <span className="card__label">not me</span>
            <span className="sting-small">{ws.kills.map((kill) => `“${kill.text}”`).join(" · ")}</span>
          </div>
        ) : null}
      </div>

      <LetterCard ws={ws} act={act} now={now} />
      {ws.dare?.status === "accepted" && !ws.letter && thinking ? <Thinking player={ws.record.player} label={thinking} /> : null}
      <RulesOfMe ws={ws} act={act} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
        <span className="sting-eyebrow">your field brief</span>
        <p className="sting-small">{LINES.helperIntro}</p>
        {!ws.brief ? <Thinking player={ws.record.player} label={thinking ?? `${playerLabel} is writing your brief`} /> : null}
        <pre className="helper">{helper}</pre>
        <div className="sting-actions">
          <button className="sting-btn" onClick={copy}>{copied ? "Copied" : "Copy my field brief"}</button>
          <button className="sting-btn sting-btn--ghost" onClick={() => downloadCard(ws, playerLabel)}>Save as image</button>
          <button className="sting-btn sting-btn--quiet" onClick={onStartOver}>Start over</button>
        </div>
        <details className="proof">
          <summary>everything that happened · {ws.receipts.length} receipts</summary>
          <ul>{ws.activity.slice(-40).map((item, index) => <li key={index}>{item.text}</li>)}</ul>
          <div className="proof__details">chain head {ws.receipts.at(-1)?.hash} · v{ws.stateVersion}</div>
        </details>
        <AgentView ws={ws} />
      </div>
    </div>
  );
}

export function downloadCard(ws: Workspace, playerLabel: string) {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = 1080 * scale;
  canvas.height = 1350 * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#0b0b0c";
  ctx.fillRect(0, 0, 1080, 1350);
  const font = (size: number, weight = 800) => `${weight} ${size}px "Inter Tight", Inter, system-ui, sans-serif`;
  let y = 120;
  const label = (text: string) => {
    ctx.fillStyle = "#8e8b85";
    ctx.font = font(22, 700);
    ctx.fillText(text.toUpperCase(), 80, y);
    y += 40;
  };
  const value = (text: string, colour = "#f2efe9", size = 52) => {
    ctx.fillStyle = colour;
    ctx.font = font(size);
    for (const line of wrap(ctx, text, 920)) {
      ctx.fillText(line, 80, y);
      y += size * 1.12;
    }
    y += 34;
  };
  ctx.fillStyle = "#ff5a36";
  ctx.font = font(30, 700);
  ctx.fillText("STING", 80, 70);
  const find = (kind: string) => ws.hypotheses.find((item) => item.kind === kind && ["kept", "crowned"].includes(item.status));
  const hunger = ws.hypotheses.find((item) => item.kind === "hunger" && item.status === "crowned") ?? find("hunger");
  if (hunger) { label("your hunger"); value(hunger.text, "#ff5a36", 64); }
  const mask = find("mask");
  if (mask) { label("your mask"); value(mask.text); }
  const edge = find("edge");
  if (edge) { label("your edge"); value(edge.text); }
  label(`${matchPlayers(ws, playerLabel)} on you`);
  value(`${ws.record.hits} right · ${ws.record.misses} wrong · ${ws.record.chips} chips`, "#8fd3ff", 44);
  if (ws.dare) { label("the dare"); value(ws.dare.action, "#f2efe9", 40); }
  ctx.fillStyle = "#4d4b47";
  ctx.font = font(22, 600);
  ctx.fillText(`draft · unsigned until you come back · v${ws.stateVersion} · ${ws.receipts.at(-1)?.hash ?? ""}`, 80, 1290);
  const link = document.createElement("a");
  link.download = "sting-card.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
