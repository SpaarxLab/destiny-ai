import { describe, expect, it, vi } from "vitest";
import { subscribeToToolChanges, type WebMcpModelContext } from "./runtime";

const registerTool: WebMcpModelContext["registerTool"] = async () => undefined;

describe("subscribeToToolChanges", () => {
  it("uses EventTarget-style listeners without mutating a frozen host object", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const context = Object.freeze({ registerTool, addEventListener, removeEventListener }) as WebMcpModelContext;
    const listener = vi.fn();

    const unsubscribe = subscribeToToolChanges(context, listener);

    expect(addEventListener).toHaveBeenCalledWith("toolchange", listener);
    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith("toolchange", listener);
  });

  it("does not crash when a frozen host exposes neither change API", () => {
    const context = Object.freeze({ registerTool }) as WebMcpModelContext;

    expect(() => subscribeToToolChanges(context, vi.fn())).not.toThrow();
  });
});
