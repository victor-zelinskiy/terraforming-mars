import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Size} from '../../../common/cards/render/Size';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ParameterSwingDown} from '../../../common/models/ParameterSwingModel';
import {NO_REMOVABLE_OCEAN_REASON, tileRemovalRoom} from '../../../common/parliament/tileRemoval';
import {CardRenderer} from '../render/CardRenderer';
import {cardSource} from '../../inputs/choiceContext';
import {Priority} from '../../deferredActions/Priority';
import {SimpleDeferredAction} from '../../deferredActions/DeferredAction';
import {RemoveOceanTile, skippedOceanRemoval} from '../../deferredActions/RemoveOceanTile';
import {recordSkippedEffect} from '../../deferredActions/skippedEffect';
import {declarativeCardPlayPreview} from '../../models/cardPlayPreview';
import {ParameterSnapshot, recordParameterSwing, snapshotParameters, upLegs} from '../parameterSwing';
import * as actionPreviews from '../actionPreviews';
import {Space} from '../../boards/Space';

/** The printed «3 [data]*» — onto ANY of the player's own data holders. */
export const DATA_ADDED = 3;
/** The card's own clause for the oceans' fall at nine — the skip's reason (an English key). */
export const OCEANS_AT_MAX_NOT_LOWERED_REASON = 'Oceans are at their maximum — not lowered';
/** The committed plate's sentence of the card's own removal pick. */
export const REMOVAL_REASON = 'The experiment lowers the planet again. The card is already played; the TR stays.';

