import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {PreludeCard} from '../prelude/PreludeCard';
import {Units} from '../../../common/Units';
import {Resource} from '../../../common/Resource';
import {cardSource} from '../../inputs/choiceContext';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {message} from '../../logs/MessageBuilder';
import * as actionPreviews from '../actionPreviews';
import * as actionReason from '../actionReasons';

/** The printed price («Lose 18 M€»). */
export const INDUSTRIAL_COMPLEX_PRICE = 18;
/** The level every production below it is raised to («… lower than 1, to 1»). */
export const INDUSTRIAL_COMPLEX_FLOOR = 1;

/** One production line the play raises: the resource and the honest delta (M€ −5 → 1 is +6). */
export type IndustrialComplexRaise = {resource: Resource, from: number, delta: number};

/**
 * The «Unchanged: …» note's templates, by the number of lines it names (a line already at 1 or more is NAMED, never
 * left out silently). Each line is a resource token and its level — the i18n keys are fixed per count, so the
 * translator owns the whole sentence.
 */
export const INDUSTRIAL_COMPLEX_UNCHANGED: ReadonlyArray<string> = [
  'Unchanged: ${0} ${1}',
  'Unchanged: ${0} ${1}, ${2} ${3}',
  'Unchanged: ${0} ${1}, ${2} ${3}, ${4} ${5}',
  'Unchanged: ${0} ${1}, ${2} ${3}, ${4} ${5}, ${6} ${7}',
  'Unchanged: ${0} ${1}, ${2} ${3}, ${4} ${5}, ${6} ${7}, ${8} ${9}',
  'Unchanged: ${0} ${1}, ${2} ${3}, ${4} ${5}, ${6} ${7}, ${8} ${9}, ${10} ${11}',
];

/**
 * P52 — INDUSTRIAL COMPLEX («Промышленный комплекс»), a Prelude 2 prelude: Building tag, «lose 18 M€; increase all your
 * productions that are lower than 1, to 1». The set's first prelude with a PRICE paid at the start (a negative
 * `startingMegaCredits`, paid by the card itself) AND a MULTI-LINE production rise — up to six lines in one wave.
 *
 * SCAN READING — the PRELUDE frame, the Building disc top right; the bottom row `[−18 M€] [production: «1»]*` and
 * «(Lose 18 M€. INCREASE ALL YOUR PRODUCTIONS THAT ARE LOWER THAN 1, TO 1.)». Lore: «Investing heavily in the
 * production of basic materials».
 *
 * RULE READINGS (pinned by tests/cards/prelude2/IndustrialComplex.spec.ts):
 *  1. THE RISE — every production ≤ 0 goes to 1 in ONE `production.adjust` (the honest delta: M€ −5 → 1 is +6), each
 *     line through `production.add`, so Manutech answers each line (one `production-gain` per line) and the Redux
 *     Greens answer the plant / heat lines with M€ production on top. A line already at 1 or more is NAMED unchanged.
 *  2. THE PRICE is paid AFTER the rise — the server's order is load-bearing: Manutech's gains count toward the 18 M€
 *     (upstream's rule). The face prints «−18» FIRST (the scan) and the information blocks read in EXECUTION order —
 *     the one named exception to «face order = block order», because the rise must come before the bill. The bill
 *     names its asker (`cause`), so a pre-collected payment (Helion's heat) lands on it.
 *  3. AFFORDABILITY is honest: 18 M€ on top of any price held back before this play (P45 Board of Directors'
 *     `canAffordOptions.cost`) minus Manutech's FULL refund (each raised M€ line's delta; heat under Helion; titanium
 *     under the Luna Trade Federation at its M€ value). A shortfall is named («Need N more M€»).
 *  4. ORDER — the card says it waits for MONEY (`preludeNeeds: 'cash'`): a prelude that grants M€ (Loan) is advised
 *     first, instead of a silent burn.
 *  5. PREVIEW — the raised lines `current → 1`, the unchanged lines named, the price chip and the payment step when the
 *     server will ask one (Helion / LTF). Read-only.
 */
export class IndustrialComplex extends PreludeCard {
  public readonly preludeNeeds = 'cash' as const;

