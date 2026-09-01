"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createParticipantCommandAdapter, type ParticipantCommandAdapter } from "../adapters/participant-command-adapter";
import { CommandKernel } from "../commands/command-kernel";
import type { OrientationProjection } from "../domain/reads";
import type { SaveReflectionResult } from "../domain/results";
import { createEmptyWorkspace, type Workspace } from "../domain/workspace";
import { WorkspaceReader } from "../projections/workspace-reader";
import { LocalWorkspaceStore } from "../storage/local-workspace-store";

interface Runtime {
  store: LocalWorkspaceStore;
  adapter: ParticipantCommandAdapter;
  reader: WorkspaceReader;
}

export function CommandSpineDemo() {
  const runtime = useRef<Runtime | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<SaveReflectionResult | null>(null);
  const [orientation, setOrientation] = useState<OrientationProjection | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    const store = new LocalWorkspaceStore(localStorage, createEmptyWorkspace());
    const adapter = createParticipantCommandAdapter(new CommandKernel(store));
    const reader = new WorkspaceReader(store);
    runtime.current = { store, adapter, reader };
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      try {
        setWorkspace(store.load());
        const readResult = reader.read();
        setOrientation(readResult.data?.view === "orientation" ? readResult.data : null);
      } catch (error) {
        setStartupError(
          error instanceof Error ? error.message : "The local workspace could not be opened.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function saveReflection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!runtime.current || !workspace) {
      return;
    }

    const commandResult = runtime.current.adapter.saveReflection({
      operationId: crypto.randomUUID(),
      expectedVersion: workspace.stateVersion,
      text,
    });
    setResult(commandResult);

    try {
      setWorkspace(runtime.current.store.load());
      const readResult = runtime.current.reader.read();
      setOrientation(readResult.data?.view === "orientation" ? readResult.data : null);
    } catch (error) {
      setStartupError(
        error instanceof Error ? error.message : "The local workspace could not be reopened.",
      );
      return;
    }

    if (commandResult.ok) {
      setText("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3ed] px-5 py-10 text-[#201d19] sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 border-b border-[#d7d0c4] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-[#745f42]">
              P2 · Command spine + cold orientation
            </p>
            <h1 className="font-serif text-4xl tracking-tight sm:text-6xl">One path to truth.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#625b51] sm:text-lg">
              Writes pass through one command kernel. A bounded deterministic projection gives
              a cold agent and this UI the same current truth.
            </p>
          </div>
          <div className="w-fit border border-[#a99b87] bg-[#eee8de] px-4 py-3 font-mono text-xs uppercase tracking-wider text-[#5b4a34]">
            Local only · schema v{workspace?.schemaVersion ?? "—"}
          </div>
        </header>

        {startupError ? (
          <section className="border border-[#a44737] bg-[#f4dfd9] p-5" role="alert">
            <h2 className="font-serif text-2xl">Workspace recovery required</h2>
            <p className="mt-2 leading-6">{startupError}</p>
            <p className="mt-2 text-sm text-[#625b51]">
              The original saved bytes were preserved; this P1 slice does not reset them.
            </p>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="border border-[#cfc5b6] bg-[#fffdf8] p-6 shadow-[6px_6px_0_#ded5c8] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#745f42]">
                    Participant adapter
                  </p>
                  <h2 className="mt-2 font-serif text-3xl">Save a reflection</h2>
                </div>
                <span className="border border-[#cfc5b6] px-3 py-1 font-mono text-xs">
                  expected v{workspace?.stateVersion ?? "—"}
                </span>
              </div>

              <form className="mt-7" onSubmit={saveReflection}>
                <label className="block font-medium" htmlFor="reflection-text">
                  What are you noticing about your direction?
                </label>
                <textarea
                  className="mt-3 min-h-44 w-full resize-y border border-[#a99b87] bg-white p-4 text-base leading-7 outline-none focus:border-[#5b4a34] focus:ring-2 focus:ring-[#d2b98e]"
                  id="reflection-text"
                  maxLength={2000}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="I keep returning to work where I can make a complicated system easier to understand…"
                  required
                  value={text}
                />
                <div className="mt-3 flex items-center justify-between gap-4 text-sm text-[#746c61]">
                  <span>The command trims whitespace and rejects empty or oversized input.</span>
                  <span className="font-mono tabular-nums">{text.length}/2000</span>
                </div>
                <button
                  className="mt-6 w-full bg-[#27231e] px-5 py-3 font-medium text-[#fffdf8] transition hover:bg-[#463d32] disabled:cursor-not-allowed disabled:bg-[#aaa196]"
                  disabled={!workspace || text.trim().length === 0}
                  type="submit"
                >
                  Execute save_reflection
                </button>
              </form>

              <div className="mt-6 min-h-20 border-t border-[#ded6ca] pt-5" aria-live="polite">
                {result ? (
                  result.ok && result.receipt ? (
                    <div>
                      <p className="font-medium text-[#28583f]">{result.guidance}</p>
                      <p className="mt-2 font-mono text-xs leading-6 text-[#625b51]">
                        {result.receipt.operationRef} · {result.receipt.effect} · v
                        {result.receipt.beforeVersion} → v{result.receipt.afterVersion}
                      </p>
                    </div>
                  ) : (
                    <div role="alert">
                      <p className="font-medium text-[#8a3025]">{result.error?.code}</p>
                      <p className="mt-2 text-sm leading-6 text-[#625b51]">{result.error?.what}</p>
                    </div>
                  )
                ) : (
                  <p className="text-sm leading-6 text-[#746c61]">
                    The authoritative receipt will appear here after the kernel applies the command.
                  </p>
                )}
              </div>
            </section>

            <aside className="flex flex-col gap-5">
              <section className="border border-[#315c51] bg-[#dfece6] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#315c51]">
                      read_workspace · orientation
                    </p>
                    <h2 className="mt-2 font-serif text-2xl">Cold-agent handoff</h2>
                  </div>
                  <span className="border border-[#77988f] px-2 py-1 font-mono text-xs">
                    {orientation?.proof.level ?? "LOADING"}
                  </span>
                </div>
                <p className="mt-5 text-sm font-medium leading-6">
                  {orientation?.nextHumanDecision.guidance ?? "Reading current truth…"}
                </p>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div>
                    <dt className="text-[#58736c]">Next boundary</dt>
                    <dd className="mt-1 font-mono text-xs">
                      {orientation?.nextHumanDecision.kind ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#58736c]">Pending review</dt>
                    <dd className="mt-1 font-mono text-xs">
                      {orientation?.pendingHumanInteractions.total ?? "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                    <dt className="text-[#58736c]">Caller cursor</dt>
                    <dd className="mt-1 break-all font-mono text-xs">{orientation?.cursor ?? "—"}</dd>
                  </div>
                </dl>
              </section>

              <section className="border border-[#cfc5b6] bg-[#e9e2d7] p-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#745f42]">
                  Workspace authority
                </p>
                <div className="mt-5 grid grid-cols-2 gap-px border border-[#cfc5b6] bg-[#cfc5b6]">
                  <Metric label="State version" value={workspace?.stateVersion ?? "—"} />
                  <Metric label="Phase" value={workspace?.phase ?? "—"} />
                  <Metric label="Reflections" value={workspace?.reflections.length ?? "—"} />
                  <Metric label="Receipts" value={workspace?.operations.length ?? "—"} />
                </div>
              </section>

              <section className="border border-[#cfc5b6] bg-[#fffdf8] p-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-serif text-2xl">Authoritative after-state</h2>
                  <span className="font-mono text-xs text-[#746c61]">localStorage</span>
                </div>
                <div className="mt-5 flex flex-col gap-3">
                  {workspace?.reflections.length ? (
                    [...workspace.reflections].reverse().map((reflection) => (
                      <article className="border-l-2 border-[#846d4d] pl-4" key={reflection.id}>
                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#746c61]">
                          <span>{reflection.ref}</span>
                          <span>·</span>
                          <span>{reflection.status}</span>
                        </div>
                        <p className="mt-2 leading-6">{reflection.text}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-[#746c61]">
                      No reflection exists yet. The board is rendering the current workspace, not
                      optimistic UI state.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#f7f2e9] p-4">
      <p className="text-xs uppercase tracking-wide text-[#746c61]">{label}</p>
      <p className="mt-2 font-mono text-base font-medium">{value}</p>
    </div>
  );
}
