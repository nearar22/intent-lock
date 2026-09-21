import { describe, expect, it } from "vitest";
import { buildReviewTransaction } from "../lib/intent-lock/review";

const address = "0x65D35C6e8Ff62235c49e08845D671e13E7feb651" as const;

describe("owner ambiguity recovery", () => {
  it("builds a DISTINCT resolution without a duplicate target", () => {
    expect(buildReviewTransaction({
      contractAddress: address,
      intentId: "travel-ops-2",
      resolution: "DISTINCT",
      duplicateOf: "travel-ops-1",
      leaseSeconds: 900,
    })).toEqual({
      kind: "write",
      address,
      method: "resolve_review",
      args: ["travel-ops-2", "DISTINCT", "", 900],
    });
  });

  it("binds a DUPLICATE resolution to the selected original", () => {
    expect(buildReviewTransaction({
      contractAddress: address,
      intentId: "travel-ops-2",
      resolution: "DUPLICATE",
      duplicateOf: "travel-ops-1",
      leaseSeconds: 900,
    }).args).toEqual(["travel-ops-2", "DUPLICATE", "travel-ops-1", 900]);
  });

  it("refuses a duplicate resolution without a target", () => {
    expect(() => buildReviewTransaction({
      contractAddress: address,
      intentId: "travel-ops-2",
      resolution: "DUPLICATE",
      duplicateOf: "",
      leaseSeconds: 900,
    })).toThrow(/Select the original intent/);
  });
});