  constructor() {
    super({
      name: CardName.INDUSTRIAL_COMPLEX,
      tags: [Tag.BUILDING],

      startingMegacredits: -INDUSTRIAL_COMPLEX_PRICE,

      metadata: {
        cardNumber: 'P52',
        // EXECUTION order (the rise, the price) — the face prints the price first; see rule 2.
        infoText: [
          {text: 'Increase every production of yours lower than 1 to 1 (M€ production −5 rises by 6).', tokens: ['production(']},
          {text: 'Lose 18 M€ — paid after the rise, so Manutech’s gains count toward it.', tokens: ['megacredits']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(-INDUSTRIAL_COMPLEX_PRICE).production((pb) => pb.one(1)).asterix();
        }),
        description: 'Lose 18 M€. INCREASE ALL YOUR PRODUCTIONS THAT ARE LOWER THAN 1, TO 1.',
      },
    });
  }

  /** Rule 1 — the lines the play raises, in the engine's order (`Units.keys`), with their honest deltas. */
  public raises(player: IPlayer): Array<IndustrialComplexRaise> {
    const out: Array<IndustrialComplexRaise> = [];
    for (const key of Units.keys) {
      const from = player.production[key];
      if (from < INDUSTRIAL_COMPLEX_FLOOR) {
        out.push({resource: key as Resource, from, delta: INDUSTRIAL_COMPLEX_FLOOR - from});
      }
    }
    return out;
  }

  /** Rule 3 — what Manutech hands back BEFORE the bill, in M€ the bill accepts. */
  private manutechRefund(player: IPlayer): number {
    if (!player.tableau.has(CardName.MANUTECH)) {
      return 0;
    }
    let refund = 0;
    for (const {resource, delta} of this.raises(player)) {
      if (resource === Resource.MEGACREDITS) {
        refund += delta;
      } else if (resource === Resource.HEAT && player.canUseHeatAsMegaCredits) {
        refund += delta;
      } else if (resource === Resource.TITANIUM && player.canUseTitaniumAsMegacredits) {
        refund += delta * (player.getTitaniumValue() - 1);
      }
    }
    return refund;
  }

  /** The bill the affordability question asks — the price, any price held back before it, less the refund. */
  private billOptions(player: IPlayer, canAffordOptions?: CanAffordOptions): CanAffordOptions {
    const held = canAffordOptions?.cost ?? 0;
    return {...canAffordOptions, cost: Math.max(0, held + INDUSTRIAL_COMPLEX_PRICE - this.manutechRefund(player))};
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions) {
    return player.canAfford(this.billOptions(player, canAffordOptions));
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    return actionReason.needMoreMCFor(player, this.billOptions(player));
  }

  private payment(player: IPlayer): SelectPaymentDeferred {
    return new SelectPaymentDeferred(player, INDUSTRIAL_COMPLEX_PRICE, {cause: cardSource(this)});
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    const raises = this.raises(player);
    const effects = [
      ...raises.map((r) => actionPreviews.productionChange(player, r.resource, r.delta)),
      actionPreviews.stockCost(player, Resource.MEGACREDITS, INDUSTRIAL_COMPLEX_PRICE),
    ];
    const unchanged = Units.keys.filter((key) => player.production[key] >= INDUSTRIAL_COMPLEX_FLOOR);
    const note = unchanged.length === 0 ? undefined : actionPreviews.noteStep('generic',
      message(INDUSTRIAL_COMPLEX_UNCHANGED[unchanged.length - 1], (b) => {
        for (const key of unchanged) {
          b.resource(key as Resource).number(player.production[key]);
        }
      }));
    return actionPreviews.playPreview(this, player, effects, [note, actionPreviews.paymentStep(player, INDUSTRIAL_COMPLEX_PRICE, {cause: cardSource(this)})]);
  }

  public override bespokePlay(player: IPlayer) {
    const production = {...Units.EMPTY};
    for (const {resource, delta} of this.raises(player)) {
      production[resource as keyof Units] = delta;
    }
    player.production.adjust(production, {log: true});

    player.game.defer(this.payment(player)).andThen(() => {
      player.game.log('${0} loses ${1} M€ for ${2}', (b) => b.player(player).number(INDUSTRIAL_COMPLEX_PRICE).card(this));
    });
    return undefined;
  }
}
