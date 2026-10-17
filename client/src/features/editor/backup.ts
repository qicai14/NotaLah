/** Local backups of unsaved edits are stored under this prefix plus the note id. */
export const BACKUP_PREFIX = 'notalah-backup:';

/**
 * Removes backups so the next person on a shared computer cannot read them (D52): all of them on logout or an expired
 * session, or, when someone signs in, every backup another user wrote.
 */
export function clearAllBackups(keepOwner?: number): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(BACKUP_PREFIX)) continue;
      if (keepOwner !== undefined && ownerOf(localStorage.getItem(k)) === keepOwner) continue;
      localStorage.removeItem(k);
    }
  } catch {
    // Storage blocked: nothing was stored either.
  }
}

function ownerOf(raw: string | null): number | null {
  try {
    const owner = raw ? (JSON.parse(raw) as { owner?: unknown } | null)?.owner : null;
    return typeof owner === 'number' ? owner : null;
  } catch {
    return null;
  }
}
