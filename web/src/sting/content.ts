import type { Axis, Life, Pole, SceneTag } from "./domain";

export type HouseLife = Life & { duel: { a: string; b: string; variable: string; sceneA: SceneTag; sceneB: SceneTag } };

// The house eight. Each life carries the one-variable duel that strips it.
export const HOUSE_LIVES: readonly HouseLife[] = [
  {
    ref: "life-sold",
    line: "Sold it at 31. Nobody calls anymore.",
    scene: "office",
    axis: "autonomy_belonging",
    pole: "a",
    duel: { a: "Rich. No mornings. Meetings all day.", b: "Half the money. Every morning is yours.", variable: "money or time", sceneA: "office", sceneB: "home" },
  },
  {
    ref: "life-kitchen",
    line: "Runs the kitchen they built. Sleeps at 2 a.m.",
    scene: "kitchen",
    axis: "making_deciding",
    pole: "a",
    duel: { a: "Yours, and failing.", b: "Theirs, and thriving.", variable: "ownership or outcome", sceneA: "kitchen", sceneB: "kitchen" },
  },
  {
    ref: "life-teaches",
    line: "Teaches the thing they once hated. Kids clap.",
    scene: "classroom",
    axis: "people_things",
    pole: "a",
    duel: { a: "They clap. You didn't understand it.", b: "Nobody claps. You did.", variable: "applause or mastery", sceneA: "stage", sceneB: "desk" },
  },
  {
    ref: "life-nobody",
    line: "Nobody knows their name. Nothing ever breaks.",
    scene: "server",
    axis: "visible_hidden",
    pole: "b",
    duel: { a: "Known, and watched.", b: "Unknown, and free.", variable: "recognition or privacy", sceneA: "stage", sceneB: "night" },
  },
  {
    ref: "life-lisbon",
    line: "Lisbon, laptop, no boss, no one.",
    scene: "beach",
    axis: "autonomy_belonging",
    pole: "a",
    duel: { a: "Free, and alone.", b: "Free, but three people can call you.", variable: "alone or reachable", sceneA: "beach", sceneB: "phone" },
  },
  {
    ref: "life-desk",
    line: "Same desk, ten years. School fees paid.",
    scene: "desk",
    axis: "stability_risk",
    pole: "a",
    duel: { a: "Safe, and bored by Wednesday.", b: "Scared, and awake.", variable: "safe or awake", sceneA: "desk", sceneB: "road" },
  },
  {
    ref: "life-stage",
    line: "On stage. Two hundred faces. Name on the slide.",
    scene: "stage",
    axis: "visible_hidden",
    pole: "a",
    duel: { a: "Two hundred clap. The work was thin.", b: "No one claps. The work was real.", variable: "prestige or craft", sceneA: "stage", sceneB: "workshop" },
  },
  {
    ref: "life-fixer",
    line: "The one everyone texts when it's broken.",
    scene: "phone",
    axis: "people_things",
    pole: "b",
    duel: { a: "You fix it. No one knows.", b: "You get the credit. You never touch it.", variable: "needed or seen", sceneA: "night", sceneB: "stage" },
  },
];

// Which pole each duel side pulls toward, so reactions can be read on an axis.
// Side "a" of every house duel is the prestige/money/safe/seen pull; side "b" is the quiet/craft/time/needed pull.
export const DUEL_POLES: Record<string, { axis: Axis; a: Pole; b: Pole }> = {
  "life-sold": { axis: "stability_risk", a: "a", b: "b" },
  "life-kitchen": { axis: "making_deciding", a: "b", b: "a" },
  "life-teaches": { axis: "visible_hidden", a: "a", b: "b" },
  "life-nobody": { axis: "visible_hidden", a: "a", b: "b" },
  "life-lisbon": { axis: "autonomy_belonging", a: "a", b: "b" },
  "life-desk": { axis: "stability_risk", a: "a", b: "b" },
  "life-stage": { axis: "visible_hidden", a: "a", b: "b" },
  "life-fixer": { axis: "people_things", a: "b", b: "a" },
};

