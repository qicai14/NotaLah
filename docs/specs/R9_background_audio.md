# R9 Background audio (FR17, Jamendo)

Agreed with the user, 20 Oct 2026.

Music plays in the note view and the feed, only when the reader taps; it never autoplays. Search shows instrumental
tracks by default. **A deck that has a video cannot have music.**

## Schema
- Migration: swap the `pst_music_provider` CHECK from `'deezer'` to `'jamendo'` (no rows use it).
- Add column `pst_music_license VARCHAR(200)`.
- `musicSchema.provider` becomes `'jamendo'` in `shared/src/deck.ts`.
- `deckSchema` refine rejects `music` when any slide has a `video` element, with message "Remove videos to add music".

## Save path
On save the server looks the track up via the Jamendo API and stores title, artist, cover and licence URL. This removes
the `shortcut:` in `server/src/features/notes/repository.ts` (around line 313) and the NULL resets there. An unknown
track returns 400. Client `features/editor/save.ts` sends `provider: 'jamendo'`.

## Server, `server/src/features/music/`
- `GET /api/music/search?q=&instrumental=1&page=` proxies Jamendo `/v3.0/tracks` with `client_id` from env,
  `vocalinstrumental=instrumental` when the toggle is on, and 20 results.
- It returns id, name, artist, cover, duration and licence. The stream URL is derived server-side from the track id,
  never taken from the user.
- Uses the existing rate-limiter factory (R38, D68) and an R34 usage counter (D57, `"USAGE_COUNTER_T"`) capped at 80% of
  Jamendo's free non-commercial allowance. The allowance is verified from Jamendo's current API docs/terms; if unclear, a
  conservative cap is chosen and stated.
- When the cap is hit: 503 "Music search is paused". Timeouts and Jamendo errors map to 502 with a friendly message.
- Router registered with the others.

## CSP
Allow Jamendo's audio and image hosts for `media-src`/`img-src` wherever the CSP lives.

## Editor
- A Music panel beside Uploads/Photos in `client/src/features/editor/Panels.tsx`, following the Design panel pattern.
- Contents: search box, "Instrumental only" toggle (on by default), result list with play/pause preview, pick, volume
  slider, remove.
- The panel is disabled with the reason shown when the deck has a video. Inserting a video while music is set asks to
  remove the music first (`ConfirmButton` or the existing dialog).
- Credit line: title, artist and a CC licence link.

## Out of scope for now
The viewer music chip in the feed card and note view. The R29 feed video player is being built in
`SlideCarousel`/`NoteCard`; the chip is added after that merges. `SlideCarousel`, `NoteCard` and `Feed.tsx` are not edited.

## Done means
- Server tests MUS-TC1...: schema (provider; video plus music rejected); search proxy with mocked fetch (params, mapping,
  cap, rate limit, upstream error); save fills metadata, unknown track returns 400.
- Client test for the Music panel: search, pick, disabled with a video.
- Rows in `docs/chapter4/4.5_test_cases.md`; Chapter 4.3 data dictionary and `10_erd.puml` updated.
- `vp run check`, server and client tests, `vp run -r build` pass; browser check of the panel at 1440 and 375 px, light
  and dark.
- D-entry D73 in `docs/DECISIONS.md`.
