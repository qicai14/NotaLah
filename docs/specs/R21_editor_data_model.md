# R21 / R22 / R29 / R10: slide editor data model (spec for review)

*Status: draft for the user's review, 15 Oct 2026. Nothing is built. Sources: D20-D24, D31-D33, PLAN R9/R10/R21/R22/R29,
wireframes 04-18 (`docs/wireframes-v2`), `server/src/features/notes/*`, the initial schema migration.*

## 1. Element schema

### 1.1 Board units
- The board is **1000 units wide** for every aspect; height = 1000 / ratio (4:5 = 1250, 9:16 = 1777.78, 16:9 = 562.5).
  Coordinates are floats rounded to 0.1.
- `x, y, w, h` give the unrotated box from the board's top-left; `rotation` (degrees, [0, 360)) turns it about its centre.
  Font sizes, strokes and radii are in board units, so one scale factor renders any size.
- **z-order is array order** (index 0 = bottom); no `z` field. The DOM renders in reading order (y, then x) with
  `z-index` from the array index, so screen readers read top to bottom whatever the layering.
- **Changing the aspect** is an undoable editor operation: uniform scale `s = min(1, newH/oldH)`, then centre. The server never rescales.

### 1.2 Types (one shared source, see 5.1)
```ts
type Aspect = '4:5' | '9:16' | '16:9';
type Hex = string;                       // /^#[0-9a-f]{6}([0-9a-f]{2})?$/i
type FontId = 'source-sans-3' | 'atkinson' | 'lora' | 'merriweather' | 'montserrat' | 'jetbrains-mono';
type Fill = { kind: 'color'; color: Hex }
          | { kind: 'gradient'; from: Hex; to: Hex; angle: number }
          | { kind: 'image'; image: ImageSource; overlay?: Hex };          // background only
type ImageSource = { kind: 'upload'; assetId: number }
                 | { kind: 'unsplash'; photoId: string; url: string;      // url must start https://images.unsplash.com/
                     authorName: string; authorUrl: string };
interface Base { id: string; x: number; y: number; w: number; h: number; rotation: number;
                 opacity: number; locked: boolean }                        // id /^[A-Za-z0-9-]{8,36}$/, unique per note
interface TextEl  extends Base { type: 'text'; html: string; font: FontId; size: number; weight: 400|600|700;
                 color: Hex; align: 'left'|'center'|'right'|'justify'; lineHeight: number; letterSpacing: number;
                 fill?: Hex; padding: number; shadow?: Shadow }
interface ShapeEl extends Base { type: 'shape'; shape: 'rect'|'ellipse'|'triangle'|'diamond'|'arrow';
                 fill: Hex | null; stroke: Hex | null; strokeWidth: number; radius: number }
interface LineEl  extends Base { type: 'line'; stroke: Hex; strokeWidth: number;
                 dash: 'solid'|'dashed'|'dotted'; startCap: 'none'|'arrow'; endCap: 'none'|'arrow' }
interface ImageEl extends Base { type: 'image'; source: ImageSource; alt: string;
                 crop: { x: number; y: number; w: number; h: number };      // fractions 0-1
                 flipX: boolean; flipY: boolean; radius: number }
interface CodeEl  extends Base { type: 'code'; code: string; language: CodeLang; theme: 'light'|'dark'; size: number }
interface VideoEl extends Base { type: 'video'; assetId: number; loop: boolean }
type Element = TextEl | ShapeEl | LineEl | ImageEl | CodeEl | VideoEl;
interface Slide { background: Fill; elements: Element[]; notes: string }   // notes = private page notes
interface Deck  { aspect: Aspect; theme: string; slides: Slide[]; music: MusicRef | null }
interface MusicRef { provider: 'deezer'; trackId: number; volume: number } // title/artist/cover come from the server
```

### 1.3 Validation
- zod `discriminatedUnion('type')`, every object `.strict()` (unknown key = 400, so no free-form `style` or URL).
- Colours, fonts, enums and URLs by regex or enum; numbers `finite()`: x, y in [-1000, 2778]; w, h in [1, 4000];
  size [8, 400]; opacity [0, 1]; lineHeight [0.8, 3]; strokeWidth [0, 40].
