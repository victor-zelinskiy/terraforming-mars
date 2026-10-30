import {expect} from 'chai';
import {EnvoysFromVenus} from '../../../src/server/cards/prelude2/EnvoysFromVenus';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, testGame} from '../../TestingUtils';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {cast} from '../../../src/common/utils/utils';
import {IGame} from '@/server/IGame';
import {fakeCard} from '../../TestingUtils';
import {VenusGovernor} from '@/server/cards/venusNext/VenusGovernor';
import {Dirigibles} from '@/server/cards/venusNext/Dirigibles';
import {ResearchCoordination} from '@/server/cards/prelude/ResearchCoordination';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {Parliament} from '@/server/parliament/Parliament';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {unplayableReasons} from '@/server/models/unplayableReasons';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Phase} from '@/common/Phase';
import {DELEGATE_ICON} from '@/common/parliament/ParliamentTypes';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('EnvoysFromVenus', () => {
  let card: EnvoysFromVenus;
  let player: TestPlayer;
  let turmoil: Turmoil;

  beforeEach(() => {
    card = new EnvoysFromVenus();
    [/* game */, player] = testGame(1, {turmoilExtension: true});
    turmoil = player.game.turmoil!;
  });

  it('canPlay', () => {
    player.megaCredits = card.cost;

    player.tagsForTest = {venus: 2};
    expect(player.canPlay(card)).is.false;

    player.tagsForTest = {venus: 3};
    expect(player.canPlay(card)).is.true;

    turmoil.delegateReserve.clear();
    expect(player.canPlay(card)).is.false;
  });


  it('play', () => {
    expect(turmoil.getAvailableDelegateCount(player)).eq(7);
    const marsFirst = turmoil.getPartyByName(PartyName.MARS);
    expect(marsFirst.delegates.get(player)).eq(0);
    card.play(player);
    runAllActions(player.game);
    const action = cast(player.getWaitingFor(), SelectParty);
    action.cb(marsFirst.name);

    expect(turmoil.getAvailableDelegateCount(player)).eq(5);
    expect(marsFirst.delegates.get(player)).eq(2);
  });
});

/**
 * P72 — ENVOYS FROM VENUS IN THE PREMIUM SCOPE: the TENTH Prelude 2 card adapted IN PLACE, the sixth POLITICAL one
 * and the first EVENT whose whole play is a delegate grant (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 1 + 5). The
 * rules did not change: the requirement counts the player's own Venus tags (`TagCardRequirement`, the wild ones
 * included, an event's not), the two delegates go through the political FACADE — availability
 * `politics.delegatesInReserve`, the placement `politics.placeDelegates` → the shared grant step
 * (`PlaceDelegatesOnResolution`): both from the reserve onto ONE resolution of the VOTING AREA. Under Redux «place
 * delegates in 1 party» means «add them to one resolution up for the vote» — never the enacted law. The work was the
 * marker, the Redux voice of the text (and the face without the classic asterisk) and the grant's flight.
 */
