import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
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
   * Resolves one of this corporation's OWN bonus cards (`info.corpBonusCards`,
   * the B22–B32 family) when the bot flips it from its action deck. Routing
   * (discard / destroy / recurring holding) stays with the caller.
   */
  resolveBonusCard?(game: IGame, id: BonusCardId): BonusCardOutcome;
};
