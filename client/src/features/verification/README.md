# client feature: verification

Lecturer Super Like (verify) of a note and its withdrawal (UC19).

- `SuperLikeDialog.tsx`: confirmation with an optional review remark (max 300), wireframe 17; built on the shared `Dialog`.
- The button lives in the shared `components/NoteActions.tsx` (feed card and note detail). It shows only for an approved
  lecturer on someone else's note: "Super Like" opens the dialog, and for the lecturer who verified it becomes
  "Remove Super Like" (no dialog: it is reversible). `onChange` hands the new `verified`/`verifiedBy`/`verifiedByMe` to
  the card or detail page, which redraws the double indigo frame and "Verified by <name>". Saved and profile lists show
  "Verified by <name>" in the summary line.

Serves: FR1, FR2 (and FR3 through the V component of ranking). Test table: `VER-TC*` in
`docs/chapter4/4.5_test_cases.md` (server tests). Decisions: D26, D27.
