# B3: time saved with the AI assistant (UAT-S2)

Method only (#122). The owner records the real timings during UAT (#86). The table below ships empty and no number in
it is invented. Related: spec R28 (#110), UAT plan in `docs/chapter4/4.5_test_cases.md` section 4.5.2 (#84).

## Question
Does the R28 assistant at least halve the time a student needs to turn a block of study text into a published
three-slide note?

## Who and what
- Every student participant (matching persona 1, Section 1.6.3) runs UAT-S2 twice, on the same machine and network:
  once by hand (manual run) and once with the assistant (assisted run).
- Lecturer and administrator participants do not take part in B3.
- Account: a UAT student account from `docs/testing/uat/README.md`. Each run starts from `/notes/new` with an empty
  editor and ends when the note is published publicly with the module and two hashtags set.
- The assisted run uses the live AI provider (the E2E tests use a stub; do not time those).

## Input text
Both runs use a different passage of similar length so the second run does not benefit from the first. The moderator
prepares two passages of 120 to 150 words from the seeded UAT101-3-2 topics, `text A` and `text B`, and keeps them in
the session folder. Which text goes with which run alternates with the order below, so each text is used equally often
manually and assisted.

## Counterbalanced order
Assign participants in arrival order P1, P2, P3, ...:

| Participant | First run | Second run | Text for first run |
|---|---|---|---|
| odd (P1, P3, ...) | Manual | Assisted | A |
| even (P2, P4, ...) | Assisted | Manual | A |

With an odd number of students the extra participant takes the next slot in this pattern. Report the split.

## Task script (both runs)
1. Start at `/notes/new`, logged in as the participant's account.
2. Make a three-slide note from the passage: a heading and the key points on each slide.
   - Manual run: type or paste the content into slides by hand.
   - Assisted run: paste the passage into "Draft slides from text", send it, then fix whatever the assistant got wrong.
   The assisted run is finished only when the three slides are as good as the participant would publish; correcting
   them is part of the time.
3. Save the draft.
4. Publish publicly with the module UAT101-3-2 and two hashtags.
5. The moderator stops the clock at the note page for the published note.

## Timing
- The moderator uses one stopwatch per run: start when the participant is told "go" (editor open and empty), stop at the
  note page after publishing. Record seconds.
- Time spent reading the passage is excluded: the participant reads it first and says when ready.
- A run the participant abandons or that fails (provider error) is recorded with the reason and excluded from the
  median. Repeat it once; report both attempts.

## Pass rule
Per participant: ratio = assisted time / manual time. B3 passes when the median of the participants' ratios is at most
0.5. Report the count of participants, the median, and the range. With fewer than three students the result is
descriptive only and is stated as such.

## Timing table (fill during UAT, #86)
| Participant | Order (manual first / assisted first) | Manual time (s) | Assisted time (s) | Ratio (assisted / manual) |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| **Median ratio** | | | | |
