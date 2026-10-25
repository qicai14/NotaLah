---
name: autopilot
description: Runs NotaLah work unattended until a stop time the user gives - a queue file, independent items in parallel, safe defaults, decisions logged for review, a clean wrap-up at 90% of the 5-hour usage window, the cache kept warm until the window resets, then automatic continuation, and a handover at the end. Use when the user asks to autopilot or to keep working while they are away.
---

# Autopilot

The user is away. Work the queue on safe defaults, never stop abruptly, and leave a trail they can review in minutes.

## Start
1. Run `date` and `get_usage`. Take the stop time and limits from the user's message.
2. Create or reuse `../run-logs/AUTOPILOT_<YYYY-MM-DD>.md` with: stop time, **Queue** (open GitHub issues labelled
   `afk` with an agreed spec, in `docs/HANDOVER.md` order), **Log**, **Decisions made without you**,
   **Needs you** (keys, approvals, screenshots).
3. Schedule the stop: CronCreate one-shot at the stop time with "Autopilot stop: finish the step in hand, then run
   the Stop section of the autopilot skill".

## Rules
- Each item goes through the `ship-feature` skill. Run items in parallel when they share no files (max 3 worktrees,
  one agent per role per item); otherwise in sequence.
- No AskUserQuestion or plan mode. A choice that is the user's: take the safest reversible option, log it under
  "Decisions made without you" with the alternative. Critical or hard-to-reverse calls (scope cuts, schema
  deletes, paid services, secrets, deleting user files, force-push) wait in "Needs you"; skip to the next item.
- Never exceed a free tier, never add payment details, never touch the dev DB or the .docx (writer only), never
  print `.env`.
- Merge only when CI is green and the reviewer has no blockers.
- Append one line to the Log per finished step (time, item, PR, result).

## Usage window (always)
- Check `get_usage` after every merged item and before starting a new one.
- **At 90% of the 5-hour window:** start nothing new. Tell running agents to commit a clean stopping point and push.
  Update the Log and `HANDOVER.md`. Note the reset time from `get_usage`.
- **Keep the cache warm until the reset:** the user's `cache-tax-plus` mod does this (`/keepwarm`, set to `always`):
  after 50 idle minutes it sends one invisible cache-read ping. Do not schedule pings of your own; they would double
  the cost and add visible turns. At start, check `~/.claude/plugins/store/cache-tax-plus_local-mods-*.json`: the
  `deadline:<this session id>` must be later than the stop time and `guard` must be `warn` (in `refuse` mode the
  guard drops the resume prompt once). If either is wrong, put "run `/keepwarm <hours>` / `/cache-tax guard warn`"
  under "Needs you" and tell the user before they leave. The 10% left in the window is what the pings spend.
- **Resume:** CronCreate one-shot a few minutes after the reset with "Autopilot resume: read
  ../run-logs/AUTOPILOT_<date>.md and continue the queue". If the cache still went cold, just continue.

## Stop
At the stop time, or when the queue is empty or every item is blocked: finish the step in hand, run the `handover`
skill, delete every autopilot cron job (CronList, CronDelete), and end with the "Needs you" list.
