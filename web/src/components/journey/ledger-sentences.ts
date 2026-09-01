import type { Workspace } from "../../domain/workspace";
import { ACTOR_NAMES, ROUTE_LABELS } from "../../content/journey";

export interface ActivityLine {
  id: string;
  at: string;
  actor: "you" | "agent";
  sentence: string;
  receipt?: string;
  session?: boolean;
  denied?: boolean;
}

/**
 * Turns the authoritative ledger into plain sentences. Details the ledger does not record
 * (which route a participant set aside) come from a presentation-only map kept by the UI.
 */
export function ledgerSentences(
  workspace: Workspace,
  details: Record<string, string> = {},
): ActivityLine[] {
  return [...workspace.operations].reverse().map((operation) => {
    const receipt = `receipt ${operation.afterVersion} · version ${operation.beforeVersion} to ${operation.afterVersion}`;
    const agent = agentNameFor(workspace, operation.changedRefs);
    const detail = details[operation.operationId];
    let sentence = "";
    switch (operation.command) {
      case "save_reflection": {
        const answered = workspace.followUpQuestions.some((question) => operation.changedRefs.includes(question.ref));
        sentence = operation.actor === "participant"
          ? answered ? "You answered the question" : "You confirmed your words"
          : `${agent} drafted words for you to confirm`;
        break;
      }
      case "set_limits":
        sentence = "You set your limits";
        break;
      case "propose_route_set": {
        const target = operation.changedRefs.at(-1);
        const set = workspace.routeProposalSets.find((candidate) => candidate.ref === target);
        const question = workspace.followUpQuestions.find((candidate) => candidate.ref === target);
        if (question) {
          sentence = `${agent} asked one question before proposing`;
        } else if (set) {
          const replaced = set.routes.filter((route) => !route.carriedFromRouteRef).map((route) => ROUTE_LABELS[route.kind].name);
          const carried = set.routes.some((route) => route.carriedFromRouteRef);
          const who = set.createdBy === "participant" ? "You" : ACTOR_NAMES[set.createdBy];
          sentence = carried
            ? `${who} replaced ${listNames(replaced)} and kept the rest`
            : `${who} ${set.createdBy === "participant" ? "drafted" : "proposed"} three routes`;
        } else {
          sentence = `${agent} proposed routes`;
        }
        break;
      }
      case "revise_route_set":
        sentence = detail ? `You ${detail}` : "You changed your routes";
        break;
      case "choose_route": {
        const set = workspace.routeProposalSets.find((candidate) => candidate.ref === operation.changedRefs[0]);
        const route = set?.routes.find((candidate) => candidate.ref === set.selectedRouteRef);
        sentence = route ? `You chose ${ROUTE_LABELS[route.kind].name}: ${route.title}` : "You chose a direction";
        break;
      }
      case "compensate_route_set":
        sentence = "You withdrew a proposal";
        break;
      case "skip_follow_up":
        sentence = "You skipped the question";
        break;
      case "reopen_exploring":
        sentence = "You parked that direction and reopened exploring";
        break;
      default:
        sentence = operation.actor === "participant" ? "You made a change" : `${agent} made a proposal`;
    }
    return {
      id: operation.operationId,
      at: operation.at,
      actor: operation.actor === "participant" ? "you" : "agent",
      sentence,
      receipt,
    };
  });
}

function agentNameFor(workspace: Workspace, changedRefs: string[]): string {
  const set = workspace.routeProposalSets.find((candidate) => changedRefs.includes(candidate.ref));
  if (set && set.createdBy !== "participant") return ACTOR_NAMES[set.createdBy];
  const question = workspace.followUpQuestions.find((candidate) => changedRefs.includes(candidate.ref));
  if (question) return ACTOR_NAMES[question.askedBy];
  return ACTOR_NAMES.chatgpt_webmcp;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "a route";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
