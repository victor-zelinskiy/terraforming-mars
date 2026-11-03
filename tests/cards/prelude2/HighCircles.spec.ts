import {expect} from 'chai';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {HighCircles} from '../../../src/server/cards/prelude2/HighCircles';
import {runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Phase} from '../../../src/common/Phase';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../../src/server/createCard';
import {hasPartyRequirement} from '../../../src/server/cards/requirements/partyRequirementCards';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {DELEGATE_ICON, ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {INFLUENCE_ICON} from '../../../src/server/cards/actionPreviews';
import {drawSearchSentence} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {Game} from '../../../src/server/Game';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

/**
 * P51 — HIGH CIRCLES IN THE PREMIUM SCOPE (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 1 + 5 — DECLARATIVE + POLITICAL;
 * ledger FF): the thirty-third Prelude 2 card, the set's second political prelude. The rules on a Turmoil Redux table:
 * +1 TR; a NAMED search for 1 card with a party requirement (`partyRequirement` — the reveal, the preview chip and the
 * card text name it; exhaustion is named); 2 delegates from the reserve onto ONE resolution (never the enacted one —
 * the shared grant step); +1 influence on the Parliament's own ledger (0 → 1 at the start, a named source in the
 * sitting's snapshot). Upstream's classic table (influence through Turmoil, delegates «in one party») is not this
 * fork's game — the console creator has no classic Turmoil.
 */
describe('HighCircles — on a Turmoil Redux table', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: HighCircles};

  /** A Mars First requirement card, a plain card, a Greens requirement card (the e2e tape is the same shape). */
  const NO_REQ = CardName.ANTS;
  const WITH_REQ = CardName.CULTURAL_METROPOLIS; // Unity
  const WITH_REQ_2 = CardName.SPONSORING_NATION; // no party requirement — a TAG requirement (the trap)

  function byName(name: CardName): IProjectCard {
    return newProjectCard(name)!;
  }

  /** Stack the draw pile so the FIRST name is turned over first (`draw()` pops the tail); `spare` sits at the bottom. */
  function stack(game: IGame, topFirst: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    game.projectDeck.drawPile.push(...spare.map(byName), ...[...topFirst].reverse().map(byName));
  }

  /**
   * A two-seat Redux + Prelude 2 table at the start (the PRELUDES phase — TRP1's table): three QUIET resolutions up for
   * the vote, no law enacted yet (the Greens rule a fresh table — their answer to the TR step is 2 M€), every reserve
   * full. `voting` lists the three parties up for the vote.
   */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true, prelude2Expansion: true});
    game.phase = Phase.PRELUDES;
    const parliament = game.parliament!;
    const card = new HighCircles();
    p1.preludeCardsInHand.push(card);
    return {game, p1, p2, parliament, card};
  }

  /** Play the prelude and run the queue up to its question (the grant's `SelectParty`). */
  function play(t: Table): SelectParty {
    cast(t.card.play(t.p1), undefined);
    runAllActions(t.game);
    return cast(t.p1.getWaitingFor(), SelectParty);
  }

  it('rule 1 — the printed card: prelude, Earth, P51, declarative whole, Redux voice; political, marked for Redux', () => {
    const c = new HighCircles();
    expect(c.type).eq(CardType.PRELUDE);
    expect(c.tags).deep.eq([Tag.EARTH]);
    expect(c.metadata.cardNumber).eq('P51');
    expect(c.behavior).deep.eq({tr: 1, drawCard: {count: 1, partyRequirement: true}, turmoil: {influenceBonus: 1, sendDelegates: {count: 2}}});
    expect(c.metadata.description).eq('Raise your TR 1 step and draw 1 card with a party requirement. Add 2 delegates to one resolution.');
    expect(Object.prototype.hasOwnProperty.call(HighCircles.prototype, 'bespokePlay'), 'wholly declarative').is.false;
    expect((c as unknown as {isDisabled?: boolean}).isDisabled, 'the dead upstream field is gone').is.undefined;
    const spec = PRELUDE2_CARD_MANIFEST.preludeCards[CardName.HIGH_CIRCLES];
    expect(spec?.compatibility).eq('turmoil');
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
    expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.HIGH_CIRCLES)).is.false;
  });

  it('rule 2 — the play: +1 TR, the draw first, then ONE grant prompt for 2 (the giver named, every resolution shown)', () => {
    const t = table();
    stack(t.game, [WITH_REQ]);
    const tr = t.p1.terraformRating;
    const select = play(t);
    expect(t.p1.terraformRating).eq(tr + 1);
    expect(t.p1.cardsInHand.map((c) => c.name), 'the drawn card is in hand when the resolution is picked').deep.eq([WITH_REQ]);
    expect(select.parties).to.have.members(t.parliament.partiesInVotingArea());
    expect(select.parties).to.have.length(3);
    expect(select.votePrompt?.source).eq('grant');
    expect(select.votePrompt?.count).eq(2);
    expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.HIGH_CIRCLES}, mode: 'reward'});
  });

  it('rule 3 — the search is NAMED: a card without a party requirement (and a TAG requirement) is discarded by name, the first with one kept', () => {
    const t = table();
    stack(t.game, [NO_REQ, WITH_REQ_2, WITH_REQ]);
    play(t);
    expect(t.p1.cardsInHand).has.length(1);
    expect(t.p1.cardsInHand.every((c) => hasPartyRequirement(c)), 'every kept card has a party requirement').is.true;
    const reveal = t.p1.cardDrawReveals[0];
    expect(reveal.search).deep.eq({count: 1, partyRequirement: true});
    expect(reveal.sequence?.map((s) => [s.card.name, s.matched])).deep.eq([[NO_REQ, false], [WITH_REQ_2, false], [WITH_REQ, true]]);
    expect(reveal.exhausted === true).is.false;
    expect(t.game.projectDeck.discardPile.map((c) => c.name)).deep.eq([NO_REQ, WITH_REQ_2]);
  });

  it('rule 4 — exhaustion is NAMED: a deck with no such card draws nothing and says so; the grant still plays', () => {
    const t = table();
    // The whole deck is the tape: nothing with a party requirement anywhere (no spare at the bottom).
    stack(t.game, [NO_REQ, CardName.BIRDS], []);
    const select = play(t);
    expect(t.p1.cardsInHand).has.length(0);
    expect(t.p1.cardDrawReveals, 'nothing kept — no empty reveal is queued').has.length(0);
    expect(t.game.gameLog.map((m) => m.message)).contains('The whole project deck has been searched — no more matching cards.');
    expect(select.votePrompt?.count).eq(2);
  });

  it('rule 5 — both cubes leave the RESERVE for the ONE chosen resolution; the lobby is untouched; the ledger holds', () => {
    const t = table();
    stack(t.game, [WITH_REQ]);
    const reserve = t.parliament.reserve(t.p1);
    const select = play(t);
    const party = select.parties[0] as ReduxParty;
    t.p1.process({type: 'party', partyName: party});
    runAllActions(t.game);
    const slot = t.parliament.slotOf(party)!;
    expect(t.parliament.votesOf(t.p1, slot)).eq(2);
    expect(t.parliament.votesOf(t.p1)).eq(2);
    expect(t.parliament.reserve(t.p1)).eq(reserve - 2);
    expect(t.p1.getWaitingFor()).is.undefined;
    t.parliament.assertLedger(t.game);
  });

  it('rule 6 — the enacted resolution is never offered', () => {
    const t = table();
    t.game.phase = Phase.ACTION;
    ([PartyName.MARS, PartyName.GREENS, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    seatEnacted(t.parliament, quietResolutionOf(PartyName.UNITY));
    stack(t.game, [WITH_REQ]);
    const select = play(t);
    expect(select.parties).not.include(PartyName.UNITY);
    expect(select.parties).to.have.members([PartyName.MARS, PartyName.GREENS, PartyName.SCIENTISTS]);
  });

  it('rule 7 — no resolution up for the vote: the grant is a NAMED skip, the TR and the draw stand', () => {
    const t = table();
    stack(t.game, [WITH_REQ]);
    t.parliament.slots = [];
    const tr = t.p1.terraformRating;
    cast(t.card.play(t.p1), undefined);
    runAllActions(t.game);
    expect(t.p1.getWaitingFor()).is.undefined;
    expect(t.p1.terraformRating).eq(tr + 1);
    expect(t.p1.cardsInHand).has.length(1);
    expect(t.game.gameLog.map((m) => m.message)).contains('${0} cannot add delegates to a resolution: no resolution is up for a vote');
  });

  it('rule 8 — +1 influence on the Parliament\'s ledger: 0 → 1 at the start, a NAMED source in the composition', () => {
    const t = table();
    stack(t.game, [WITH_REQ]);
    expect(t.parliament.influence(t.p1)).eq(0);
    play(t);
    expect(t.parliament.influence(t.p1)).eq(1);
    const composition = t.parliament.influenceComposition(t.p1);
    expect(composition.total).eq(1);
    expect(composition.sources).deep.eq([{amount: 1, source: CardName.HIGH_CIRCLES}]);
    expect(t.parliament.influence(t.p2), 'the other seat is untouched').eq(0);
  });

  it('rule 9 — the preview: TR, the NAMED search chip, influence 0 → 1, the reserve −2, the grant follow-up; read-only', () => {
    const t = table();
    const tr = t.p1.terraformRating;
    const reserve = t.parliament.reserve(t.p1);
    const before = JSON.stringify(t.game.serialize());
    const preview = cardPlayPreview(t.p1, t.card);
    expect(preview.kind).eq('declarative');
    const branch = preview.branches[0];
    expect(branch.effects.find((e) => e.icon === 'tr')).deep.include({direction: 'gain', amount: 1, current: tr, resulting: tr + 1});
    expect(branch.effects.find((e) => e.icon === 'cards')).deep.include({direction: 'gain', amount: 1, note: 'draw', search: {count: 1, partyRequirement: true}});
    expect(branch.effects.find((e) => e.icon === INFLUENCE_ICON)).deep.include({direction: 'gain', amount: 1, current: 0, resulting: 1});
    expect(branch.effects.find((e) => e.icon === DELEGATE_ICON)).deep.include({direction: 'cost', amount: 2, current: reserve, resulting: reserve - 2});
    expect(branch.steps).deep.eq([{kind: 'delegateGrantFollowUp', count: 2, printed: 2}]);
    expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
  });

  it('rule 10 — the card text names the search (the generator\'s sentence)', () => {
    expect(drawSearchSentence({count: 1, partyRequirement: true}))
      .eq('Reveal cards from the project deck until you reveal a card with a party requirement. Take it into your hand and discard the rest.');
  });

  it('rule 11 — save / reload under the grant: TR, the drawn card and the influence stand, the reserve untouched', () => {
    const t = table();
    stack(t.game, [WITH_REQ]);
    const tr = t.p1.terraformRating;
    const reserve = t.parliament.reserve(t.p1);
    play(t);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.terraformRating).eq(tr + 1);
    expect(owner.cardsInHand.map((c) => c.name)).deep.eq([WITH_REQ]);
    expect(reloaded.parliament!.reserve(owner)).eq(reserve);
    expect(reloaded.parliament!.influence(owner)).eq(1);
  });

  it('rule 12 — dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getPreludeCards().map((c) => c.name);
    }
    expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true, prelude2Expansion: true})).include(CardName.HIGH_CIRCLES);
    expect(dealt({turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true, prelude2Expansion: false})).not.include(CardName.HIGH_CIRCLES);
  });
});
