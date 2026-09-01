import type { RouteProposalInput } from "../../domain/commands";
import { createEmptyWorkspace, workspaceSchema } from "../../domain/workspace";

export const confirmedReflectionText =
  "I enjoy making complicated systems understandable, and I need a low-cost test before committing.";

export function p3Workspace() {
  return workspaceSchema.parse({
    ...createEmptyWorkspace(),
    participant: {
      displayName: "Synthetic participant",
      focusQuestion: "Which direction is worth testing next?",
      costCaps: { hoursPerWeek: 6, money: 100, currency: "USD" },
    },
    reflections: [{
      id: "00000000-0000-4000-8000-000000000101",
      ref: "reflection-grounded",
      availableActions: [],
      status: "confirmed",
      text: confirmedReflectionText,
      recordedBy: "participant",
      createdAt: "2026-09-01T10:00:00.000Z",
    }],
    followUpQuestions: [],
  });
}

export function validRoutes(): [RouteProposalInput, RouteProposalInput, RouteProposalInput] {
  const common = {
    sourceQuotes: [{
      reflectionRef: "reflection-grounded",
      quote: "making complicated systems understandable",
    }],
    constraint: "Stay within six hours and 100 USD this week.",
    strengthensWhen: "The participant wants to repeat the work.",
    weakensWhen: "The work feels draining after the bounded trial.",
  };
  return [
    {
      ...common,
      ref: "route-closest",
      kind: "closest",
      title: "Systems explainer",
      premise: "A nearby direction may be work that turns complex systems into clear guidance.",
      learningQuestion: "Does explaining one real system create sustained energy?",
      test: { action: "Explain one existing workflow to a peer.", maximumDays: 3, maximumHours: 2, maximumMoney: 0, currency: "USD" },
    },
    {
      ...common,
      ref: "route-bridge",
      kind: "bridge",
      title: "Product operations bridge",
      premise: "A bridge direction may combine current operations knowledge with product discovery.",
      learningQuestion: "Does interviewing one operator reveal a problem worth framing?",
      test: { action: "Interview one consenting operator and frame one problem.", maximumDays: 5, maximumHours: 3, maximumMoney: 20, currency: "USD" },
    },
    {
      ...common,
      ref: "route-probe",
      kind: "probe",
      title: "Technical education probe",
      premise: "A more distant probe may test whether teaching technical ideas feels meaningful.",
      learningQuestion: "Does a tiny teaching artifact attract useful feedback?",
      test: { action: "Draft and privately share one short teaching artifact.", maximumDays: 7, maximumHours: 4, maximumMoney: 30, currency: "USD" },
    },
  ];
}
