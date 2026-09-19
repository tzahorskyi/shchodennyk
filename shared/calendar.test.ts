import { describe, expect, it } from "vitest";
import { addDays, mondayOf, weekTypeFor } from "./calendar";

describe("calendar", () => {
  it("finds Monday across a year boundary", () => {
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });

  it("alternates upper and lower weeks in both directions", () => {
    expect(weekTypeFor("2026-09-14", "2026-09-14", true)).toBe("upper");
    expect(weekTypeFor("2026-09-21", "2026-09-14", true)).toBe("lower");
    expect(weekTypeFor("2026-09-07", "2026-09-14", true)).toBe("lower");
  });

  it("adds days without local timezone drift", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
