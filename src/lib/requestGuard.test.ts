import { describe, expect, it } from "vitest";
import { createLatestRequestGuard, createSingleFlightGuard } from "./requestGuard";

describe("request guards", () => {
  it("only lets the latest request commit after responses arrive out of order", () => {
    const guard = createLatestRequestGuard();
    const requestA = guard.start();
    const requestB = guard.start();
    const committed: string[] = [];

    if (requestB.isCurrent()) committed.push("B");
    if (requestA.isCurrent()) committed.push("A");

    expect(requestA.signal.aborted).toBe(true);
    expect(committed).toEqual(["B"]);
  });

  it("rejects a duplicate mutation but allows a retry after failure cleanup", () => {
    const guard = createSingleFlightGuard();
    const first = guard.start();

    expect(guard.start()).toBeNull();
    expect(first?.isCurrent()).toBe(true);

    // A failed request releases its handle from finally before the retry.
    first?.release();
    const retry = guard.start();
    expect(retry?.isCurrent()).toBe(true);
  });

  it("invalidates active work during cleanup", () => {
    const guard = createLatestRequestGuard();
    const request = guard.start();

    guard.cancel();

    expect(request.signal.aborted).toBe(true);
    expect(request.isCurrent()).toBe(false);
  });
});
