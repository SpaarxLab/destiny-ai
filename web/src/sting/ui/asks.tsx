"use client";

import { useState } from "react";
import { MAX_RULES, openQuestion, rulesOfMe, voiceAt, type Workspace } from "../domain";
import { commitment } from "../hash";
import type { Move } from "../kernel";
import { playerName } from "../kernel";

type Act = (move: Move) => Promise<boolean>;

/** The one question the player paid a chip to ask. Only the person can answer, and only by tapping. */
export function QuestionCard({ ws, act }: { ws: Workspace; act: Act }) {
  const question = openQuestion(ws);
  if (!question) return null;
  return (
    <div className="ask sting-enter" role="group" aria-label="A question from the player">
      <span className="sting-eyebrow" style={{ color: "var(--cold)" }}>{playerName(question.player)} spent a chip to ask you one thing</span>
      <VoiceLine ws={ws} at={question.askedAt} />
      <h2 className="sting-title" style={{ marginTop: 6 }}>{question.text}</h2>
      <div className="ask__options">
        {question.options.map((option, index) => (
          <button key={option} className="ask__option" onClick={() => void act({ type: "answer_question", questionRef: question.ref, choice: index as 0 | 1 | 2 })}>
            {option}
          </button>
        ))}
      </div>
      <span className="sting-small">It gets one question a match. This was it.</span>
    </div>
  );
}

/** Everything the person has ruled out, in their words. Every tool description carries these. */
export function RulesOfMe({ ws, act }: { ws: Workspace; act: Act }) {
  const [draft, setDraft] = useState("");
  const rules = rulesOfMe(ws);
  const full = ws.rules.length >= MAX_RULES;
  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    const ok = await act({ type: "add_rule", text });
    if (ok) setDraft("");
  };
  return (
    <details className="rules" open={rules.length > 0}>
      <summary>rules of me · {rules.length}</summary>
      <p className="sting-small">Every line you cross out becomes a rule. Add your own. Any AI that opens this room reads them before it may speak.</p>
      {rules.length ? <ul className="rules__list">{rules.map((rule) => <li key={rule}>{rule}</li>)}</ul> : null}
      {!full ? (
        <form
          className="rules__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={120} placeholder="Never bring up…" aria-label="Add a rule in your words" />
          <button type="submit" className="sting-btn sting-btn--ghost" disabled={draft.trim().length < 3}>Add rule</button>
        </form>
      ) : (
        <span className="sting-small">Six is plenty.</span>
      )}
    </details>
  );
}

/** The sealed letter about the person's week: hidden from everyone until the dare is due, then scored by reality. */
export function LetterCard({ ws, act, now }: { ws: Workspace; act: Act; now: () => Date }) {
  const [verified, setVerified] = useState<"match" | "mismatch" | null>(null);
  const [didIt, setDidIt] = useState<boolean | null>(null);
  const letter = ws.letter;
  if (!letter) return null;
  const opens = new Date(letter.opensAt);
  const due = now().getTime() >= opens.getTime();
  const when = opens.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  const name = playerName(letter.player);

  if (letter.status === "opened" && letter.opened) {
    const hit = letter.opened.outcome === "hit";
    return (
      <div className="letter letter--open sting-enter">
        <span className="sting-eyebrow" style={{ color: hit ? "var(--cold)" : "var(--sting)" }}>the letter · {hit ? `${name} called your week right` : `${name} called your week wrong`}</span>
        <p className="letter__note">“{letter.sealed.note}”</p>
        <ul className="rules__list">
          <li>It bet you {letter.sealed.willDo ? "would" : "would not"} do it. You {letter.opened.didIt ? "did" : "did not"}.</li>
          <li>It guessed it would feel “{letter.sealed.feeling}”. You said {letter.opened.feltLikeIt ? "it did" : "it didn’t"}.</li>
          <li>{hit ? "+" : "−"}{Math.abs(letter.opened.chipsMoved)} chips, settled by your week, not your thumb.</li>
        </ul>
        <button
          className="sting-btn sting-btn--quiet"
          onClick={async () => setVerified((await commitment(letter.sealed, letter.operationId)) === letter.commitment ? "match" : "mismatch")}
        >
          verify the seal
        </button>
        {verified ? <span className="sting-small" style={{ color: verified === "match" ? "#6bcf7f" : "var(--sting)" }}>{verified === "match" ? `matches ✓ ${letter.commitment}` : "MISMATCH"} · hashed the day it was sealed, re-hashed here in your browser</span> : null}
      </div>
    );
  }

  return (
    <div className="letter sting-enter">
      <span className="sting-eyebrow" style={{ color: "var(--cold)" }}>a sealed letter about your week · {letter.commitment}</span>
      <p className="sting-body">
        {name} wrote down whether you’ll do it and how it will feel, then sealed it. Nobody can read it, not even the one who wrote it, until {when}.
      </p>
      {due ? (
        <div className="letter__open">
          <span className="sting-small">It’s {when}. Two taps and reality settles the bet.</span>
          <div className="ask__options">
            <button className={`ask__option ${didIt === true ? "ask__option--on" : ""}`} onClick={() => setDidIt(true)}>I did it</button>
            <button className={`ask__option ${didIt === false ? "ask__option--on" : ""}`} onClick={() => setDidIt(false)}>I didn’t</button>
          </div>
          {didIt !== null ? (
            <>
              <span className="sting-small">Did it feel the way you thought it would?</span>
              <div className="ask__options">
                <button className="ask__option" onClick={() => void act({ type: "open_letter", didIt, feltLikeIt: true })}>Yes</button>
                <button className="ask__option" onClick={() => void act({ type: "open_letter", didIt, feltLikeIt: false })}>No</button>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <span className="sting-small">Come back {when}. The tool to open it does not exist until then.</span>
      )}
    </div>
  );
}

/** What the player just said to the person, in its own voice. Shown next to the thing it said it about. */
export function VoiceLine({ ws, at }: { ws: Workspace; at: number }) {
  const line = voiceAt(ws, at);
  if (!line) return null;
  return (
    <p className={`voice ${line.player === "house" ? "voice--house" : ""}`} aria-live="polite">
      <span className="voice__who">{playerName(line.player)}</span> “{line.text}”
    </p>
  );
}
