import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

// Example of the project test style (Arrange-Act-Assert). The real suites
// for chunk, rrf and validate arrive with T-019.
describe("cn", () => {
  it("lets the later Tailwind utility win when two conflict", () => {
    const base = "px-2 text-sm";
    const override = "px-4";

    const result = cn(base, override);

    expect(result).toBe("text-sm px-4");
  });

  it("drops falsy values", () => {
    const isActive = false;

    const result = cn("rounded-md", isActive && "ring-2");

    expect(result).toBe("rounded-md");
  });
});
