import type {
  WebMcpModelContext,
  WebMcpToolDefinition,
} from "../runtime";
import type { WorkspaceReader } from "../../projections/workspace-reader";
import { WebMcpRegistrationManager } from "../lifecycle";

interface RegisteredTool {
  tool: WebMcpToolDefinition;
  signal: AbortSignal;
}

export class FakeWebMcpRuntime implements WebMcpModelContext {
  private readonly registrations: RegisteredTool[] = [];

  registerTool(
    tool: WebMcpToolDefinition,
    { signal }: Readonly<{ signal: AbortSignal }>,
  ): void {
    this.registrations.push({ tool, signal });
  }

  activeToolNames(): string[] {
    return this.registrations
      .filter(({ signal }) => !signal.aborted)
      .map(({ tool }) => tool.name);
  }

  latest(name: string): WebMcpToolDefinition {
    const registration = [...this.registrations]
      .reverse()
      .find(({ tool }) => tool.name === name);
    if (!registration) throw new Error(`No fake WebMCP registration exists for ${name}.`);
    return registration.tool;
  }

  cached(name: string, occurrence = 0): WebMcpToolDefinition {
    const registration = this.registrations
      .filter(({ tool }) => tool.name === name)
      .at(occurrence);
    if (!registration) throw new Error(`No cached WebMCP registration exists for ${name}.`);
    return registration.tool;
  }

  invoke(name: string, input: unknown = {}): unknown | Promise<unknown> {
    return this.latest(name).execute(input);
  }
}

export function createWebMcpHarness(reader: WorkspaceReader) {
  const runtime = new FakeWebMcpRuntime();
  const manager = new WebMcpRegistrationManager(() => runtime);
  const registration = manager.replace(reader);
  return { runtime, manager, registration };
}
