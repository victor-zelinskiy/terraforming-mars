/**
 * A saved parliament this build cannot load — an unknown resolution id, a
 * newer save version. Thrown EXPLICITLY (never degraded to an empty slot):
 * a game whose politics cannot be reconstructed must not be played on as if
 * they could.
 */
export class IncompatibleParliamentSaveError extends Error {
  constructor(public readonly detail: string) {
    super(`Incompatible Turmoil Redux save: ${detail}`);
    this.name = 'IncompatibleParliamentSaveError';
  }
}
