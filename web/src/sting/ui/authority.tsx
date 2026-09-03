"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { detectModelContext, subscribeToToolChanges, type WebMcpModelContext, type WebMcpRegisteredTool } from "../../webmcp/runtime";

export interface CatalogueTool {
  name: string;
  description?: string;
}

type NarrateFn = (removed: string[], added: string[]) => string | null;

interface TickerLine {
  id: string;
  text: string;
  at: number;
}

type ChipStatus = "normal" | "gone" | "new";

interface ChipView extends CatalogueTool {
  status: ChipStatus;
}

const READ_ONLY_TOOLS = new Set(["inspect_room"]);
const HUMAN_TOOL_NAMES: Record<string, string> = {
  inspect_room: "look at the game",
  stage_cast: "lay out lives",
  stage_duel: "place a bet",
  propose_hypothesis: "make a guess",
  ask_once: "ask once",
  present_evidence: "show the fight",
  stage_route_auditions: "show three lives",
  propose_experiment: "offer a dare",
  seal_letter: "seal a letter",
};
const GONE_MS = 600;
const NEW_MS = 900;

/** Reads the live WebMCP catalogue straight from `document.modelContext`, if present. */
export function useLiveCatalogue(): { names: string[]; tools: CatalogueTool[]; connected: boolean; lastChange: number | null } {
  const [tools, setTools] = useState<CatalogueTool[]>([]);
  const [lastChange, setLastChange] = useState<number | null>(null);
  // document.modelContext is attached synchronously (or not at all) before this component's first paint,
  // same assumption StingWebMcp makes; a lazy initializer keeps the connected flag out of the effect body.
  const [connected] = useState(() => detectModelContext() !== null);

  useEffect(() => {
    const context: WebMcpModelContext | null = detectModelContext();
    if (!context) return;
    let cancelled = false;

    const read = async () => {
      try {
        const result = context.getTools ? await context.getTools() : [];
        if (cancelled) return;
        setTools((result as readonly WebMcpRegisteredTool[]).map((tool) => ({ name: tool.name, description: tool.description })));
        setLastChange(Date.now());
      } catch {
        // The room re-registers constantly; a race here just waits for the next event.
      }
    };

    void read();
    const handler = () => void read();
    const unsubscribe = subscribeToToolChanges(context, handler);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const names = useMemo(() => tools.map((tool) => tool.name), [tools]);
  return { names, tools, connected, lastChange };
}

function defaultNarrate(removed: string[], added: string[]): string | null {
  if (removed.includes("stage_duel") || removed.includes("stage_probe")) return "The bet is sealed. Your choice decides it.";
  if (removed.includes("propose_hypothesis")) return "It lost the right to describe you.";
  if (removed.includes("present_evidence")) return "The ring is closed.";
  if (removed.includes("stage_route_auditions")) return "It has shown you the three lives.";
  if (removed.includes("propose_experiment")) return "The dare is yours now.";
  if (removed.includes("ask_once")) return "It spent its question.";
  if (added.includes("stage_cast")) return "It may lay out eight lives.";
  if (added.includes("stage_duel")) return "It may bet on you again.";
  if (added.includes("propose_hypothesis")) return "It has earned the right to describe you.";
  if (added.includes("seal_letter")) return "It may seal a letter about your week.";
  if (added.includes("open_letter")) return "The letter can be opened.";
  return null;
}

function relativeTime(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

export function AuthorityStrip({ fallbackNames, narrate }: { fallbackNames: string[]; narrate?: NarrateFn }) {
  const { tools } = useLiveCatalogue();
  // The room state is the same command kernel that shapes the catalogue. Hosts
  // can deliver toolchange late, so a stale browser read must not mislead people.
  const effectiveTools: CatalogueTool[] = fallbackNames.map((name) => ({ name }));
  const effectiveNames = useMemo(() => effectiveTools.map((tool) => tool.name), [effectiveTools]);
  const namesKey = effectiveNames.join("|");

  const toolsRef = useRef(effectiveTools);
  const narrateRef = useRef(narrate);
  useEffect(() => {
    toolsRef.current = effectiveTools;
    narrateRef.current = narrate;
  });

  const [chips, setChips] = useState<ChipView[]>(() => effectiveNames.map((name) => ({ name, description: effectiveTools.find((tool) => tool.name === name)?.description, status: "normal" })));
  const [lines, setLines] = useState<TickerLine[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const prevNamesRef = useRef<string[] | null>(null);

  useEffect(() => {
    const next = namesKey === "" ? [] : namesKey.split("|");
    const prev = prevNamesRef.current;
    const nextTools = toolsRef.current;

    if (prev === null) {
      prevNamesRef.current = next;
      setChips(next.map((name) => ({ name, description: nextTools.find((tool) => tool.name === name)?.description, status: "normal" })));
      return;
    }

    const prevSet = new Set(prev);
    const nextSet = new Set(next);
    const removed = prev.filter((name) => !nextSet.has(name));
    const added = next.filter((name) => !prevSet.has(name));
    prevNamesRef.current = next;
    if (removed.length === 0 && added.length === 0) return;

    const onlyInspectLeft = next.length === 1 && next[0] === "inspect_room";
    const narrated = (narrateRef.current ?? defaultNarrate)(removed, added) ?? (onlyInspectLeft ? "It can only watch now." : null);
    if (narrated) {
      setLines((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: narrated, at: Date.now() }, ...current].slice(0, 4));
    }

    setChips(() => {
      const view: ChipView[] = next.map((name) => ({ name, description: nextTools.find((tool) => tool.name === name)?.description, status: added.includes(name) ? "new" : "normal" }));
      const goneView: ChipView[] = removed.map((name) => ({ name, description: nextTools.find((tool) => tool.name === name)?.description, status: "gone" }));
      return [...view, ...goneView];
    });

    let goneTimer: number | undefined;
    let newTimer: number | undefined;
    if (removed.length) {
      goneTimer = window.setTimeout(() => setChips((current) => current.filter((chip) => chip.status !== "gone")), GONE_MS);
    }
    if (added.length) {
      newTimer = window.setTimeout(() => setChips((current) => current.map((chip) => (chip.status === "new" ? { ...chip, status: "normal" } : chip))), NEW_MS);
    }
    return () => {
      if (goneTimer) window.clearTimeout(goneTimer);
      if (newTimer) window.clearTimeout(newTimer);
    };
  }, [namesKey]);

  useEffect(() => {
    if (lines.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lines.length]);

  const raw = useMemo(() => effectiveTools.map((tool) => ({ name: tool.name, description: tool.description ?? null })), [effectiveTools]);

  const [open, setOpen] = useState(false);
  const latest = lines[0];

  return (
    <aside className={`authority ${open ? "authority--open" : ""}`} aria-label="what the agent may do">
      <button type="button" className="authority__head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="sting-eyebrow">why ChatGPT has limits</span>
        <span className="authority__count">{open ? "less" : "more"}</span>
      </button>
      <div className="authority__chips">
        {chips.map((chip) => {
          const readOnly = READ_ONLY_TOOLS.has(chip.name);
          return (
            <span
              key={chip.name}
              className={`authority__chip ${chip.status === "gone" ? "authority__chip--gone" : ""} ${chip.status === "new" ? "authority__chip--new" : ""} ${readOnly ? "authority__chip--read" : ""}`}
              title={`${chip.description ?? "no description given"} · ${readOnly ? "read only" : "can act"}`}
            >
              <span className="authority__glyph" aria-hidden="true">{readOnly ? "\u{1F441}" : "✎"}</span>
              <span className="authority__chip-name">{HUMAN_TOOL_NAMES[chip.name] ?? chip.name}</span>
            </span>
          );
        })}
      </div>
      {!open && latest ? (
        <p className="authority__latest sting-small" aria-live="polite">
          {latest.text} <span className="authority__ticker-time">{relativeTime(latest.at, now)}</span>
        </p>
      ) : null}
      {open ? (
        <>
          <p className="authority__note sting-small">The page decides what ChatGPT may do. Your taps and final calls stay yours.</p>
          <ul className="authority__ticker" aria-live="polite">
            {lines.map((line) => (
              <li key={line.id}>
                <span>{line.text}</span>
                <span className="authority__ticker-time">{relativeTime(line.at, now)}</span>
              </li>
            ))}
          </ul>
          <details className="authority__verify">
            <summary>technical details</summary>
            <p className="sting-small">Browser-reported tools are shown here for debugging.</p>
            <pre>{JSON.stringify({ roomAllows: raw, browserReports: tools }, null, 2)}</pre>
          </details>
        </>
      ) : null}
    </aside>
  );
}
