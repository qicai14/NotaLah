# NotaLah design system

The reference for every screen in `client/`. Built for R19 (D52): TikTok web on desktop (left rail, one centred
full-height card, action rail to its right) and TikTok mobile below 768 px (full-screen snap feed, bottom tab bar).
Light is the default; dark follows the system setting or the toggle in **More**.

Rule zero: **no raw colours in components.** Use the token classes below. A new colour means a new token in
`src/index.css` (both the `:root` and `.dark` blocks, plus a line in `@theme inline`), never a hex or a Tailwind
palette class such as `slate-500` or `indigo-600`.

## 1. Where things live

| What | File |
|---|---|
| All tokens (colour, type, radius, spacing, shadow, motion) | `src/index.css` |
| Theme preference (`system` / `light` / `dark`, stored as `notalah-theme`) | `src/lib/theme.ts`, pre-paint script in `index.html` |
| `cn()` (clsx + tailwind-merge that knows the type scale) | `src/lib/utils.ts` |
| shadcn/ui primitives (CLI-added, then tuned) | `src/components/ui/` |
| App shell: rail, tab bar, More menu, nav lists | `src/components/shell/` |
| Shared building blocks | `src/components/` (`Field`, `ConfirmButton`, `UserAvatar`, `VerifiedPill`, `LecturerBadge`, `Logo`, `NoteActions`) |
| Write state (pending + error) | `src/lib/useAction.ts` |
| Breakpoint hook | `src/hooks/useMediaQuery.ts` (`DESKTOP` = `(min-width: 768px)`) |

To swap the palette (for example from Google Stitch), edit only the two variable blocks at the top of `index.css`.

## 2. Colour tokens

Ink blue is the brand (a ballpoint pen); highlighter yellow means lecturer validation and is used for nothing else.

| Class suffix | Light | Dark | Use |
|---|---|---|---|
| `background` / `foreground` | #ffffff / #15171c | #0f1015 / #f2f3f6 | Page and body text |
| `surface` | #f3f4f6 | #1a1c23 | Inputs, chips, rail buttons, card footers |
| `surface-strong` | #e7e9ee | #262934 | Active nav row, hover on surface, avatar fallback |
| `card` / `card-foreground` | #ffffff | #16181f | Feed and note cards |
| `popover` / `popover-foreground` | #ffffff | #1c1e26 | Dialogs, sheets, menus, popovers |
| `muted-foreground` | #5a606e | #a3a8b6 | Secondary text (6.3:1 on white) |
| `border`, `input` | #e2e4e9, #d5d8df | #2a2d37, #3a3e4b | Hairlines; outlined control borders |
| `primary` / `primary-foreground` | #2b37e3 / #ffffff | #8a93ff / #0b0e2e | Main action, focus ring, links, active tab icon |
| `secondary`, `accent` | #f3f4f6, #eceef2 | #1f222b, #23262f | Secondary buttons; hover fills |
| `destructive` / `destructive-foreground` | #c8242b / #ffffff | #ff6b6b / #1d0606 | Errors, Delete, Report submit |
| `success` | #0b7a4b | #4ad295 | Confirmations |
| `like` | #e5163f | #ff4d6a | Filled heart only |
| `highlight` / `highlight-foreground` | #ffe14d / #2a2300 | same | "Verified by", Super Like state |
| `overlay` | 55 % ink | 65 % black | Scrim behind dialogs and sheets |
| `rail` | #fafafb | #121319 | Desktop left rail |
| `media` / `media-dim` | #ffffff / 50 % white (both themes) | same | Icons, dots and text drawn straight over a slide: the phone action rail, carousel arrows and dots. `media` is the current dot; `media-dim` the others. Always paired with `media-shadow` (below) |
| `slide` / `slide-foreground` | #ffffff | #1a1c23 | Slide content box (also `--slide-muted`, `--slide-quote`, `--slide-rule`, `--code-block*`) |

Write them as Tailwind classes: `bg-surface`, `text-muted-foreground`, `border-border`, `ring-ring/50`,
`bg-primary/90`. Opacity modifiers are fine; they still follow the token.

Contrast: body text and `muted-foreground` pass AA (4.5:1) on `background`, `surface` and `card` in both themes;
`primary-foreground` on `primary` passes 4.5:1. Never put `muted-foreground` text on `surface-strong` at caption size.

## 3. Type

One family: **Plus Jakarta Sans Variable** (self-hosted via `@fontsource-variable`), system sans as fallback.
Tracking tightens as size grows; these are built into the classes, so do not add `tracking-*` to them.

