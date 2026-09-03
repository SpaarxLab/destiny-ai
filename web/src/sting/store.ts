import { freshWorkspace, workspaceSchema, type Workspace } from "./domain";

export const STING_STORAGE_KEY = "sting.workspace.v5";

export interface LockManager {
  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
}

export class StoreError extends Error {
  constructor(
    readonly code: "STALE_WRITE" | "CORRUPT" | "PERSISTENCE_FAILED" | "WRITE_CANCELLED",
    message: string,
    readonly currentVersion?: number,
  ) {
    super(message);
  }
}

export interface StingStore {
  load(): Workspace;
  save(expectedVersion: number, next: Workspace, commitIf?: () => boolean): Promise<void>;
  clear(): Promise<void>;
}

const inlineLocks: LockManager = {
  async request(_name, callback) {
    return callback();
  },
};

export function browserLocks(): LockManager {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return inlineLocks;
  return {
    request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T> {
      return locks.request(name, () => Promise.resolve(callback())) as Promise<T>;
    },
  };
}

export class MemoryStore implements StingStore {
  private workspace: Workspace;
  constructor(initial: Workspace = freshWorkspace()) {
    this.workspace = initial;
  }
  load(): Workspace {
    return structuredClone(this.workspace);
  }
  async save(expectedVersion: number, next: Workspace, commitIf: () => boolean = () => true): Promise<void> {
    if (this.workspace.stateVersion !== expectedVersion) {
      throw new StoreError("STALE_WRITE", "The room changed before the move could be saved.", this.workspace.stateVersion);
    }
    if (!commitIf()) throw new StoreError("WRITE_CANCELLED", "The caller yielded before the move could be saved.", this.workspace.stateVersion);
    this.workspace = workspaceSchema.parse(structuredClone(next));
  }
  async clear(): Promise<void> {
    this.workspace = freshWorkspace();
  }
}

export class LocalStore implements StingStore {
  constructor(
    private readonly storage: Storage,
    private readonly locks: LockManager = browserLocks(),
    private readonly key = STING_STORAGE_KEY,
  ) {}

  load(): Workspace {
    const raw = this.storage.getItem(this.key);
    if (raw === null) return freshWorkspace();
    try {
      return migrate(JSON.parse(raw));
    } catch {
      throw new StoreError("CORRUPT", "The saved room is unreadable. Its bytes were left untouched.");
    }
  }

  async save(expectedVersion: number, next: Workspace, commitIf: () => boolean = () => true): Promise<void> {
    await this.locks.request(`${this.key}.write`, async () => {
      const current = this.load();
      if (current.stateVersion !== expectedVersion) {
        throw new StoreError("STALE_WRITE", "The room changed before the move could be saved.", current.stateVersion);
      }
      if (!commitIf()) throw new StoreError("WRITE_CANCELLED", "The caller yielded before the move could be saved.", current.stateVersion);
      try {
        this.storage.setItem(this.key, JSON.stringify(workspaceSchema.parse(next)));
      } catch {
        throw new StoreError("PERSISTENCE_FAILED", "The browser could not save the room.", current.stateVersion);
      }
    });
  }

  async clear(): Promise<void> {
    await this.locks.request(`${this.key}.write`, async () => {
      this.storage.removeItem(this.key);
    });
  }
}

export function migrate(raw: unknown): Workspace {
  const candidate = raw as { schema?: number };
  if (candidate?.schema === 5) {
    const parsed = workspaceSchema.parse(raw);
    const rawRecord = (raw as { record?: { players?: unknown; externalAllowed?: unknown } }).record;
    if (!Array.isArray(rawRecord?.players) || typeof rawRecord?.externalAllowed !== "boolean") {
      const contributors = new Set([
        ...parsed.probes.map((probe) => probe.player),
        ...parsed.hypotheses.map((item) => item.player),
        ...parsed.questions.map((item) => item.player),
        ...(parsed.letter ? [parsed.letter.player] : []),
      ]);
      parsed.record.players = [...contributors];
      // Later legacy phases did not retain enough authorship to prove that the
      // visiting agent alone earned the standing, so fail closed on reload.
      parsed.record.externalAllowed = [...contributors].every((player) => player === "chatgpt") && !["lives", "dare", "card"].includes(parsed.phase);
    }
    const hasPreColdEvidence = parsed.probes.some((probe) => probe.kind === "duel") || parsed.questions.length > 0;
    const hasColdRead = parsed.hypotheses.some((item) => item.kind === "cold_read");
    // Earlier schema-5 builds could allow a duel before the promised sealed cold
    // read. That commitment cannot be reconstructed honestly after the fact.
    if (hasPreColdEvidence && !hasColdRead) return freshWorkspace();
    // Earlier schema-5 builds let a model write the final brief, and older
    // house briefs predate the explicit evidence/instruction boundary. Remove
    // either legacy form so the current deterministic house template recompiles
    // from the preserved accepted state on the next card turn.
    const currentBriefPrefix = "FIELD BRIEF — GAME-DERIVED CLAIMS ARE REVISABLE EVIDENCE.";
    if (parsed.brief && (parsed.brief.player !== "house" || !parsed.brief.text.startsWith(currentBriefPrefix))) {
      parsed.brief = undefined;
    }
    return parsed;
  }
  // Older or unknown documents are not STING rooms; start fresh rather than guess.
  return freshWorkspace();
}
