/** Music search settings (R9). Not ranking constants, so they live with the feature. */
export const MUSIC = Object.freeze({
  /** Searches per signed-in user per minute. */
  searchesPerMinute: 20,
  perPage: 20,
  timeoutMs: 5000,
  /** Identical searches are answered from memory this long, to spare the monthly allowance. */
  cacheMs: 10 * 60_000,
  cacheMax: 200,
});
