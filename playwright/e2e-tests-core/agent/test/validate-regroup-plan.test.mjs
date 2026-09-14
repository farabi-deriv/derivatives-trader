import assert from "node:assert/strict";
import test from "node:test";
import { validateRegroupPlan } from "../scripts/regroup-plan-validation.mjs";

const context = {
  groupIds: ["ui-change-a", "ui-change-b", "ui-change-c"],
};

test("validates a complete regroup plan", () => {
  const result = validateRegroupPlan({
    groups: [
      {
        groupIds: ["ui-change-a", "ui-change-b"],
        reason: "same root cause",
      },
      {
        groupIds: ["ui-change-c"],
        reason: "separate issue",
      },
    ],
  }, context);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("reports missing and duplicate group ids", () => {
  const result = validateRegroupPlan({
    groups: [
      { groupIds: ["ui-change-a", "ui-change-a"] },
    ],
  }, context);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /duplicate group id: ui-change-a/);
  assert.match(result.errors.join("\n"), /Missing group id: ui-change-b/);
  assert.match(result.errors.join("\n"), /Missing group id: ui-change-c/);
});

test("reports missing validation context", () => {
  const result = validateRegroupPlan({
    groups: [
      { groupIds: ["ui-change-a"] },
    ],
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ["Context must be a JSON object."]);
});
