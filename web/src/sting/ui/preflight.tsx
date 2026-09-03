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
          ChatGPT desktop app: open this page in ChatGPT&rsquo;s built-in browser with GPT-5.6 Sol or Terra. Luna has site tools off. Enterprise and Edu
          workspaces cannot use site tools yet.
        </p>
        <p className="sting-small">
          Chrome 149+: turn on <code>chrome://flags/#enable-webmcp-testing</code>, or open Chrome DevTools &gt; Application &gt; WebMCP to run the tools by
          hand.
        </p>
        <p className="sting-small">No agent? The house plays. Same rules, fewer surprises.</p>
      </div>
    </details>
  );
}
