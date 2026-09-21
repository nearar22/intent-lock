import type { SubmitInput } from "@genlayer/transaction-kit-react";

export type ReviewResolution = "DISTINCT" | "DUPLICATE";

type BuildReviewTransactionInput = {
  contractAddress: `0x${string}`;
  intentId: string;
  resolution: ReviewResolution;
  duplicateOf: string;
  leaseSeconds: number;
};

export function buildReviewTransaction({
  contractAddress,
  intentId,
  resolution,
  duplicateOf,
  leaseSeconds,
}: BuildReviewTransactionInput): SubmitInput {
  if (!intentId) throw new Error("Select an intent awaiting review");
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 60 || leaseSeconds > 86400) {
    throw new Error("Lease must be between 60 and 86400 seconds");
  }
  if (resolution === "DUPLICATE" && !duplicateOf) {
    throw new Error("Select the original intent for a duplicate resolution");
  }

  return {
    kind: "write",
    address: contractAddress,
    method: "resolve_review",
    args: [intentId, resolution, resolution === "DUPLICATE" ? duplicateOf : "", leaseSeconds],
  };
}