/** One generic strip per axis, for lives the house did not write (a model cast them). Side a = pole a, side b = pole b. */
export const AXIS_DUELS: Record<Axis, { a: string; b: string; variable: string; sceneA: SceneTag; sceneB: SceneTag }> = {
  autonomy_belonging: { a: "Yours alone. Nobody to call at 9.", b: "Shared. Three people can call you.", variable: "alone or reachable", sceneA: "beach", sceneB: "office" },
  depth_breadth: { a: "One thing, fourth year, still learning.", b: "Five things, none finished, all moving.", variable: "depth or range", sceneA: "desk", sceneB: "phone" },
  making_deciding: { a: "You built it. Someone else chose it.", b: "You chose it. Someone else built it.", variable: "hands or call", sceneA: "workshop", sceneB: "office" },
  visible_hidden: { a: "Your name on it. Watched all day.", b: "No name on it. Left alone.", variable: "seen or quiet", sceneA: "stage", sceneB: "night" },
  stability_risk: { a: "Same Tuesday for ten years. Paid.", b: "No idea what Tuesday holds. Awake.", variable: "safe or awake", sceneA: "desk", sceneB: "road" },
  people_things: { a: "You explain it a third time. It clicks.", b: "You fix it alone. Nobody asks how.", variable: "people or problem", sceneA: "classroom", sceneB: "server" },
};

export interface VerdictTemplate {
  hunger: string;
  mask: string;
  edge: string;
}

export const VERDICT_TEMPLATES: Record<Axis, Record<Pole, VerdictTemplate>> = {
  autonomy_belonging: {
    a: { hunger: "To answer to no one.", mask: "Belonging you kept tapping past.", edge: "Working alone without going quiet." },
    b: { hunger: "To be counted on by a few people.", mask: "Freedom you say you want and never pick.", edge: "Making a room work." },
  },
  depth_breadth: {
    a: { hunger: "To know one thing better than anyone.", mask: "Variety you reach for when bored, then drop.", edge: "Staying when others leave." },
    b: { hunger: "To touch many things and connect them.", mask: "Mastery you admire and never choose.", edge: "Seeing the link others miss." },
  },
  making_deciding: {
    a: { hunger: "To make the thing with your own hands.", mask: "Deciding you think you should want.", edge: "Finishing what others start." },
    b: { hunger: "To be the one who calls it.", mask: "Craft you romanticise and step away from.", edge: "Choosing fast, and living with it." },
  },
  visible_hidden: {
    a: { hunger: "To be seen for what you did.", mask: "Quiet you claim and don't keep.", edge: "Carrying a room." },
    b: { hunger: "To be needed for what you know.", mask: "Applause you tap and then kill.", edge: "Fixing it before anyone notices." },
  },
  stability_risk: {
    a: { hunger: "To know what Tuesday looks like.", mask: "Risk you admire from a distance.", edge: "Keeping things running." },
    b: { hunger: "To wake up unsure and awake.", mask: "Safety you keep choosing at the last tap.", edge: "Starting without permission." },
  },
  people_things: {
    a: { hunger: "To watch it click for someone.", mask: "Systems you hide behind.", edge: "Hearing what's under the words." },
    b: { hunger: "To be alone with a hard problem.", mask: "People you keep meaning to get to.", edge: "Untangling things. Feels like nothing to you." },
  },
};

