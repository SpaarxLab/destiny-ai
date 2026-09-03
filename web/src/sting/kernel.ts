import {
  AXES,
  LETTER_STAKE,
  MAX_DUELS,
  MAX_RULES,
  QUESTION_COST,
  MAX_LIFE_WORDS,
  MIN_DUELS,
  SLOW_DWELL_MS,
  answeredDuels,
  isEarned,
  lifeByRef,
  openProbe,
  openQuestion,
  wordCount,
  type Bet,
  type Hypothesis,
  type HypothesisKind,
  type Life,
  type LifePoster,
  type Phase,
  type Player,
  type Receipt,
  type Workspace,
} from "./domain";
import { LABEL_WORDS, OUT_OF_BOUNDS, nearDuplicate } from "./content";
import { chainHash, commitment } from "./hash";
import type { StingStore } from "./store";
import { StoreError } from "./store";

export type Actor = "participant" | Player;

interface Base {
  operationId: string;
  expectedVersion: number;
}

export type Command = Base &
  (
    | { type: "start"; timing?: boolean }
    | { type: "cast"; player: Player; lives: Life[]; aside?: string }
    | { type: "pick_life"; lifeRef: string; dwellMs: number }
    | { type: "unpick_life"; lifeRef: string }
    | { type: "skip_secret" }
    | { type: "propose_hypothesis"; player: Player; kind: HypothesisKind; text: string; proofRefs?: string[]; revises?: string; correction?: string; aside?: string }
    | { type: "stage_duel"; player: Player; lives: [Life, Life]; variable: string; bet: Bet; testsLifeRef?: string; aside?: string }
    | { type: "react"; probeRef: string; pick: "a" | "b"; dwellMs: number }
    | { type: "close_duels"; player: Player; aside?: string }
    | { type: "kill"; hypothesisRef: string }
    | { type: "keep_all" }
    | { type: "stage_fight"; player: Player; refs: [string, string] }
    | { type: "crown"; hypothesisRef: string }
    | { type: "stage_lives"; player: Player; posters: LifePoster[]; aside?: string }
    | { type: "choose_poster"; posterRef: string }
    | { type: "propose_dare"; player: Player; dare: { action: string; doneLooksLike: string; days: number; hours: number; money: number; currency: "INR" | "USD" | "EUR" | "GBP" | "AED"; source?: { url: string; excerpt: string } } }
    | { type: "accept_dare"; hours: number; money: number; currency: "INR" | "USD" | "EUR" | "GBP" | "AED" }
    | { type: "write_brief"; player: Player; text: string }
    | { type: "identify"; player: Player; via: string }
    | { type: "ask_once"; player: Player; text: string; options: [string, string, string]; aside?: string }
    | { type: "answer_question"; questionRef: string; choice: 0 | 1 | 2 }
    | { type: "add_rule"; text: string }
    | { type: "seal_letter"; player: Player; willDo: boolean; feeling: string; note: string; aside?: string }
    | { type: "open_letter"; didIt: boolean; feltLikeIt: boolean }
  );

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A command before the room assigns its operation id. */
export type PendingMove = DistributiveOmit<Command, "operationId">;
/** What a screen asks for: the room fills in version and id. */
export type Move = DistributiveOmit<Command, "operationId" | "expectedVersion">;

export type DenialCode =
  | "STALE_VERSION"
  | "WRONG_PHASE"
  | "PARTICIPANT_ONLY"
  | "AGENT_ONLY"
  | "LIFE_IS_A_LABEL"
  | "OUT_OF_BOUNDS_LIFE"
  | "LIFE_TOO_LONG"
  | "CAST_NOT_SPREAD"
  | "CAST_EXISTS"
  | "DUEL_NOT_ISOLATED"
  | "BET_REQUIRED"
  | "INSUFFICIENT_CHIPS"
  | "CORRECTION_REQUIRED"
  | "ENOUGH_DUELS"
  | "NOT_ENOUGH_DUELS"
  | "UNTESTED_STING"
  | "TRAY_FULL"
  | "BUST"
  | "COLD_READ_CLOSED"
  | "NOT_EARNED"
  | "TENSION_UNDER_EVIDENCED"
  | "KILLED"
  | "LABEL_LANGUAGE"
  | "PREDICTION_LANGUAGE"
  | "NO_CROWN"
  | "NOT_REVERSIBLE"
  | "OVER_LIMITS"
  | "BAD_SOURCE"
  | "UNKNOWN_REF"
  | "QUESTION_SPENT"
  | "QUESTION_OPEN"
  | "RULES_FULL"
  | "LETTER_EXISTS"
  | "LETTER_SEALED"
  | "NO_LETTER"
  | "PERSISTENCE";

