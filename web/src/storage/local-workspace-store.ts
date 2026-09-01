import { workspaceSchema, type Workspace } from "../domain/workspace";
import { WorkspaceStoreError, type WorkspaceStore } from "./workspace-store";

export const LOCAL_WORKSPACE_KEY = "destiny-ai.workspace.v1";

export interface WorkspaceLockManager {
  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
}

export class LocalWorkspaceStore implements WorkspaceStore {
  constructor(
    private readonly storage: Storage,
    private readonly initialWorkspace: Workspace,
    private readonly locks: WorkspaceLockManager,
    private readonly key = LOCAL_WORKSPACE_KEY,
  ) {}

  load(): Workspace {
    const raw = this.storage.getItem(this.key);

    if (raw === null) {
      return workspaceSchema.parse(this.initialWorkspace);
    }

    try {
      return workspaceSchema.parse(JSON.parse(raw));
    } catch {
      throw new WorkspaceStoreError(
        "CORRUPT_WORKSPACE",
        "The saved workspace is invalid. Its original bytes were preserved.",
      );
    }
  }

  async save(expectedVersion: number, nextWorkspace: Workspace): Promise<void> {
    await this.locks.request(`${this.key}.write`, async () => {
      const current = this.load();
      if (current.stateVersion !== expectedVersion) {
        throw new WorkspaceStoreError(
          "STALE_WRITE",
          "The workspace changed before the command could be saved.",
          current.stateVersion,
        );
      }

      this.persist(workspaceSchema.parse(nextWorkspace));
    });
  }

  private persist(workspace: Workspace): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(workspace));
    } catch {
      throw new WorkspaceStoreError(
        "PERSISTENCE_FAILED",
        "The browser could not persist the workspace.",
        workspace.stateVersion,
      );
    }
  }
}
