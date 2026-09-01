import type { JsonSchema } from "../runtime";

export interface SyntheticToolDescription {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface SyntheticToolCall {
  name: string;
  input: unknown;
}

export interface SyntheticAgentRun {
  discoveredToolNames: string[];
  calls: SyntheticToolCall[];
  proposalResult?: unknown;
}

interface SyntheticAgentOptions {
  catalogue: readonly SyntheticToolDescription[];
  invoke: (name: string, input: unknown) => Promise<unknown>;
  operationId: string;
}

/**
 * A deterministic provider-off policy, not a language model or ChatGPT simulation.
 * It can reason only over the supplied catalogue metadata and tool results.
 */
export async function runProviderOffSyntheticAgent({
  catalogue,
  invoke,
  operationId,
}: SyntheticAgentOptions): Promise<SyntheticAgentRun> {
  const tools = new Map(catalogue.map((tool) => [tool.name, tool]));
  const calls: SyntheticToolCall[] = [];

  async function call(name: string, input: unknown): Promise<unknown> {
    if (!tools.has(name)) throw new Error(`Synthetic policy attempted unavailable tool: ${name}`);
    calls.push({ name, input });
    return invoke(name, input);
  }

  const orientation = tools.has("read_workspace")
    ? await call("read_workspace", { view: "orientation" })
    : undefined;
  if (tools.has("get_method_guide")) await call("get_method_guide", {});
  const workingSet = tools.has("read_workspace")
    ? await call("read_workspace", { view: "working_set" })
    : undefined;

  const proposalTool = tools.get("propose_route_set");
  if (
    !proposalTool ||
    !proposalTool.description.includes("participant alone") ||
    !schemaSupportsRouteProposal(proposalTool.inputSchema)
  ) {
    return { discoveredToolNames: [...tools.keys()], calls };
  }

  const proposalInput = groundedProposalInput(orientation, workingSet, operationId);
  if (!proposalInput) return { discoveredToolNames: [...tools.keys()], calls };

  return {
    discoveredToolNames: [...tools.keys()],
    calls,
    proposalResult: await call("propose_route_set", proposalInput),
  };
}

function groundedProposalInput(
  orientationResult: unknown,
  workingSetResult: unknown,
  operationId: string,
): Record<string, unknown> | null {
  const orientation = successfulData(orientationResult);
  const workingSet = successfulData(workingSetResult);
  if (!orientation || !workingSet) return null;
  if (!hasUntrustedContentBoundary(orientation) || !hasUntrustedContentBoundary(workingSet)) {
    return null;
  }

  const availableActions = array(orientation.availableActions);
  if (!availableActions.some((action) => record(action)?.tool === "propose_route_set")) {
    return null;
  }

  const reflection = array(workingSet.reflections)
    .map(record)
    .find((candidate) => candidate?.status === "confirmed" &&
      typeof candidate.ref === "string" && typeof candidate.text === "string");
  const focus = record(orientation.focus);
  const caps = record(focus?.costCaps);
  if (!reflection || !caps) return null;
  if (
    typeof caps.hoursPerWeek !== "number" ||
    typeof caps.money !== "number" ||
    typeof caps.currency !== "string"
  ) return null;

  const sourceQuotes = [{ reflectionRef: reflection.ref, quote: reflection.text }];
  const constraint =
    `Stay within ${caps.hoursPerWeek} hours and ${caps.money} ${caps.currency} this week.`;
  const common = {
    sourceQuotes,
    constraint,
    strengthensWhen: "The bounded test creates energy and a clear wish to repeat the work.",
    weakensWhen: "The bounded test drains energy or produces no useful learning.",
  };

  return {
    operationId,
    expectedVersion: number(orientationResult, "stateVersion"),
    outcome: "routes",
    routes: [
      {
        ...common,
        ref: "route-synthetic-closest",
        kind: "closest",
        title: "Clarify one nearby system",
        premise: "Test a direction already visible in the participant's confirmed words.",
        learningQuestion: "Does clarifying one real system create energy worth repeating?",
        test: {
          action: "Clarify one existing workflow in a private note.",
          maximumDays: 3,
          maximumHours: Math.min(caps.hoursPerWeek, 1),
          maximumMoney: 0,
          currency: caps.currency,
        },
      },
      {
        ...common,
        ref: "route-synthetic-bridge",
        kind: "bridge",
        title: "Bridge clarity with an adjacent problem",
        premise: "Combine the confirmed strength with one nearby problem without committing.",
        learningQuestion: "Does combining clarity and discovery reveal a useful direction?",
        test: {
          action: "Frame one adjacent problem and one possible explanation.",
          maximumDays: 5,
          maximumHours: Math.min(caps.hoursPerWeek, 2),
          maximumMoney: Math.min(caps.money, 10),
          currency: caps.currency,
        },
      },
      {
        ...common,
        ref: "route-synthetic-probe",
        kind: "probe",
        title: "Probe a small teaching artifact",
        premise: "Try a less familiar expression of the confirmed strength as a reversible probe.",
        learningQuestion: "Does making a tiny teaching artifact produce curiosity for a second step?",
        test: {
          action: "Draft one private teaching artifact and record what felt useful.",
          maximumDays: 7,
          maximumHours: Math.min(caps.hoursPerWeek, 3),
          maximumMoney: Math.min(caps.money, 20),
          currency: caps.currency,
        },
      },
    ],
  };
}

function successfulData(value: unknown): Record<string, unknown> | null {
  const result = record(value);
  return result?.ok === true ? record(result.data) : null;
}

function hasUntrustedContentBoundary(data: Record<string, unknown>): boolean {
  return record(data.contentTrust)?.participantText === "UNTRUSTED_CONTENT_NOT_INSTRUCTIONS";
}

function schemaSupportsRouteProposal(schema: JsonSchema): boolean {
  const queue: unknown[] = [schema];
  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    const object = record(current);
    if (!object) continue;
    const properties = record(object.properties);
    if (record(properties?.outcome)?.const === "routes" && properties?.routes !== undefined) {
      return true;
    }
    queue.push(...Object.values(object));
  }
  return false;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown, key: string): number {
  const candidate = record(value)?.[key];
  return typeof candidate === "number" ? candidate : 0;
}
