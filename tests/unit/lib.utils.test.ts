import { describe, expect, test } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  test("merges multiple class strings", () => {
    expect(cn("text-red-500", "bg-blue-200")).toBe("text-red-500 bg-blue-200");
  });

  test("handles conditional (falsy) values gracefully", () => {
    expect(cn("base", false && "hidden", null, undefined, "extra")).toBe(
      "base extra",
    );
  });

  test("deduplicates conflicting Tailwind classes", () => {
    // tailwind-merge picks the last conflicting utility
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  test("handles empty input", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
  });

  test("merges array inputs via clsx", () => {
    expect(cn(["text-red-500", "bg-blue-200"])).toBe(
      "text-red-500 bg-blue-200",
    );
  });
});
