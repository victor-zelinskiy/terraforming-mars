import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {ALL_RESOURCES, Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {cardEffect} from '../../inputs/choiceContext';
import {gainStock} from '../../inputs/optionMetadata';
import {OptionMetadata} from '../../../common/models/PlayerInputModel';
import {message} from '../../logs/MessageBuilder';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ActionFutilityVerdict} from '../../../common/models/ActionFutilityModel';
import {noProduction} from '../actionFutilities';
import * as actionPreviews from '../actionPreviews';

/** The printed «−3 [energy]» — the price paid on top of the M€ cost (`spend`, before the choice). */
export const OVERCLOCKED_ENERGY_PRICE = 3;

/**
 * The six standard resources in the RAIL's order (top to bottom: M€, steel, titanium, plants, energy, heat) — the
 * order of the live `OrOptions`, the preview's branches and the console's palette, one list for all three.
 */
export const OVERCLOCKED_RESOURCES: ReadonlyArray<Resource> = ALL_RESOURCES;

/** Each option's words (i18n keys) — the palette speaks with the hero and the number; these are the option's name. */
const GAIN_TITLE: Readonly<Record<Resource, string>> = {
  [Resource.MEGACREDITS]: 'Gain ${0} M€',
  [Resource.STEEL]: 'Gain ${0} steel',
  [Resource.TITANIUM]: 'Gain ${0} titanium',
  [Resource.PLANTS]: 'Gain ${0} plants',
  [Resource.ENERGY]: 'Gain ${0} energy',
  [Resource.HEAT]: 'Gain ${0} heat',
};

/** Rule 4: as many as the production of it, never below zero (a negative M€ production gives 0, never takes). */
export function overclockedAmount(player: IPlayer, resource: Resource): number {
  return Math.max(0, player.production.get(resource));
}

/**
 * TR54 — OVERCLOCKED EQUIPMENT («Разогнанное оборудование»), a Turmoil Redux
 * PROJECT card: the INDUSTRIALISTS' plate (TR55's class), a declared price of
 * 3 energy (`spend` — paid with the play, before anything else of it) and ONE
 * question: «which standard resource?» — six answers, each «as many as your
 * production of it».
 *
 * SCAN READING — cost 9, green (AUTOMATED). ONE tag in the corner: Power (the
 * purple disc with the lightning). The orange MIN plate beside the cost holds
 * the INDUSTRIALISTS' emblem (the cog around the globe): the REQUIREMENT, never
 * a tag. The field holds ONE row: a large «−3» and ONE energy icon (the price),
 * then the six-coloured «?» square (the Standard Resource — any one of the six)
 * with its asterisk, a «/», and the same «?» inside a BROWN PRODUCTION FRAME
 * with its asterisk — «as many ? as your ?-production» (`wild` on the face: the
 * premium `wild.png`, the owner's decision 4 of the prompt). Printed text:
 * «(Requires the Industrialists to be ruling or that you have 2 delegates
 * there. Also pay 3 energy. Pick a basic resource type. Gain an amount of that
 * resource equal to your production of it.)» Lore under the rule: «It even
 * comes with RGB lighting!» (`lore_texts.json` «TR54», word for word). Art
 * credit: UBTech. No VP badge. Only the module's symbol at the bottom left (the
 * purple diamond with the arrow): no `compatibility`.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/OverclockedEquipment.spec.ts):
 *  1. The REQUIREMENT is the Industrialists' plate (the TR15 class): they rule,
 *     or 2 of the player's OWN delegates on their resolution; TR36 Council Seat
 *     lowers an EFFECT's threshold, never a requirement's.
 *  2. THE PRICE: 9 M€ by the ordinary payment + 3 ENERGY at the play
 *     (`spend: {energy: 3}`): with 2 energy the card is unplayable and the hand
 *     names ONE blocker — the energy (the shared `spend` rung of the play
 *     ladder, `unplayableReasons`), after the party when both fail.
 *  3. THE QUESTION IS ALWAYS ASKED — six options (M€ · steel · titanium · plants
 *     · energy · heat — the rail's order), five zeros included; no auto-select of
 *     the one non-zero resource. Each option is `gainStock` with the viewer's
 *     `current → resulting`; the `or` is the card's reward
 *     (`cardEffect(this, undefined, 'reward')`).
 *  4. HOW MANY: `max(0, production)` at the moment of the choice; a NEGATIVE M€
 *     production gives 0 and its option stays, named («production −1 → 0»).
 *  5. ENERGY: the price is already paid — choosing energy gives the energy
 *     production, net `production − 3`; its chip reads the base AFTER the price
 *     (the live option reads the paid stock; the preview subtracts the price).
 *  6. PREVIEW = EXECUTION: `orBranches` in the live options' order, the price
 *     chip FIRST in every branch (the composer lifts the shared chip above the
 *     row), a zero branch `futile` (the server's verdict «production 0»); the
 *     `or` answer is addressed `{role: 'or', source: this card}` and replays in
 *     the batch `[play, or]`.
 *  7. A COUNTED play: every gain chip carries its basis (the production it
 *     reads) — the composer's «ПОЧЕМУ». No hand plate: the six counts are a
 *     CHOICE, and the plate never shows six gains as if all landed.
 *  8. THE POWER TAG: Thorgate −3 M€, other cards' Power-tag requirements, RX04
 *     Central Power Grid (`raw`) and its chairman quest «2 Power tags».
 *  9. THE JOURNAL: «paid 3 energy for …» (the price) → «gained N <res>» (the
 *     choice); a zero choice logs «gained 0 <res>» honestly — the player's own
 *     choice, never an `effect-skipped`.
 * 10. A RIVAL sees the play and the choice; MarsBot never plays the card; save /
 *     load — an ordinary card, a standing `or` survives the reload (live
 *     `waitingFor`).
 * 11. THE TABLE'S ANSWERS: whatever answers a Power tag; no TR — no party answers.
 * 12. PURITY: `cardPlayPreview` mutates nothing.
 */