- `parseDeck(body)`: zod, then unique ids, limits, asset ownership (2.4), text sanitising (2.5). The same schema validates AI output (D33).
- Extend `issueMap` so slide errors read "Slide 3, element 2: Text is too long".

### 1.4 Limits
| Limit | Value | Source |
|---|---|---|
| Slides per note | 30 | D21 |
| Hashtags | 5 | D21 |
| Elements per slide | 60 | new |
| Images per slide | 10 | new |
| Videos per slide | 1 | D32 |
| Text element `html`, after sanitising | 5,000 chars | new |
| Text per slide (text + code) | 20,000 chars | D21, now summed |
| Code element | 5,000 chars | new |
| Page notes per slide | 2,000 chars, plain text | new |
| Serialised slide | 48 KB | new |
| Image alt text | 250 chars | new |

Notes routes get a 2 MB JSON body limit at route level (global stays 1 MB).

## 2. Storage

### 2.1 Migration `..._slide_elements.sql`
```sql
ALTER TABLE "POST_T"
  ADD COLUMN pst_aspect VARCHAR(4) NOT NULL DEFAULT '4:5' CHECK (pst_aspect IN ('4:5', '9:16', '16:9')),
  ADD COLUMN pst_music_provider VARCHAR(10) CHECK (pst_music_provider IN ('deezer')),
  ADD COLUMN pst_music_track_id BIGINT,
  ADD COLUMN pst_music_title VARCHAR(200),
  ADD COLUMN pst_music_artist VARCHAR(200),
  ADD COLUMN pst_music_cover VARCHAR(500),
  ADD COLUMN pst_music_volume SMALLINT CHECK (pst_music_volume BETWEEN 0 AND 100),
  ADD CHECK ((pst_music_provider IS NULL) = (pst_music_track_id IS NULL));
ALTER TABLE "SLIDE_T"
  ADD COLUMN sld_doc   JSONB,
  ADD COLUMN sld_notes VARCHAR(2000) NOT NULL DEFAULT '';
UPDATE "SLIDE_T" s SET sld_doc = jsonb_build_object(
  'background', jsonb_build_object('kind', 'color', 'color', '#ffffff'),
  'elements', jsonb_build_array(jsonb_build_object(
     'id', gen_random_uuid()::TEXT, 'type', 'text', 'x', 60, 'y', 60, 'w', 880, 'h', 1130, 'rotation', 0,
     'opacity', 1, 'locked', FALSE, 'html', s.sld_content, 'font', 'source-sans-3', 'size', 32,
     'weight', 400, 'color', '#111827', 'align', 'left', 'lineHeight', 1.4, 'letterSpacing', 0, 'padding', 0)));
ALTER TABLE "SLIDE_T" ALTER COLUMN sld_doc SET NOT NULL, DROP COLUMN sld_content,
  ADD CHECK (jsonb_typeof(sld_doc -> 'elements') = 'array');
```
- Down migration rebuilds `sld_content` from the text elements' `html`.
- JSONB keeps the search document buildable in SQL (D20) and lets the database check the shape.
- Each old slide becomes one text element; the old allow-list is a subset of the new one, so nothing is lost.
- `pst_template` stays and now means the deck theme (old values become themes of the same name; NOTE-TC25 keeps its meaning).
- `pst_ai_assisted` arrives with R28's own migration.

