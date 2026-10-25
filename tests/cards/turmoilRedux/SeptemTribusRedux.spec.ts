import {expect} from 'chai';
import {SeptemTribusRedux} from '../../../src/server/cards/turmoilRedux/SeptemTribusRedux';
import {TharsisAlliance} from '../../../src/server/cards/turmoilRedux/TharsisAlliance';
import {AerialLensesRedux} from '../../../src/server/cards/turmoilRedux/AerialLensesRedux';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CUBE_ALREADY_ON_BANNER_REASON, PLACE_BANNER_CUBE_TITLE} from '../../../src/server/parliament/PlaceBannerCube';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {getParliamentModel} from '../../../src/server/parliament/ParliamentModel';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {replacementCardNumber} from '../../../src/common/cards/turmoilReduxReplacements';
import {TURMOIL_CARDS_HELD_BACK_UNDER_REDUX} from '../../../src/common/cards/turmoilReduxAdaptation';
import {bannerPartiesOf} from '../../../src/common/parliament/bannerCubes';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {REDUX_PARTIES, ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {inPremiumScope} from '../../../src/common/cards/premiumScope';
import {toName} from '../../../src/common/utils/utils';
import {GameEvent} from '../../../src/common/events/GameEvent';
import {TestPlayer} from '../../TestPlayer';
import {formatMessage, runAllActions, testGame} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {atSittingEnd, passToParliament, quietResolutionOf, seatResolution, settleParliamentGates} from '../../parliament/parliamentArrange';

/**
 * SEPTEM TRIBUS:REDUX (TR77 — the Redux replacement of the classic R15). Every rule reading of the card file's header
 * is pinned here on the real card: the printed card, the first action (a cube on ANY banner — a grant of the party's
 * effect), the win on a resolution (the cube on its party's banner, at the enactment, once), the FAQ (the effect,
 * never the requirement, never an alliance), one cube per banner, the corporation leaving, save / load, the deal.
 */
const S = PartyName.SCIENTISTS;
const M = PartyName.MARS;
const R = PartyName.REDS;
const G = PartyName.GREENS;
const ID = CardName.SEPTEM_TRIBUS_REDUX;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: SeptemTribusRedux};

/** A two-seat Redux table with three QUIET real resolutions (Scientists · Mars First · Reds); the corporation on p1's table. */
function table(parties: ReadonlyArray<ReduxParty> = [S, M, R]): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parties.forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new SeptemTribusRedux();
  p1.playedCards.push(card);
  // The access snapshot is taken (the first diff announces nothing).
  parliament.announceAccessChanges(game);
  return {game, p1, p2, parliament, card};
}

/** `n` of `player`'s own cubes on the slot of `party`. */
function cubes(t: Table, player: TestPlayer, party: ReduxParty, n: number): void {
  const slot = t.parliament.slotOf(party)!;
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

/** The first action's prompt, raised and returned (never answered). */
function firstActionPrompt(t: Table): SelectParty {
  expect(t.card.initialAction(t.p1)).is.undefined;
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectParty);
}

/** Answer p1's standing banner prompt with `party` through the player's own door (the access diff runs after it). */
function answer(t: Table, party: ReduxParty): void {
  t.p1.process({type: 'party', partyName: party});
  runAllActions(t.game);
}

/** The banners holding `player`'s cube — read the way the client reads them (the access rows' `granted` sources). */
const banners = (t: Table, player: TestPlayer = t.p1) =>
  bannerPartiesOf(REDUX_PARTIES.map((party) => ({party, granted: t.parliament.access(player, party).granted})));

function eventsOf(game: IGame, type: GameEvent['type'], from = 0): Array<GameEvent> {
  return game.events.events.slice(from).filter((e) => e.type === type);
}

function options(overrides: Partial<GameOptions>): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

