import {expect} from 'chai';
import {IGame} from '@/server/IGame';
import {Game} from '@/server/Game';
import {Server} from '@/server/models/ServerModel';
import {NirgalEnterprises} from '@/server/cards/prelude2/NirgalEnterprises';
import {VanAllen} from '@/server/cards/ceos/VanAllen';
import {Vitor} from '@/server/cards/prelude/Vitor';
import {StagedProtests} from '@/server/cards/underworld/StagedProtests';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectOption} from '@/server/inputs/SelectOption';
import {PlayerInput} from '@/server/PlayerInput';
import {serializeFundedAwards, deserializeFundedAwards} from '@/server/awards/FundedAward';
import {CardName} from '@/common/cards/CardName';
import {MILESTONE_COST} from '@/common/constants';
import {GameEvent} from '@/common/events/GameEvent';
import {effectOverlayStats} from '@/common/events/aggregate';
import {buildEndgameFacts} from '@/common/events/endgameFacts';
import {cast} from '@/common/utils/utils';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';

/**
 * PC01 Nirgal Enterprises · ledger GO — THE PRICE OF A MILESTONE / AN AWARD NAMES ITS CAUSE.
 *
 * One price function (`Player.maPriceOf`) answers the table's price, the charge and the card that waived it; the numbers
 * of `milestoneCost()` / `awardFundingCost()` stay upstream's byte for byte. A waived price writes ONE `discount-applied`
 * inside the claim's / the funding's own scope (the journal's «−8» child, «Ваши эффекты», the endgame's saving come
 * from it for free) — never for Vitor's free sponsorship, never for a plain seat, never in a preview. What a slot WENT
 * for is a server fact (`paid` / `waivedBy` / `slot`) every seat reads, and it survives a save (an old save has none).
 */