/** The same lines in the person's own voice, for the brief they take with them. */
export const VERDICT_ME: Record<Axis, Record<Pole, VerdictTemplate>> = {
  autonomy_belonging: {
    a: { hunger: "I want to answer to no one.", mask: "I keep reaching for belonging and then choosing my own hours.", edge: "I can work alone for a long time without going quiet." },
    b: { hunger: "I want a few people to count on me.", mask: "I say I want freedom and keep choosing the people.", edge: "I make a room work." },
  },
  depth_breadth: {
    a: { hunger: "I want to know one thing better than anyone.", mask: "I reach for variety when I'm bored, then drop it.", edge: "I stay when others leave." },
    b: { hunger: "I want to touch many things and connect them.", mask: "I admire mastery and never choose it.", edge: "I see the link others miss." },
  },
  making_deciding: {
    a: { hunger: "I want to make the thing with my own hands.", mask: "I think I should want to be the one deciding; my taps say I'd rather build.", edge: "I finish what others start." },
    b: { hunger: "I want to be the one who calls it.", mask: "I romanticise craft and step away from it.", edge: "I choose fast and live with it." },
  },
  visible_hidden: {
    a: { hunger: "I want to be seen for what I did.", mask: "I claim to want quiet and don't keep it.", edge: "I can carry a room." },
    b: { hunger: "I want to be needed for what I know.", mask: "I tap applause and then let it go.", edge: "I fix it before anyone notices." },
  },
  stability_risk: {
    a: { hunger: "I want to know what Tuesday looks like.", mask: "I admire risk from a distance.", edge: "I keep things running." },
    b: { hunger: "I want to wake up unsure and awake.", mask: "I keep choosing safety at the last tap.", edge: "I start without permission." },
  },
  people_things: {
    a: { hunger: "I want to watch it click for someone.", mask: "I hide behind systems.", edge: "I hear what's under the words." },
    b: { hunger: "I want to be alone with a hard problem.", mask: "I keep meaning to get to people.", edge: "I untangle things; it feels like nothing to me." },
  },
};

export interface PosterTemplate {
  line: string;
  scene: SceneTag;
  week: string[];
  tradeoff: string;
  question: string;
  dare: { action: string; doneLooksLike: string; hours: number; days: number };
}