export class OverclockedEquipment extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.OVERCLOCKED_EQUIPMENT,
      type: CardType.AUTOMATED,
      tags: [Tag.POWER],
      cost: 9,
      requirements: {party: PartyName.INDUSTRIALISTS},

      // Rule 2 — the energy leaves the stock with the play, before the question (`Executor.execute`).
      behavior: {
        spend: {energy: OVERCLOCKED_ENERGY_PRICE},
      },

      metadata: {
        cardNumber: 'TR54',
        // The bespoke choice is prosed by hand (the generator reads the declared price only).
        infoText: [
          {text: 'Pay 3 energy. Gain a standard resource of your choice — as many as your production of it.', tokens: ['wild']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The scan's one row — «−3 [energy]  [?]* / [? in a production frame]*».
          b.minus().energy(OVERCLOCKED_ENERGY_PRICE, {digit}).nbsp.wild(1).asterix().slash().production((pb) => pb.wild(1)).asterix();
        }),
        description: 'Requires the Industrialists to be ruling or that you have 2 delegates there. Also pay 3 energy. Pick a basic resource type. Gain an amount of that resource equal to your production of it.',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    // Rule 9 — the price is on the journal before the choice (the executor deducted it silently).
    player.game.log('${0} paid ${1} ${2} for ${3}', (b) => b.player(player).number(OVERCLOCKED_ENERGY_PRICE).resource(Resource.ENERGY).card(this));
    return this.resourceChoice(player, /* pricePaid */ true);
  }

  /**
   * THE QUESTION — six `SelectOption`s, built WITHOUT side effects (every gain lives in its `andThen`), so the live
   * play and the preview share ONE builder and cannot drift. `pricePaid` is false only for the preview: there the
   * energy option's chip subtracts the price the play will have paid by the time it is asked (rule 5).
   */
  public resourceChoice(player: IPlayer, pricePaid: boolean): OrOptions {
    return new OrOptions(...this.resourceOptions(player, pricePaid)).setTitle('Choose a resource').markChoiceContext(cardEffect(this, undefined, 'reward'));
  }

  /** The six options of the question, in the rail's order (`resourceChoice`'s, and the preview's branches). */
  private resourceOptions(player: IPlayer, pricePaid: boolean): Array<SelectOption> {
    return OVERCLOCKED_RESOURCES.map((resource) => {
      const amount = overclockedAmount(player, resource);
      const futile = this.futility(player, resource);
      const metadata: OptionMetadata = {...this.gainMetadata(player, resource, amount, pricePaid), ...(futile !== undefined ? {futile} : {})};
      return new SelectOption(message(GAIN_TITLE[resource], (b) => b.number(amount)), 'Gain')
        .withMetadata(metadata)
        .andThen(() => {
          this.gain(player, resource, amount);
          return undefined;
        });
    });
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    const price = actionPreviews.stockCost(player, Resource.ENERGY, OVERCLOCKED_ENERGY_PRICE);
    const preview = actionPreviews.orBranches(this, this.resourceOptions(player, /* pricePaid */ false).map((option, i) => {
      const resource = OVERCLOCKED_RESOURCES[i];
      const gain = option.metadata?.effects?.[0];
      return {
        available: true,
        title: option.title,
        effects: gain !== undefined ?
          [price, actionPreviews.counted(gain, {count: player.production.get(resource), label: 'Your production'})] :
          [price],
      };
    }), {autoResolveSingle: false});
    // Rule 6 — a zero is the server's «no effect» verdict on its branch (the branch stays a full answer).
    return {
      ...preview,
      branches: preview.branches.map((branch, i) => {
        const futile = this.futility(player, OVERCLOCKED_RESOURCES[i]);
        return futile !== undefined ? {...branch, futile} : branch;
      }),
    };
  }

  /** The option's `gainStock` — the energy row read after the price when the price is still to be paid (rule 5). */
  private gainMetadata(player: IPlayer, resource: Resource, amount: number, pricePaid: boolean): OptionMetadata {
    const metadata = gainStock(player, resource, amount);
    if (pricePaid || resource !== Resource.ENERGY) {
      return metadata;
    }
    const current = Math.max(0, player.energy - OVERCLOCKED_ENERGY_PRICE);
    return {...metadata, effects: (metadata.effects ?? []).map((e) => ({...e, current, resulting: current + amount}))};
  }

  /** Rule 4 — a production of 0 (or below) gives nothing: the option is live and changes nothing, named. */
  private futility(player: IPlayer, resource: Resource): ActionFutilityVerdict | undefined {
    const production = player.production.get(resource);
    return production <= 0 ? noProduction(production) : undefined;
  }

  private gain(player: IPlayer, resource: Resource, amount: number): void {
    if (amount > 0) {
      player.stock.add(resource, amount, {log: true});
      return;
    }
    // Rule 9 — the player's own choice of a zero is a journal line, never a skipped effect.
    player.game.log('${0} gained ${1} ${2}', (b) => b.player(player).number(0).resource(resource));
  }
}
