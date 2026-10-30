import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {SponsoringNation} from '../../../src/server/cards/prelude2/SponsoringNation';
import {runAllActions} from '../../TestingUtils';
import {assertAddDelegateAction} from '../../turmoil/turmoilAssertions';
import {cast} from '../../../src/common/utils/utils';
import {IGame} from '@/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {fakeCard} from '../../TestingUtils';
import {Sponsors} from '@/server/cards/base/Sponsors';
import {Cartel} from '@/server/cards/base/Cartel';
import {LunaGovernor} from '@/server/cards/colonies/LunaGovernor';
import {ResearchCoordination} from '@/server/cards/prelude/ResearchCoordination';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {Parliament} from '@/server/parliament/Parliament';
import {SelectParty} from '@/server/inputs/SelectParty';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {unplayableReasons} from '@/server/models/unplayableReasons';
import {ratingVetoed} from '@/server/parliament/ratingVetoGate';
import {UNMI_VETO_ID} from '@/server/parliament/resolutions/reds/UnmiVeto';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Phase} from '@/common/Phase';
import {PartyName} from '@/common/turmoil/PartyName';
import {DELEGATE_ICON} from '@/common/parliament/ParliamentTypes';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('SponsoringNation', () => {
  it('canPlay', () => {
    const card = new SponsoringNation();
    const [/* game */, player] = testGame(1, {turmoilExtension: true});

    player.tagsForTest = {earth: 3};

    expect(card.canPlay(player)).is.false;

    player.tagsForTest = {earth: 4};

    expect(card.canPlay(player)).is.true;
  });

  it('play', () => {
    const card = new SponsoringNation();
    const [game, player] = testGame(1, {turmoilExtension: true});

    expect(player.terraformRating).eq(14);

    cast(card.play(player), undefined);

    expect(player.terraformRating).eq(17);

    runAllActions(game);

    assertAddDelegateAction(player, player.popWaitingFor(), 2);
  });
});

/**
 * P83 — SPONSORING NATION IN THE PREMIUM SCOPE: the EIGHTH Prelude 2 card adapted IN PLACE, the fourth POLITICAL
 * one and the first declarative PLAY whose delegate grant is a LIVE follow-up with no board door
 * (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 1 + 5). The rules did not change: the requirement counts the
 * player's own Earth tags (`TagCardRequirement`, the wild ones included), the rating is `behavior.tr`, the two
 * delegates go through the political FACADE — availability `politics.delegatesInReserve`, the placement
 * `politics.placeDelegates` → the shared grant step (`PlaceDelegatesOnResolution`, T03's and TR03's body): both
 * from the reserve onto ONE resolution of the voting area. The work was the marker, the Redux voice of the text
 * and the play's ONE flow on the console (the vote rises as a step of the hand — ledger CX).
 */