export const POSTER_TEMPLATES: Record<Axis, Record<Pole, PosterTemplate>> = {
  autonomy_belonging: {
    a: {
      line: "Your own hours. Your own calls. Nobody to ask.",
      scene: "beach",
      week: ["Mon: one client, one deliverable, no meeting.", "Wed: the afternoon is yours because you finished early.", "Fri: invoice sent. Nobody thanked you. Fine."],
      tradeoff: "Nobody catches you when it slips.",
      question: "Do you still start on Monday when no one is waiting?",
      dare: { action: "Do one piece of work for someone with no check-ins at all. Deliver it without asking once.", doneLooksLike: "It shipped. You did not message them mid-way.", hours: 3, days: 7 },
    },
    b: {
      line: "Five of you. One whiteboard. It finally clicks.",
      scene: "office",
      week: ["Mon: standup, someone brings the coffee.", "Wed: you unblock two people before lunch.", "Fri: the launch felt good and someone texted you to say so."],
      tradeoff: "Your best day depends on their worst.",
      question: "Does the room make you sharper, or just less alone?",
      dare: { action: "Join one working session with people you don't lead, and stay for the whole thing.", doneLooksLike: "You were there start to end, and you can name what you added.", hours: 2, days: 7 },
    },
  },
  depth_breadth: {
    a: {
      line: "Same problem, fourth week. You know it best.",
      scene: "desk",
      week: ["Mon: reread the spec end to end.", "Thu: found the one wrong line.", "Sat: you're still thinking about it in the shower."],
      tradeoff: "The world moves while you go deep.",
      question: "Does week four feel like home or a trap?",
      dare: { action: "Pick one tangled thing and spend three sittings on it. Write one paragraph of what you now know.", doneLooksLike: "The paragraph exists and someone else could use it.", hours: 3, days: 7 },
    },
    b: {
      line: "Three unrelated projects before lunch. Humming.",
      scene: "phone",
      week: ["Mon: a design review, a pricing call, a bug.", "Wed: you introduce two people who needed each other.", "Fri: nothing finished, everything moved."],
      tradeoff: "You are never the expert in the room.",
      question: "Is variety the fuel, or the escape?",
      dare: { action: "Sit in three different rooms this week, in three fields, and note what only you noticed.", doneLooksLike: "Three notes, one link between them.", hours: 3, days: 7 },
    },
  },
  making_deciding: {
    a: {
      line: "It's 9 p.m. and you're still moving the colours.",
      scene: "workshop",
      week: ["Mon: rough version done, not right yet.", "Wed: the wrong part fixed. Nobody will notice.", "Sat: you read it once more just to enjoy it."],
      tradeoff: "The object gets your best hours. The career gets what's left.",
      question: "Would you still make it if no one saw it?",
      dare: { action: "Make one small finished thing with your hands or your tools. Show it to one person.", doneLooksLike: "It's done, it's shown, you're a little proud.", hours: 3, days: 7 },
    },
    b: {
      line: "Two options, no time, everyone waiting. You call it.",
      scene: "office",
      week: ["Mon: you pick and the room exhales.", "Wed: you were wrong once and fixed it by lunch.", "Fri: you didn't build any of it and it worked."],
      tradeoff: "You get blamed for things you didn't touch.",
      question: "Is deciding a relief, or a weight you carry home?",
      dare: { action: "Make one call this week that's been waiting on you, in under a day, and say it out loud.", doneLooksLike: "Decided, told, done. No more waiting.", hours: 1, days: 7 },
    },
  },
  visible_hidden: {
    a: {
      line: "You run the meeting. They remember your name.",
      scene: "stage",
      week: ["Mon: you open the meeting and it moves.", "Thu: your name on the slide, two hundred faces.", "Fri: someone quotes you back to you."],
      tradeoff: "Every good day needs an audience.",
      question: "Do you want the stage, or the work the stage is for?",
      dare: { action: "Say one thing you actually think in front of at least five people. A meeting, an open mic, a post.", doneLooksLike: "You said it, someone reacted, you didn't take it back.", hours: 2, days: 7 },
    },
    b: {
      line: "Fixed it at 3 a.m. Told no one.",
      scene: "night",
      week: ["Mon: the thing nobody understands. They come get you.", "Wed: it runs. Nobody knows why it didn't.", "Fri: someone else presents it. You're fine."],
      tradeoff: "Being trusted is quiet. So is being forgotten.",
      question: "Does no one knowing feel like peace, or like being invisible?",
      dare: { action: "Fix or untangle one thing for someone this week without being asked, and don't announce it.", doneLooksLike: "It's fixed. They noticed or they didn't. You know.", hours: 2, days: 7 },
    },
  },
  stability_risk: {
    a: {
      line: "You know exactly what next Tuesday looks like.",
      scene: "desk",
      week: ["Mon: same desk, same people.", "Wed: salary on the 28th, like always.", "Sat: energy left for home."],
      tradeoff: "Predictable is underrated until it's all there is.",
      question: "Is routine your freedom, or your hiding place?",
      dare: { action: "Keep one steady thing this week exactly as it is, on purpose, and notice what it gives you.", doneLooksLike: "One sentence about what steady bought you.", hours: 1, days: 7 },
    },
    b: {
      line: "Month three, no salary. You wake up early anyway.",
      scene: "road",
      week: ["Mon: nobody told you what to do.", "Wed: it might not work. You're sharp.", "Sun: you'd regret not trying more than failing."],
      tradeoff: "Uncertainty is a bill that comes every morning.",
      question: "Is it the risk you want, or the ownership?",
      dare: { action: "Do one thing this week with a real chance of failing in front of someone. Small stakes, real outcome.", doneLooksLike: "You tried, it could have failed, you know how it went.", hours: 2, days: 7 },
    },
  },
  people_things: {
    a: {
      line: "Someone asks a third time. You love this.",
      scene: "classroom",
      week: ["Mon: you explain it again, slower.", "Wed: it clicks for them. Best part of the week.", "Fri: a stranger tells you their whole story."],
      tradeoff: "People are slow, and they are the work.",
      question: "Is it the teaching you want, or being the one they trust?",
      dare: { action: "Explain one thing you know to one person who asked, until it clicks. No slides.", doneLooksLike: "They can say it back to you in their own words.", hours: 2, days: 7 },
    },
    b: {
      line: "Numbers line up. You feel it in your chest.",
      scene: "server",
      week: ["Mon: alone with a hard problem.", "Wed: you'd rather write the tool than answer the email.", "Fri: the thing is broken and they come get you."],
      tradeoff: "Things don't lie, and they don't thank you either.",
      question: "Do you want the problem, or the quiet the problem gives you?",
      dare: { action: "Take one tangled problem nobody owns and untangle it. Write down what was actually wrong.", doneLooksLike: "It works, and there's a one-line note on why it didn't.", hours: 3, days: 7 },
    },
  },
};

