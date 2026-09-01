import type { ReadWorkspaceInput, ReadWorkspaceResult } from "../domain/reads";
import type { WorkspaceReader } from "../projections/workspace-reader";

export interface TestReadAdapter {
  readWorkspace(input?: ReadWorkspaceInput): ReadWorkspaceResult;
}

export function createTestReadAdapter(reader: WorkspaceReader): TestReadAdapter {
  return {
    readWorkspace: (input = {}) => reader.read(input),
  };
}