describe('SeptemTribusRedux', () => {
  it('the printed card: corporation, 40 M€, the wild tag, no action, a first action and an effect; TR77, R15\'s art and lore', () => {
    const card = new SeptemTribusRedux();
    expect(card.name).eq(ID);
    expect(card.name, 'the PRINTED spelling').eq('Septem Tribus:redux');
    expect(card.type).eq(CardType.CORPORATION);
    expect(card.startingMegaCredits).eq(40);
    expect(card.tags).deep.eq([Tag.WILD]);
    expect(card.metadata.cardNumber).eq('TR77');
    expect(replacementCardNumber(CardName.SEPTUM_TRIBUS), 'decision 1 — the first number past the six projects').eq('TR77');
    expect(card.metadata.reimplements, 'the R15 art and lore').eq(CardName.SEPTUM_TRIBUS);
    expect(card.initialActionText).is.not.undefined;
    expect((card as unknown as {action?: unknown}).action, 'the classic M€-per-party action is gone').is.undefined;
    expect(TURMOIL_REDUX_CARD_MANIFEST.corporationCards[ID], 'the Redux manifest\'s corporation').is.not.undefined;
    expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(CardName.SEPTUM_TRIBUS)).is.true;
    expect(TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(CardName.SEPTUM_TRIBUS), 'off the hold-back list').is.false;
  });

  describe('the first action — a cube on ANY banner', () => {
    it('asks for the party with the `bannerPrompt` projection of all six banners, none refused, the giver named', () => {
      const t = table();
      const prompt = firstActionPrompt(t);
      expect(prompt.title).eq(PLACE_BANNER_CUBE_TITLE);
      expect(prompt.parties).has.length(6);
      expect(prompt.bannerPrompt?.source).eq('first-action');
      expect(prompt.bannerPrompt?.parties.map((row) => row.available)).deep.eq([true, true, true, true, true, true]);
      // The Greens rule by the starting rule: their effect is already the seat's by another road (the cube still lands).
      expect(prompt.bannerPrompt?.parties.find((row) => row.party === G)).deep.include({hasEffect: true, hasCube: false});
      expect(prompt.bannerPrompt?.parties.find((row) => row.party === S)).deep.include({hasEffect: false, hasCube: false});
      expect(prompt.choiceContext?.source).deep.eq({kind: 'corporation', card: ID});
      const model = prompt.toModel(t.p1);
      expect(model.bannerPrompt, 'serialized on the input itself').deep.eq(prompt.bannerPrompt);
    });

    it('the answer is the GRANT: the effect, never the requirement; a log line, a journal row and the access announced by the card', () => {
      const t = table();
      firstActionPrompt(t);
      const at = t.game.events.events.length;
      answer(t, S);
      expect(t.parliament.access(t.p1, S)).deep.include({granted: [ID], hasEffect: true, satisfiesRequirement: false, ruling: false, delegates: 0});
      expect(banners(t)).deep.eq([S]);
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => /places a cube on the banner of Scientists/.test(l)), lines.join('\n')).is.true;
      expect(lines.some((l) => /gains the Scientists party effect — granted by Septem Tribus/.test(l)), lines.join('\n')).is.true;
      const placed = eventsOf(t.game, 'banner-cube-placed', at);
      expect(placed).has.length(1);
      expect(placed[0].impact.bannerCube).deep.eq({party: S});
      const gained = eventsOf(t.game, 'party-effect-gained', at);
      expect(gained.map((e) => e.impact.partyEffect)).deep.eq([{party: S, basis: 'card', source: ID}]);
      expect(t.p1.getWaitingFor(), 'answered — nothing more asked').is.undefined;
    });

    it('the ruling party\'s banner takes a cube too (its effect is everyone\'s today): placed, no access news', () => {
      const t = table();
      expect(t.parliament.rulingParty()).eq(G);
      firstActionPrompt(t);
      const at = t.game.events.events.length;
      answer(t, G);
      expect(banners(t)).deep.eq([G]);
      expect(eventsOf(t.game, 'banner-cube-placed', at)).has.length(1);
      expect(eventsOf(t.game, 'party-effect-gained', at), 'the ruling party is everyone\'s').deep.eq([]);
    });

    it('a banner already holding the cube is shown REFUSED with its reason (one cube per banner)', () => {
      const t = table();
      firstActionPrompt(t);
      answer(t, S);
      const again = firstActionPrompt(t);
      const row = again.bannerPrompt!.parties.find((p) => p.party === S)!;
      expect(row).deep.include({available: false, hasCube: true, reason: CUBE_ALREADY_ON_BANNER_REASON});
      expect(again.parties).not.to.include(S);
      expect(() => t.p1.process({type: 'party', partyName: S})).to.throw();
    });

    it('the briefing\'s preview is read-only and says the party is asked after the confirm', () => {
      const t = table();
      const preview = t.card.firstActionPreview();
      expect(preview.branches[0].steps.some((s) => s.kind === 'note')).is.true;
      expect(t.parliament.grantedEffects.get(t.p1.id) ?? []).deep.eq([]);
    });
  });

  describe('«when you win on a resolution» — the cube on its party\'s banner, at the enactment', () => {
    it('p1 leads the Scientists\' resolution: the cube lands, the summary records it once, no access news (the party rules now)', () => {
      const t = table();
      cubes(t, t.p1, S, 3);
      t.parliament.announceAccessChanges(t.game);
      const at = t.game.events.events.length;
      let summary: unknown;
      atSittingEnd(t.game, () => (summary = structuredClone(t.parliament.phase?.summary)));
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.rulingParty()).eq(S);
      expect(banners(t)).deep.eq([S]);
      expect((summary as {bannerCubes?: unknown}).bannerCubes).deep.eq([{player: t.p1.id, party: S, card: ID}]);
      const placed = eventsOf(t.game, 'banner-cube-placed', at);
      expect(placed).has.length(1);
      expect(placed[0].source).deep.include({card: ID});
      expect(eventsOf(t.game, 'party-effect-gained', at).filter((e) => e.player === t.p1.color && e.impact.partyEffect?.party === S),
        'the enactment is told once, for everyone').deep.eq([]);
      // The model carries the record for every viewer.
      expect(getParliamentModel(t.game, t.p2)?.lastPhase?.bannerCubes).deep.eq([{player: t.p1.color, party: S, card: ID}]);
    });

    it('the next generation another party rules: the Scientists\' effect stays by the cube — a road swapped under a standing effect is no news', () => {
      const t = table();
      cubes(t, t.p1, S, 3);
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.rulingParty()).eq(S);
      // The next sitting: p2 leads a Mars First resolution.
      t.game.phase = Phase.ACTION;
      const slots = t.parliament.slots.map((slot) => t.parliament.resolutionOf(slot.instance).party);
      const party = slots.find((p) => p !== S) as ReduxParty;
      const slot = t.parliament.slotOf(party)!;
      t.parliament.placeVote(t.p2, slot, 'reserve');
      t.parliament.placeVote(t.p2, slot, 'reserve');
      t.parliament.announceAccessChanges(t.game);
      const at = t.game.events.events.length;
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.rulingParty()).eq(party);
      expect(t.parliament.access(t.p1, S)).deep.include({ruling: false, granted: [ID], hasEffect: true, satisfiesRequirement: false});
      expect(eventsOf(t.game, 'party-effect-gained', at).concat(eventsOf(t.game, 'party-effect-lost', at))
        .filter((e) => e.player === t.p1.color && e.impact.partyEffect?.party === S)).deep.eq([]);
    });

    it('a second win on a banner already holding the cube places nothing and records nothing (one cube)', () => {
      const t = table();
      firstActionPrompt(t);
      answer(t, S);
      cubes(t, t.p1, S, 3);
      const at = t.game.events.events.length;
      let summary: unknown;
      atSittingEnd(t.game, () => (summary = structuredClone(t.parliament.phase?.summary)));
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.grantedEffects.get(t.p1.id)).deep.eq([{party: S, source: ID}]);
      expect((summary as {bannerCubes?: unknown}).bannerCubes).is.undefined;
      expect(eventsOf(t.game, 'banner-cube-placed', at)).deep.eq([]);
    });

    it('a NEUTRAL win and a RIVAL\'s win place nothing', () => {
      const neutral = table();
      passToParliament(neutral.game);
      settleParliamentGates(neutral.game);
      expect(neutral.parliament.grantedEffects.get(neutral.p1.id) ?? []).deep.eq([]);

      const rival = table();
      cubes(rival, rival.p2, M, 3);
      passToParliament(rival.game);
      settleParliamentGates(rival.game);
      expect(rival.parliament.rulingParty()).eq(M);
      expect(rival.parliament.grantedEffects.get(rival.p1.id) ?? []).deep.eq([]);
      expect(rival.parliament.grantedEffects.get(rival.p2.id) ?? [], 'the rival holds no Septem Tribus').deep.eq([]);
    });

    it('a RELOAD mid-sitting (at its last step) never places twice', () => {
      const t = table();
      cubes(t, t.p1, S, 3);
      let save: ReturnType<IGame['serialize']> | undefined;
      atSittingEnd(t.game, () => (save = structuredClone(t.game.serialize())));
      passToParliament(t.game);
      const game = Game.deserialize(save!);
      settleParliamentGates(game);
      expect(game.parliament!.grantedEffects.get(t.p1.id)).deep.eq([{party: S, source: ID}]);
      expect(game.gameLog.filter((m) => formatMessage(m).includes('places a cube on the banner'))).has.length(1);
    });

    it('MarsBot is never asked: outside the party-effects aspect', () => {
      const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      const bannerHook = new SeptemTribusRedux();
      bot.playedCards.push(bannerHook);
      expect(parliament.participates(bot, 'party-effects')).is.false;
      bannerHook.onResolutionWon(bot, {instance: 'x' as never, resolution: 'x' as never, party: S});
      // The hook itself is the card's; the SITTING never calls it for the bot — and a grant would be dormant anyway.
      expect(parliament.access(bot, S).hasEffect).is.false;
    });
  });

  describe('the FAQ (p.19) — a cube gives the EFFECT, never the requirement, never an alliance', () => {
    it('a card requiring the Scientists is NOT playable on the cube alone; the effect is the seat\'s', () => {
      const t = table();
      firstActionPrompt(t);
      answer(t, S);
      const lenses = new AerialLensesRedux();
      t.p1.cardsInHand.push(lenses);
      t.p1.megaCredits = 30;
      expect(t.game.politics!.hasPartyEffect(t.p1, S)).is.true;
      expect(t.parliament.satisfiesPartyRequirement(t.p1, S)).is.false;
      expect(t.p1.canPlay(lenses)).is.false;
    });

    it('two banners, two effects (Scientists and Reds): each the seat\'s by the card road', () => {
      const t = table();
      firstActionPrompt(t);
      answer(t, S);
      firstActionPrompt(t);
      answer(t, R);
      expect(banners(t)).to.have.members([S, R]).and.length(2);
      expect(t.parliament.accessBasis(t.p1, S)).eq('card');
      expect(t.parliament.accessBasis(t.p1, R)).eq('card');
    });

    it('a cube never sets off an alliance (TR62 reads the printed roads only)', () => {
      const t = table();
      t.p1.playedCards.push(new TharsisAlliance());
      firstActionPrompt(t);
      answer(t, M);
      expect(t.parliament.access(t.p1, M).hasEffect).is.true;
      expect(t.parliament.access(t.p1, R)).deep.include({hasEffect: false, allied: []});
    });
  });

  describe('the cubes are the corporation\'s', () => {
    it('the corporation leaving revokes every grant of its source (the cubes leave the banners)', () => {
      const t = table();
      firstActionPrompt(t);
      answer(t, S);
      t.parliament.grantPartyEffect(t.p1, R, CardName.REDS_NEWS_OUTLET);
      t.card.onDiscard(t.p1);
      expect(t.parliament.grantedEffects.get(t.p1.id)).deep.eq([{party: R, source: CardName.REDS_NEWS_OUTLET}]);
    });

    it('save / load keeps the cubes with their source', () => {
      const t = table();
      firstActionPrompt(t);
      answer(t, S);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      expect(reloaded.parliament!.grantedEffects.get(t.p1.id)).deep.eq([{party: S, source: ID}]);
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.playedCards.get(ID)).to.be.instanceOf(SeptemTribusRedux);
    });

    it('every seat\'s cubes are public: the model carries each seat\'s banner grants', () => {
      const t = table();
      firstActionPrompt(t);
      answer(t, S);
      const seen = getParliamentModel(t.game, t.p2)!.players.find((p) => p.color === t.p1.color)!;
      expect(bannerPartiesOf(seen.access)).deep.eq([S]);
    });
  });

  describe('the deal: the replacement on a Redux table, the classic card on a classic one, never both', () => {
    const REDUX = {turmoilReduxExpansion: true, turmoilExtension: false, coloniesExtension: true};
    const CLASSIC = {turmoilReduxExpansion: false, turmoilExtension: true, coloniesExtension: true};

    it('Redux: TR77 is dealt among the corporations, the classic R15 is not', () => {
      const names = new GameCards(options(REDUX)).getCorporationCards().map(toName);
      expect(names).to.contain(ID);
      expect(names).to.not.contain(CardName.SEPTUM_TRIBUS);
    });

    it('classic Turmoil: the classic card is dealt, the replacement is not', () => {
      const names = new GameCards(options(CLASSIC)).getCorporationCards().map(toName);
      expect(names).to.contain(CardName.SEPTUM_TRIBUS);
      expect(names).to.not.contain(ID);
    });

    it('the premium scope covers the replacement and never the replaced classic card', () => {
      expect(inPremiumScope({module: 'turmoilRedux', name: ID})).is.true;
      expect(inPremiumScope({module: 'turmoil', name: CardName.SEPTUM_TRIBUS})).is.false;
    });
  });
});
