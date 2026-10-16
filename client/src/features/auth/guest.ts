// Whether this tab chose "Browse as guest" (R31). Session-only: a new visit starts on the Welcome page again.
const KEY = 'notalah-guest';

export function markGuest(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // storage blocked: the visitor simply sees Welcome again next time
  }
}

export function isGuestBrowsing(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