/**
 * TR47 — ECOLOGICAL EXPERIMENT («Экологический эксперимент»), a Turmoil Redux
 * PROJECT card: the Scientists' plate over the set's first «UP AND BACK» —
 * every Mars parameter rises one step for everybody, pays what a raise pays,
 * and every parameter the raise left BELOW its maximum comes back down one
 * step, for everybody, with nothing taken back. The first half is ONE
 * DECLARATION (the engine's own raise, the data onto a card, the staged ocean);
 * the second half is the card's own tail — the one removal step
 * (`RemoveOceanTile`), the one lowering function (`Game.lowerParameters`),
 * and the one record of the whole swing (`cards/parameterSwing.ts`) the
 * board's scene plays when the two halves land in one answer.
 *
 * SCAN READING — cost 18, a RED card (EVENT). Three tags in the corner, in the
 * printed order: SCIENCE (the atom), PLANT (the leaf), EVENT (the yellow disc
 * with the arrow down). The orange MIN plate beside the cost holds the
 * SCIENTISTS' emblem (the flask): a REQUIREMENT (`{party: SCIENTISTS}`), never
 * a tag. One printed row: the three Mars parameters «[O₂] [t°] [ocean]»
 * (Venus is NOT a Mars parameter and is not drawn), «3 [data]*» (a digit and
 * ONE data square — onto ANY card), a vertical bar, the printed word «THEN»,
 * then «− [O₂] [t°] [ocean]». The face draws it as two rows under the row
 * budget: the raise with the data, then «THEN» and the fall. No VP badge. No
 * quote — the lore is INVENTED (`docs/claude/turmoil-redux-invented-lore.md`:
 * «The results were inconclusive. The jungle was not.»). Only the module's
 * icon at the bottom left: no `compatibility`. The art's caption «ON-A» is the
 * art's, not the face's.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/EcologicalExperiment.spec.ts;
 * the class «up and back» by tests/game/ParameterSwing.spec.ts):
 *  1. The REQUIREMENT is the Scientists' plate — they rule, or 2 of the
 *     player's OWN delegates stand on their resolution — checked at the PLAY
 *     only; TR36 Council Seat lowers an EFFECT's threshold, never a requirement.
 *  2. UP — each MARS parameter one step by the ORDINARY raise: +2 °C, +1 %,
 *     +1 ocean (a PLACEMENT — the cell, its printed bonus, its neighbours).
 *     Every step made pays +1 TR (`{global: true}` — the Greens answer, TR24
 *     / Aphrodite do not: Mars), wakes the thresholds (−24 / −20 °C heat
 *     production, 0 °C a BONUS OCEAN — a second placement with its TR, 8 % O₂ a
 *     temperature step with ITS thresholds). A parameter ALREADY at its
 *     maximum makes no step and pays no TR — NAMED before the press, the card
 *     stays playable (the official rule; `maxtemp` is a warning).
 *  3. +3 DATA onto ANY card — any of the player's OWN data holders (the
 *     tableau + SRR; never a rival's — TR43's rule 3), MANDATORY, the target
 *     pre-selected in the composer and never chosen for the player (one holder
 *     is still a question); no holder → a skip BY NAME (`skippedAddToCard`),
 *     the card still playable. Asked BEFORE the ocean (`PLAY_CARD_RESOURCE_CHOICE`),
 *     landing where it was addressed (law 27).
 *  4. THEN — once EVERYTHING the raise set off has resolved (the card's ocean,
 *     the 0 °C bonus ocean, the 8 % temperature step, the data): every Mars
 *     parameter NOT at its maximum AFTER the raise comes down one step —
 *     −2 °C (never below −30), −1 % (never below 0), −1 ocean = REMOVE ANY
 *     PLAIN OCEAN of the player's choosing (whoever placed it, the one just
 *     placed included, the ocean under a TR44 city included — the city stays;
 *     never a composite). A parameter the raise took TO its maximum STAYS
 *     (the point of the experiment); a parameter at its maximum before the
 *     play neither rises nor falls («stays at maximum» — named). No plain
 *     ocean below nine → a named skip (`NO_REMOVABLE_OCEAN_REASON`).
 *  5. EVERYTHING THE RAISE GAVE STAYS: the TR (per step, the bonus ocean's,
 *     the 8 % step's), the heat production of the thresholds, the placed
 *     ocean's cell bonus and adjacency, the data. The fall PAYS NOTHING AND
 *     TAKES NOTHING: no TR back, no threshold re-armed (the claims stand —
 *     `claimCrossedScaleBonuses`), the removed ocean's cell bonus not returned
 *     (the next ocean there pays again), a Capital beside the removed ocean a
 *     point poorer (a fact on the event, PL-041), no party passive answering
 *     the fall. The lowering's event is `global-parameter-changed` with
 *     NEGATIVE steps and THE PLAYER as its author (`increaseTemperature(player,
 *     -1)` without `unrewarded` — that flag is the World Government's and a
 *     resolution's «for nobody» mode: a lie about the author here); the removal
 *     is `tile-removed` with the actor.
 *  6. THE OCEAN PICK IS A STEP OF THIS VERY PLAY, on the board: the family's
 *     one prompt (`oceanRemovalPrompt` — `placementEffect: 'remove'`,
 *     `placementType: 'ocean-removal'`, `tileType: OCEAN`, a committed context
 *     naming this card), never automatic (one ocean is still a question —
 *     invariant 3), the dossier naming what the removal does and what it
 *     UNCOVERS. A choice AFTER the commit is honest here: which ocean to take
 *     depends on where the raise's ocean (and the bonus ocean) landed — the
 *     answer was not known before «A» (TR51's law stands).
 *  7. THE ORDER of the second half (the owner's decision 2 — one scene, one
 *     cause): below nine oceans the question «which ocean» comes FIRST, and the
 *     answer's response carries the whole fall — the removal, −2 °C, −1 %; at
 *     nine oceans there is no question and the temperature / oxygen fall rides
 *     the last answer of the raise (or the play itself).
 *  8. THE SWING IS A FACT OF THE SERVER (the PL-133 / `scaleStepRewards`
 *     class): the play publishes a `parameterSwings` record — per parameter
 *     before · peak · after, the rating each raise paid, the thresholds it
 *     claimed, the ocean removed — so the client plays the UP (what its view
 *     has not shown) and the DOWN (always from the record) and never reads a
 *     diff that is zero for «up and back». Never serialized.
 *  9. THE TAGS wake the table: Science — Olympus Conference / Mars University /
 *     Pharmacy Union (the composer's own questions, TR51); Plant — Decomposers
 *     (+1 microbe), Ecological Zone (+1 animal), Viral Enhancers (+1 plant);
 *     the EVENT goes to the events pile and its Science tag leaves the count;
 *     +3 data → Martian Fiber (+1 M€ per data); the raise's TR → the Greens.
 *     The forecast names all of it before the press.
 * 10. PREVIEW = EXECUTION: the batch `[play, {card: data}, {space: ocean,
 *     staged}]` lands whole; the bonus ocean and the removal are honest
 *     follow-ups the «ДАЛЕЕ» rows name (the bonus one only when 0 °C is crossed).
 * 11. THE JOURNAL: the raise's lines (the engine's), the placement, the data,
 *     «lowered the temperature 1 step (0 → −2) — the TR stays», «lowered the
 *     oxygen…», «removed an ocean tile from <cell>» with the actor, the skips
 *     by name («Oxygen is at its maximum — not lowered»).
 * 12. A RIVAL sees the play with its swing on the board (the same record), the
 *     ocean's departure (`liftRemote`), a Capital's loss named (PL-041).
 * 13. MarsBot never plays the card; its oceans are candidates.
 * 14. SAVE / LOAD: the scales and the board are the engine's; the swing's
 *     record is presentation (not serialized); a reload between the question
 *     and the fall rebuilds the removal prompt (the committed context), and
 *     the fall rides its answer — the up legs of the record are then measured
 *     from a fresh instance (none: the client plays from its own view).
 */
export class EcologicalExperiment extends Card implements IProjectCard {
  /** The planet as it stood BEFORE the raise — the raise's legs are measured against it (rule 8). */
  private swingBefore: ParameterSnapshot | undefined;

