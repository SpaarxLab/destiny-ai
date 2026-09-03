const encoder = new TextEncoder();

async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", encoder.encode(text));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  // Deterministic fallback for environments without Web Crypto (never production browsers).
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").repeat(8);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

/** Binds an idempotency key to the actor, command kind and semantic payload (not room version). */
export async function requestFingerprint(actor: string, command: Record<string, unknown>): Promise<string> {
  const { operationId: _operationId, expectedVersion: _expectedVersion, ...payload } = command;
  void _operationId;
  void _expectedVersion;
  return (await sha256Hex(canonical({ actor, payload }))).slice(0, 12);
}

/** Short commitment shown before a reveal: sha256(payload ‖ operationId), first 4 hex. */
export async function commitment(payload: unknown, operationId: string): Promise<string> {
  const full = await sha256Hex(`${JSON.stringify(payload)}\u0000${operationId}`);
  return full.slice(0, 4);
}

export async function verifyCommitment(payload: unknown, operationId: string, expected: string): Promise<boolean> {
  return (await commitment(payload, operationId)) === expected;
}

/** Receipt chain hash: sha256(prev ‖ seq ‖ operationId ‖ command ‖ stateVersion ‖ summary), first 12 hex. */
export async function chainHash(input: {
  prev: string;
  seq: number;
  operationId: string;
  command: string;
  stateVersion: number;
  summary: string;
  requestHash?: string;
}): Promise<string> {
  const parts = [input.prev, input.seq, input.operationId, input.command, input.stateVersion, input.summary];
  if (input.requestHash) parts.push(input.requestHash);
  const full = await sha256Hex(parts.join("\u0000"));
  return full.slice(0, 12);
}
