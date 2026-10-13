# client feature: moderation

Administrator console pages, all behind `ProtectedRoute roles={['admin']}` and linked from the header
(Lecturer applications, Reports, Users). Lecturer Super Like is in `features/verification`.

- `AdminLecturers.tsx` (`/admin/lecturers`): lecturer applications, approve or reject with a reason (UC22, wireframe 25).
- `AdminReports.tsx` (`/admin/reports`): open reports grouped by note, oldest first, with count, reasons and age;
  "Review" opens a panel with a slide preview, an "Open note" link, each report, a required remark, Dismiss and
  Hide note. After hiding, a link opens the author in the Users page for an account action (UC20 4b, wireframe 23).
- `AdminUsers.tsx` (`/admin/users?q=`): search by name or email; table with role, status and upheld report count;
  Restrict, Suspend, Reinstate and Delete (only those that change the status; none for admins or deleted accounts)
  open an inline reason field with Confirm / Cancel, no `window.confirm` (UC21, wireframe 24).

Test table: `ADM-TC*` in `docs/chapter4/4.5_test_cases.md` (server tests). Decisions: D18, D26, D27.
