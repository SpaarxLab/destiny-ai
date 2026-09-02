import type { Axis, Pole } from "../domain/workspace";

export type FixtureCard = Readonly<{
  axis: Axis;
  pole: Pole;
  text: string;
  reasons: readonly [string, string, string];
}>;

const r = (first: string, second: string, third: string) => [first, second, third] as const;

export const fixtureDeck: readonly FixtureCard[] = [
  { axis: "autonomy_belonging", pole: "a", text: "Nobody has checked on you since Monday and the work is going well.", reasons: r("I do my best when no one is watching.", "I'd rather own the whole thing than share it.", "Silence is where I think.") },
  { axis: "autonomy_belonging", pole: "a", text: "You changed the plan at 11 p.m. without asking anyone, and it was right.", reasons: r("I trust my own call.", "Asking would have slowed it down.", "I like being the one who decides.") },
  { axis: "autonomy_belonging", pole: "a", text: "Your calendar is empty until Thursday. You smile.", reasons: r("Meetings drain me.", "I want long stretches, not slices.", "I get more done alone.") },
  { axis: "autonomy_belonging", pole: "b", text: "Five of you, one whiteboard, someone brings the coffee, the thing finally clicks.", reasons: r("The room makes me sharper.", "I miss this more than I admit.", "I don't want to win alone.") },
  { axis: "autonomy_belonging", pole: "b", text: "Someone you work with texts you on a Sunday just to say the launch felt good.", reasons: r("I work for the people, not the task.", "Being counted on matters to me.", "I want to belong to something.") },
  { axis: "autonomy_belonging", pole: "b", text: "The team stays late together and nobody complains.", reasons: r("Shared effort feels like home.", "I'd stay for them.", "I don't want to be the only one who cares.") },
  { axis: "depth_breadth", pole: "a", text: "Same problem, fourth week. You know more about it than anyone alive.", reasons: r("Going deep is the whole point.", "I hate leaving things half-understood.", "Mastery is how I feel safe.") },
  { axis: "depth_breadth", pole: "a", text: "You read the 80-page spec end to end and found the one line that was wrong.", reasons: r("Details are where truth lives.", "I like being the one who actually read it.", "Careful is who I am.") },
  { axis: "depth_breadth", pole: "a", text: "Someone asks a quick question. You say: give me two days and I'll really answer it.", reasons: r("I can't fake shallow.", "I want to be right, not fast.", "Quick answers embarrass me.") },
  { axis: "depth_breadth", pole: "b", text: "Three unrelated projects before lunch. You're humming.", reasons: r("Variety keeps me alive.", "I get bored the moment I'm good at it.", "I connect things others don't.") },
  { axis: "depth_breadth", pole: "b", text: "You know a little about everything in the room, and you're the one who introduces people.", reasons: r("I'm the bridge, not the pillar.", "I like knowing enough to ask.", "Breadth is my depth.") },
  { axis: "depth_breadth", pole: "b", text: "New city, new tool, new team, all in one month. You slept fine.", reasons: r("Change is my resting state.", "I learn by moving.", "Staying still scares me more.") },
  { axis: "making_deciding", pole: "a", text: "It's 9 p.m. and you're still moving the colours around because it isn't right yet.", reasons: r("I can't leave it ugly.", "Making is when I lose time.", "The thing has to be good, even if no one notices.") },
  { axis: "making_deciding", pole: "a", text: "Your hands are dirty and the shelf finally stands straight.", reasons: r("I need to see what I made.", "Screens don't give me this.", "Finished things calm me.") },
  { axis: "making_deciding", pole: "a", text: "The draft is done. You read it once more just to enjoy it.", reasons: r("I love the object more than the outcome.", "Craft is how I care.", "I'd do it for free.") },
  { axis: "making_deciding", pole: "b", text: "Two good options, no time, everyone waiting. You pick one and the room exhales.", reasons: r("Deciding is a relief, not a weight.", "I'd rather be wrong than stuck.", "People need someone to call it.") },
  { axis: "making_deciding", pole: "b", text: "You didn't build any of it, but you chose what got built and it worked.", reasons: r("Direction is my craft.", "I like the shape more than the pieces.", "Making the call is making.") },
  { axis: "making_deciding", pole: "b", text: "Someone says: just tell us what to do. You already know.", reasons: r("I see the path before others do.", "Responsibility feels natural.", "I don't mind being blamed.") },
  { axis: "visible_hidden", pole: "a", text: "You're asked to run the meeting.", reasons: r("I come alive in front of people.", "I want to be the one they remember.", "Speaking is thinking for me.") },
  { axis: "visible_hidden", pole: "a", text: "Your name is on the slide. Two hundred people are looking at it.", reasons: r("Credit matters and I'm done pretending it doesn't.", "Being seen is the reward.", "I want my work to have my face.") },
  { axis: "visible_hidden", pole: "a", text: "Everyone claps at the end.", reasons: r("I need the applause more than I'd like.", "Recognition fuels the next one.", "It felt earned.") },
  { axis: "visible_hidden", pole: "b", text: "The system ran perfectly all year and nobody knows your name.", reasons: r("Quiet competence is enough.", "I don't want the stage.", "The work knowing is enough.") },
  { axis: "visible_hidden", pole: "b", text: "You fixed it at 3 a.m. and told no one.", reasons: r("I don't need witnesses.", "Being needed beats being seen.", "I'd rather be trusted than famous.") },
  { axis: "visible_hidden", pole: "b", text: "Someone else presents your work and gets the thanks. You're fine.", reasons: r("The result is what I wanted.", "Attention costs me energy.", "I know what I did.") },
  { axis: "stability_risk", pole: "a", text: "Same desk, same people, salary on the 28th, ten years now.", reasons: r("Steady lets me build a life.", "I've had enough chaos.", "Predictable is underrated.") },
  { axis: "stability_risk", pole: "a", text: "You know exactly what next Tuesday looks like.", reasons: r("Routine is freedom for me.", "I want energy left for home.", "I like knowing.") },
  { axis: "stability_risk", pole: "a", text: "Your parents finally get what you do.", reasons: r("Their relief matters to me.", "I wanted to be understood.", "It's easier when they approve.") },
  { axis: "stability_risk", pole: "b", text: "Month three, no salary, the thing might not work. You wake up early anyway.", reasons: r("Uncertainty makes me sharp.", "I'd regret not trying more than failing.", "I want it to be mine.") },
  { axis: "stability_risk", pole: "b", text: "You said yes to the job in the country where you don't speak the language.", reasons: r("Not knowing is the adventure.", "I grow when I'm scared.", "I've done safe long enough.") },
  { axis: "stability_risk", pole: "b", text: "You quit before the next thing was certain.", reasons: r("Staying was the bigger risk.", "I trust myself to land.", "I needed the door shut behind me.") },
  { axis: "people_things", pole: "a", text: "Someone junior asks you to explain it a third time. You love this.", reasons: r("Watching it click is the best part.", "I'm patient in a way that surprises me.", "Teaching is how I learn.") },
  { axis: "people_things", pole: "a", text: "A stranger tells you their whole story on a train and you're not tired.", reasons: r("People are my material.", "I hear what's under the words.", "I want to be the one they trust.") },
  { axis: "people_things", pole: "a", text: "The hardest part of the week is a conversation, and you're the one who has it.", reasons: r("Difficult talks don't scare me.", "I'd rather face it than avoid it.", "Someone has to care enough.") },
  { axis: "people_things", pole: "b", text: "Numbers on a screen finally line up and you feel it in your chest.", reasons: r("Order makes me happy.", "Things don't lie.", "I like being alone with a hard problem.") },
  { axis: "people_things", pole: "b", text: "The thing is broken and nobody knows why. They come and get you.", reasons: r("I'm the one who fixes it.", "A mystery pulls me in.", "I like being needed for what I know.") },
  { axis: "people_things", pole: "b", text: "You'd rather write the tool than answer the email.", reasons: r("Systems over small talk.", "I express care by building.", "People are the slow part.") },
] as const;

export function openingFixtureCards(count = 5): readonly FixtureCard[] {
  const axes: Axis[] = ["autonomy_belonging", "depth_breadth", "making_deciding", "visible_hidden", "stability_risk", "people_things"];
  return axes.slice(0, count).map((axis, index) => fixtureDeck.find((card) => card.axis === axis && card.pole === (index % 2 === 0 ? "a" : "b"))!);
}
