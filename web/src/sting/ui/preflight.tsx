"use client";

/**
 * A collapsed-by-default door screen banner explaining how to bring a real agent into the room.
 * Opens on its own when there is no way to play against one right now (no WebMCP, no Spark).
 */
export function Preflight({ connected, sparkEnabled }: { connected: boolean; sparkEnabled: boolean }) {
  const bare = !connected && !sparkEnabled;
  return (
    <details className="preflight" open={bare}>
      <summary>Playing with your own AI?</summary>
      <div className="preflight__body">
        <p className="sting-small">
          ChatGPT: open this page in the built-in browser and ask your agent to play. If this chat does not expose Site tools, use the house fallback.
        </p>
        <p className="sting-small">
          Chrome 149+: enable <code>chrome://flags/#enable-webmcp-testing</code>, relaunch, then open Chrome DevTools &gt; Application &gt; WebMCP to inspect
          or run the tools.
        </p>
        <p className="sting-small">No agent? The house plays. Same rules, fewer surprises.</p>
      </div>
    </details>
  );
}