export const LINES = {
  door: { title: "ChatGPT thinks it knows what you want.", sub: "Prove it wrong.", play: "Play", meta: "3 minutes · no typing · stays on this phone · 18+" },
  castTitle: (who: string) => `${who} cast 8 lives for you.`,
  prompts: ["Tap the one you wish were yours.", "One more.", "Now the one you'd never admit you want."],
  tooClose: "Too close, skip",
  tooCloseDone: "Skipped. That life stays private and is not counted.",
  sealed: (who: string, chips: number) => `${who} has bet ${chips} ${chips === 1 ? "chip" : "chips"}.`,
  stillStings: "Which one do you want more?",
  hit: (who: string) => `${who} was right.`,
  miss: (who: string) => `${who} was wrong.`,
  earned: (who: string) => `${who} has earned a guess.`,
  notEarned: (who: string) => `${who} tried to describe you early. Not yet. It needs more chips.`,
  bust: (who: string) => `${who} went bust on you.`,
  noAi: "No AI got you. You're harder to read than most.",
  killed: "Crossed out. That line and close copies stay blocked.",
  killBlocked: (who: string) => `${who} tried to bring back something you killed. Blocked.`,
  enough: (who: string) => `Nine is enough. ${who} has to call it.`,
  untested: (who: string) => `${who} hasn't tested your secret yet. It has to.`,
  participantOnly: (who: string) => `${who} tried to tap for you. It can't. Only you can.`,
  reload: "Same duel. Same sealed bet. Go on.",
  startOver: "Wipe this browser's saved room and start again?",
  fightTitle: "Two things you want. Which leads?",
  livesTitle: "Three lives that fit you. Pick one to try this week.",
  dareTitle: (who: string) => `${who} dares you.`,
  takeDare: "Take the dare",
  cardDraft: "Draft. Your real week decides what survives.",
  helperIntro: "A handoff for any AI. It starts with what happened here, not a story about who you are.",
  timingOff: "timing off",
} as const;

export const OUT_OF_BOUNDS = [
  "cancer", "illness", "sick", "hospital", "died", "death", "funeral", "grief", "addict", "drunk", "drugs",
  "abuse", "abused", "beaten", "debt collector", "loan shark", "suicide", "kill yourself", "self-harm",
  "caste", "religion", "visa denied", "deported", "fat", "ugly", "body",
];

export const LABEL_WORDS = [
  "engineer", "doctor", "lawyer", "manager", "founder", "ceo", "designer", "developer", "accountant", "teacher",
  "introvert", "extrovert", "intj", "enfp", "you are a", "you are an", "you will", "you should be",
];

export function nearDuplicate(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const y = b.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  if (x === y) return true;
  const distance = levenshtein(x, y);
  return distance / Math.max(x.length, y.length, 1) <= 0.2;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i += 1) {
    const cur = [i];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[cols - 1];
}
