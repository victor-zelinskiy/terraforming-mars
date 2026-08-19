import {BonusCardId, TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpInfo, MarsBotTrackCube} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import type {BonusCardOutcome} from '../AutomaBonusCards';

/**
 * One MarsBot corporation's SERVER behavior — the printed rule boxes of the
 * physical card (Rule Book B "Adding Corporations"), co-located per
 * corporation in `src/server/automa/corps/MarsBot<Name>.ts`. The printed DATA
 * (identity, tags, draft priority, display sections) lives in the shared
 * `common/automa/MarsBotCorpData.ts`; this type adds only the behavior.
 *
 * Only the boxes the physical card prints are implemented — a corporation
 * with no Setup box has no `setup`, one with no Effect box has no
 * `onProjectCardResolving` (RB-B anatomy: "Not all corporations use all
 * fields"). Starting tags are NOT a hook: the framework resolves them
 * generically at selection time (RB-B Setup 4 applies to every corporation).
 */
export type MarsBotCorp = {
  readonly info: MarsBotCorpInfo;

  /** RB-B Setup 3: "Immediately resolve any instructions found in the Setup box of the card." */
  setup?(game: IGame): void;

  /**
   * The "Before Action Phase" box — runs every generation right before the
   * action phase, INCLUDING the first: "Ones marked 'Before Action Phase' are
   * also resolved after setup, before the first generation's Action Phase"
   * (RB-B p.3). Dispatched from the one research → action gate, guarded
   * once-per-generation by `AutomaState.corpBapGeneration`.
   */
  beforeActionPhase?(game: IGame): void;

  /**
   * The "Effect" box, for effects worded "When resolving a card …" — fired
   * for EVERY project card the bot resolves (its own turn flip, the
   * Research & Development draw, the Local Neural Instance fallback), BEFORE
   * tag processing. The wording is "when RESOLVING", not "when successfully
   * resolving": a Failed Action during the card's resolution never swallows
   * the corporation effect.
   */
  onProjectCardResolving?(game: IGame, card: IProjectCard): void;

  /**
   * MarsBot's marker ADVANCED one space on `trackIndex` (the space it landed
   * on is `position`). Fires for EVERY successful advance — a card's printed
   * tag, a cascade, a corporation's own starting tag — and never for a
   * refused one (a maxed track is a Failed Action, not an advance). Runs
   * BEFORE the space's printed icon, like the cube hook beside it.
   */
  onTrackAdvance?(game: IGame, trackIndex: number, position: number): void;

  /**
   * MarsBot's marker ADVANCED onto one of this corporation's cubes (RB-B
   * «Special Cubes on the MarsBot Player Mat»). Fires BEFORE the space's
   * printed icon and IN ADDITION to it — unless the hook returns
   * `'replaces-action'`, the card's explicit «instead of …» case (Helion's
   * white cube takes over the printed temperature raise).
   *
   * A cube fires at most ONCE per game: the framework marks it spent, and a
   * regressed track never re-arms it.
   */
  onTrackCubeTrigger?(game: IGame, cube: MarsBotTrackCube, printedAction: TrackAction | undefined): 'replaces-action' | void;

  /**
   * Resolves one of this corporation's OWN bonus cards (`info.corpBonusCards`,
   * the B22–B32 family) when the bot flips it from its action deck. Routing
   * (discard / destroy / recurring holding) stays with the caller.
   */
  resolveBonusCard?(game: IGame, id: BonusCardId): BonusCardOutcome;
};
