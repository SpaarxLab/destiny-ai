import type { Workspace } from "../domain/workspace";

export type WorkspaceStoreErrorCode =
  | "CORRUPT_WORKSPACE"
  | "STALE_WRITE"
  | "PERSISTENCE_FAILED";

export class WorkspaceStoreError extends Error {
  constructor(
    readonly code: WorkspaceStoreErrorCode,
    message: string,
    readonly stateVersion?: number,
  ) {
    super(message);
    this.name = "WorkspaceStoreError";
  }
}

export interface WorkspaceStore {
  load(): Workspace;
  save(expectedVersion: number, nextWorkspace: Workspace): void | Promise<void>;
}