  constructor() {
    super({
      name: CardName.ECOLOGICAL_EXPERIMENT,
      type: CardType.EVENT,
      tags: [Tag.SCIENCE, Tag.PLANT],
      cost: 18,
      requirements: {party: PartyName.SCIENTISTS},

      // Rules 2–3 — the raise as ONE declaration: the engine raises temperature then oxygen (synchronously), asks the
      // data's target ahead of the placement (`PLAY_CARD_RESOURCE_CHOICE`), and defers the ocean (the staged cell).
      behavior: {
        global: {temperature: 1, oxygen: 1},
        ocean: {},
        addResourcesToAnyCard: {type: CardResource.DATA, count: DATA_ADDED},
      },

      metadata: {
        cardNumber: 'TR47',
        infoText: [
          {text: 'Increase each Mars global parameter 1 step and add 3 data to ANY card.', tokens: ['oxygen', 'temperature', 'oceans', 'res-data']},
          {text: 'Then decrease each Mars global parameter that isn\'t at maximum 1 step (remove any ocean you like). Keep the TR you gained.', tokens: ['oxygen', 'temperature', 'oceans']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The scan's one row, folded under the row budget: the raise with the data, then «THEN» and the fall.
          b.oxygen(1).temperature(1).oceans(1).nbsp.resource(CardResource.DATA, {amount: DATA_ADDED, digit: true}).asterix().br;
          b.text('THEN', Size.SMALL, true).nbsp.minus().oxygen(1).temperature(1).oceans(1);
        }),
        description: 'Requires the Scientists to be ruling or that you have 2 delegates there. Increase each Mars global parameter 1 step, and add 3 data resources to ANY card. Then decrease each Mars global parameter that isn\'t at maximum by 1 step. (Remove any ocean you like; keep the TR you gained.)',
      },
    });
  }

  /** Rule 8 — the planet before the raise, read on the live card instance the play runs on. */
  public override bespokePlayBefore(player: IPlayer): void {
    this.swingBefore = snapshotParameters(player.game, player);
  }

  /**
   * Rules 4–8 — THE FALL, one deferred step at the BACK OF THE LINE («once
   * everything the raise set off has resolved»): the oceans' room is read
   * FIRST (the card's clause at nine, the empty board — both named), the ocean
   * is asked through the family's one step, and the answer's own response
   * carries the rest of the fall and the record.
   */
  public override bespokePlay(player: IPlayer) {
    player.game.defer(new SimpleDeferredAction(player, () => {
      const game = player.game;
      const peak = snapshotParameters(game, player);
      const before = this.swingBefore;
      this.swingBefore = undefined;
      const finish = (oceans: ParameterSwingDown, removed?: Space): void => {
        const down: Array<ParameterSwingDown> = [oceans, ...game.lowerParameters(player, ['temperature', 'oxygen'])];
        recordParameterSwing(player, this, {
          up: before === undefined ? [] : upLegs(before, peak, peak.terraformRating > before.terraformRating),
          down,
          removed,
        });
      };
      const room = tileRemovalRoom({tile: 'ocean', executor: 'first-player'}, {
        oceans: peak.oceans,
        removableOceans: game.board.getOceanSpaces({upgradedOceans: false}).length,
      });
      if (room.atMax) {
        recordSkippedEffect(player, OCEANS_AT_MAX_NOT_LOWERED_REASON, skippedOceanRemoval());
        finish({parameter: 'oceans', atMax: true, at: peak.oceans});
        return undefined;
      }
      if (!room.removes) {
        recordSkippedEffect(player, NO_REMOVABLE_OCEAN_REASON, skippedOceanRemoval());
        finish({parameter: 'oceans', atMin: true, at: peak.oceans});
        return undefined;
      }
      game.defer(new RemoveOceanTile(player, {source: cardSource(this), reason: REMOVAL_REASON}), Priority.BACK_OF_THE_LINE)
        .andThen((space) => {
          if (space === undefined) {
            finish({parameter: 'oceans', atMin: true, at: peak.oceans});
            return;
          }
          finish({parameter: 'oceans', before: peak.oceans, after: game.board.getOceanSpaces().length}, space);
        });
      return undefined;
    }, Priority.BACK_OF_THE_LINE));
    return undefined;
  }

  /**
   * THE COMPOSER'S READING — the declaration's own first half (the door
   * `declarativeCardPlayPreview`: the raise's chips with their implied
   * ratings, the data's target step, the staged ocean), then the card's TAIL
   * (`parameterSwingTail`: «THEN» and the fall read from the PEAK, the ocean's
   * board step in «ДАЛЕЕ»), then the closing line — the rating the whole press
   * leaves the player with (restated, never counted twice).
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const base = declarativeCardPlayPreview(player, this);
    const tail = actionPreviews.parameterSwingTail(player, {temperature: 1, oxygen: 1, oceans: 1});
    const net = tail.rating > 0 ? [{
      direction: 'gain' as const, icon: 'tr', amount: tail.rating, implied: true, phase: actionPreviews.NET_PHASE,
      current: player.terraformRating, resulting: player.terraformRating + tail.rating,
    }] : [];
    return {
      ...base,
      branches: base.branches.map((branch) => ({
        ...branch,
        effects: [...branch.effects, ...tail.effects, ...net],
        steps: [...branch.steps, ...tail.steps],
      })),
    };
  }
}
