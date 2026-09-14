import assert from "node:assert/strict";
import test from "node:test";
import {
  healerJobUrl,
  healerWorkflowRunUrl,
  mergeEvalLinksIntoBody,
  renderEvalLinksSection,
  stripTrailingGithubNote,
  testdinoCaseUrl,
  testdinoEvalLinks,
} from "../scripts/prepare-pr-body.mjs";

test("builds healer workflow run URL from GitHub Actions env", () => {
  assert.equal(
    healerWorkflowRunUrl({
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "deriv-com/home-app",
      GITHUB_RUN_ID: "33440399889",
    }),
    "https://github.com/deriv-com/home-app/actions/runs/33440399889",
  );
  assert.equal(healerWorkflowRunUrl({}), null);
});

test("builds healer job URL from check run id or a full job URL", () => {
  assert.equal(
    healerJobUrl({
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "deriv-com/home-app",
      GITHUB_RUN_ID: "33440399889",
      HEALER_CHECK_RUN_ID: "51725241954",
    }),
    "https://github.com/deriv-com/home-app/actions/runs/33440399889/job/51725241954",
  );
  assert.equal(
    healerJobUrl({
      HEALER_JOB_URL: "https://github.com/deriv-com/home-app/actions/runs/1/job/22",
    }),
    "https://github.com/deriv-com/home-app/actions/runs/1/job/22",
  );
  assert.equal(
    healerJobUrl({
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "deriv-com/home-app",
      GITHUB_RUN_ID: "1",
      HEALER_JOB_URL: "https://github.com/deriv-com/home-app/actions/runs/1/job/",
    }),
    null,
  );
});

test("stamps the collection testCase.url", () => {
  assert.equal(
    testdinoCaseUrl({
      testCase: { url: "https://app.testdino.com/org_x/projects/p/test-runs/r1/case-a" },
    }),
    "https://app.testdino.com/org_x/projects/p/test-runs/r1/case-a",
  );
  assert.equal(
    testdinoCaseUrl({
      run: { url: "https://app.testdino.com/org_x/projects/p/test-runs/r1" },
      testCase: { id: "944b5de8-12d0" },
    }),
    null,
  );
  assert.equal(
    testdinoCaseUrl({
      testCase: { url: "https://example.com/not-testdino" },
    }),
    null,
  );
});

test("dedupes TestDino links from a group file", () => {
  const links = testdinoEvalLinks({
    candidates: [
      {
        testCase: {
          title: "VERIFY picker",
          url: "https://app.testdino.com/org/projects/p/test-runs/r/c1",
        },
      },
      {
        testCase: {
          title: "VERIFY picker again",
          url: "https://app.testdino.com/org/projects/p/test-runs/r/c1",
        },
      },
    ],
  });
  assert.equal(links.length, 1);
  assert.equal(links[0].title, "VERIFY picker");
});

test("appends links at the bottom of the body", () => {
  const section = renderEvalLinksSection({
    healerJobUrl: "https://github.com/deriv-com/home-app/actions/runs/1/job/22",
    testdinoLinks: [{ title: "VERIFY x", url: "https://app.testdino.com/org/projects/p/test-runs/r/c1" }],
  });
  assert.match(section, /## Links/);
  assert.match(section, /Healer job \(this group\)/);
  assert.doesNotMatch(section, /Healer workflow run/);
  assert.match(section, /\[VERIFY x\]\(https:\/\/app\.testdino\.com/);
  const once = mergeEvalLinksIntoBody("## What is failing\n\nfoo", section);
  assert.ok(once.startsWith("## What is failing"));
  assert.match(once, /## Links/);
  assert.ok(once.indexOf("## What is failing") < once.indexOf("## Links"));
  const alreadyLinked = mergeEvalLinksIntoBody("## Links\n\n- stale\n\n## What is failing\n\nfoo", section);
  assert.doesNotMatch(alreadyLinked, /stale/);
  assert.ok(alreadyLinked.startsWith("## What is failing"));
  assert.match(alreadyLinked, /\[VERIFY x\]\(https:\/\/app\.testdino\.com/);
  assert.ok(alreadyLinked.indexOf("## What is failing") < alreadyLinked.indexOf("## Links"));
});

test("strips a trailing GitHub NOTE so it is not left on the PR", () => {
  const stripped = stripTrailingGithubNote("## Changes\n\nok\n\n> [!NOTE]\n> Review the diff before merging.\n");
  assert.equal(stripped, "## Changes\n\nok");
  assert.equal(stripTrailingGithubNote("## Changes\n\nok"), "## Changes\n\nok");
});

test("falls back to Heal job name when job URL is missing", () => {
  const section = renderEvalLinksSection({
    healerJobName: "Heal: TimeoutError: locator.click",
    testdinoLinks: [],
  });
  assert.match(section, /Healer job \(this group\): Heal: TimeoutError: locator\.click/);
  assert.doesNotMatch(section, /Healer workflow run/);
  assert.doesNotMatch(section, /TestDino:/);
});