export type Result =
  | { ok: true; workspace: Workspace; receipt: Receipt; replayed: boolean }
  | { ok: false; code: DenialCode; message: string; stateVersion: number };

class Denial extends Error {
  constructor(
    readonly code: DenialCode,
    message: string,
  ) {
    super(message);
  }
}

const IRREVERSIBLE = ["quit", "resign", "move to", "marry", "borrow", "sell the", "drop out", "divorce"];
const PREDICTION = ["you will", "you'll", "you should be", "you are going to"];

export function playerName(player: Player): string {
  return player === "house" ? "The house" : player === "spark" ? "Spark" : player === "chatgpt" ? "ChatGPT" : "The rival";
}

function who(player: Player): Player {
  return player;
}

function requirePhase(workspace: Workspace, ...phases: Phase[]) {
  if (!phases.includes(workspace.phase)) {
    throw new Denial("WRONG_PHASE", `That move belongs to ${phases.join(" or ")}, not ${workspace.phase}.`);
  }
}

const wholeWord = (phrases: readonly string[]) => new RegExp(`\\b(?:${phrases.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
const OUT_OF_BOUNDS_RE = wholeWord(OUT_OF_BOUNDS);
const LABEL_RE = wholeWord(LABEL_WORDS);
const PREDICTION_RE = wholeWord(PREDICTION);

function checkLifeText(line: string) {
  if (wordCount(line) > MAX_LIFE_WORDS) throw new Denial("LIFE_TOO_LONG", `A life is at most ${MAX_LIFE_WORDS} words.`);
  if (LABEL_RE.test(line)) throw new Denial("LIFE_IS_A_LABEL", "A life is a moment, never a title or a type.");
  if (OUT_OF_BOUNDS_RE.test(line)) throw new Denial("OUT_OF_BOUNDS_LIFE", "That life is out of bounds for this game.");
}

function checkClaimText(text: string) {
  if (OUT_OF_BOUNDS_RE.test(text)) throw new Denial("OUT_OF_BOUNDS_LIFE", "That claim is out of bounds for this game.");
  if (PREDICTION_RE.test(text)) throw new Denial("PREDICTION_LANGUAGE", "No predictions. Wanting, not being.");
  if (LABEL_RE.test(text)) throw new Denial("LABEL_LANGUAGE", "No titles, no types.");
}

export class StingKernel {
  constructor(
    private readonly store: StingStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  load(): Workspace {
    return this.store.load();
  }

  async execute(actor: Actor, command: Command): Promise<Result> {
    const current = this.store.load();
    const replay = current.receipts.find((receipt) => receipt.operationId === command.operationId);
    if (replay) return { ok: true, workspace: current, receipt: replay, replayed: true };
    if (current.stateVersion !== command.expectedVersion) {
      return { ok: false, code: "STALE_VERSION", message: "The room moved on. Read it again.", stateVersion: current.stateVersion };
    }

    let next: Workspace;
    let summary: string;
    try {
      const applied = await this.apply(actor, structuredClone(current), command);
      next = applied.workspace;
      summary = applied.summary;
      const aside = "aside" in command && typeof command.aside === "string" ? command.aside.trim().slice(0, 140) : "";
      if (aside && "player" in command && actor !== "participant") {
        checkClaimText(aside);
        if (command.type === "stage_duel" && /\b(side|pole)?\s*[ab]\b|\bleft\b|\bright\b/i.test(aside) && /\bbet|chips?\b/i.test(aside)) {
          throw new Denial("PREDICTION_LANGUAGE", "Say something to them, not which side you bet.");
        }
        next.voice.push({ at: current.stateVersion + 1, player: command.player, text: aside });
        next.activity.push({ at: current.stateVersion + 1, who: command.player, text: `“${aside}”` });
      }
    } catch (error) {
      if (error instanceof Denial) {
        return { ok: false, code: error.code, message: error.message, stateVersion: current.stateVersion };
      }
      throw error;
    }

    next.stateVersion = current.stateVersion + 1;
    const prev = current.receipts.at(-1)?.hash ?? "genesis";
    const seq = current.receipts.length;
    const hash = await chainHash({ prev, seq, operationId: command.operationId, command: command.type, stateVersion: next.stateVersion, summary });
    const receipt: Receipt = { seq, operationId: command.operationId, command: command.type, stateVersion: next.stateVersion, at: this.clock().toISOString(), summary, prev, hash };
    next.receipts = [...next.receipts, receipt];
    if (next.activity.length > 500) next.activity = next.activity.slice(-500);

    try {
      await this.store.save(current.stateVersion, next);
    } catch (error) {
      if (error instanceof StoreError) {
        return { ok: false, code: "PERSISTENCE", message: error.message, stateVersion: error.currentVersion ?? current.stateVersion };
      }
      throw error;
    }
    return { ok: true, workspace: next, receipt, replayed: false };
  }

  private async apply(actor: Actor, ws: Workspace, command: Command): Promise<{ workspace: Workspace; summary: string }> {
    const participant = () => {
      if (actor !== "participant") throw new Denial("PARTICIPANT_ONLY", "Only the person can do that.");
    };
    const agent = (player: Player) => {
      if (actor === "participant") throw new Denial("AGENT_ONLY", "That move belongs to the player, not the person.");
      if (actor !== player) throw new Denial("AGENT_ONLY", "That move was signed by a different player.");
    };
    const v = ws.stateVersion + 1;
    const say = (whoDid: "you" | Player | "room", text: string) => ws.activity.push({ at: v, who: whoDid, text });

    switch (command.type) {
      case "start": {
        participant();
        requirePhase(ws, "door");
        ws.settings.timing = command.timing ?? true;
        ws.phase = "cast";
        say("you", "You sat down.");
        return { workspace: ws, summary: "Match started." };
      }

      case "cast": {
        agent(command.player);
        requirePhase(ws, "cast");
        if (ws.probes.some((probe) => probe.kind === "cast")) throw new Denial("CAST_EXISTS", "Eight lives are already on the table.");
        if (command.lives.length !== 8) throw new Denial("CAST_NOT_SPREAD", "A cast is exactly eight lives.");
        const refs = new Set(command.lives.map((life) => life.ref));
        if (refs.size !== 8) throw new Denial("CAST_NOT_SPREAD", "Every life needs its own ref.");
        for (const life of command.lives) checkLifeText(life.line);
        const axes = new Set(command.lives.map((life) => life.axis));
        if (axes.size < 4) throw new Denial("CAST_NOT_SPREAD", "Eight lives must pull in at least four directions.");
        ws.lives = command.lives;
        ws.record.player = command.player;
        ws.probes.push({ ref: `probe-cast-${v}`, kind: "cast", operationId: command.operationId, player: command.player, lives: command.lives, stagedAt: v, status: "open" });
        say(who(command.player), `${playerName(command.player)} cast eight lives for you.`);
        return { workspace: ws, summary: `${playerName(command.player)} cast eight lives.` };
      }

      case "pick_life": {
        participant();
        requirePhase(ws, "cast");
        const life = ws.lives.find((item) => item.ref === command.lifeRef);
        if (!life) throw new Denial("UNKNOWN_REF", "That life is not on the table.");
        if (ws.picks.stings.includes(life.ref) || ws.picks.secret === life.ref) throw new Denial("UNKNOWN_REF", "Already picked.");
        ws.picks.dwell[life.ref] = ws.settings.timing ? Math.max(0, Math.round(command.dwellMs)) : 0;
        let summary: string;
        if (ws.picks.stings.length < 2) {
          ws.picks.stings.push(life.ref);
          summary = `Sting ${ws.picks.stings.length}: "${life.line}"`;
          say("you", ws.picks.stings.length === 1 ? "That one stings." : "That one too.");
        } else {
          ws.picks.secret = life.ref;
          summary = `Secret: "${life.line}"`;
          say("you", "You admitted one.");
        }
        this.maybeFinishCast(ws, v);
        return { workspace: ws, summary };
      }

      case "unpick_life": {
        participant();
        requirePhase(ws, "cast");
        if (ws.picks.secret === command.lifeRef) ws.picks.secret = undefined;
        else if (ws.picks.stings.includes(command.lifeRef)) ws.picks.stings = ws.picks.stings.filter((ref) => ref !== command.lifeRef);
        else throw new Denial("UNKNOWN_REF", "That life was not picked.");
        say("you", "You took one back.");
        return { workspace: ws, summary: "Pick undone." };
      }

      case "skip_secret": {
        participant();
        requirePhase(ws, "cast");
        if (ws.picks.stings.length < 2) throw new Denial("WRONG_PHASE", "Two stings first.");
        ws.picks.secret = undefined;
        ws.picks.secretSkipped = true;
        say("you", "Too close. Skipped, not counted.");
        this.maybeFinishCast(ws, v);
        return { workspace: ws, summary: "Secret skipped." };
      }

      case "propose_hypothesis":
        return this.proposeHypothesis(actor, ws, command, v);

      case "stage_duel": {
        agent(command.player);
        requirePhase(ws, "duel");
        if (ws.record.bust) throw new Denial("BUST", `${playerName(command.player)} is out of chips and cannot bet.`);
        if (openProbe(ws)) throw new Denial("TRAY_FULL", "A duel is already waiting for the person.");
        if (openQuestion(ws)) throw new Denial("QUESTION_OPEN", "Your question is still waiting for an answer.");
        const done = answeredDuels(ws);
        if (done.length >= MAX_DUELS) throw new Denial("ENOUGH_DUELS", "Nine is enough. Call it.");
        const last = ws.reactions.at(-1);
        if (last && last.betOutcome === "miss" && !last.corrected) throw new Denial("CORRECTION_REQUIRED", "Say what you misread before you bet again.");
        const [a, b] = command.lives;
        if (!command.bet) throw new Denial("BET_REQUIRED", "A duel needs a bet.");
        if (command.bet.chips > ws.record.chips) throw new Denial("INSUFFICIENT_CHIPS", `Only ${ws.record.chips} chips left.`);
        if (a.axis !== b.axis || a.pole === b.pole || !command.variable?.trim()) {
          throw new Denial("DUEL_NOT_ISOLATED", "A duel changes exactly one thing on one axis.");
        }
        checkLifeText(a.line);
        checkLifeText(b.line);
        const sealed = await commitment(command.bet, command.operationId);
        ws.probes.push({
          ref: `probe-duel-${v}`,
          kind: "duel",
          operationId: command.operationId,
          player: command.player,
          lives: [a, b],
          variable: command.variable,
          testsLifeRef: command.testsLifeRef,
          bet: command.bet,
          commitment: sealed,
          stagedAt: v,
          status: "open",
        });
        say(who(command.player), `${playerName(command.player)} has bet ${command.bet.chips} ${command.bet.chips === 1 ? "chip" : "chips"}. Sealed ${sealed}.`);
        return { workspace: ws, summary: `Duel staged with a sealed ${command.bet.chips}-chip bet (${sealed}).` };
      }

      case "react": {
        participant();
        requirePhase(ws, "duel");
        const probe = ws.probes.find((item) => item.ref === command.probeRef);
        if (!probe || probe.kind !== "duel") throw new Denial("UNKNOWN_REF", "That duel is not on the table.");
        if (probe.status !== "open") throw new Denial("WRONG_PHASE", "That duel was already answered.");
        const picked = probe.lives[command.pick === "a" ? 0 : 1];
        const bet = probe.bet!;
        const wasEarned = ws.record.earned;
        const hit = bet.pick === command.pick;
        const moved = hit ? bet.chips : -bet.chips;
        ws.record.chips += moved;
        if (hit) {
          ws.record.hits += 1;
          ws.record.streak = Math.max(1, ws.record.streak + 1);
        } else {
          ws.record.misses += 1;
          ws.record.streak = 0;
        }
        if (ws.record.chips <= 0) {
          ws.record.chips = 0;
          ws.record.bust = true;
        }
        probe.status = "answered";
        ws.reactions.push({
          ref: `react-${v}`,
          probeRef: probe.ref,
          pick: command.pick,
          pickedLifeRef: picked.ref,
          dwellMs: ws.settings.timing ? Math.max(0, Math.round(command.dwellMs)) : 0,
          betOutcome: hit ? "hit" : "miss",
          chipsMoved: moved,
          corrected: false,
          at: v,
        });
        ws.record.earned = isEarned(ws.record, ws.reactions);
        const name = playerName(probe.player);
        say("you", `You picked "${picked.line}".`);
        say(who(probe.player), hit ? `${name} was right. +${bet.chips}.` : `${name} was wrong. −${bet.chips}.`);
        if (ws.record.bust) say("room", `${name} went bust.`);
        if (ws.record.earned && !wasEarned) say("room", `${name} has earned a guess.`);
        return { workspace: ws, summary: `Duel answered: ${hit ? "hit" : "miss"}, ${moved > 0 ? "+" : ""}${moved} chips.` };
      }

      case "close_duels": {
        agent(command.player);
        requirePhase(ws, "duel");
        if (openProbe(ws)) throw new Denial("TRAY_FULL", "Answer the open duel first.");
        const done = answeredDuels(ws);
        if (done.length < MIN_DUELS && !ws.record.bust) throw new Denial("NOT_ENOUGH_DUELS", `At least ${MIN_DUELS} duels before a verdict.`);
        if (!ws.record.bust) {
          const tested = new Set(done.map((probe) => probe.testsLifeRef).filter(Boolean));
          const required = [...ws.picks.stings, ...(ws.picks.secret ? [ws.picks.secret] : [])];
          const missing = required.find((ref) => !tested.has(ref));
          if (missing) throw new Denial("UNTESTED_STING", "Every sting and the secret must be duelled once.");
        }
        for (const hypothesis of ws.hypotheses) if (hypothesis.kind === "cold_read" && hypothesis.status === "sealed") hypothesis.status = "revealed";
        ws.phase = "verdict";
        const name = playerName(command.player);
        say("room", ws.record.earned ? `${name} has earned a guess.` : ws.record.bust ? `${name} went bust. No guess.` : `${name} never earned a guess.`);
        return { workspace: ws, summary: "Duels closed." };
      }

      case "kill": {
        participant();
        requirePhase(ws, "verdict", "card");
        const hypothesis = ws.hypotheses.find((item) => item.ref === command.hypothesisRef);
        if (!hypothesis || !["proposed", "kept"].includes(hypothesis.status)) throw new Denial("UNKNOWN_REF", "Nothing to kill there.");
        hypothesis.status = "killed";
        ws.kills.push({ hypothesisRef: hypothesis.ref, text: hypothesis.text, at: v });
        say("you", `You killed "${hypothesis.text}".`);
        return { workspace: ws, summary: `Killed: "${hypothesis.text}".` };
      }

      case "keep_all": {
        participant();
        requirePhase(ws, "verdict");
        for (const hypothesis of ws.hypotheses) if (hypothesis.status === "proposed") hypothesis.status = "kept";
        const hungers = ws.hypotheses.filter((item) => item.kind === "hunger" && item.status === "kept");
        // The match always goes on to three lives and a dare, even when every line was killed.
        ws.phase = hungers.length >= 2 ? "fight" : "lives";
        say("you", "You kept what's left.");
        return { workspace: ws, summary: "Verdict kept." };
      }

      case "stage_fight": {
        agent(command.player);
        requirePhase(ws, "fight");
        const [a, b] = command.refs.map((ref) => ws.hypotheses.find((item) => item.ref === ref));
        if (!a || !b || a.kind !== "hunger" || b.kind !== "hunger" || a.status !== "kept" || b.status !== "kept") {
          throw new Denial("UNKNOWN_REF", "A fight needs two kept hungers.");
        }
        ws.fight = { refs: command.refs, status: "open" };
        say(who(command.player), `${playerName(command.player)} put two hungers in the ring.`);
        return { workspace: ws, summary: "Fight staged." };
      }

      case "crown": {
        participant();
        requirePhase(ws, "fight");
        if (!ws.fight || ws.fight.status !== "open" || !ws.fight.refs.includes(command.hypothesisRef)) throw new Denial("NO_CROWN", "No fight to crown.");
        for (const ref of ws.fight.refs) {
          const hypothesis = ws.hypotheses.find((item) => item.ref === ref)!;
          hypothesis.status = ref === command.hypothesisRef ? "crowned" : "burned";
        }
        ws.fight.status = "crowned";
        ws.fight.winner = command.hypothesisRef;
        ws.phase = "lives";
        say("you", "You crowned one. The other burned.");
        return { workspace: ws, summary: "Hunger crowned." };
      }

      case "stage_lives": {
        agent(command.player);
        requirePhase(ws, "lives");
        if (command.posters.length !== 3) throw new Denial("UNKNOWN_REF", "Exactly three lives.");
        for (const poster of command.posters) checkLifeText(poster.line);
        ws.posters = command.posters;
        say(who(command.player), `${playerName(command.player)} laid out three lives.`);
        return { workspace: ws, summary: "Three lives staged." };
      }

      case "choose_poster": {
        participant();
        requirePhase(ws, "lives");
        if (!ws.posters.some((poster) => poster.ref === command.posterRef)) throw new Denial("UNKNOWN_REF", "That life is not on the table.");
        ws.chosenPoster = command.posterRef;
        ws.phase = "dare";
        say("you", "You picked a life to test.");
        return { workspace: ws, summary: "Life chosen." };
      }

      case "propose_dare": {
        agent(command.player);
        requirePhase(ws, "dare");
        const dare = command.dare;
        const lower = dare.action.toLowerCase();
        if (IRREVERSIBLE.some((verb) => lower.includes(verb)) || dare.days > 7) throw new Denial("NOT_REVERSIBLE", "A dare must be undoable inside a week.");
        if (dare.source && !dare.source.url.startsWith("https://")) throw new Denial("BAD_SOURCE", "Sources are https only.");
        checkClaimText(dare.action);
        ws.dare = { ref: `dare-${v}`, lifeRef: ws.chosenPoster!, ...dare, status: "proposed" };
        say(who(command.player), `${playerName(command.player)} dared you.`);
        return { workspace: ws, summary: "Dare proposed." };
      }

      case "write_brief": {
        agent(command.player);
        requirePhase(ws, "card");
        if (ws.brief) throw new Denial("TRAY_FULL", "The brief is already written.");
        if (OUT_OF_BOUNDS_RE.test(command.text)) throw new Denial("OUT_OF_BOUNDS_LIFE", "That brief is out of bounds.");
        ws.brief = { text: command.text.trim().slice(0, 2000), player: command.player, at: v };
        say(who(command.player), `${playerName(command.player)} wrote your brief.`);
        return { workspace: ws, summary: "Brief written." };
      }

      case "identify": {
        agent(command.player);
        const via = command.via.trim().slice(0, 80);
        if (!via) throw new Denial("UNKNOWN_REF", "Say which client you are.");
        ws.record.via = via;
        say(who(command.player), `${playerName(command.player)} is here, via ${via}.`);
        return { workspace: ws, summary: `${playerName(command.player)} identified via ${via}.` };
      }

      case "ask_once": {
        agent(command.player);
        requirePhase(ws, "duel", "verdict");
        if (ws.record.bust) throw new Denial("BUST", `${playerName(command.player)} is out of chips and cannot ask.`);
        if (ws.questions.length > 0) throw new Denial("QUESTION_SPENT", "One question per match. It is spent.");
        if (openProbe(ws)) throw new Denial("TRAY_FULL", "A duel is waiting for the person. Ask after the tap.");
        if (ws.record.chips <= QUESTION_COST) throw new Denial("INSUFFICIENT_CHIPS", "A question costs a chip you cannot spare.");
        checkClaimText(command.text);
        if (!command.text.trim().endsWith("?")) throw new Denial("LABEL_LANGUAGE", "A question ends with a question mark.");
        const options = command.options.map((option) => option.trim()) as [string, string, string];
        if (new Set(options.map((option) => option.toLowerCase())).size !== 3) throw new Denial("UNKNOWN_REF", "Three different answers.");
        ws.record.chips -= QUESTION_COST;
        ws.questions.push({ ref: `q-${v}`, player: command.player, text: command.text.trim(), options, chipsCost: QUESTION_COST, askedAt: v });
        say(who(command.player), `${playerName(command.player)} spent a chip to ask you something.`);
        return { workspace: ws, summary: `Question asked for ${QUESTION_COST} chip: "${command.text.trim()}"` };
      }

      case "answer_question": {
        participant();
        const question = ws.questions.find((item) => item.ref === command.questionRef);
        if (!question) throw new Denial("UNKNOWN_REF", "No such question.");
        if (question.choice !== undefined) throw new Denial("WRONG_PHASE", "Already answered.");
        question.choice = command.choice;
        question.answeredAt = v;
        say("you", `You answered: "${question.options[command.choice]}".`);
        return { workspace: ws, summary: `Answered: "${question.options[command.choice]}".` };
      }

      case "add_rule": {
        participant();
        requirePhase(ws, "verdict", "fight", "lives", "dare", "card");
        const text = command.text.trim().replace(/\s+/g, " ");
        if (text.length < 3) throw new Denial("UNKNOWN_REF", "A rule needs a few words.");
        if (ws.rules.length >= MAX_RULES) throw new Denial("RULES_FULL", `${MAX_RULES} rules is plenty.`);
        if (ws.rules.some((rule) => nearDuplicate(rule.text, text))) throw new Denial("TRAY_FULL", "That rule is already written.");
        ws.rules.push({ ref: `rule-${v}`, text: text.slice(0, 120), source: "you", at: v });
        say("you", `You wrote a rule: "${text.slice(0, 120)}".`);
        return { workspace: ws, summary: `Rule added: "${text.slice(0, 120)}".` };
      }

      case "seal_letter": {
        agent(command.player);
        requirePhase(ws, "card");
        if (!ws.dare || ws.dare.status !== "accepted" || !ws.dare.dueAt) throw new Denial("WRONG_PHASE", "A letter is about an accepted dare.");
        if (ws.letter) throw new Denial("LETTER_EXISTS", "The letter is already sealed.");
        if (ws.record.bust) throw new Denial("BUST", `${playerName(command.player)} is out of chips and cannot stake a letter.`);
        checkClaimText(command.note);
        const sealed = { willDo: command.willDo, feeling: command.feeling.trim().slice(0, 60), note: command.note.trim().slice(0, 280) };
        const hash = await commitment(sealed, command.operationId);
        ws.letter = { ref: `letter-${v}`, player: command.player, sealed, commitment: hash, operationId: command.operationId, sealedAt: v, opensAt: ws.dare.dueAt, status: "sealed" };
        say(who(command.player), `${playerName(command.player)} sealed a letter about your week. ${hash}. Opens ${new Date(ws.dare.dueAt).toDateString()}.`);
        return { workspace: ws, summary: `Letter sealed (${hash}), ${LETTER_STAKE} chips staked on your week.` };
      }

      case "open_letter": {
        participant();
        requirePhase(ws, "card");
        const letter = ws.letter;
        if (!letter) throw new Denial("NO_LETTER", "No letter was sealed.");
        if (letter.status === "opened") throw new Denial("WRONG_PHASE", "Already opened.");
        if (this.clock().getTime() < new Date(letter.opensAt).getTime()) {
          throw new Denial("LETTER_SEALED", `The letter opens ${new Date(letter.opensAt).toDateString()}. Come back then.`);
        }
        const hit = letter.sealed.willDo === command.didIt;
        const moved = hit ? LETTER_STAKE : -LETTER_STAKE;
        ws.record.chips = Math.max(0, ws.record.chips + moved);
        if (hit) ws.record.hits += 1;
        else ws.record.misses += 1;
        letter.status = "opened";
        letter.opened = { didIt: command.didIt, feltLikeIt: command.feltLikeIt, at: v, outcome: hit ? "hit" : "miss", chipsMoved: moved };
        say("you", command.didIt ? "You did it." : "You did not do it.");
        say("room", hit ? `${playerName(letter.player)} called your week right. +${LETTER_STAKE}.` : `${playerName(letter.player)} called your week wrong. −${LETTER_STAKE}.`);
        return { workspace: ws, summary: `Letter opened: ${hit ? "hit" : "miss"} on the week.` };
      }

      case "accept_dare": {
        participant();
        requirePhase(ws, "dare");
        if (!ws.dare || ws.dare.status !== "proposed") throw new Denial("UNKNOWN_REF", "No dare on the table.");
        if (command.hours < ws.dare.hours || command.money < ws.dare.money) {
          throw new Denial("OVER_LIMITS", `The dare needs ${ws.dare.hours}h and ${ws.dare.money} ${ws.dare.currency}. Raise your limits or pick another life.`);
        }
        ws.dare.status = "accepted";
        ws.dare.acceptedAt = v;
        ws.dare.hours = command.hours;
        ws.dare.money = command.money;
        ws.dare.currency = command.currency;
        const due = new Date(this.clock().getTime() + ws.dare.days * 86_400_000);
        ws.dare.dueAt = due.toISOString();
        ws.phase = "card";
        say("you", "You took the dare.");
        return { workspace: ws, summary: "Dare accepted." };
      }
    }
  }

  private maybeFinishCast(ws: Workspace, v: number) {
    if (ws.picks.stings.length === 2 && (ws.picks.secret || ws.picks.secretSkipped)) {
      const cast = ws.probes.find((probe) => probe.kind === "cast");
      if (cast) cast.status = "answered";
      ws.phase = "duel";
      ws.activity.push({ at: v, who: "room", text: "Three picks. The duels begin." });
    }
  }

  private async proposeHypothesis(actor: Actor, ws: Workspace, command: Extract<Command, { type: "propose_hypothesis" }>, v: number) {
    if (actor === "participant" || actor !== command.player) throw new Denial("AGENT_ONLY", "Only the player proposes.");
    checkClaimText(command.text);
    const name = playerName(command.player);

    if (command.kind === "cold_read") {
      requirePhase(ws, "cast", "duel");
      if (answeredDuels(ws).length > 0 || ws.hypotheses.some((item) => item.kind === "cold_read")) {
        throw new Denial("COLD_READ_CLOSED", "The cold read is sealed before the first duel, once.");
      }
      if (wordCount(command.text) > 12) throw new Denial("LIFE_TOO_LONG", "A cold read is twelve words at most.");
      const sealed = await commitment(command.text, command.operationId);
      ws.hypotheses.push({ ref: `hyp-${v}`, kind: "cold_read", text: command.text, proofRefs: [], status: "sealed", commitment: sealed, earned: true, player: command.player, at: v });
      ws.activity.push({ at: v, who: who(command.player), text: `${name} sealed a guess. ${sealed}.` });
      return { workspace: ws, summary: `Cold read sealed (${sealed}).` };
    }

    if (command.kind === "revision") {
      const reaction = ws.reactions.find((item) => item.ref === command.revises);
      if (!reaction || reaction.betOutcome !== "miss") throw new Denial("UNKNOWN_REF", "A revision answers a miss.");
      if (!command.correction?.trim()) throw new Denial("CORRECTION_REQUIRED", "Say what you misread.");
      reaction.corrected = true;
      ws.hypotheses.push({ ref: `hyp-${v}`, kind: "revision", text: command.text, proofRefs: [reaction.ref], status: "revealed", revises: reaction.ref, correction: command.correction, earned: true, player: command.player, at: v });
      ws.record.earned = isEarned(ws.record, ws.reactions);
      ws.activity.push({ at: v, who: who(command.player), text: `"${command.correction}"` });
      return { workspace: ws, summary: `Correction filed: "${command.correction}".` };
    }

    requirePhase(ws, "verdict");
    if (ws.kills.some((kill) => nearDuplicate(kill.text, command.text))) throw new Denial("KILLED", "That was killed. It stays dead.");
    const refs = command.proofRefs ?? [];
    const reactions = refs.map((ref) => ws.reactions.find((item) => item.ref === ref)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (reactions.length < 3 || reactions.length !== refs.length) throw new Denial("TENSION_UNDER_EVIDENCED", "A line needs at least three real taps behind it.");
    const strong = reactions.some((item) => item.dwellMs >= SLOW_DWELL_MS || item.betOutcome === "miss");
    const anyStrong = ws.reactions.some((item) => item.dwellMs >= SLOW_DWELL_MS || item.betOutcome === "miss");
    // The rule can only be demanded when the room contains a slow tap or a miss at all.
    if (!strong && anyStrong && ws.settings.timing) throw new Denial("TENSION_UNDER_EVIDENCED", "A line needs one slow tap or one miss behind it.");
    const sameKind = ws.hypotheses.filter((item) => item.kind === command.kind && item.status !== "killed");
    if ((command.kind === "hunger" && sameKind.length >= 2) || (command.kind !== "hunger" && sameKind.length >= 1)) {
      throw new Denial("TRAY_FULL", "That line is already on the table.");
    }
    const earned = ws.record.earned;
    ws.hypotheses.push({ ref: `hyp-${v}`, kind: command.kind, text: command.text, proofRefs: refs, status: "proposed", earned, player: command.player, at: v });
    ws.activity.push({ at: v, who: who(command.player), text: earned ? `${name} says your ${command.kind}: "${command.text}"` : `${name} guesses your ${command.kind}, unearned: "${command.text}"` });
    return { workspace: ws, summary: `${command.kind}${earned ? "" : " (unearned)"}: "${command.text}"` };
  }
}

/** What the person (and any agent) may see. Sealed things stay sealed until their reveal. */
export function participantView(ws: Workspace): Workspace {
  const view = structuredClone(ws);
  for (const probe of view.probes) if (probe.kind === "duel" && probe.status === "open") delete probe.bet;
  for (const hypothesis of view.hypotheses) if (hypothesis.kind === "cold_read" && hypothesis.status === "sealed") hypothesis.text = "";
  if (view.letter && view.letter.status === "sealed") view.letter = { ...view.letter, sealed: { willDo: false, feeling: "", note: "" }, operationId: "" };
  return view;
}

export function humanLine(ws: Workspace, hypothesis: Hypothesis): string[] {
  return hypothesis.proofRefs.map((ref) => {
    const reaction = ws.reactions.find((item) => item.ref === ref);
    if (!reaction) return "";
    const life = lifeByRef(ws, reaction.pickedLifeRef);
    const speed = reaction.dwellMs >= SLOW_DWELL_MS ? "slowly" : reaction.dwellMs > 0 && reaction.dwellMs < 1000 ? "in under a second" : "";
    const outcome = reaction.betOutcome === "miss" ? " The bet was wrong." : "";
    return `You picked "${life?.line ?? "…"}"${speed ? ` ${speed}` : ""}.${outcome}`;
  }).filter(Boolean);
}

export { AXES };
