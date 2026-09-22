import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {compatibleWith, Parliament} from '../../src/server/parliament/Parliament';
import {IncompatibleParliamentSaveError} from '../../src/server/parliament/ParliamentErrors';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {PARLIAMENT_SAVE_VERSION} from '../../src/server/parliament/SerializedParliament';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {
  PARLIAMENT_DELEGATES_PER_PLAYER, PARLIAMENT_NEUTRAL_DELEGATES, PARLIAMENT_VOTE_COST, PARLIAMENT_VOTING_SLOTS, REDUX_PARTIES, ReduxParty,
  STARTER_QUEST,
} from '../../src/common/parliament/ParliamentTypes';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {SelectPayment} from '../../src/server/inputs/SelectPayment';
import {Payment} from '../../src/common/inputs/Payment';
import {Phase} from '../../src/common/Phase';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament;
  if (parliament === undefined) {
    throw new Error('no parliament');
  }
  return [game, p1, p2, parliament];
}

/** The vote option of the action menu (the SelectParty carrying the vote marker). */
function voteOption(player: TestPlayer): SelectParty | undefined {
  const option = player.getActions().options.find((o) => (o as SelectParty).votePrompt !== undefined);
  return option === undefined ? undefined : cast(option, SelectParty);
}

describe('Parliament', () => {
  describe('setup', () => {
    it('deals three resolutions of different parties, seats every free delegate in the lobby and starts with the Greens ruling', () => {
      const [game, p1, p2, parliament] = reduxGame();
      expect(parliament.slots).has.length(PARLIAMENT_VOTING_SLOTS);
      const parties = parliament.partiesInVotingArea();
      expect(new Set(parties).size).eq(PARLIAMENT_VOTING_SLOTS);
      expect(parliament.enacted).is.undefined;
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      expect(parliament.lobby.has(p1.id)).is.true;
      expect(parliament.lobby.has(p2.id)).is.true;
      expect(parliament.reserve(p1)).eq(PARLIAMENT_DELEGATES_PER_PLAYER - 1);
      expect(parliament.neutralSupply()).eq(PARLIAMENT_NEUTRAL_DELEGATES);
      expect(parliament.quest?.definition).deep.eq(STARTER_QUEST);
      expect(parliament.quest?.source).eq('starter');
      expect(parliament.quest?.generation).eq(1);
      // THE DECK IS THE SUM OF WHAT IS SHIPPED — never a fixed total and never
      // a quota per party (the Greens already carry three real resolutions).
      // Derived from the catalog THROUGH THE GAME'S OWN EXPANSION FILTER (a
      // Venus-only card is catalogued and dealt in no game without Venus), so
      // implementing the next one cannot fail a spec that only ever meant
      // «every dealt card is somewhere on the table».
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(compatibleWith(game.gameOptions.expansions)).length;
      expect(dealt).is.greaterThan(PARLIAMENT_VOTING_SLOTS);
      expect(parliament.deck.length + parliament.discard.length + PARLIAMENT_VOTING_SLOTS).eq(dealt);
    });

    it('refuses classic Turmoil alongside Redux and requires Colonies', () => {
      expect(() => testGame(2, {turmoilReduxExpansion: true, turmoilExtension: true, coloniesExtension: true})).to.throw(/mutually exclusive/);
      expect(() => testGame(2, {turmoilReduxExpansion: true})).to.throw(/Colonies/);
      const [game] = testGame(2, {turmoilExtension: true});
      expect(game.parliament).is.undefined;
      expect(game.politics?.engine).eq('classic');
    });

    it('every participant holds the ruling party\'s effect from the first generation', () => {
      const [, p1, , parliament] = reduxGame();
      expect(parliament.hasPartyEffect(p1, PartyName.GREENS)).is.true;
      expect(parliament.satisfiesPartyRequirement(p1, PartyName.GREENS)).is.true;
      expect(parliament.hasPartyEffect(p1, PartyName.REDS)).is.false;
      // Kelvinists read as the Greens (rulebook p.13) through the facade.
      expect(p1.game.politics?.hasPartyEffect(p1, PartyName.KELVINISTS)).is.true;
    });
  });

  describe('voting', () => {
    it('the first vote spends the free lobby delegate, the next one costs 5 M€ from the reserve — pay first, then place', () => {
      const [game, p1, , parliament] = reduxGame();
      const first = voteOption(p1);
      expect(first?.votePrompt).deep.eq({source: 'lobby', cost: 0});
      const party = parliament.partiesInVotingArea()[1];
      first?.cb(party);
      runAllActions(game);
      const slot = parliament.slotOf(party)!;
      expect(slot.votes.map((v) => v.owner)).deep.eq([p1.id]);
      expect(parliament.lobby.has(p1.id)).is.false;
      expect(parliament.reserve(p1)).eq(PARLIAMENT_DELEGATES_PER_PLAYER - 1);
      expect(p1.totalDelegatesPlaced).eq(1);

      p1.megaCredits = 7;
      const second = voteOption(p1);
      expect(second?.votePrompt).deep.eq({source: 'reserve', cost: PARLIAMENT_VOTE_COST});
      second?.cb(party);
      // The bill is settled through the deferred payment BEFORE the delegate moves.
      expect(slot.votes).has.length(1);
      runAllActions(game);
      expect(p1.megaCredits).eq(2);
      expect(slot.votes.map((v) => v.owner)).deep.eq([p1.id, p1.id]);
      expect(parliament.reserve(p1)).eq(PARLIAMENT_DELEGATES_PER_PLAYER - 2);
      expect(slot.votes[1].seq).greaterThan(slot.votes[0].seq);

      // Now with 2 M€ the reserve path is blocked — and the menu says why.
      expect(voteOption(p1)).is.undefined;
      const availability = parliament.canVote(p1);
      expect(availability.ok).is.false;
      expect(availability.source).eq('reserve');
      parliament.assertLedger(game);
    });

    it('a reserve vote with an alternative way to pay raises a REAL bill carrying the vote-payment marker — the delegate follows the payment', () => {
      const [game, p1, , parliament] = reduxGame();
      const party = parliament.partiesInVotingArea()[0];
      const slot = parliament.slotOf(party)!;
      parliament.placeVote(p1, slot, 'lobby');
      p1.megaCredits = 20;
      p1.heat = 6;
      p1.canUseHeatAsMegaCredits = true;
      const option = voteOption(p1);
      expect(option?.votePrompt).deep.eq({source: 'reserve', cost: PARLIAMENT_VOTE_COST});
      option?.cb(party);
      runAllActions(game);
      // The bill is a prompt (heat could pay), and it NAMES the vote it settles.
      const bill = cast(p1.popWaitingFor(), SelectPayment);
      expect(bill.toModel(p1).votePayment).deep.eq({party, cost: PARLIAMENT_VOTE_COST});
      expect(slot.votes, 'nothing moves before the bill is settled').has.length(1);
      bill.process({type: 'payment', payment: Payment.of({megacredits: PARLIAMENT_VOTE_COST})}, p1);
      runAllActions(game);
      expect(slot.votes.map((v) => v.owner)).deep.eq([p1.id, p1.id]);
      expect(p1.megaCredits).eq(15);
      expect(parliament.reserve(p1)).eq(PARLIAMENT_DELEGATES_PER_PLAYER - 2);
      parliament.assertLedger(game);
    });

    it('two own delegates on a party\'s resolution grant its effect AND satisfy its requirement; a card grant gives only the effect', () => {
      const [, p1, p2, parliament] = reduxGame();
      const party = parliament.partiesInVotingArea().find((p) => p !== PartyName.GREENS) as ReduxParty;
      const slot = parliament.slotOf(party)!;
      parliament.placeVote(p1, slot, 'lobby');
      expect(parliament.hasPartyEffect(p1, party)).is.false;
      parliament.placeVote(p1, slot, 'reserve');
      expect(parliament.hasPartyEffect(p1, party)).is.true;
      expect(parliament.satisfiesPartyRequirement(p1, party)).is.true;
      expect(parliament.hasPartyEffect(p2, party)).is.false;

      parliament.grantPartyEffect(p2, party, 'Council Seat');
      expect(parliament.hasPartyEffect(p2, party)).is.true;
      expect(parliament.satisfiesPartyRequirement(p2, party), 'a granted effect never satisfies the requirement').is.false;
      const access = parliament.access(p2, party);
      expect(access.granted).deep.eq(['Council Seat']);
      parliament.revokePartyEffect(p2, party, 'Council Seat');
      expect(parliament.hasPartyEffect(p2, party)).is.false;
    });

    it('action uses are counted per player and party and survive losing and regaining access', () => {
      const [, p1, , parliament] = reduxGame();
      const party = PartyName.REDS;
      expect(parliament.partyActionUsesLeft(p1, party)).eq(1);
      parliament.recordPartyActionUse(p1, party);
      expect(parliament.partyActionUsesLeft(p1, party)).eq(0);
      // Access comes and goes; the use stays spent until the generation boundary.
      parliament.grantPartyEffect(p1, party, 'x');
      parliament.revokePartyEffect(p1, party, 'x');
      expect(parliament.partyActionUsesLeft(p1, party)).eq(0);
      parliament.resetGenerationUses();
      expect(parliament.partyActionUsesLeft(p1, party)).eq(1);
    });
  });

  describe('leaders, ties and the winner', () => {
    it('the resolution with most delegates wins; a tie goes to the slot closer to ENACTED', () => {
      const [, p1, p2, parliament] = reduxGame();
      parliament.placeVote(p1, parliament.slots[2], 'lobby');
      parliament.placeVote(p2, parliament.slots[1], 'lobby');
      const verdict = parliament.winner()!;
      expect(verdict.slotIndex).eq(1);
      expect(verdict.tieBreak).eq('slot-priority');
      expect(verdict.player).eq(p2.id);
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      const later = parliament.winner()!;
      expect(later.slotIndex).eq(2);
      expect(later.tieBreak).is.undefined;
    });

    it('the winning player has most delegates on the card; a tie goes to the EARLIER first delegate; only neutral votes → the neutral player wins', () => {
      const [, p1, p2, parliament] = reduxGame();
      const slot = parliament.slots[0];
      parliament.placeVote(p2, slot, 'lobby'); // p2 first
      parliament.placeVote(p1, slot, 'lobby');
      parliament.placeVote(p1, slot, 'reserve');
      parliament.placeVote(p2, slot, 'reserve');
      const leader = parliament.leaderOf(slot)!;
      expect(leader.owner).eq(p2.id);
      expect(leader.votes).eq(2);
      expect(leader.tieBreak).eq('earlier-delegate');
      expect(parliament.winner()?.playerTieBreak).eq('earlier-delegate');

      const neutralOnly = parliament.slots[1];
      parliament.addNeutralVote(neutralOnly);
      parliament.addNeutralVote(neutralOnly);
      expect(parliament.leaderOf(neutralOnly)?.owner).eq('NEUTRAL');
      expect(parliament.neutralSupply()).eq(PARLIAMENT_NEUTRAL_DELEGATES - 2);
    });

    it('influence comes from the Agenda track (plus bonuses), never from delegates', () => {
      const [, p1, , parliament] = reduxGame();
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      expect(parliament.influence(p1)).eq(0);
      expect(parliament.advanceAgenda(p1)).deep.eq({from: 0, to: 1, bonus: undefined});
      expect(parliament.influence(p1)).eq(1);
      expect(parliament.advanceAgenda(p1)).deep.eq({from: 1, to: 2, bonus: 'tr'});
      expect(parliament.influence(p1)).eq(1);
      parliament.addInfluenceBonus(p1, 2);
      expect(parliament.influence(p1)).eq(3);
    });

    it('popular support caps at 3 per party and never exceeds the neutral supply', () => {
      const [, , , parliament] = reduxGame();
      expect(parliament.addPopularSupport(PartyName.REDS, 2)).eq(2);
      expect(parliament.addPopularSupport(PartyName.REDS, 2)).eq(1);
      expect(parliament.popularSupportOf(PartyName.REDS)).eq(3);
      for (const party of REDUX_PARTIES) {
        parliament.addPopularSupport(party, 3);
      }
      // 6 parties × 3 = 18 > 14 neutral delegates: the supply ran dry first.
      expect(parliament.totalPopularSupport()).eq(PARLIAMENT_NEUTRAL_DELEGATES);
      expect(parliament.neutralSupply()).eq(0);
    });
  });

  describe('serialization', () => {
    it('round-trips every field and keeps the ledger', () => {
      const [game, p1, p2, parliament] = reduxGame();
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.placeVote(p2, parliament.slots[2], 'lobby');
      parliament.addNeutralVote(parliament.slots[1]);
      parliament.addPopularSupport(PartyName.UNITY, 2);
      parliament.advanceAgenda(p1);
      parliament.addInfluenceBonus(p2, 1);
      parliament.grantPartyEffect(p1, PartyName.MARS, 'Septem Tribus');
      parliament.recordPartyActionUse(p2, PartyName.GREENS);
      parliament.chairman = p2.id;
      parliament.addQuestProgress(p1, 2);
      const restored = Game.deserialize(structuredClone(game.serialize()));
      const copy = restored.parliament!;
      expect(copy.serialize()).deep.eq(parliament.serialize());
      expect(copy.rulingParty()).eq(PartyName.GREENS);
      expect(copy.votesOf(p1.id)).eq(1);
      expect(copy.chairman).eq(p2.id);
      expect(copy.questProgressOf(p1.id)).eq(2);
      expect(copy.partyActionUsesLeft(restored.getPlayerById(p2.id), PartyName.GREENS)).eq(0);
      expect(copy.hasPartyEffect(restored.getPlayerById(p1.id), PartyName.MARS)).is.true;
      copy.assertLedger(restored);
      expect(restored.politics?.engine).eq('redux');
    });

    it('refuses a save naming an unknown resolution or a newer version — explicitly, never as an empty slot', () => {
      const [game] = reduxGame();
      const serialized = structuredClone(game.serialize());
      serialized.parliament!.slots[0].instance = 'RDX_FROM_THE_FUTURE#0';
      expect(() => Game.deserialize(serialized)).to.throw(IncompatibleParliamentSaveError);
      const newer = structuredClone(game.serialize());
      newer.parliament!.version = PARLIAMENT_SAVE_VERSION + 1;
      expect(() => Game.deserialize(newer)).to.throw(/newer/);
    });
  });
});