describe('EnvoysFromVenus — on a Turmoil Redux table', () => {
  const U = PartyName.UNITY;
  const G = PartyName.GREENS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: EnvoysFromVenus};

  /**
   * A two-seat Redux + Prelude 2 + Venus table (Colonies on) in the action phase, the card in hand, 20 M€, three
   * QUIET real resolutions up for the vote and Unity's law enacted (a fresh table's Greens answer rating steps only,
   * which this card has none of — Unity keeps the rules read plain).
   */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new EnvoysFromVenus();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    const parliament = game.parliament!;
    ([PartyName.MARS, G, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(U));
    expect(parliament.rulingParty()).eq(U);
    return {game, p1, p2, parliament, card};
  }

  /** Three Venus tags on p1's table: Venus Governor (two) and Dirigibles. */
  function threeVenus(t: Table): void {
    t.p1.playedCards.push(new VenusGovernor(), new Dirigibles());
  }

  /** Leave exactly `n` delegates in p1's reserve (the rest stand on the last slot). */
  function drainReserve(t: Table, n: number): void {
    const slot = t.parliament.slots[t.parliament.slots.length - 1];
    while (t.parliament.reserve(t.p1) > n) {
      t.parliament.placeVote(t.p1, slot, 'reserve');
    }
  }

  /** Play the card for real (past the requirement gate) and stop at its only question — the grant. */
  function playToGrant(t: Table): SelectParty {
    t.p1.playCard(t.card);
    runAllActions(t.game);
    return cast(t.p1.getWaitingFor(), SelectParty);
  }

  it('rule 1 — the printed card: red, 1, Venus, no VP, the plate «3 Venus tags», P72; political, marked for Redux', () => {
    const c = new EnvoysFromVenus();
    expect(c.name).eq(CardName.ENVOYS_FROM_VENUS);
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(1);
    expect(c.tags).deep.eq([Tag.VENUS]);
    expect(c.victoryPoints).is.undefined;
    expect(c.metadata.cardNumber).eq('P72');
    expect(c.behavior).deep.eq({turmoil: {sendDelegates: {count: 2}}});
    expect(c.metadata.description, 'the Redux voice — the generator\'s own grant sentence')
      .eq('Requires 3 Venus tags. Add 2 delegates to one resolution.');
    expect(Object.prototype.hasOwnProperty.call(EnvoysFromVenus.prototype, 'bespokePlay'), 'wholly declarative').is.false;
    expect(JSON.stringify(c.metadata.renderData), 'the scan prints no asterisk — the classic footnote does not exist under Redux')
      .not.contains('asterix');
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.ENVOYS_FROM_VENUS];
    expect(spec?.compatibility).deep.eq(['turmoil', 'venus']);
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
  });

  describe('rule 2 — the requirement: 3 of YOUR Venus tags', () => {
    it('two Venus tags: unplayable, the reason COUNTS them («Requires 3 tag(s)», current 2)', () => {
      const t = table();
      t.p1.playedCards.push(new VenusGovernor());
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({type: 'tag', params: ['3'], tag: Tag.VENUS, current: 2});
    });

    it('three Venus tags: playable, no reason', () => {
      const t = table();
      threeVenus(t);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a WILD tag of the player\'s own counts (two Venus + Research Coordination)', () => {
      const t = table();
      t.p1.playedCards.push(new VenusGovernor(), new ResearchCoordination());
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('an opponent\'s Venus tags and an EVENT\'s Venus tag do not count', () => {
      const t = table();
      t.p2.playedCards.push(new VenusGovernor(), new Dirigibles());
      t.p1.playedCards.push(new VenusGovernor());
      t.p1.playedCards.push(fakeCard({name: 'venus event' as CardName, type: CardType.EVENT, tags: [Tag.VENUS]}));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({tag: Tag.VENUS, current: 2});
    });
  });

  describe('rule 3 — the reserve: 2 delegates must be there to place', () => {
    it('one in the reserve: unplayable, the reason COUNTS it «Delegates in your reserve: 1 of 2»', () => {
      const t = table();
      threeVenus(t);
      drainReserve(t, 1);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([
        {type: 'party', message: 'Delegates in your reserve: ${0} of ${1}', params: ['1', '2'], current: 1},
      ]);
    });

    it('exactly two in the reserve: playable — and the lobby\'s cube is not the reserve', () => {
      const t = table();
      threeVenus(t);
      drainReserve(t, 2);
      expect(t.parliament.lobby.has(t.p1.id)).is.true;
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('paid with M€ — and, a Venus tag, with Dirigibles\' floaters; never steel or titanium', () => {
      const t = table();
      const options = t.p1.paymentOptionsForCard(t.card);
      expect(options.floaters).is.true;
      expect(options.steel).is.false;
      expect(options.titanium).is.false;
    });
  });

  describe('rule 4 — the play: 2 delegates on ONE resolution of the voting area', () => {
    it('ONE grant prompt for 2, the giver named, every resolution UP FOR THE VOTE shown', () => {
      const t = table();
      threeVenus(t);
      const select = playToGrant(t);
      expect(select.parties).to.have.members(t.parliament.partiesInVotingArea());
      expect(select.parties).to.have.length(3);
      expect(select.votePrompt?.source).eq('grant');
      expect(select.votePrompt?.count).eq(2);
      expect(select.votePrompt?.printed).eq(2);
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.ENVOYS_FROM_VENUS}, mode: 'reward'});
    });

    it('«in 1 party» under Redux is a resolution UP FOR THE VOTE — the enacted law is never offered', () => {
      const t = table();
      threeVenus(t);
      const select = playToGrant(t);
      expect(t.parliament.rulingParty()).eq(U);
      expect(select.parties).not.include(U);
    });

    it('both cubes leave the RESERVE for the ONE chosen resolution; the lobby is untouched; the ledger holds', () => {
      const t = table();
      threeVenus(t);
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
      expect(t.p1.tableau.has(CardName.ENVOYS_FROM_VENUS)).is.true;
      t.parliament.assertLedger(t.game);
    });

    it('the played event\'s own Venus tag never joins the count (an event lies face down)', () => {
      const t = table();
      threeVenus(t);
      expect(t.p1.tags.count(Tag.VENUS, 'raw')).eq(3);
      playToGrant(t);
      t.p1.process({type: 'party', partyName: G});
      runAllActions(t.game);
      expect(t.p1.tags.count(Tag.VENUS, 'raw')).eq(3);
    });

    it('no resolution up for the vote: the card is played, the grant is a NAMED journal line', () => {
      const t = table();
      threeVenus(t);
      t.parliament.slots = [];
      expect(t.p1.canPlay(t.card)).is.true;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.tableau.has(CardName.ENVOYS_FROM_VENUS)).is.true;
      expect(t.game.gameLog.map((m) => m.message)).contains('${0} cannot add delegates to a resolution: no resolution is up for a vote');
    });
  });

  describe('rule 5 — the play preview: the reserve −2, the vote as a live follow-up', () => {
    it('chip «−2 delegates · from the reserve»; the steps: the grant for 2 (no board door); read-only', () => {
      const t = table();
      threeVenus(t);
      const reserve = t.parliament.reserve(t.p1);
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind).eq('declarative');
      const branch = preview.branches[0];
      expect(branch.effects.find((e) => e.icon === DELEGATE_ICON)).deep.include({direction: 'cost', amount: 2, current: reserve, resulting: reserve - 2});
      expect(branch.steps).deep.eq([{kind: 'delegateGrantFollowUp', count: 2, printed: 2}]);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('an empty voting area: no vote is promised — the NAMED skip instead', () => {
      const t = table();
      threeVenus(t);
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

    it('dealt with Turmoil Redux + Prelude 2 + Venus (the marker); absent without Prelude 2 or Venus; off the hold-back list', () => {
      const redux = {turmoilReduxExpansion: true, coloniesExtension: true};
      expect(dealt({...redux, venusNextExtension: true, prelude2Expansion: true})).include(CardName.ENVOYS_FROM_VENUS);
      expect(dealt({...redux, venusNextExtension: true, prelude2Expansion: false})).not.include(CardName.ENVOYS_FROM_VENUS);
      expect(dealt({...redux, venusNextExtension: false, prelude2Expansion: true})).not.include(CardName.ENVOYS_FROM_VENUS);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.ENVOYS_FROM_VENUS)).is.false;
    });

    it('save / reload under the grant: the event is played, the reserve untouched (T03\'s shape)', () => {
      const t = table();
      threeVenus(t);
      const reserve = t.parliament.reserve(t.p1);
      playToGrant(t);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.tableau.has(CardName.ENVOYS_FROM_VENUS)).is.true;
      expect(reloaded.parliament!.reserve(owner)).eq(reserve);
    });

    it('MarsBot at the table (the card brought in by hand): the human\'s grant is the ordinary one', () => {
      const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.MARS, G, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      seatEnacted(parliament, quietResolutionOf(U));
      const c = new EnvoysFromVenus();
      human.cardsInHand.push(c);
      human.playedCards.push(new VenusGovernor(), new Dirigibles());
      human.megaCredits = 20;
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
