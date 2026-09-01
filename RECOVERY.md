# Destiny.AI — Repository Consolidation Recovery

On 2026-09-01, the nested Create Next App repository was consolidated into the canonical
repository at `/Users/harsh/career-lab`.

Nothing from the old repository was deleted. Recovery material is stored outside the active
repository at:

`/Users/harsh/career-lab-recovery/2026-09-01-1535-web-scaffold/`

It contains:

- `web.git/` — original Git metadata;
- `web-scaffold-6290be4.bundle` — verified complete committed history;
- `working-tree.patch` — the original package dependency overlay;
- `README.md` — isolated recovery instructions.

Original authority:

- branch: `main`;
- HEAD: `6290be40f4074a139b0e4bb021091d52a507d4e1`;
- dirty paths: `web/package.json`, `web/package-lock.json`.

The current root baseline intentionally includes those dependency additions. Restoring the
old repository is a recovery action, not a normal development step.