| Class | Size / line | Use |
|---|---|---|
| `text-display` | clamp(2.75rem, 6vw, 4.75rem) / 1, -0.04em | Welcome headline only |
| `text-headline` | 2rem / 2.25rem, -0.025em | Rare page heroes |
| `text-title` | 1.375rem / 1.75rem, -0.015em | Page titles, dialog titles, note title in detail |
| `text-title-sm` | 1.0625rem / 1.4rem | Card captions, feed tabs, section heads |
| `text-body` | 0.9375rem / 1.45rem | Default body (set on `<body>`) |
| `text-body-sm` | 0.8125rem / 1.25rem | Meta rows, buttons, labels |
| `text-caption` | 0.75rem / 1rem, +0.01em | Counts, chips, hints |

Slides use their own curated fonts (deck data, never UI type): Source Sans 3, Atkinson Hyperlegible, Lora, Merriweather,
Montserrat and JetBrains Mono, self-hosted from `@fontsource` in `index.css` (each woff2 downloads only when a slide uses
it). Ids and names live in `@notalah/shared` (`FONT_IDS`, `FONT_NAMES`); CSS stacks in `components/board/geometry.ts`.

Weights: 400 body, 600 labels and meta names, 700 headings and buttons, 800 display and the wordmark. Sentence case
everywhere; no all-caps labels. Use `tabular-nums` on counts and scores.

## 4. Radius, spacing, elevation

- Radius: `rounded-sm` 0.5rem (chips, menu items), `rounded-md` 0.75rem (inputs, nav rows), `rounded-lg` 1rem
  (menus, slide box), `rounded-xl` 1.25rem (mobile card, popovers), `rounded-2xl` 1.5rem (desktop card, dialogs,
  sheet top). Buttons and rail circles are `rounded-full`.
- Spacing: Tailwind's 0.25rem scale. Layout tokens: `w-rail` 15rem, `w-rail-collapsed` 4.5rem, `h-tabbar` 3.75rem,
  `h-topbar`/`pt-topbar` 3.5rem, `size-action` 3rem (rail buttons). Ordinary pages: `max-w-3xl px-4 py-6 md:px-8 md:py-10`
  (the shell adds this; do not repeat it).
- Halo on media: the `media-shadow` utility (a dark `drop-shadow` from `--media-shadow`) keeps `media` readable on a white slide. It is for icons and dots over slides only; never a column, scrim or gradient behind them.
- Shadows: `shadow-(--shadow-card)` for resting cards, `shadow-(--shadow-float)` for dialogs, sheets and popovers.
  No other shadows.

## 5. Motion

- Tokens: `duration-(--duration-fast)` 120 ms (press, hover), `--duration-base` 200 ms, `--duration-slow` 320 ms
  (theme change, meters); easing `ease-(--ease-out-soft)`, critically damped, no bounce.
- Press feedback on pointer-down: buttons scale to 0.97 (`active:scale-[0.97]` is in the Button base), rail circles
  to 0.9. The heart uses `animate-pop` once when liked.
- Dialogs and sheets use shadcn's `tw-animate-css` enter and exit; a sheet leaves the way it came.
- `prefers-reduced-motion: reduce` collapses all durations globally (`index.css`), and the feed's up/down buttons
  scroll without smoothing. `prefers-reduced-transparency` drops the blur on translucent bars.

## 6. Components

