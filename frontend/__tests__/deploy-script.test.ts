import { describe, expect, it } from "vitest";
import { isSuccessfulDeploymentReceipt } from "../../deploy/deployScript";

describe("deployment receipt success", () => {
  it("requires both a decided status and a successful execution", () => {
    expect(
      isSuccessfulDeploymentReceipt({
        status: 6,
        statusName: "UNDETERMINED",
      }),
    ).toBe(false);
  });

  it("accepts only finalized transactions with a successful execution result", () => {
    expect(isSuccessfulDeploymentReceipt({ status: 5 })).toBe(false);
    expect(isSuccessfulDeploymentReceipt({ statusName: "FINALIZED" })).toBe(false);
    expect(isSuccessfulDeploymentReceipt({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(false);
    expect(isSuccessfulDeploymentReceipt({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(true);
    expect(isSuccessfulDeploymentReceipt({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" })).toBe(false);
    expect(
      isSuccessfulDeploymentReceipt({ statusName: "LEADER_TIMEOUT" }),
    ).toBe(false);
  });
});
