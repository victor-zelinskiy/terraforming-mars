import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {all} from '../Options';
import {message} from '../../logs/MessageBuilder';
import {ActionPreview, TableImpactRow} from '../../../common/models/ActionPreviewModel';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as actionPreviews from '../actionPreviews';
import {computeTargetImpact} from '../../inputs/targetImpact';
import {AutomaTargeting} from '../../automa/AutomaTargeting';
import {recordSkippedEffect} from '../../deferredActions/skippedEffect';

/** What every opponent loses — the printed numbers, read by the play, the gate, the preview and the record alike. */
const STOCK_LOSS = 5;
const PRODUCTION_LOSS = 1;
/** M€ production floors at −5 (`productionFloor`): a HUMAN opponent there cannot lose the printed step. */
const MC_PRODUCTION_FLOOR = -5;

/** The spared part's reasons — the preview's row and the live record say the same words. */
const PRODUCTION_PROTECTED = 'Production is protected';
const TRACK_CANNOT_REGRESS = 'The track cannot regress';

export class Recession extends PreludeCard {
  constructor() {
    super({
      name: CardName.RECESSION,

      behavior: {
        stock: {megacredits: 10},
      },

      metadata: {
        cardNumber: 'P59',
        // The printed order (the scan's row): the table's loss first, the gain last. The two losses are BESPOKE, so the
        // whole on-play zone is authored (an `immediate` entry replaces the derived one).
        infoText: [
          {text: 'Each opponent loses 5 M€.', tokens: ['megacredits']},
          {text: 'Each opponent decreases their M€ production 1 step.', tokens: ['production(megacredits', 'production(']},
          {text: 'Gain 10 M€.', tokens: ['megacredits']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(-5, {all}).asterix().production((pb) => pb.megacredits(-1, {all})).asterix().megacredits(10);
        }),
        description: 'EACH OPPONENT loses 5 M€ and their M€ production decreases 1 step. You gain 10 M€.',
      },
    });
  }

  /**
   * The HUMAN opponents already at the floor of M€ production — the printed «decreases 1 step» cannot be done to them,
   * and upstream's rule keeps the card in hand then (the print asks it of EACH opponent). MarsBot never locks the card:
   * it has no production — its track regresses if it can, and the step is NAMED skipped if it cannot (the home rule).
   */
  private floorVictims(player: IPlayer): ReadonlyArray<IPlayer> {
    return player.opponents.filter((target) => !target.isMarsBot && target.production.megacredits <= MC_PRODUCTION_FLOOR);
  }

  public override bespokeCanPlay(player: IPlayer) {
    return this.floorVictims(player).length === 0;
  }

  /** The seat that keeps the card in hand, NAMED with its colour (invariant 2 — a locked card carries its reason). */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const victim = this.floorVictims(player)[0];
    if (victim === undefined) {
      return undefined;
    }
    return {
      type: 'production',
      message: '${0}: M€ production is already at −5',
      params: [victim.name],
      resource: Resource.MEGACREDITS,
      seat: {name: victim.name, color: victim.color},
    };
  }

  /**
   * Why `target` keeps its production — undefined when the step lands. A human is protected by Private Security
   * (`canHaveProductionReduced` — the floor is the gate's, never reached here); MarsBot's M€ step is its track's.
   */
  private productionSpared(player: IPlayer, target: IPlayer): string | undefined {
    if (target.canHaveProductionReduced(Resource.MEGACREDITS, PRODUCTION_LOSS, player)) {
      return undefined;
    }
    return target.isMarsBot ? TRACK_CANNOT_REGRESS : PRODUCTION_PROTECTED;
  }

  public override bespokePlay(player: IPlayer) {
    for (const target of player.opponents) {
      if (target.isMarsBot) {
        // The bot is hit through ITS OWN doors — never `stock.deduct` on its placeholder M€: the supply (+ the Luna
        // area) through `removeFromBot`, the production through its track (`Production.add` regresses it). The bot
        // has no Underworld defence to ask.
        AutomaTargeting.removeFromBot(target, player, Resource.MEGACREDITS, STOCK_LOSS, {log: true});
        this.hitProduction(player, target);
        continue;
      }
      const m = message('Lose 5 M€ and 1 M€ production');
      target.maybeBlockAttack(player, m, (proceed) => {
        if (proceed) {
          // The printed order — the M€, then the production — so the victim's one red card reads its chips as printed.
          target.stock.deduct(Resource.MEGACREDITS, Math.min(target.megaCredits, STOCK_LOSS), {log: true, from: {player}});
          this.hitProduction(player, target);
        }
        return undefined;
      });
    }
    return undefined;
  }

  /** The production half: the step through the engine, or the spared step NAMED (no silent loss — invariant 4). */
  private hitProduction(player: IPlayer, target: IPlayer): void {
    const spared = this.productionSpared(player, target);
    if (spared === undefined) {
      target.production.add(Resource.MEGACREDITS, -PRODUCTION_LOSS, {log: true, from: {player}});
      return;
    }
    recordSkippedEffect(player, spared, {
      label: message('M€ production of ${0}', (b) => b.player(target)),
      effect: actionPreviews.skippedAttackChip('megacredits', PRODUCTION_LOSS, 'production'),
    });
  }

  /**
   * THE VICTIMS BEFORE THE PRESS (invariant 3 — no hidden target even with no choice): every opponent a row of the
   * server's own `current → resulting` — the M€ and the production (MarsBot: its supply and its TRACK, verbatim) — and a
   * spared step named on its row. A table with no opponent says so; the +10 M€ come from `behavior` by themselves.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const rows: Array<TableImpactRow> = player.opponents.map((target) => {
      const spared = this.productionSpared(player, target);
      const stock = computeTargetImpact(target, Resource.MEGACREDITS, STOCK_LOSS, 'stock');
      const production = spared === undefined ? computeTargetImpact(target, Resource.MEGACREDITS, PRODUCTION_LOSS, 'production').changes : [];
      return {
        color: target.color,
        impact: {color: target.color, changes: [...stock.changes, ...production]},
        ...(spared === undefined ? {} : {skipped: {scope: 'production' as const, icon: 'megacredits', amount: PRODUCTION_LOSS, reason: spared}}),
      };
    });
    const step = rows.length > 0 ?
      actionPreviews.tableImpactStep('Opponents', rows) :
      {kind: 'note' as const, noteKind: 'generic' as const, text: 'No opponents — only the +10 M€'};
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}
