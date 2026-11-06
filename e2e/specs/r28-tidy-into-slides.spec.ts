import { test } from '@playwright/test';

// Runs after R28 slice 1, against a stub AI server (no key, no network). The stub is not added yet.
test.fixme('E2E-TC8 S2 assisted: paste text and tidy it into slides', async () => {
  // 1. Start the stub AI server and point the API at it.
  // 2. Student opens /notes/new, uses the draft-from-text action and pastes text.
  // 3. Expect draft slides; time it with timed('S2-assisted', ...) for the B3 ratio (#122).
});
