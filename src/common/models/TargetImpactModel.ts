import {Color} from '../Color';

/**
 * The SERVER-computed impact of an attack on ONE target (decrease production /
 * steal / remove a resource). The client renders these `current → resulting`
 * rows VERBATIM — it never derives them itself and never branches on isMarsBot,
 * so a human and a MarsBot target read from ONE premium presentation.
 *
 * Why server-authoritative: a MarsBot's public resource/production FIELDS are
 * static placeholders — reducing its production actually REGRESSES a board
 * TRACK, and removing a resource drains its M€ supply (+ Colonies storage), so a
 * client that reads `player.energyProduction` would show wrong numbers. The
 * universal helper `src/server/inputs/targetImpact.ts` computes the REAL change.
 */
export type TargetImpactChange = {
  /**
   * Icon key. A `Resource` value (stock / production of a human), OR a track
   * identity `Tag` value (a MarsBot production hit regresses a track, not a
   * production field — so the row shows WHICH track by its tag).
   */
  icon: string;
  from: number;
  to: number;
  /**
   * 'stock' / 'production' for a human; 'track' for a MarsBot production
   * regression (the row renders the track TAG + the step count).
   */
  scope: 'stock' | 'production' | 'track';
  /** Step count for production / track scopes (how many steps / track divisions). */
  steps?: number;
};

export type TargetImpact = {
  color: Color;
  /**
   * The concrete before→after rows the target undergoes. Usually ONE; a MarsBot
   * Colonies-storage loss can split into a storage row + the M€-supply row.
   * EMPTY = a no-op (nothing actually changes) → the client renders it muted.
   */
  changes: ReadonlyArray<TargetImpactChange>;
};
