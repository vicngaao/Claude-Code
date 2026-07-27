---
name: os-audit
description: Use when someone asks to run an OS audit, check their AIOS for stale or outdated data, verify routing points at things that actually exist, find duplicate or bloated folders, clean up or organize their project, check for context failure modes (poisoning, bloat, confusion, clash), or says "os audit", "is my setup stale", "run a data audit", "my project root is a mess", or "my agent keeps missing things that are there". Read-only drift, freshness, and organization audit of the current project.
argument-hint: [optional: a subfolder to scope the audit to]
---

# OS Audit — is your AIOS still true?

Your operating manual, indexes, and wikis are claims about what exists and what's current. This audit checks every claim against reality. Structure problems are loud; freshness problems are silent. When people say "my agent keeps forgetting things," it's usually the agent faithfully reading a frozen index.

**Read-only.** Never fix, move, rename, or delete anything during the audit. The only write is the report file at the end. Fixes happen after the user approves them.

**Works on any Claude Code project.** Look for patterns and intent, not exact paths. The operating manual might be CLAUDE.md, AGENTS.md, or a README with a routing table. An index might be `_index.md`, `INDEX.md`, or a catalog section in a README. There might be one knowledge folder or ten. Detect by role, not by name. Never assume a specific person's folder layout.

## Today's context

- Date: use today's real date; all freshness math depends on it
- Scope: the current project root, or the subfolder passed as `$ARGUMENTS`

## The lens: four failure modes, two context types

Every finding this audit produces is a risk of one of the four ways context breaks (field vocabulary via LangChain/Drew Breunig; "bloat" names the cause):

- **Poisoning** — false information sits where the agent reads it, and the model treats everything in context as true. A stale number stated as current, an index claiming "recently active" about a month-old list, an unlabeled snapshot of data that lives live elsewhere.
- **Bloat** — too much piles in and the model loses the thread. Oversized always-loaded files, scratch inside the knowledge tree, one mega-store where segmented stores should be.
- **Confusion** — something the agent needs is missing, or something off-topic is present. Unmapped folders, data pulled but never ingested, off-domain notes in the knowledge layer.
- **Clash** — two pieces of context contradict, usually old versus new. Duplicate folders, the same fact living in two stores at two ages, rules added piecewise with no declared winner.

Anchor: poisoning is false, bloat is too much, confusion is wrong-or-missing, clash is contradictory. **Tag every finding in the report with the failure mode it feeds.** A finding that feeds none of the four is probably cosmetic; say so and rank it last.

The second lens is *when context loads*:

- **Expertise context** — stable knowledge needed on every call: the operating manual, standing rules, memory index, hot cache. Preloaded, so every word is paid for every session.
- **Situational context** — live, specific, only matters in the moment: project files, wiki pages, feeds. Fetched just in time through routing.

The audit checks that facts sit on the correct side (Check 6). A live number baked into a preloaded file WILL go stale (poisoning) while taxing every session (bloat). A standing rule buried in one project folder is invisible when it's needed (confusion).

## Step 0 — Prior report and recent evidence

1. Look for earlier reports in `audits/os-audit-*.md`. If one exists, read the most recent. The final report must include a "Since last audit" section: what got fixed, what got worse, what's new.
2. If any audit of this project ran within the last week (this skill, or another audit with saved findings), reuse its still-valid evidence and re-verify only what could have changed. Don't re-sweep the whole project to rediscover week-old findings.

## Execution

For a large project (100+ folders), fan out one Explore subagent per check below, giving each the check's instructions verbatim plus the project root, then merge their reports. For a small project, run the checks yourself in order.

