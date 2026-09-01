import type { ReadWorkspaceInput } from "../domain/reads";
import type { WorkspaceReader } from "../projections/workspace-reader";
import {
  getMethodGuide,
  staleRegistrationResult,
  webMcpReadWorkspaceResultSchema,
} from "./contracts";
import type { WebMcpToolDefinition } from "./runtime";

export const READ_WORKSPACE_INPUT_SCHEMA = {
  oneOf: [
    {
      type: "object",
      properties: {
        view: { type: "string", const: "orientation" },
        sinceCursor: { type: "string", minLength: 1, maxLength: 200 },
      },
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        view: { type: "string", const: "working_set" },
        sinceCursor: { type: "string", minLength: 1, maxLength: 200 },
      },
      required: ["view"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        view: { type: "string", const: "entities" },
        refs: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: { type: "string", minLength: 1, maxLength: 128 },
        },
      },
      required: ["view", "refs"],
      additionalProperties: false,
    },
  ],
} as const;

const EMPTY_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

export function createWebMcpTools(
  reader: WorkspaceReader,
  signal: AbortSignal,
): readonly WebMcpToolDefinition[] {
  return [
    {
      name: "read_workspace",
      description:
        "Read bounded current Destiny.AI workspace truth without mutation. Use orientation for identity, proof summary, available actions, guidance, and cursor-based changes; use working_set for recent reflections; use entities for targeted reflection refs.",
      inputSchema: READ_WORKSPACE_INPUT_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input: unknown) {
        if (signal.aborted) return staleRegistrationResult();
        return webMcpReadWorkspaceResultSchema.parse(
          reader.read((input ?? {}) as ReadWorkspaceInput),
        );
      },
    },
    {
      name: "get_method_guide",
      description:
        "Read the versioned Destiny.AI method and contract identity. Use before interpreting workspace state or proposing a direction. Returns the product promise, evidence rules, human authority boundaries, methodVersion, and contractVersion without mutation.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      execute(input: unknown) {
        if (signal.aborted) return staleRegistrationResult();
        const identityRead = webMcpReadWorkspaceResultSchema.parse(
          reader.read({ view: "orientation" }),
        );
        if (!identityRead.ok) return identityRead;
        if (!isEmptyRecord(input ?? {})) {
          return webMcpReadWorkspaceResultSchema.parse({
            ok: false,
            error: {
              code: "MALFORMED_INPUT",
              what: "get_method_guide accepts an empty object only.",
              retry: "NEVER",
              insteadDo: "Call get_method_guide with {}.",
              example: {},
            },
            nextActions: identityRead.nextActions,
            stateVersion: identityRead.stateVersion,
            guidance: "No guide was returned because the request contained unsupported fields.",
          });
        }
        return getMethodGuide(identityRead.stateVersion, identityRead.nextActions);
      },
    },
  ];
}

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.keys(value).length === 0;
}