### 2.2 New tables
```sql
CREATE TABLE "ASSET_T" (
  ast_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ast_usr_id      INTEGER      NOT NULL REFERENCES "USER_T" (usr_id),
  ast_kind        VARCHAR(5)   NOT NULL CHECK (ast_kind IN ('image', 'video')),
  ast_key         VARCHAR(100) NOT NULL UNIQUE,
  ast_poster_key  VARCHAR(100),
  ast_mime        VARCHAR(30)  NOT NULL,
  ast_bytes       INTEGER      NOT NULL CHECK (ast_bytes > 0),
  ast_width       SMALLINT, ast_height SMALLINT,
  ast_duration_ms INTEGER      CHECK (ast_duration_ms BETWEEN 1 AND 90500),
  ast_status      VARCHAR(10)  NOT NULL DEFAULT 'pending'
                  CHECK (ast_status IN ('pending', 'ready', 'rejected', 'deleted')),
  ast_created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (ast_kind = 'video' OR (ast_duration_ms IS NULL AND ast_poster_key IS NULL))
);
CREATE INDEX asset_owner_idx ON "ASSET_T" (ast_usr_id, ast_created_at DESC);
CREATE TABLE "POST_ASSET_T" (
  pas_pst_id INTEGER NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
  pas_ast_id INTEGER NOT NULL REFERENCES "ASSET_T" (ast_id),
  PRIMARY KEY (pas_pst_id, pas_ast_id)
);
CREATE INDEX post_asset_ast_idx ON "POST_ASSET_T" (pas_ast_id);
```
`writeChildren` rebuilds `POST_ASSET_T` from the deck's asset ids, as it does hashtags.

### 2.3 Templates, themes, fonts: client constants
Design data shipped with the code; applying a theme writes concrete fonts and colours into the elements, so later
theme changes never alter published notes. The AI assistant imports the same constants.

### 2.4 Asset references and moderation
- On save every `assetId` must be the author's, `ready`, and the right kind; else 400 "Image not found".
- Notes carry no permanent URLs: note detail and feed add an `assets` map of **presigned R2 GET URLs**
  (signing time = start of the hour, 2 h expiry, so URLs stay cacheable for an hour).
- Hidden or deleted notes are never returned, so no URL is issued and old ones expire within 2 h.
- Unsplash images are hotlinked (required by Unsplash); hiding the note hides them too.
- Cleanup: assets unlinked from any non-deleted post for 24 h are deleted from R2; an R2 lifecycle rule clears `tmp/` after a day.

### 2.5 Sanitising
- Text `html`: D21 allow-list plus `u`, plus `span` with `style` limited to `color: #hex`. Box-level font, size,
  colour and alignment are typed props, so no other CSS reaches HTML.
- `code` and `notes` are plain strings, rendered as text. Limits measured after sanitising.
- Empty slides are dropped on publish; at least one non-empty slide required (D21).

### 2.6 Search document (FR12)
```sql
COALESCE((SELECT string_agg(CASE e->>'type' WHEN 'text' THEN regexp_replace(e->>'html', '<[^>]*>', ' ', 'g')
                                            WHEN 'code' THEN e->>'code' ELSE e->>'alt' END, ' ' ORDER BY s.sld_position)
          FROM "SLIDE_T" s, jsonb_array_elements(s.sld_doc->'elements') e
          WHERE s.sld_pst_id = p.pst_id AND e->>'type' IN ('text', 'code', 'image')), '')
```
Page notes are never indexed.

## 3. API changes
| Route | Behaviour |
|---|---|
| `POST /api/notes`, `PUT /api/notes/:id` | Body `{title, theme, aspect, slides, music, moduleId, hashtags, status, visibility, baseUpdatedAt?}`. 201/200; 400 validation; 403/404 as D21. **New 409** "This note was changed elsewhere" when `baseUpdatedAt` differs from `pst_updated_at`. |
| `GET /api/notes/:id` | Adds `aspect`, `music{trackId,title,artist,cover,volume}`, `assets`; `slides[].notes` only for the author. |
| `POST /api/assets/images` | Through the server: raw body ≤ 5 MB (jpeg/png/webp); sharp with `limitInputPixels`, real type from magic bytes, auto-rotate, longest edge ≤ 2560, re-encoded to WebP with metadata stripped, PUT to R2. 201; 400 wrong type; 413 too large; 429 (30/hour/user). |
| `POST /api/assets/videos` | `{bytes, mime}` (mp4/webm, ≤ 50 MB) creates a `pending` row and returns a 10-minute presigned PUT to `tmp/`; the browser uploads straight to R2. |
| `POST /api/assets/:id/complete` | Owner only. HEAD size must match; `ffprobe` checks container, codec, ≤ 90 s, ≤ 1920 px; `ffmpeg` grabs a poster (WebP); move to `v/`, mark `ready`. Failure: `rejected`, object deleted, 400 with reason. |
| `GET /api/unsplash/search?q=&page=` | Server proxy with `UNSPLASH_ACCESS_KEY`; trimmed results cached 1 h; 503 when unavailable. |
| `POST /api/unsplash/:photoId/download` | Server looks up the photo and calls its own `download_location` (never a client URL, avoiding SSRF); 204. |
| `GET /api/music/search?q=`, `GET /api/music/tracks/:id` | Deezer proxy; track route returns a fresh preview URL at play time; 503 when Deezer is down (note still works). Track metadata refreshed on save only when the track changes. |

