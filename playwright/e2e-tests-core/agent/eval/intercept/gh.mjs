/**
 * Fixture-backed GitHub CLI intercept for healer eval.
 *
 * EVAL_CASE_DIR=/path/to/cases/<id> node agent/eval/intercept/gh.mjs <gh args...>
 *
 * Subcommands are parsed positionally (not by substring), so `gh pr diff 3405`
 * and `gh pr list --search "list"` cannot be confused for one another.
 *
 * Fixtures, all under cases/<id>/fixtures/gh/:
 *   pr-list.json          array of PRs, including unrelated noise. `gh pr list`
 *                         filters it by --state/--search/--base the way GitHub
 *                         would, so a query that cannot return rows (path:)
 *                         returns none here either.
 *   pr-view-<n>.json      full view for one PR; falls back to the pr-list entry
 *   pr-diff-<n>.diff      raw diff for one PR
 *   artifacts.json        gh api .../artifacts response
 *   releases.json         gh release list response
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const caseFixtures = () => path.join(process.env.EVAL_CASE_DIR || "", "fixtures");

const readJson = (name, fallback) => {
  const filePath = path.join(caseFixtures(), name);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const readText = (name) => {
  const filePath = path.join(caseFixtures(), name);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
};

const copyIfPresent = (fromName, destDir, destName) => {
  const source = path.join(caseFixtures(), fromName);
  if (!fs.existsSync(source) || !destDir) return;
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(source, path.join(destDir, destName));
};

/** First non-flag token after `gh pr <sub>` that looks like a PR number or URL. */
export const prNumberFrom = (argv) => {
  for (const token of argv) {
    if (token.startsWith("-")) continue;
    const fromUrl = token.match(/\/pull\/(\d+)/);
    if (fromUrl) return fromUrl[1];
    if (/^\d+$/.test(token)) return token;
  }
  return "";
};

const prList = () => {
  const list = readJson("gh/pr-list.json", []);
  return Array.isArray(list) ? list : [];
};

/** Value of --flag x / --flag=x, honouring single and double quotes. */
export const flagValue = (argv, flag) => {
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === flag) return stripQuotes(argv[i + 1] || "");
    if (token.startsWith(`${flag}=`)) return stripQuotes(token.slice(flag.length + 1));
  }
  return "";
};

const stripQuotes = (value) => {
  const text = String(value || "").trim();
  const quoted = (text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"));
  return quoted ? text.slice(1, -1) : text;
};

const isMerged = (pr) => Boolean(pr.mergedAt) || String(pr.state || "").toUpperCase() === "MERGED";
const isOpen = (pr) => String(pr.state || "").toUpperCase() === "OPEN";

export const matchesState = (pr, state) => {
  switch (String(state || "open").toLowerCase()) {
    case "all":
      return true;
    case "merged":
      return isMerged(pr);
    // gh mirrors the API here: --state closed includes merged PRs.
    case "closed":
      return !isOpen(pr);
    default:
      return isOpen(pr);
  }
};

/**
 * GitHub issue/PR search, faithfully enough to be worth scoring against.
 *
 * `path:` is a CODE-search qualifier. Issue/PR search does not implement it and
 * returns nothing rather than erroring, so a healer searching `path:<file>`
 * always concludes "no prior PRs" no matter what exists. Reproducing that is the
 * point: a fixture that helpfully answered the broken query would hide the bug.
 */
export const searchMatches = (pr, query) => {
  const terms = String(query || "").trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${pr.title || ""}\n${pr.body || ""}`.toLowerCase();
  for (const term of terms) {
    if (/^path:/i.test(term)) return false;
    // Scope and date qualifiers narrow a real search; the state/base flags
    // already cover them here, so they neither match nor exclude on their own.
    if (/^(in|is|state|base|head|author|label|repo|type|sort|created|merged|closed|updated):/i.test(term)) {
      continue;
    }
    if (!haystack.includes(term.toLowerCase())) return false;
  }
  return true;
};

export const filterPrList = (list, argv) => {
  const state = flagValue(argv, "--state") || "open";
  const query = flagValue(argv, "--search");
  const base = flagValue(argv, "--base");
  const limit = Number.parseInt(flagValue(argv, "--limit") || "30", 10);
  const filtered = list.filter(
    (pr) =>
      matchesState(pr, state) &&
      searchMatches(pr, query) &&
      (!base || !pr.baseRefName || pr.baseRefName === base),
  );
  return Number.isFinite(limit) && limit > 0 ? filtered.slice(0, limit) : filtered;
};

const prView = (number) => {
  const specific = readJson(`gh/pr-view-${number}.json`, null);
  if (specific) return specific;
  const listed = prList().find((item) => String(item.number) === String(number));
  if (listed) return listed;
  return { error: `no pull request found for ${number || "(missing argument)"}` };
};

/** gh api routes the healer is allowed to use. */
const handleApi = (argv) => {
  const route = argv.find((token) => !token.startsWith("-") && token.includes("/")) || "";
  const pull = route.match(/\/pulls\/(\d+)/);
  if (pull) return JSON.stringify(prView(pull[1]));
  if (/\/artifacts/.test(route)) {
    return JSON.stringify(readJson("gh/artifacts.json", { artifacts: [] }));
  }
  if (/\/pulls\b/.test(route)) return JSON.stringify(prList());
  if (/\/releases\b/.test(route)) return JSON.stringify(readJson("gh/releases.json", []));
  throw new Error(`unhandled gh api route in eval intercept: ${route || argv.join(" ")}`);
};

export const handleGh = (argv) => {
  const positional = argv.filter((token) => !token.startsWith("-"));
  const [command, sub, ...rest] = positional;

  if (command === "api") return handleApi(argv.slice(1));

  if (command === "run" && sub === "download") {
    const destFlag = argv.findIndex((token) => token === "-D" || token === "--dir");
    const dest = destFlag >= 0 ? argv[destFlag + 1] : process.cwd();
    copyIfPresent("screenshot.png", dest, "test-failed-1.png");
    copyIfPresent("error-context.md", dest, "error-context.md");
    return "downloaded intercepted artifacts\n";
  }

  if (command === "pr") {
    if (sub === "list") return JSON.stringify(filterPrList(prList(), argv));
    if (sub === "view") return JSON.stringify(prView(prNumberFrom(rest)));
    if (sub === "diff") {
      const number = prNumberFrom(rest);
      const diff = readText(`gh/pr-diff-${number}.diff`);
      return diff || `no diff fixture for PR ${number || "(missing argument)"}\n`;
    }
  }

  if (command === "release") return JSON.stringify(readJson("gh/releases.json", []));

  throw new Error(`unhandled gh command in eval intercept: ${argv.join(" ")}`);
};

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  if (!process.env.EVAL_CASE_DIR) {
    console.error("EVAL_CASE_DIR is required");
    process.exit(2);
  }
  try {
    process.stdout.write(handleGh(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
