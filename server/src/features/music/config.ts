/** Music search settings (R9). Not ranking constants, so they live with the feature. */
export const MUSIC = Object.freeze({
  /** Searches per signed-in user per minute. */
  searchesPerMinute: 20,
  /** Jamendo calls (searches and save-time lookups) per signed-in user per day, so one account cannot drain the shared monthly cap. */
  callsPerUserPerDay: 300,
  perPage: 20,
  /** Tracks remembered from searches so a save of a track just found needs no second Jamendo call. */
  trackMemory: 500,
  timeoutMs: 5000,
  /** Identical searches are answered from memory this long, to spare the monthly allowance. */
  cacheMs: 10 * 60_000,
  cacheMax: 200,
});