**If there is no operating manual and no indexes at all:** that is itself the number-one finding. Report Routing and Index checks as RED with "no routing layer exists: your agent is navigating by guesswork," recommend creating a CLAUDE.md router first, and continue with checks 3-5 (they don't need a manual).

## Check 1 — Routing integrity ("does everything it points to exist?")

1. Read the operating manual (CLAUDE.md, CLAUDE.local.md, AGENTS.md, or equivalent). Extract every path, folder, and file it references, including routing tables. Verify each exists on disk. A routing rule that points at a missing path means the agent confidently walks into a wall.
2. Reverse direction: list top-level directories and compare against the manual. Flag real, active directories the routing map doesn't mention. Unmapped = invisible to a fresh session.
3. Misroutes count too: a rule that points at a place that exists but is NOT where the current data actually lives is worse than a dead path, because nothing errors.
4. Spot-check hardcoded paths inside `.claude/skills/*/SKILL.md` and `.claude/agents/*.md`. Skills fail silently on dead paths.
5. If a persistent memory system exists (a MEMORY.md index or memory folder): verify each index entry resolves to a file, and flag memory files missing from the index.

## Check 2 — Index truth ("do the indexes match the disk?")

1. Find every index file: `_index*.md`, `INDEX.md`, catalog sections in READMEs, hot-cache/summary files. For each, diff its entries against the actual directory contents, both directions: rows with no folder (phantoms) and folders with no row (orphans).
2. Check any counts the index claims ("55 folders", "page_count: 50") against reality.
3. Check any freshness claims ("Recently Active", "updated weekly", `updated:` frontmatter) against real file dates. An index that says "last 14 days" but whose newest entry is a month old is actively lying to the agent.

## Check 3 — Freshness ("are the data feeds current?")

1. Identify every recurring data source: transcript pulls, meeting ingests, API exports, wikis, analytics dumps, anything with dated files or a fetch/refresh script. For each, find the newest dated artifact and compare against the feed's natural cadence (weekly meetings should have last week's file; daily pulls, yesterday's).
2. Classify each feed:
   - **FRESH** — within one cycle.
   - **DRIFTING** — one cycle behind.
   - **FROZEN** — more than one cycle behind, and the OS still implies it's current. Estimate what's missing ("3 weekly syncs and one major event absent").
   - **RETIRED?** — more than ~2 months dead. Don't assume it's broken; ask the user whether they stopped on purpose. If retired, the fix is updating the OS so it stops implying the feed is current, not reviving it.
   - **ON-DEMAND** — feeds with no natural cadence (per-video, per-request). Not stale by definition; note the last run and move on.
3. **Check both layers: pulled vs ingested.** Data can be fresh in the raw layer (files pulled to disk) and frozen in the knowledge layer (never summarized/indexed where the agent actually looks). Report each feed's raw date AND its ingested date when the project has that split. The gap between them is un-queryable knowledge.
4. Check hot-cache / summary files (the small files loaded every session): are their key numbers and active threads dated within their claimed refresh cycle?
5. **Memory staleness:** scan memory notes for time-dimensioned facts: counters ("107 left"), snapshots ("425K members"), statuses ("still open", "in progress"), and future-tense events that are now past. Flag the provably stale ones.
6. Report the single date that matters most: "your AIOS's knowledge effectively ends on YYYY-MM-DD," using the ingested layer, not the raw layer.

## Check 4 — Bloat, duplication, and organization ("does anything live twice, or in the wrong place, or for no reason?")

1. Duplicate hunts: same content or purpose in two places (a folder in both active and archive locations; two folders whose names describe the same thing, e.g. `thing-v2` vs `Thing results v2`). Flag each pair with a recommendation for which is canonical.
2. Stale one-offs: folders containing a single old file, finished point-in-time work (past-quarter planning, old event assets), demos untouched for 60+ days. Archive candidates, not delete candidates.
3. Scratch contamination: temp files, API response dumps, `_tmp_*`, `__pycache__`, empty stub files or folders sitting inside the knowledge tree where a blind search will treat them as knowledge.
4. Always-loaded weight: word-count the files loaded every session (operating manual, memory index, hot cache). Flag growth; every extra line here taxes every future session.
5. Rule violations: if the manual states placement rules ("all X goes in one folder per Y"), find violators.
6. **Root hygiene.** The project root should read like a table of contents: folders, the operating manual, a README, and almost nothing else. Every loose file at root is a finding. Classify each by role and recommend a home that ALREADY EXISTS in the project:
   - temp/scratch output (API response dumps, one-session JSON, stray exports) → the archive or tmp folder
   - reusable assets (logos, face cutouts, brand images) → the assets/brand folder
   - media sources (recordings, renders) → their project's folder, or the archive if the project shipped
   - documents → the folder of the subject they belong to

   Only propose creating a new folder when nothing existing fits. Before recommending any move, grep for references to the file (scripts, skills, docs): a file referenced by a live code path must be flagged as move-with-caution, with the referencing paths listed.
7. **Intuitiveness gut check.** Pick 3 recent artifacts the user would plausibly ask for and walk the folder tree to them like a human in a file explorer: can each be found by clicking down obviously-named folders, no search? Flag any folder whose purpose isn't guessable from its name, and any artifact that took a wrong turn to find. If a human can't follow the trail, the agent is navigating on luck.

## Check 5 — Hygiene and silent failures ("what's broken or exposed without anyone noticing?")

1. Secrets and personal data:
   - **If the project is a git repo:** check that `.env` and any OAuth/credential files are gitignored AND untracked (`git check-ignore`, `git ls-files`). Grep tracked files for exported personal data (inbox dumps, private-call transcripts) that shouldn't be in history.
   - **If it is not a git repo:** scan directly for credential-looking files and exported personal data sitting in the knowledge tree, flag them, and note as a finding that the project has no version control (no history, no rollback, and no ignore layer for the day it becomes a repo).
2. Dead capabilities: skill folders whose file isn't exactly `SKILL.md`, missing or empty frontmatter descriptions, agents referencing models or paths that don't exist. These never load and never error.
3. Orphans: agent-memory folders with no matching agent, empty directories, 0-byte files.
4. Cadence reality check: do any hooks or scheduled jobs actually exist, or is every "recurring" process manual? Manual-only cadence is the root cause of most Check-3 freezes; say so explicitly if found.

## Check 6 — Context placement ("is everything on the right side of the expertise/situational line?")

<!-- [RECONSTRUCTED] This check was cut off in the source screenshots. Rebuilt from the lens
     section ("The audit checks that facts sit on the correct side (Check 6). A live number baked
     into a preloaded file WILL go stale (poisoning) while taxing every session (bloat). A standing
     rule buried in one project folder is invisible when it's needed (confusion).") and the video's
     expertise-vs-situational framework. Same intent, wording is a faithful reconstruction. -->

1. **Live facts in preloaded files.** Read every always-loaded file (operating manual, standing rules, memory index, hot cache). Flag any volatile, time-dimensioned fact baked in: revenue numbers, member counts, prices, statuses, "current" project lists. Each one WILL go stale (poisoning) while taxing every session (bloat). Recommend replacing the value with a pointer to where the live source actually lives.
2. **Standing rules buried in situational folders.** Reverse direction: scan project and knowledge folders for rules, policies, or preferences that apply everywhere but live in one project folder. A global rule the agent only sees when it happens to open that folder is invisible when it's needed (confusion). Recommend promoting it to the operating manual or standing-rules layer.
3. **Situational payloads preloaded.** Flag one-off, per-request data (a single customer ticket, one meeting's transcript, a finished deliverable) sitting in the always-loaded layer. It belongs behind a routing rule, fetched just in time.
4. **Same fact on both sides.** If a fact exists both in a preloaded file and in a live source at two different ages, that's a clash. Declare which side is canonical (almost always the live source) and recommend the preloaded copy become a pointer.
5. Report each placement finding with the direction of the fix: demote (expertise → situational, fetch just-in-time) or promote (situational → expertise, always loaded), and tag the failure mode it feeds.

## The report

<!-- [RECONSTRUCTED] The report-format section was not visible in the screenshots. Rebuilt from
     the actual audit output shown in the video (scorecard, "what would wrong-answer you today",
     approval-gated fix list, durability suggestions) and Step 0's "Since last audit" requirement. -->

Write the only output of this audit to `audits/os-audit-YYYY-MM-DD.md` (create the `audits/` folder at the project root if it doesn't exist). Structure:

1. **Header** — date of the run, scope audited, and the single most important line: "your AIOS's knowledge effectively ends on YYYY-MM-DD" (from Check 3.6).
2. **Scorecard** — one row per check (Routing integrity, Index truth, Freshness, Bloat/duplication, Hygiene, Context placement), each rated RED / YELLOW / GREEN with a one-line reason (e.g. "Index says 55 folders, disk has 79").
3. **What would wrong-answer you today** — translate the top findings into concrete questions the user could ask right now and get a confidently wrong answer to. This is what makes the audit feel real.
4. **Findings** — every finding tagged with the failure mode it feeds (poisoning / bloat / confusion / clash), ranked by impact. Cosmetic findings that feed none of the four go last, labeled as such.
5. **Since last audit** — if a prior report existed (Step 0): what got fixed, what got worse, what's new.
6. **Fix list — awaiting approval** — numbered, grouped so the user can approve in batches:
   - *Finish in-flight* — commit half-done cleanup decisions already started
   - *Routing + index truth* — repairs to the manual, routing tables, and indexes
   - *Data catch-up* — ingest what's drifted or frozen
   - *Durability* — crons, hooks, or scheduled jobs so the same drift doesn't recur (weekly transcript pulls, archive sweeps, a quarterly re-run of this audit)

   End by asking which items to execute. **Do nothing until the user approves.**