| Need | Use | Notes |
|---|---|---|
| Button | `Button` (`@/components/ui/button`) | Variants: `default` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`. Sizes: `xs`, `sm`, `default` (40 px), `lg` (48 px, full-width form actions), `icon*`. Use `asChild` with `Link` for navigation. |
| Text input | `Field` | Label, hint, error with `aria-describedby`; `type="password"` gets Show/Hide. Reuse `inputClass` for a raw `<select>` or `<input>` (there is no shadcn Input/Label; use `Field`). |
| Programme picker | `ProgrammeSelect` | Already styled. |
| Modal | shadcn `Dialog` (`@/components/ui/dialog`), mounted with `open` and `onOpenChange={(o) => !o && onClose()}` | Always give a `DialogTitle` and `DialogDescription` (sr-only is fine). When the opener disappears (a menu item), pass a ref and focus it in `onCloseAutoFocus`, as `ReportDialog` does with `returnFocus`. |
| Bottom or side sheet | shadcn `Sheet` | `side="bottom"` on phones with `rounded-t-2xl border-t-0`, `side="right"` on desktop (`w-[26rem]`). Pick with `useMediaQuery(DESKTOP)`. |
| Menu | shadcn `DropdownMenu` | Items `h-10 rounded-sm`, icon `size-4` first. Disabled items for features not yet built. |
| Popover | shadcn `Popover` (+ `PopoverClose`) | `rounded-xl p-5 shadow-(--shadow-float)`. |
| Tooltip | shadcn `Tooltip` | Only for icon-only controls (the collapsed rail). `TooltipProvider` is in `AppShell`. |
| Avatar | `UserAvatar name src` | Initials fallback; decorative, so always show the name next to it. |
| Lecturer mark | `LecturerBadge` after a name | Blue check with sr-only text. |
| Verified note | `VerifiedPill by` | The highlighter stroke; only for lecturer validation. |
| Delete with confirm | `ConfirmButton` | Inline "Are you sure?" instead of `confirm()`. |
| Note actions | `NoteActions` | `layout="rail"` (vertical, feed and note detail desktop) or `"bar"` (phone note detail). Handles guests. Below 768 px a `rail` drops the grey circles: only the avatar keeps its circle, the rest are bare 44 px icons in `media` with `media-shadow` and the count underneath (see Feed card). |
| Comments | `CommentPanel` | Fills its parent's height; `heading={false}` inside a sheet that has its own title. |

## 7. Patterns

- **Shell.** `AppShell` wraps every route except `/welcome`, `/login`, `/register`. Desktop: `LeftRail` (collapses to
  icons below 1280 px or when toggled; choice stored as `notalah-rail`). Phone: `BottomTabs` for signed-in users and a
  `MobileTopBar` (menu, logo, Log in for guests) on ordinary pages. The feed (`/`) and a note (`/notes/:id`) are
  full-bleed and draw their own header; add a path to `isFullBleed` in `AppShell.tsx` only for screens like them.
- **Messaging.** `features/messaging/` (FR6, FR7, FR13, D50). `MessagingProvider` (in `main.tsx`, inside `AuthProvider`) opens one websocket-only Socket.io connection per signed-in session and closes it on logout; guests get none. It holds the inbox (`inboxReducer`) and its events; `useUnread()` feeds the nav badge. `/messages/*` is full-bleed: desktop shows the inbox pane (`md:w-[22rem]`) beside a conversation pane, phones show one pane (the chat covers the tab bar with `max-md:fixed max-md:inset-0`). Routes: `/messages`, `/messages/:id`, `/messages/new`, `/messages/new-group`, `/messages?to=<id>[&note=<id>&noteTitle=...]` (opens the existing direct chat or starts one; a non-friend's first message shows "Request sent"). Bubbles: mine `bg-primary`, theirs `bg-surface`, `rounded-xl` with a squared corner; the per-message actions (Reply, Delete via `ConfirmButton`) open from a "Message actions" button. Unread counts are `bg-primary` pills in the list and `bg-foreground` pills (rail) or `bg-primary` (tab bar) on the nav item.
- **Navigation lists.** Add a screen to `RAIL` (and `TABS` if it belongs in the phone bar) in `components/shell/nav.ts`.
  `RAIL` is Feed, Search, Following, Create, Drafts, Saved, Profile; `TABS` is Home, Search, Create, Drafts, Profile
  (Saved moved to the phone More menu, D55). Messages is in `RAIL` after Following and Inbox replaced Drafts in `TABS`; Drafts stays reachable from your profile. When Explore and Notifications land, they follow the same placement, and Discover replaces Search in `TABS` (wireframe 13). Badges: a `size-5 rounded-full bg-foreground text-background text-caption`
  count at the row's right edge.
- **Feed card.** Full height, `snap-start`, card `aspect-[9/16]` on desktop, rail to its right aligned to the bottom. On phones the rail floats over the card instead of taking a column: `NoteCard` mounts `NoteActions` inside the slide area (`absolute right-0.5 bottom-2`, above the footer) and the card and slide padding shrink to `px-2`, so the note gets the width. The rail never covers the dots, which sit centred at the slide's foot. Exactly one `NoteActions` is mounted (`useMediaQuery(DESKTOP)` picks the spot).
  Top row: `VerifiedPill` left, "Why this note?" right. Bottom: author, time, title, module chip, hashtags on `bg-surface`.
- **Page header.** Ordinary pages start with `<h1 className="text-title font-bold">` and, if needed, actions on the
  right (`Button size="sm"`). Back navigation: ghost icon button with `ArrowLeft` and `aria-label="Back"`.
- **Lists and grids** (Saved, Drafts, profile notes): tiles on `bg-card border rounded-xl`, title `text-title-sm
  font-semibold`, meta `text-body-sm text-muted-foreground`, module chip `rounded-sm bg-surface-strong px-2 text-caption`.
- **Profile.** `features/users/Profile.tsx`: avatar, name with `LecturerBadge`, role and programme, `Stat` row (Following, Followers, Likes; the first two open `PeopleDialog` for signed-in users), then Follow (`default`; `secondary` when following; reads Friends when mutual), Message (`outline` link to `/messages?to=id`; guests get the guest sheet) and a More menu holding Block (`BlockDialog`). Notes are a 2 or 3 column grid of tiles with the first slide in a `SlideBoard`. On your own profile a `tablist` (Notes, Saved; arrow keys move between them) sits above the grid; Saved renders `features/feed/SavedNotes` (the same list as `/saved`, paged with `usePaged`). Saved also stays in the More menu. A blocked profile shows only name and Unblock; a blocked-from-the-other-side or missing one shows "This profile is not available". Guests may read it; Follow and Message open the guest sheet.
- **Empty state.** Centred, `text-title font-bold` line, one `text-body text-muted-foreground` sentence saying what
  to do, and at most one primary button.
- **Loading.** `role="status"` text in `text-body-sm text-muted-foreground`, or a `bg-surface animate-pulse` block the
  shape of the content.
- **Errors.** Inline `role="alert"` in `text-body-sm font-medium text-destructive`; boxed form: `rounded-md
  bg-destructive/10 px-3 py-2`. Say what happened and how to fix it.
- **Writes.** Wrap each write in `useAction`: `const { run, pending, error } = useAction();` then
  `await run(() => api(...))`. It ignores double clicks, clears the last error and returns `undefined` on failure.
  Pass a second argument to map errors or return `null` after setting field errors.
- **Guests (R31).** Anything that needs an account calls `useGuestPrompt()({ action, returnTo })`, which opens the Log
  in / Register sheet; login returns to `returnTo`. Guests can read the Feed (after "Browse as guest") and any public
  note with its comments.
- **Forms.** Labels above inputs, `gap-4` between fields, the submit as `Button size="lg"` full width, the switch link
  ("Already have an account? Log in") centred below in `text-body-sm`.
- **Slides.** `SlideCarousel` (`components/board/`) shows a note's slides with arrow keys, swipe and, over the foot of the slide, a
  TikTok-style row: a bare `<` chevron, dots, a bare `>` chevron (44 px targets, `media` with `media-shadow`; a chevron fades out at the first or last slide). Dots are decorative: the current one is `media` (white) and slightly larger, the others `media-dim`. With more than 7 slides `dotWindow` shows a sliding window of 7 whose outer dots are smaller when more slides lie beyond them. The slide count is announced by an `aria-live` "Slide 3 of 8" (sr-only); one slide shows no controls. It
  fills its parent, so give the parent a height (`h-[min(36rem,64dvh)]`, or `min-h-0 flex-1` in a flex column). Each slide is a
  `SlideBoard`, a fixed 1000 x H board scaled to fit; slide colours come from the deck, not the theme.
- **Editor** (`features/editor/`, R21c). Full-window route outside `AppShell`. Desktop: top bar (Drafts, title, save
  status, undo/redo, slide size, Save draft, Publish/Update), a `w-rail-collapsed` panel rail with a `w-80` panel, the
  contextual `ElementBar` (h-12) above the canvas on `bg-editor-canvas`, and the slide strip below. Phone: the same top
  bar, the element bar, canvas, a compact strip, and a 4-button tool tray whose panels open as bottom sheets. State lives
  in the zustand store (`store.ts`); every change goes through `apply` (one undo step) or `preview` + `commitFrom` (a drag
  or a text edit as one step). Selection frame and handles use `--primary`; snap guides use `--editor-guide`. Handles are
  10 px (22 px target) on desktop and 14 px (44 px target) on phones; phones get corner handles only and centre snap.
  Background and shape swatches are deck colours, so they are the one place raw hex values appear in components.
  **Design panel** (R21d, D69), first in the panel rail and the phone tray: theme cards (`aspect-[4/3]` swatch in the theme's
  background with "Aa" in its heading font, the body font's name and an accent dot; `aria-pressed` on the current theme;
  2 columns, 3 in the phone sheet), then layout tiles that render a real `SlideBoard` of each layout in the current theme
  and aspect. Themes, layouts and `applyTheme` are in `shared/src/design.ts`; a theme writes concrete fonts and colours
  into every element, so restyling later never changes a published note. The font select (`FontSelect` in
  `ElementBar.tsx`) lists only the curated fonts, each drawn in its own face.

## 8. Accessibility checklist

- Every icon-only control has `aria-label`; icons inside labelled controls get `aria-hidden="true"`.
- Toggle buttons use `aria-pressed`; the active nav item uses `aria-current="page"`.
- Focus: the global `:focus-visible` outline (2 px `ring`) stays; never remove outlines. Components may add
  `focus-visible:ring-[3px] focus-visible:ring-ring/25`.
- Targets at least 40 px (buttons) and 48 px (rail actions, tab bar).
- A skip link ("Skip to content") jumps to `#main`; each page has one `h1` (sr-only is fine for the feed).
- Check each new screen at 1440 px and 375 px, light and dark.