function menuLeaf(input: PlayerInput, name: string): SelectOption | undefined {
  if (input instanceof SelectOption && input.title === name) {
    return input;
  }
  if (input instanceof OrOptions) {
    for (const option of input.options) {
      const found = menuLeaf(option, name);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

function claimTerraformer(player: TestPlayer): void {
  player.setTerraformRating(40);
  const milestone = player.game.milestones.find((m) => m.name.startsWith('Terraformer'))!;
  menuLeaf(player.getActions(), milestone.name)!.cb(undefined);
  runAllActions(player.game);
}

function fund(player: TestPlayer, index: number): void {
  menuLeaf(player.getActions(), player.game.awards[index].name)!.cb(undefined);
  runAllActions(player.game);
}

function discounts(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'discount-applied');
}

describe('PC01 · GO — the milestone / award price names its cause', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    [game, player, player2] = testGame(2, {ceoExtension: true, underworldExpansion: true});
    player2.megaCredits = 100;
  });

  describe('maPriceOf — ONE price function, the waiver named by the branch that returns the 0', () => {
    it('a plain seat: the table\'s price, nothing waived', () => {
      expect(player.maPriceOf('milestone')).deep.eq({printed: MILESTONE_COST, price: MILESTONE_COST});
      expect(player.maPriceOf('award')).deep.eq({printed: 8, price: 8});
    });

    it('Nirgal Enterprises waives both kinds', () => {
      player.playedCards.push(new NirgalEnterprises());
      expect(player.maPriceOf('milestone')).deep.eq({printed: 8, price: 0, waivedBy: CardName.NIRGAL_ENTERPRISES});
      expect(player.maPriceOf('award')).deep.eq({printed: 8, price: 0, waivedBy: CardName.NIRGAL_ENTERPRISES});
    });

    it('Van Allen waives the claim only', () => {
      player.playedCards.push(new VanAllen());
      expect(player.maPriceOf('milestone')).deep.eq({printed: 8, price: 0, waivedBy: CardName.VANALLEN});
      expect(player.maPriceOf('award')).deep.eq({printed: 8, price: 8});
    });

    it('both on the table: the claim names the card upstream\'s condition checks first (Van Allen)', () => {
      player.playedCards.push(new VanAllen());
      player.playedCards.push(new NirgalEnterprises());
      expect(player.maPriceOf('milestone').waivedBy).eq(CardName.VANALLEN);
      expect(player.maPriceOf('award').waivedBy).eq(CardName.NIRGAL_ENTERPRISES);
    });

    it('a surcharge is part of the PRINTED price — and waived whole («ALWAYS»)', () => {
      const protests = new StagedProtests();
      player2.playedCards.push(protests);
      protests.generationUsed = game.generation;
      expect(player.maPriceOf('milestone')).deep.eq({printed: 16, price: 16});
      player.playedCards.push(new NirgalEnterprises());
      expect(player.maPriceOf('milestone')).deep.eq({printed: 16, price: 0, waivedBy: CardName.NIRGAL_ENTERPRISES});
      expect(player.maPriceOf('award')).deep.eq({printed: 16, price: 0, waivedBy: CardName.NIRGAL_ENTERPRISES});
    });

    it('milestoneCost / awardFundingCost ARE its price — upstream\'s numbers unchanged', () => {
      expect(player.milestoneCost()).eq(8);
      expect(player.awardFundingCost()).eq(8);
      fund(player2, 0);
      expect(player.awardFundingCost()).eq(14);
      player.playedCards.push(new NirgalEnterprises());
      expect(player.milestoneCost()).eq(0);
      expect(player.awardFundingCost()).eq(0);
    });
  });

  describe('the saving is RECORDED — one discount-applied inside the claim\'s / the funding\'s own scope', () => {
    beforeEach(() => {
      player.playCorporationCard(new NirgalEnterprises());
      runAllActions(game);
      player.megaCredits = 0;
    });

    it('a claim: one −8 under the milestone\'s root, named Nirgal Enterprises, tagged as the corporation\'s passive effect', () => {
      claimTerraformer(player);
      const [discount, ...rest] = discounts(game);
      expect(rest, 'one record per claim').is.empty;
      expect(discount.impact.megacreditsSaved).eq(8);
      expect(discount.source).deep.eq({kind: 'corporation', card: CardName.NIRGAL_ENTERPRISES, owner: player.color});
      expect(discount.player).eq(player.color);
      expect(discount.tags).to.include.members(['discount', 'corporation', 'passive-effect']);
      const root = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'milestone');
      expect(root, 'the claim\'s root').is.not.undefined;
      expect(discount.correlationId, 'under the claim\'s root').eq(root!.correlationId);
    });

    it('three fundings: 8 · 14 · 20 saved, each under its own award root', () => {
      fund(player, 0);
      fund(player, 1);
      fund(player, 2);
      const saved = discounts(game).map((e) => e.impact.megacreditsSaved);
      expect(saved).deep.eq([8, 14, 20]);
      const roots = game.events.events.filter((e) => e.type === 'action' && e.source?.kind === 'award');
      expect(discounts(game).map((e) => e.correlationId)).deep.eq(roots.map((e) => e.correlationId));
    });

    it('«Ваши эффекты» count the firings and the M€ saved; the endgame\'s saving knows it', () => {
      claimTerraformer(player);
      fund(player, 0);
      fund(player, 1);
      const stat = effectOverlayStats(game.events.events, player.color).find((s) => s.card === CardName.NIRGAL_ENTERPRISES);
      expect(stat, 'the corporation\'s effect stat').is.not.undefined;
      expect(stat!.triggerCount).eq(3);
      expect(stat!.megacreditsSaved).eq(8 + 8 + 14);
      const biggest = buildEndgameFacts(game.events.events).find((f) => f.id.includes('biggestDiscount'));
      expect(biggest?.metrics.megacreditsSaved).eq(14);
      expect(biggest?.player).eq(player.color);
    });

    it('a preview records nothing — the model\'s prices and bills are read-only', () => {
      const before = game.events.events.length;
      Server.getPlayerModel(player);
      Server.getAwards(game);
      expect(game.events.events.length).eq(before);
    });
  });

  describe('no record where nothing was waived', () => {
    it('a plain seat\'s paid claim and funding write no discount', () => {
      player.megaCredits = 100;
      claimTerraformer(player);
      fund(player, 0);
      expect(discounts(game)).is.empty;
    });

    it('Vitor\'s free sponsorship is FREE by its own rule — no saving, even with Nirgal on the table (Merger)', () => {
      player.playedCards.push(new NirgalEnterprises());
      const action = cast(new Vitor().initialAction(player), OrOptions);
      action.options[0].cb();
      runAllActions(game);
      expect(discounts(game)).is.empty;
      expect(game.fundedAwards[0].paid).eq(0);
      expect(game.fundedAwards[0].waivedBy).is.undefined;
    });
  });

  describe('the model', () => {
    it('maCosts states the printed prices and the waiver beside a waiver — and nothing for a plain seat', () => {
      expect(Server.getPlayerModel(player).maCosts).deep.eq({milestone: 8, award: 8});
      player.playedCards.push(new NirgalEnterprises());
      fund(player2, 0);
      const costs = Server.getPlayerModel(player).maCosts!;
      expect(costs.milestone).eq(0);
      expect(costs.award).eq(0);
      expect(costs.printed).deep.eq({milestone: 8, award: 14});
      expect(costs.waiver).deep.eq({milestone: CardName.NIRGAL_ENTERPRISES, award: CardName.NIRGAL_ENTERPRISES});
      expect(costs.payments, 'a 0 bill never asks — no preview').is.undefined;
    });

    it('every seat reads what each funded slot WENT for, in funding order', () => {
      player.playedCards.push(new NirgalEnterprises());
      fund(player2, 2); // the first funding — 8, by the rival
      fund(player, 0); // the second — 14 waived by Nirgal
      const awards = Server.getAwards(game);
      expect(awards[2]).to.include({slot: 0, paid: 8});
      expect(awards[2].waivedBy).is.undefined;
      expect(awards[0]).to.include({slot: 1, paid: 0, waivedBy: CardName.NIRGAL_ENTERPRISES});
      expect(awards[1].slot).is.undefined;
      expect(awards[1].paid).is.undefined;
    });
  });

  describe('the slot\'s price survives a save', () => {
    it('round-trips paid / waivedBy', () => {
      player.playedCards.push(new NirgalEnterprises());
      fund(player, 0);
      const serialized = serializeFundedAwards(game.fundedAwards);
      expect(serialized[0]).deep.eq({name: game.awards[0].name, playerId: player.id, paid: 0, waivedBy: CardName.NIRGAL_ENTERPRISES});
      const back = deserializeFundedAwards(serialized, game.players.slice(), game.awards);
      expect(back[0].paid).eq(0);
      expect(back[0].waivedBy).eq(CardName.NIRGAL_ENTERPRISES);
    });

    it('an old save carries no price facts — the fields stay absent (the ladder prints the rules\' price)', () => {
      const serialized = game.serialize();
      serialized.fundedAwards = [{name: game.awards[0].name, playerId: player.id}];
      const loaded = Game.deserialize(serialized);
      expect(loaded.fundedAwards[0].paid).is.undefined;
      expect(loaded.fundedAwards[0].waivedBy).is.undefined;
      const model = Server.getAwards(loaded)[0];
      expect(model.slot).eq(0);
      expect(model.paid).is.undefined;
    });
  });
});