describe('SponsoringNation — on a Turmoil Redux table', () => {
  const U = PartyName.UNITY;
  const G = PartyName.GREENS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: SponsoringNation};

  /**
   * A two-seat Redux + Prelude 2 table (Colonies on) in the action phase, the card in hand, 40 M€, three QUIET real
   * resolutions up for the vote and `ruling`'s law enacted. ⚠ A fresh Redux table opens with the GREENS ruling, whose
   * effect answers every rating step with 2 M€ — the rules below read the card under Unity, the Greens' answer has
   * its own table.
   */
  function table(ruling: typeof U | typeof G = U): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new SponsoringNation();
    p1.cardsInHand.push(card);
    p1.megaCredits = 40;
    const parliament = game.parliament!;
    const voting = ([PartyName.MARS, G, U, PartyName.SCIENTISTS] as const).filter((party) => party !== ruling).slice(0, 3);
    voting.forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(ruling));
    expect(parliament.rulingParty()).eq(ruling);
    return {game, p1, p2, parliament, card};
  }

  /** Four Earth tags on p1's table: Sponsors, Cartel and Luna Governor (two). */
  function fourEarth(t: Table): void {
    t.p1.playedCards.push(new Sponsors(), new Cartel(), new LunaGovernor());
  }

  /** Leave exactly `n` delegates in p1's reserve (the rest stand on the last slot). */
  function drainReserve(t: Table, n: number): void {
    const slot = t.parliament.slots[t.parliament.slots.length - 1];
    while (t.parliament.reserve(t.p1) > n) {
      t.parliament.placeVote(t.p1, slot, 'reserve');
    }
  }

  /** Play the card for real (past the requirement gate) and stop at its first question — the grant. */
  function playToGrant(t: Table): SelectParty {
    t.p1.playCard(t.card);
    runAllActions(t.game);
    return cast(t.p1.getWaitingFor(), SelectParty);
  }

  it('rule 1 — the printed card: green, 21, Earth, no VP, the plate «4 Earth tags», P83; political, marked for Redux', () => {
    const c = new SponsoringNation();
    expect(c.name).eq(CardName.SPONSORING_NATION);
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(21);
    expect(c.tags).deep.eq([Tag.EARTH]);
    expect(c.victoryPoints).is.undefined;
    expect(c.metadata.cardNumber).eq('P83');
    expect(c.behavior).deep.eq({tr: 3, turmoil: {sendDelegates: {count: 2}}});
    expect(c.metadata.description, 'the Redux voice — the generator\'s own grant sentence')
      .eq('Requires 4 Earth tags. Gain 3 TR. Add 2 delegates to one resolution.');
    expect(Object.prototype.hasOwnProperty.call(SponsoringNation.prototype, 'bespokePlay'), 'wholly declarative').is.false;
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.SPONSORING_NATION];
    expect(spec?.compatibility).eq('turmoil');
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
  });

  describe('rule 2 — the requirement: 4 of YOUR Earth tags', () => {
    it('three Earth tags: unplayable, the reason COUNTS them («Requires 4 tag(s)», current 3)', () => {
      const t = table();
      t.p1.playedCards.push(new Sponsors(), new LunaGovernor());
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({type: 'tag', params: ['4'], tag: Tag.EARTH, current: 3});
    });

    it('four Earth tags: playable, no reason', () => {
      const t = table();
      fourEarth(t);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a WILD tag of the player\'s own counts (three Earth + Research Coordination)', () => {
      const t = table();
      t.p1.playedCards.push(new Sponsors(), new LunaGovernor(), new ResearchCoordination());
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('the Scientists\' effect (+1 wild tag under Redux) counts too: three Earth tags and two delegates on their resolution', () => {
      const t = table();
      t.p1.playedCards.push(new Sponsors(), new LunaGovernor());
      expect(t.p1.canPlay(t.card)).is.false;
      const scientists = t.parliament.slotOf(PartyName.SCIENTISTS)!;
      t.parliament.placeVote(t.p1, scientists, 'reserve');
      t.parliament.placeVote(t.p1, scientists, 'lobby');
      expect(t.game.politics!.hasPartyEffect(t.p1, PartyName.SCIENTISTS)).is.true;
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('an opponent\'s Earth tags and an EVENT\'s Earth tag do not count', () => {
      const t = table();
      t.p2.playedCards.push(new Sponsors(), new Cartel(), new LunaGovernor());
      t.p1.playedCards.push(new Sponsors(), new LunaGovernor());
      t.p1.playedCards.push(fakeCard({name: 'earth event' as CardName, type: CardType.EVENT, tags: [Tag.EARTH]}));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({tag: Tag.EARTH, current: 3});
    });
  });

  describe('rule 3 — the reserve: 2 delegates must be there to place', () => {
    it('one in the reserve: unplayable, the reason COUNTS it «Delegates in your reserve: 1 of 2»', () => {
      const t = table();
      fourEarth(t);
      drainReserve(t, 1);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([
        {type: 'party', message: 'Delegates in your reserve: ${0} of ${1}', params: ['1', '2'], current: 1},
      ]);
    });

    it('exactly two in the reserve: playable — and the lobby\'s cube is not the reserve', () => {
      const t = table();
      fourEarth(t);
      drainReserve(t, 2);
      expect(t.parliament.lobby.has(t.p1.id)).is.true;
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('paid with M€ only (an Earth tag takes neither steel nor titanium)', () => {
      const t = table();
      const options = t.p1.paymentOptionsForCard(t.card);
      expect(options.steel).is.false;
      expect(options.titanium).is.false;
    });
  });

  describe('rule 4 — the play: 3 TR, THEN 2 delegates on ONE resolution', () => {
    it('the rating first; then ONE grant prompt for 2, the giver named, every resolution shown', () => {
      const t = table();
      fourEarth(t);
      const tr = t.p1.terraformRating;
      const select = playToGrant(t);
      expect(t.p1.terraformRating).eq(tr + 3);
      expect(select.parties).to.have.members(t.parliament.partiesInVotingArea());
      expect(select.parties).to.have.length(3);
      expect(select.votePrompt?.source).eq('grant');
      expect(select.votePrompt?.count).eq(2);
      expect(select.votePrompt?.printed).eq(2);
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.SPONSORING_NATION}, mode: 'reward'});
    });

    it('both cubes leave the RESERVE for the ONE chosen resolution; the lobby is untouched; the ledger holds', () => {
      const t = table();
      fourEarth(t);
      const reserve = t.parliament.reserve(t.p1);
      playToGrant(t);
      t.p1.process({type: 'party', partyName: G});
      runAllActions(t.game);
      const greens = t.parliament.slotOf(G)!;
      expect(t.parliament.votesOf(t.p1, greens)).eq(2);
      expect(t.parliament.votesOf(t.p1)).eq(2);
      expect(t.parliament.reserve(t.p1)).eq(reserve - 2);
      expect(t.parliament.lobby.has(t.p1.id), 'the lobby\'s cube is the generation\'s free vote, not the card\'s').is.true;
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.tableau.has(CardName.SPONSORING_NATION)).is.true;
      t.parliament.assertLedger(t.game);
    });

    it('the GREENS rule: their effect answers the three rating steps with 6 M€ — before the vote is asked', () => {
      const t = table(G);
      fourEarth(t);
      const mc = t.p1.megaCredits;
      playToGrant(t);
      expect(t.p1.megaCredits - mc, '2 M€ per TR step (`playCard` takes no payment)').eq(6);
    });

    it('no resolution up for the vote: the card is played, the TR is gained, the grant is a NAMED journal line', () => {
      const t = table();
      fourEarth(t);
      t.parliament.slots = [];
      expect(t.p1.canPlay(t.card)).is.true;
      const tr = t.p1.terraformRating;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.terraformRating).eq(tr + 3);
      expect(t.game.gameLog.map((m) => m.message)).contains('${0} cannot add delegates to a resolution: no resolution is up for a vote');
    });

    it('RX42 UNMI Veto (p1 first by rating): the 3 TR are refused and NAMED, the grant still asked', () => {
      const t = table();
      fourEarth(t);
      seatEnacted(t.parliament, UNMI_VETO_ID);
      t.p1.terraformRating = 30;
      t.p2.terraformRating = 20;
      expect(ratingVetoed(t.p1)).is.true;
      expect(t.p1.canPlay(t.card)).is.true;
      const from = t.game.events.events.length;
      const select = playToGrant(t);
      expect(t.p1.terraformRating).eq(30);
      expect(t.game.events.events.slice(from).some((e) => e.type === 'effect-skipped'), 'the refusal names itself').is.true;
      expect(select.votePrompt?.count).eq(2);
    });
  });

  describe('rule 5 — the play preview: the rating, the reserve −2, the vote as a live follow-up', () => {
    it('chips «TR N → N+3» and «−2 delegates · from the reserve»; the steps: the grant for 2 (no board door); read-only', () => {
      const t = table();
      fourEarth(t);
      const reserve = t.parliament.reserve(t.p1);
      const tr = t.p1.terraformRating;
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind).eq('declarative');
      const branch = preview.branches[0];
      expect(branch.effects.find((e) => e.icon === 'tr'), JSON.stringify(branch.effects))
        .deep.include({direction: 'gain', amount: 3, current: tr, resulting: tr + 3});
      expect(branch.effects.find((e) => e.icon === DELEGATE_ICON)).deep.include({direction: 'cost', amount: 2, current: reserve, resulting: reserve - 2});
      expect(branch.steps).deep.eq([{kind: 'delegateGrantFollowUp', count: 2, printed: 2}]);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('an empty voting area: no vote is promised — the NAMED skip instead', () => {
      const t = table();
      fourEarth(t);
      t.parliament.slots = [];
      const steps = cardPlayPreview(t.p1, t.card).branches[0].steps;
      expect(steps.map((s) => s.kind)).deep.eq(['note']);
      expect(steps[0]).deep.include({noteKind: 'warning', text: 'No resolution is up for a vote'});
    });
  });

  describe('rule 6 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2; off the hold-back list', () => {
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true})).include(CardName.SPONSORING_NATION);
      expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: false})).not.include(CardName.SPONSORING_NATION);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.SPONSORING_NATION)).is.false;
    });

    it('save / reload under the grant: the card and its TR stand, the reserve untouched (T03\'s shape)', () => {
      const t = table();
      fourEarth(t);
      const tr = t.p1.terraformRating;
      const reserve = t.parliament.reserve(t.p1);
      playToGrant(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.tableau.has(CardName.SPONSORING_NATION)).is.true;
      expect(owner.terraformRating).eq(tr + 3);
      expect(reloaded.parliament!.reserve(owner)).eq(reserve);
    });

    it('MarsBot at the table (the card brought in by hand): the human\'s grant is the ordinary one', () => {
      const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.MARS, G, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      seatEnacted(parliament, quietResolutionOf(U));
      const c = new SponsoringNation();
      human.cardsInHand.push(c);
      human.playedCards.push(new Sponsors(), new Cartel(), new LunaGovernor());
      human.megaCredits = 40;
      expect(human.canPlay(c)).is.true;
      const reserve = parliament.reserve(human);
      human.playCard(c);
      runAllActions(game);
      cast(human.getWaitingFor(), SelectParty);
      human.process({type: 'party', partyName: G});
      runAllActions(game);
      expect(parliament.reserve(human)).eq(reserve - 2);
      expect(parliament.votesOf(human, parliament.slotOf(G)!)).eq(2);
    });
  });
});
