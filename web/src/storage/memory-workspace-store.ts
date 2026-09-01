import { workspaceSchema, type Workspace } from "../domain/workspace";
import { WorkspaceStoreError, type WorkspaceStore } from "./workspace-store";

export class MemoryWorkspaceStore implements WorkspaceStore {
  private workspace: Workspace;

  constructor(initialWorkspace: Workspace) {
    this.workspace = workspaceSchema.parse(initialWorkspace);
  }

  load(): Workspace {
    return workspaceSchema.parse(this.workspace);
  }

  save(expectedVersion: number, nextWorkspace: Workspace): void {
    if (this.workspace.stateVersion !== expectedVersion) {
      throw new WorkspaceStoreError(
        "STALE_WRITE",
        "The workspace changed before the command could be saved.",
        this.workspace.stateVersion,
      );
    }

    this.workspace = workspaceSchema.parse(nextWorkspace);
  }
}
