import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {Resource} from '../../../common/Resource';
import {Phase} from '../../../common/Phase';
import {OncePerAction} from '@/server/utils/OncePerAction';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastGrant} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** What one action that raises any production pays — read by the live hook and its forecast twin alike. */
const PAYOUT = 2;

/**
 * P63 — SUITABLE INFRASTRUCTURE: gain 5 steel; «once per action you take, gain 2 M€ if you increase any
 * production(s)». RULE READINGS (pinned by tests/cards/prelude2/SuitableInfrastructure.spec.ts):
 *  1. ONE gate — `answers`: the card's owner is the ACTIVE player, the step is positive, the phase is ACTION or
 *     PRELUDES (each prelude played is an action of its own — `Player.takeAction` counts it). The Parliament's
 *     reward, the production phase and another seat's card raising this seat's production pay nothing.
 *  2. ONCE PER ACTION — upstream's `OncePerAction` (by `game.getActionCount()`, deliberately NOT serialized: a
 *     server restart in the middle of an action with two raises pays the second raise again — upstream's, named).
 *  3. The 2 M€ are paid SYNCHRONOUSLY with the card as their source (`from: {card: this}`): inside the hook's
 *     `production-gain` scope (the reaction record) and named in the standard log line. Upstream wrote its own
 *     `${0} gained ${1} ${2} from ${3}` line with the plain string «M€».
 *  4. The twin is HONEST about rule 2: silent where the hook is (rule 1) and for an action that has already paid
 *     (`paidThisAction`), and ONE fact per operation: the engine asks it on EVERY production chip (Industrial
 *     Microbes raises two) and in every cascade, so the fact is declared `once` under a fixed id and the engine's exit
 *     pass keeps the first (`effectForecastPreviews.oncePerOperation` — P63 · GD).
 */
export class SuitableInfrastructure extends PreludeCard {
  constructor() {
    super({
      name: CardName.SUITABLE_INFRASTRUCTURE,
      tags: [Tag.BUILDING],

      behavior: {
        stock: {steel: 5},
      },

      metadata: {
        cardNumber: 'P63',
        description: 'Gain 5 steel.',
        infoText: [
          // The printed rule runs past the caption clamp.
          {kind: 'effect-short', text: 'Once per action: +2 M€ when a production rises'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('Once per action you take, gain 2 M€ if you increase any productions.', (eb) => {
            eb.production((pb) => pb.wild(1)).asterix().startEffect.megacredits(PAYOUT);
          });
          b.br;
          b.steel(5);
        }),
      },
    });
  }

  private readonly oncePerAction = new OncePerAction();

  /** Rule 1 — THE gate, for the hook (the live active player) and the twin (the operation's actor). */
  private static answers(owner: IPlayer, actor: IPlayer, amount: number): boolean {
    const phase = owner.game.phase;
    return actor.id === owner.id && amount > 0 && (phase === Phase.ACTION || phase === Phase.PRELUDES);
  }

  /** Rule 2, read-only — the action now running has already been paid. */
  public paidThisAction(game: IGame): boolean {
    return this.oncePerAction.spent(game);
  }

  /** Rules 1 · 2 · 3. */
  public onProductionGain(player: IPlayer, _resource: Resource, amount: number) {
    if (!SuitableInfrastructure.answers(player, player.game.activePlayer, amount)) {
      return;
    }
    this.oncePerAction.oncePerAction(player.game, () => {
      player.stock.add(Resource.MEGACREDITS, PAYOUT, {log: true, from: {card: this}});
    });
  }

  /** Rule 4 — the mirror: one exact «+2 M€» per operation, never for an action that already paid. */
  public grantForecast(cardOwner: IPlayer, activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'production' || !SuitableInfrastructure.answers(cardOwner, activePlayer, grant.amount) || this.paidThisAction(cardOwner.game)) {
      return [];
    }
    return [forecast.exact(
      {...forecast.sourceOf(this, cardOwner, 'production-gain'), printedEffect: 0},
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, PAYOUT)],
      'You raise a production this action',
      {id: 'once-per-action', once: true, note: 'Once per action'})];
  }
}
