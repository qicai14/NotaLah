# client feature: search

Search screen at `/search` (open to guests, D44): one query box, result tabs (Top, Notes, People, Hashtags, Modules), the
note filters of FR15 in a sheet, and keyset "Load more". Wireframes 07, 37, 38, 39; API in D48.

- `Search.tsx`: the page. Query, tab and filters live in the URL (`searchParams.ts`); typing is debounced 300 ms.
- `searchParams.ts`: URL to state, state to URL and API path (pure, tested as CLI-TC21 to CLI-TC25).
- `useSearchResults.ts`: pages one query, sends the cursor and the `asOf` from page 1, drops stale answers (CLI-TC26 to CLI-TC28).
- `FilterSheet.tsx`: lecturer, term (hidden while no terms exist), dates, module (hidden for guests, whose API cannot list modules).
- `SearchResults.tsx`: note tile (first slide, `SlideBoard`), person, hashtag and module rows. Hashtags and modules have no page yet, so they link to a notes search for that tag or module.

Serves: FR4, FR5, FR12, FR15.
