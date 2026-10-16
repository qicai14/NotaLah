/** Local backups of unsaved edits to published notes are stored under this prefix plus the note id. */
export const BACKUP_PREFIX = 'notalah-backup:';

/** On logout every backup goes, so the next person on a shared computer cannot read them (D52). */
export function clearAllBackups(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(BACKUP_PREFIX)) localStorage.removeItem(k);
  } catch {
    // Storage blocked: nothing was stored either.
  }
}