Upload routes use `requireActive` and get `/security-review` before merge.

## 4. Annotation anchoring (R10, FR18)
- `"ANNOTATION_T"` (R10's migration): `ann_pst_id`, `ann_usr_id`, `ann_element_id VARCHAR(36)`, `ann_slide_no` (hint),
  `ann_start`, `ann_end`, `ann_quote VARCHAR(500)`, `ann_prefix`/`ann_suffix VARCHAR(32)` (W3C TextQuoteSelector style),
  `ann_body`, `ann_is_deleted`, `ann_created_at`.
- Anchors use the **element id**, not `sld_id` (slides are re-inserted on every save; element ids are stable).
- Offsets index the element's text-node concatenation (DOM `textContent`); the server rebuilds it from stored `html`
  with `htmlparser2` and checks `slice(start, end) === quote` (else 400).
- When text changes, the client `resolveAnchor` tries the exact offsets, then the best prefix/suffix match near the old
  offset; otherwise the annotation is **orphaned** and listed under "Text changed" with its quote. Saving never deletes annotations.

## 5. Client architecture
- **Shared workspace** `shared/` (`@parp/shared`): zod deck schema and types, limits, fonts, layouts and themes, pure
  geometry and anchor functions; used by server, client and the AI assistant.
- **State:** zustand (about 1 KB; pin a version at least two weeks old). Store `{deck, selection, activeSlide, past, future, dirty, saveState}`;
  snapshot undo capped at 100, pushed on commit (pointerup, discrete actions, text blur); TipTap owns Ctrl+Z while a box is focused.
- **Transforms:** hand-rolled Pointer Events (no dependency): move, 8-handle resize in rotated space, Shift keeps ratio,
  rotate with 15° snap, centre/edge guides; maths in pure `shared/geometry.ts` tested with the existing Vitest setup.
  react-moveable (unmaintained since 2023) and react-rnd (no rotation) rejected.
- **Rendering:** one `<SlideBoard mode="view|edit">` (1000 × H, scaled with a CSS transform via ResizeObserver) used by
  the editor, feed, note page, thumbnails, publish preview and moderation queue. Only the selected text box mounts TipTap.
  Fonts self-hosted (woff2). Feed renders the active slide and neighbours; video muted, `playsInline`, autoplays when ≥ 50 % visible.
- **Autosave:** drafts only, 2 s after the last change (at most every 10 s, plus on tab hide); first save creates the
  note and switches to `/edit/:id`; 409 offers "Reload" or "Keep mine". Published notes need an explicit Update.
- **Mobile:** tap to select, drag to move, corner and rotate handles with 44 px targets, centre snap only, bottom tool tray.

## 6. Test plan (continues from NOTE-TC25)
| TC ID | Test | Data | Expected |
|---|---|---|---|
| NOTE-TC26 | Valid deck of every element type | one slide with text, shape, line, image, code, video | 201; GET returns elements unchanged plus `assets` |
| NOTE-TC27 | Unknown type or extra key | `type:'iframe'`; text with `style` | 400 naming slide and element |
| NOTE-TC28 | Out-of-range geometry | `x: 1e9`, `rotation: 400`, `opacity: 2`, `w: 0` | 400 each |
| NOTE-TC29 | Invalid colour, font, aspect | `color:'red;...'`, `font:'Comic Sans'`, `aspect:'1:1'` | 400 each |
| NOTE-TC30 | Duplicate element ids | two elements, same id | 400 |
| NOTE-TC31 | Text sanitising | span with extra style, onclick, script | only `color:#hex` kept; script removed |
| NOTE-TC32 | Limits | 31 slides; 61 elements; 2 videos; 20,001 chars; 2,001-char notes | 400 each |
| NOTE-TC33 | Foreign or unready asset | other user's asset; pending video; image id in a video element | 400 |
| NOTE-TC34 | Unsplash URL spoofing | `url:'https://evil.example/x.jpg'` | 400 |
| NOTE-TC35 | Search uses elements | words in text, code, alt; word only in page notes | first three found; notes word not found |
| NOTE-TC36 | Page notes private | other user GETs a published note | `notes` absent |
| NOTE-TC37 | Hidden note hides assets | moderator hides a note with an upload | others 404, no asset URL; author still sees it |
| NOTE-TC38 | Image upload validation | 5 MB + 1 byte; renamed text file; PNG with GPS EXIF | 413; 400; 201 WebP without EXIF |
| NOTE-TC39 | Video completion | 91 s MP4; size mismatch; valid 30 s WebM | 400; 400; 200 ready with poster |
| NOTE-TC40 | Asset ownership | user B completes user A's upload | 404 |
| NOTE-TC41 | Stale save | PUT with old `baseUpdatedAt` | 409, unchanged |
| NOTE-TC42 | Migration of HTML slides | old note, migrate up then down | one text element per slide; search unchanged; down restores |
| NOTE-TC43 | Music reference | valid track; Deezer down on a later save | 200; save still 200 |
| NOTE-TC44 | Geometry (client) | resize a 30°-rotated box; rotate with snap | opposite corner fixed; 15° steps |

R10 adds ANN-TC rows: exact anchor, re-anchor after an earlier insert, orphan after deletion, quote mismatch (400).

## 7. Size, order, risks
| Part | Size |
|---|---|
| R21a shared module, schema, migration, notes API, search doc | M (2 d) |
| R21b read-only `SlideBoard` everywhere | M (1.5 d) |
| R21c editor core (store, undo, transforms, element types, layers, strip, aspect, notes, autosave, mobile) | XL (6-7 d) |
| R21d templates, themes, fonts | M (1.5 d) |
| R22 images: pipeline, R2, signed URLs, cleanup, Unsplash, panels | M-L (3 d) |
| R29 video: presign, ffprobe/ffmpeg, poster, autoplay | M (2 d) |
| R9 Deezer proxy and Music panel | S-M (1 d) |
| R10 annotations | L (3 d) |

**Order:** R21a → R21b (app works on the new data) → R22 server alongside R21c → R21d → R22 client → R29 and R9 → R10.
Frontend work waits on wireframe sign-off.

**Risks:** ffmpeg/ffprobe needed in the Fly image and on the dev machine; text measurement drift across browsers
(self-hosted fonts mitigate); R2 CORS setup and Unsplash's 50/hour demo limit (production approval needs the live site);
undo memory on 30-slide decks (measure); 2 MB / 48 KB limits may reject very dense slides; annotations orphan when authors rewrite heavily.

## Open questions for the user
1. Wireframe 15 shows a **table** element, not in the agreed list: add it (text grid) or drop it from the wireframe?
2. Text styling (font, size, alignment) applies to the **whole box**, with only bold/italic/underline/strike/colour
   inside the text. Per-word font sizes would widen the sanitiser. Agree?
3. ffmpeg: install it in the Docker image and locally by hand, or use the `ffmpeg-static`/`ffprobe-static` npm binaries (downloaded at install)?
4. A `shared/` workspace (recommended), or duplicated client types checked by a test?
5. Per-user storage quota of 500 MB? Reject GIFs, or store them as a still WebP?
6. Local unsaved-changes backup for published notes, or is the explicit Update enough?
7. May one uploaded asset be reused across notes (e.g. duplicating a draft)? Proposed: yes.
