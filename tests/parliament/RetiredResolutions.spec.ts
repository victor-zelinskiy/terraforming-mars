import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {IncompatibleParliamentSaveError} from '../../src/server/parliament/ParliamentErrors';
import {REDUX_RESOLUTION_CATALOG, RETIRED_RESOLUTION_IDS, TEST_CHOICE_RESOLUTION_ID} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {PARLIAMENT_VOTING_SLOTS, ReduxParty, RESOLUTION_CODE_PATTERN, ResolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';

/**
 * THE DECK IS REAL RESOLUTIONS ONLY — and an OLDER save that still carries
 * iteration 0's dummies (`RETIRED_RESOLUTION_IDS`) loads STRIPPED of them and
 * dealt back to a full table: never an error, never an empty voting area. What
 * these specs pin: every dealt card carries its printed code and no retired id
 * is catalogued; a new game holds the whole shipped deck; an older save loses
 * its retired cards everywhere (a delegate on one is home again), gets back
 * every shipped card it holds nowhere and has its voting area dealt back up by
 * the refresh's own rule; an enacted retired card leaves the government empty,
 * ends its chairman quest and hides a recap that names it; the earliest saves
 * (an area of retired cards only) reach the political phase with a real vote;
 * a phase caught in progress around a retired card fails explicitly while one
 * with retired cards only in the deck or the discard resumes untouched; a save
 * without retired cards loads exactly as saved; an unknown id still fails.
 */
const RETIRED = {
  reds: 'RDX_DUMMY_REDS_1#0',
  unity: 'RDX_DUMMY_UNITY_2#0',
  scientists: 'RDX_DUMMY_SCIENTISTS_1#0',
  mars: 'RDX_DUMMY_MARS_2#0',
  greens: 'RDX_DUMMY_GREENS_1#0',
  industrialists: 'RDX_DUMMY_INDUSTRIALISTS_2#0',
} as const;

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/**
 * Every player passes; production → the parliament; the sitting's ASSEMBLY
 * gate is answered for every seat (the harness's stale menus cleared first),
 * so the resolution's own asks stand — or, for a quiet card, the ADJOURN gate
 * is answered too and the phase is over (`parliamentArrange`).
 */
function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

/** The deck the game's own deal would make (the expansion filter included). */
function shippedFor(game: IGame): Array<ResolutionInstanceId> {
  return REDUX_RESOLUTION_CATALOG
    .dealtInstances((definition) => (definition.compatibility ?? []).every((expansion) => game.gameOptions.expansions[expansion] === true))
    .sort();
}

/** Every card the parliament holds, wherever it is — a card in two places shows twice. */
function poolOf(parliament: Parliament): Array<ResolutionInstanceId> {
  return [
    ...parliament.deck, ...parliament.discard, ...parliament.slots.map((slot) => slot.instance),
    ...(parliament.enacted === undefined ? [] : [parliament.enacted]),
  ].sort();
}

function partyOf(instance: ResolutionInstanceId): ReduxParty {
  return REDUX_RESOLUTION_CATALOG.ofInstance(instance).party;
}

/** No retired card anywhere; the area is of distinct parties, none of them the enacted one's. */
function expectCleanTable(parliament: Parliament): void {
  const retired = [...poolOf(parliament), ...(parliament.lastPhase === undefined ? [] : [parliament.lastPhase.enacted])]
    .filter((instance) => RETIRED_RESOLUTION_IDS.has(instance.split('#')[0]));
  expect(retired, 'no retired card survives the load').deep.eq([]);
  const parties = parliament.slots.map((slot) => partyOf(slot.instance));
  expect(new Set(parties).size, `the area's parties ${parties.join(', ')} are distinct`).eq(parties.length);
  if (parliament.enacted !== undefined) {
    expect(parties, 'the ruling party is never up for the vote').not.includes(partyOf(parliament.enacted));
  }
}

/** How many slots the refresh's rule can fill from `pool` — distinct parties, never the enacted one's. */
function fullAreaFor(pool: ReadonlyArray<ResolutionInstanceId>, enacted: ResolutionInstanceId | undefined): number {
  const parties = new Set(pool.map(partyOf));
  if (enacted !== undefined) {
    parties.delete(partyOf(enacted));
  }
  return Math.min(PARLIAMENT_VOTING_SLOTS, parties.size);
}

describe('RetiredResolutions', () => {
  describe('the deck of real resolutions', () => {
    it('deals REAL resolutions only: every dealt card carries its printed code, no retired id is catalogued', () => {
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt).is.not.empty;
      for (const instance of dealt) {
        expect(REDUX_RESOLUTION_CATALOG.ofInstance(instance).code, instance).matches(RESOLUTION_CODE_PATTERN);
      }
      for (const id of RETIRED_RESOLUTION_IDS) {
        expect(REDUX_RESOLUTION_CATALOG.get(id), id).is.undefined;
      }
      // What carries no code is a never-dealt fixture (the specs, the Polygon).
      for (const definition of REDUX_RESOLUTION_CATALOG.all()) {
        if (definition.code === undefined) {
          expect(definition.copies, `${definition.id} is never dealt`).eq(0);
        }
      }
    });

    it('a new game holds the whole shipped deck, and its area is as full as distinct parties allow', () => {
      const [game, , , parliament] = reduxGame();
      expect(poolOf(parliament)).deep.eq(shippedFor(game));
      expect(parliament.slots).has.length(fullAreaFor(shippedFor(game), undefined));
      expectCleanTable(parliament);
    });
  });

  describe('an older save that still carries retired resolutions', () => {
    it('loads STRIPPED of them: a delegate on one is home again, every shipped card comes back, the area is dealt back up', () => {
      const [game, p1, p2, parliament] = reduxGame();
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.placeVote(p2, parliament.slots[1], 'lobby');
      const reserveBefore = parliament.reserve(p1);
      const saved = structuredClone(game.serialize());
      const sp = saved.parliament!;
      // The iteration-0 table: a retired card in slot 0 under p1's delegate (the real
      // card it stands in for is in no pile of the save — as if it shipped later),
      // more of them in the deck and the discard.
      sp.slots[0].instance = RETIRED.reds;
      sp.deck = [...sp.deck, RETIRED.unity, RETIRED.mars];
      sp.discard = [RETIRED.scientists];
      const live = Game.deserialize(saved);
      const copy = live.parliament!;
      expectCleanTable(copy);
      expect(copy.votesOf(p1.id), 'the delegate on the retired card is home').eq(0);
      expect(copy.reserve(live.getPlayerById(p1.id))).eq(reserveBefore + 1);
      expect(copy.votesOf(p2.id), 'a real slot keeps its delegate').eq(1);
      expect(copy.slots.find((slot) => slot.votes.length > 0)?.instance).eq(parliament.slots[1].instance);
      copy.assertLedger(live);
      expect(poolOf(copy), 'the pool is the shipped deck, each card once').deep.eq(shippedFor(live));
      expect(copy.slots, 'dealt back up by the refresh\'s rule').has.length(fullAreaFor(shippedFor(live), copy.enacted));
    });

    it('an enacted retired card leaves the government empty (the Greens rule, as at the start), ends its quest and hides a recap naming it', () => {
      const [game, p1, , parliament] = reduxGame();
      // A real phase first, so the save has a recap and a posted quest.
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGeneration(game);
      settleParliamentGates(game);
      expect(parliament.phase, 'Architecture Award asks nothing').is.undefined;
      settleParliamentGates(game);
      expect(parliament.lastPhase?.enacted).eq(`${ARCHITECTURE_AWARD_ID}#0`);
      expect(parliament.quest?.source).eq(ARCHITECTURE_AWARD_ID);
      const saved = structuredClone(game.serialize());
      const sp = saved.parliament!;
      // …rewritten as an iteration-0 save: a retired card won and posted the quest.
      sp.enacted = RETIRED.scientists;
      sp.quest!.source = RETIRED.scientists.split('#')[0];
      sp.lastPhase!.enacted = RETIRED.scientists;
      sp.lastPhase!.winner.instance = RETIRED.scientists;
      const live = Game.deserialize(saved);
      const copy = live.parliament!;
      expect(copy.enacted).is.undefined;
      expect(copy.rulingParty()).eq(PartyName.GREENS);
      expect(copy.quest, 'the quest it posted ends with it').is.undefined;
      expect(copy.lastPhase, 'a recap naming it is not shown').is.undefined;
      expectCleanTable(copy);
      expect(poolOf(copy)).deep.eq(shippedFor(live));
      // No party rules by an enacted card now, so every party may come up again.
      expect(copy.slots).has.length(fullAreaFor(shippedFor(live), undefined));
    });

    it('the earliest saves — a voting area of retired cards only — reach the political phase with a real vote', () => {
      const [game, p1] = reduxGame();
      const saved = structuredClone(game.serialize());
      const sp = saved.parliament!;
      sp.slots = [
        {instance: RETIRED.reds, votes: [{owner: p1.id, seq: 1}]},
        {instance: RETIRED.unity, votes: []},
        {instance: RETIRED.scientists, votes: []},
      ];
      sp.deck = [RETIRED.mars, RETIRED.greens, RETIRED.industrialists];
      sp.discard = [];
      const live = Game.deserialize(saved);
      const copy = live.parliament!;
      expectCleanTable(copy);
      expect(poolOf(copy)).deep.eq(shippedFor(live));
      expect(copy.slots).has.length(fullAreaFor(shippedFor(live), undefined));
      copy.assertLedger(live);
      // The vote runs on the dealt-back area: whatever stands in slot 0 wins it.
      const one = live.getPlayerById(p1.id);
      const contested = copy.slots[0].instance;
      copy.placeVote(one, copy.slots[0], 'lobby');
      live.phase = Phase.ACTION;
      endGeneration(live);
      const summary = copy.phase?.summary ?? copy.lastPhase;
      expect(summary?.winner.instance).eq(contested);
    });

    it('a political phase caught IN PROGRESS around a retired card fails explicitly; one with retired cards only in the piles resumes untouched', () => {
      const [game, p1, , parliament] = reduxGame();
      seatResolution(parliament, 0, TEST_CHOICE_RESOLUTION_ID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGeneration(game);
      expect(parliament.phase?.step, 'the phase waits on the resolution\'s question').eq('effects');
      expect(parliament.slots.length).is.greaterThan(0);
      const around = structuredClone(game.serialize());
      around.parliament!.slots[0].instance = RETIRED.reds;
      expect(() => Game.deserialize(around)).to.throw(IncompatibleParliamentSaveError, /in progress/);

      const aside = structuredClone(game.serialize());
      aside.parliament!.deck = [...aside.parliament!.deck, RETIRED.unity];
      aside.parliament!.discard = [...aside.parliament!.discard, RETIRED.mars];
      const live = Game.deserialize(aside);
      const copy = live.parliament!;
      expectCleanTable(copy);
      const before = parliament.serialize();
      const after = copy.serialize();
      expect(after.phase, 'the phase resumes where it stood').deep.eq(before.phase);
      expect(after.slots, 'its own refresh deals — the area is not touched mid-phase').deep.eq(before.slots);
      expect(after.deck).deep.eq(before.deck);
      expect(after.discard).deep.eq(before.discard);
    });

    it('a save WITHOUT retired cards loads exactly as saved — even a thin area is never re-dealt', () => {
      const [game, , , parliament] = reduxGame();
      parliament.deck.push(parliament.slots[2].instance);
      parliament.slots = parliament.slots.slice(0, 2);
      const live = Game.deserialize(structuredClone(game.serialize()));
      expect(live.parliament!.serialize()).deep.eq(parliament.serialize());
    });

    it('an UNKNOWN id is still refused explicitly — stripping the retired ones never swallows it', () => {
      const [game] = reduxGame();
      const saved = structuredClone(game.serialize());
      saved.parliament!.deck = [...saved.parliament!.deck, RETIRED.reds, 'RDX_FROM_THE_FUTURE#0'];
      expect(() => Game.deserialize(saved)).to.throw(IncompatibleParliamentSaveError, /RDX_FROM_THE_FUTURE/);
    });
  });
});
