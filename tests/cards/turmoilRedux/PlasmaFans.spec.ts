import {expect} from 'chai';
import {HEAT_PER_VENUS_STEP, HEAT_PRODUCTION_ON_PLAY, PlasmaFans} from '../../../src/server/cards/turmoilRedux/PlasmaFans';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {VenusianCensus} from '../../../src/server/cards/turmoilRedux/VenusianCensus';
import {Aphrodite} from '../../../src/server/cards/venusNext/Aphrodite';
import {testGame} from '../../TestGame';
import {ConvertHeat} from '../../../src/server/cards/base/standardActions/ConvertHeat';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {STARTER_QUEST} from '../../../src/common/parliament/ParliamentTypes';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {MAX_VENUS_SCALE} from '../../../src/common/constants';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForAction, effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast, toName} from '../../../src/common/utils/utils';
import {answerQuestGate, questGateOf, quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {formatMessage, runAllActions, setVenusScaleLevel} from '../../TestingUtils';

/**
 * TR41 — PLASMA FANS: the Greens' fourth plate, the set's second Venus card,
 * and ONE DECLARATION of two engine classes — Caretaker Contract's price (8
 * heat off the rail) and Thermophiles' reward (Venus +1 step) — with a plain
 * production block for the play. Every rule reading of the card file's header
 * is pinned here: the plate's two roads, the play's +3 heat production and the
 * Greens' ONE answer of 3, the printed generation-1 chairman quest CLOSED BY
 * THIS ONE PLAY (the gate, the office, the Agenda step), the action and what
 * the ENGINE answers at 7 heat and at the Venus ceiling (the official rule: the
 * action stays legal, the scale does not move — the composer names the loss),
 * the Venus step as an ordinary step (the 8 % card off the SCALE's source, the
 * 16 % TR bonus, the Greens' 2 M€ per TR step, the census and Aphrodite in
 * whosever tableau), the deck gate of `compatibility: 'venus'`, the standard
 * heat conversion beside it, once per generation, save / load, MarsBot.
 */
const G = PartyName.GREENS;
const COST = 8;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: PlasmaFans};

/** A two-seat Redux + Venus Next table in the action phase: generation 1, nothing enacted — the Greens rule by the STARTING RULE. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  const card = new PlasmaFans();
  return {game, player, opponent, parliament: game.parliament!, card};
}

/** The Reds rule by an enacted card — the Greens' effect is nobody's by the ruling road. */
function redsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
  return t;
}

/** `n` of `player`'s own cubes on the Greens' quiet resolution in slot 0 (the lobby's free one first, the rest from the reserve). */
function greensCubes(t: Table, player: TestPlayer, n: number): void {
  let slot = t.parliament.slotOf(G);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(G));
    slot = t.parliament.slotOf(G)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

/** The card on the player's table, the player at `heat`, Venus at `venus` %. */
function owned(t: Table, heat: number, venus = 0): Table {
  t.player.playedCards.push(t.card);
  t.player.heat = heat;
  setVenusScaleLevel(t.game, venus);
  return t;
}

/** The blue card's action from the action menu, every deferred step run. */
function act(t: Table): void {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name)).to.include(CardName.PLASMA_FANS);
  door.cb([t.card]);
  runAllActions(t.game);
}

/**
 * The PLAY as the player's OWN action-phase action — the event recorder's
 * root is what the chairman-quest tracker reads (`QuestTracker.eligible`);
 * a bare `playCard` has no root and would count nothing.
 */
function playAsAction(t: Table, player: TestPlayer = t.player): void {
  player.cardsInHand.push(t.card);
  player.megaCredits = 20;
  const events = t.game.events;
  events.beginAction(player, {kind: 'card', card: t.card.name, owner: player.color}, {category: 'card-play'});
  try {
    player.playCard(t.card, Payment.of({megacredits: COST}));
  } finally {
    events.endScope();
  }
  runAllActions(t.game);
}

function options(overrides: Partial<GameOptions>): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

describe('PlasmaFans', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 8, Venus, no VP, the GREENS\' plate (the set\'s fourth), TR41 — in the Redux manifest with `compatibility: \'venus\'`', () => {
      const card = t.card;
      expect(card.name).eq(CardName.PLASMA_FANS);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.VENUS]);
      expect(card.resourceType, 'no resource holder').is.undefined;
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Greens\' emblem — a requirement, not a tag').eq(G);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR41');
      expect(card.metadata.description).eq('Requires the Greens to be ruling or that you have 2 delegates there. Increase your heat production 3 steps.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.PLASMA_FANS];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'the Venus Next icon at the bottom left: without Venus Next the card leaves the deck').eq('venus');
      expect(HEAT_PRODUCTION_ON_PLAY).eq(3);
      expect(HEAT_PER_VENUS_STEP).eq(8);
      // ONE DECLARATION — nothing of the card lives in its file.
      expect((card as ICard).actionUnavailableReason, 'no reason of its own — the declaration\'s automatic ones').is.undefined;
      expect((card as ICard).onCardPlayed, 'no trigger').is.undefined;
      expect((card as ICard).onGlobalParameterRaised, 'no scale listener — the card MAKES the step, it does not answer one').is.undefined;
      expect(Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(card), 'canAct'), 'canAct is ActionCard\'s, never this file\'s').is.false;
      expect(Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(card), 'action'), 'action() is ActionCard\'s, never this file\'s').is.false;
    });

    it('the PLAY is a plain production block and the ACTION is Caretaker Contract\'s price with Thermophiles\' reward — one declaration each', () => {
      expect(t.card.behavior).deep.eq({production: {heat: 3}});
      expect(t.card.actionBehavior).deep.eq({spend: {heat: 8}, global: {venus: 1}});
    });

    it('the structured text prints the requirement, the one action row and the play\'s own line — nothing curated (the rule is 37 characters)', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Greens to be ruling or that you have 2 delegates on its resolution.',
        'Action: Pay 8 heat to terraform Venus 1 step.',
        'Increase your heat production 3 steps.',
      ]);
      expect(blocks.map((b) => b.short ?? null), 'no short caption — the printed rule fits the browser\'s budget').deep.eq([null, null, null]);
    });

    it('rule 5 — the deck gate: dealt with Venus Next, absent without it (the Redux module alone does not bring the card)', () => {
      const withVenus = new GameCards(options({turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true})).getProjectCards().map(toName);
      const withoutVenus = new GameCards(options({turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: false})).getProjectCards().map(toName);
      expect(withVenus).includes(CardName.PLASMA_FANS);
      expect(withoutVenus).not.includes(CardName.PLASMA_FANS);
    });
  });

  describe('rule 1 — the requirement: the Greens rule (the starting rule counts), or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
    });

    it('generation 1, nothing enacted: the Greens rule by the STARTING RULE — playable with no delegate anywhere', () => {
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0, requirement: true, requirementKey: 'req:party',
      });
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: G, current: 1});
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s: with one cube the card still reads «1 of 2»', () => {
      redsRule(t);
      t.player.playedCards.push(new CouncilSeat());
      greensCubes(t, t.player, 1);
      expect(t.parliament.hasPartyEffect(t.player, G), 'the Greens\' EFFECT is the player\'s by the Seat').is.true;
      expect(t.player.canPlay(t.card), 'the requirement is still two').is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: G, current: 1, params: [G, '2']});
    });

    it('checked at the PLAY only: once on the table, the action works whoever rules', () => {
      const u = redsRule(table());
      owned(u, 8);
      expect(u.card.canAct(u.player)).is.true;
    });
  });

  describe('rule 2 — the play: +3 heat production; the Greens answer with ONE +3 M€ production; the generation-1 chairman quest closes', () => {
    it('the cost is paid, heat production 0 → 3, the Greens (the starting rule) +3 M€ production in ONE call; the journal reads play · step · answer', () => {
      const at = t.game.gameLog.length;
      expect(t.parliament.hasPartyEffect(t.player, G)).is.true;
      playAsAction(t);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(CardName.PLASMA_FANS)).eq(t.card);
      expect(t.player.production.heat).eq(HEAT_PRODUCTION_ON_PLAY);
      expect(t.player.production.megacredits).eq(3);
      expect(t.player.heat, 'production, never stock').eq(0);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      const play = lines.findIndex((l) => /played Plasma Fans/.test(l));
      const step = lines.findIndex((l) => /gained 3 heat production/.test(l));
      const greens = lines.findIndex((l) => /gained 3 megacredits production because of Greens/.test(l));
      expect(play, lines.join('\n')).is.gte(0);
      expect(step, lines.join('\n')).is.gt(play);
      expect(greens, 'ONE answer of 3, never three of 1').is.gt(step);
      expect(lines.filter((l) => /because of Greens/.test(l))).has.length(1);
    });

    it('the Greens NOT ruling: two own cubes open the effect — +3 M€ production; one cube does not; one cube WITH TR36 does', () => {
      for (const [cubes, seat, answer] of [[2, false, 3], [1, false, 0], [1, true, 3]] as const) {
        const u = redsRule(table());
        if (seat) {
          u.player.playedCards.push(new CouncilSeat());
        }
        greensCubes(u, u.player, cubes);
        expect(u.parliament.hasPartyEffect(u.player, G), `${cubes} cube(s), seat ${seat}`).eq(answer === 3);
        playAsAction(u);
        expect(u.player.production.heat, `${cubes} cube(s), seat ${seat}`).eq(3);
        expect(u.player.production.megacredits, `${cubes} cube(s), seat ${seat}`).eq(answer);
      }
    });

    it('the composer promises the +3 heat production as the card\'s own chip and names the Greens\' «+3 M€ production» before the press', () => {
      t.player.cardsInHand.push(t.card);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches[0].effects).has.length(1);
      expect(preview.branches[0].effects[0]).deep.include({direction: 'gain', icon: Resource.HEAT, amount: 3, current: 0, resulting: 3, note: 'production'});
      const greens = effectForecastForPlay(t.player, t.card, preview).facts.find((f) => f.id?.endsWith('greens-production'));
      expect(greens, 'the Greens\' production answer').is.not.undefined;
      expect(greens).deep.include({certainty: 'exact'});
      expect(greens?.source).deep.include({kind: 'party', name: G, channel: 'production-gain'});
      expect(greens?.effects[0]).deep.include({direction: 'gain', icon: Resource.MEGACREDITS, amount: 3, current: 0, resulting: 3, note: 'production'});

      const u = redsRule(table());
      u.player.cardsInHand.push(u.card);
      const silent = effectForecastForPlay(u.player, u.card, cardPlayPreview(u.player, u.card)).facts;
      expect(silent.find((f) => f.id?.endsWith('greens-production')), 'nothing when the effect is not yours').is.undefined;
    });

    it('the printed generation-1 quest («raise your heat production 3 steps») is COMPLETED BY THIS ONE PLAY: 0 → 3, the gate stands AFTER the landing, the office and one Agenda step on the answer', () => {
      expect(t.parliament.quest?.definition, 'the starter quest is on the table').deep.eq(STARTER_QUEST);
      expect(t.parliament.questProgressOf(t.player)).eq(0);
      expect(t.parliament.chairman).is.undefined;
      const agendaBefore = t.parliament.agendaOf(t.player);
      playAsAction(t);
      expect(t.parliament.questProgressOf(t.player)).eq(3);
      expect(t.parliament.quest?.completedBy).eq(t.player.id);
      // The gate (`BACK_OF_THE_LINE`) — nothing of the quest is applied until it is answered.
      expect(questGateOf(t.player), 'the chairman-quest gate stands').is.not.undefined;
      expect(t.parliament.chairman, 'not before the answer').is.undefined;
      expect(t.parliament.agendaOf(t.player)).eq(agendaBefore);
      answerQuestGate(t.game, t.player);
      expect(t.parliament.chairman).eq(t.player.id);
      expect(t.parliament.agendaOf(t.player), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => /completed the chairman quest/.test(l))).is.true;
    });

    it('a quest the OPPONENT already completed moves nothing: no progress, no gate, the office stays', () => {
      expect(t.parliament.addQuestProgress(t.opponent, STARTER_QUEST.count)).eq('completed');
      t.parliament.chairman = t.opponent.id;
      playAsAction(t);
      expect(t.player.production.heat, 'the play itself is whole').eq(3);
      expect(t.parliament.questProgressOf(t.player)).eq(0);
      expect(t.parliament.quest?.completedBy).eq(t.opponent.id);
      expect(questGateOf(t.player)).is.undefined;
      expect(t.parliament.chairman).eq(t.opponent.id);
    });

    it('a play outside the ACTION phase counts nothing toward the quest — the production step still lands', () => {
      t.game.phase = Phase.RESEARCH;
      playAsAction(t);
      expect(t.player.production.heat).eq(3);
      expect(t.parliament.questProgressOf(t.player), 'the tracker counts the action phase only').eq(0);
      expect(t.parliament.quest?.completedBy).is.undefined;
    });
  });

  describe('rule 3 — the action: 8 heat → Venus +1 step; what the engine answers at 7 heat and at the ceiling', () => {
    it('8 heat, Venus 0 %: heat 8 → 0, Venus 0 → 2 %, +1 TR, the Greens +2 M€; the use is spent; the event stream reads price · TR · answer · step', () => {
      owned(t, 8, 0);
      const tr = t.player.terraformRating;
      const before = t.game.events.events.length;
      expect(t.card.canAct(t.player)).is.true;
      act(t);
      expect(t.player.heat).eq(0);
      expect(t.game.getVenusScaleLevel()).eq(2);
      expect(t.player.terraformRating).eq(tr + 1);
      expect(t.player.megaCredits, 'the Greens pay 2 M€ per TR step').eq(2);
      expect(t.player.actionsThisGeneration.has(CardName.PLASMA_FANS), 'once per generation').is.true;
      expect(t.player.getWaitingFor(), 'nothing is asked').is.undefined;
      const events = t.game.events.events.slice(before);
      const price = events.findIndex((e) => e.impact.stock?.heat === -8);
      const rating = events.findIndex((e) => e.impact.tr === 1);
      const greens = events.findIndex((e) => e.impact.stock?.megacredits === 2);
      const step = events.findIndex((e) => e.impact.globalParameter?.parameter === 'venus' && e.impact.globalParameter.steps === 1);
      expect(price, JSON.stringify(events.map((e) => e.type))).is.gte(0);
      expect(rating).is.gt(price);
      expect(greens).is.gt(rating);
      expect(step).is.gt(greens);
    });

    it('the preview is DECLARATIVE: the «8 → 0 heat» cost chip and the «Venus 0 → 2 %» gain chip; the forecast names the Greens\' «+2 M€» before the press', () => {
      owned(t, 8, 0);
      const preview = actionPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches).has.length(1);
      const [branch] = preview.branches;
      expect(branch.available).is.true;
      expect(branch.effects).deep.eq([
        {direction: 'cost', icon: Resource.HEAT, amount: 8, current: 8, resulting: 0},
        {direction: 'gain', icon: 'venus', amount: 2, current: 0, resulting: 2, unit: '%'},
      ]);
      const forecast = effectForecastForAction(t.player, t.card, preview);
      const greens = forecast.facts.find((f) => f.id?.endsWith('greens-tr'));
      expect(greens, JSON.stringify(forecast.facts.map((f) => f.id))).is.not.undefined;
      expect(greens).deep.include({certainty: 'exact'});
      expect(greens?.source).deep.include({kind: 'party', name: G, channel: 'tr-increase'});
      expect(greens?.effects[0]).deep.include({direction: 'gain', icon: Resource.MEGACREDITS, amount: 2, current: 0, resulting: 2});

      const u = redsRule(table());
      owned(u, 8, 0);
      expect(effectForecastForAction(u.player, u.card, actionPreview(u.player, u.card)).facts.find((f) => f.id?.endsWith('greens-tr'))).is.undefined;
    });

    it('7 heat: refused with the automatic «Not enough heat» and the count — shown, never hidden; nothing moves', () => {
      owned(t, 7, 0);
      expect(t.card.canAct(t.player)).is.false;
      expect(t.player.getPlayableActionCards().includes(t.card)).is.false;
      expect(actionUnavailableReasons(t.player, t.card)).deep.eq([{type: 'resource', message: 'Not enough heat', resource: Resource.HEAT, current: 7}]);
      const branch = actionPreview(t.player, t.card).branches[0];
      expect(branch.available).is.false;
      expect(branch.unavailableReason).eq('Not enough heat');
      expect(branch.effects.map((e) => e.icon), 'the refused action still shows its chips').deep.eq([Resource.HEAT, 'venus']);
    });

    it('Venus at 30 % — THE OFFICIAL RULE: the action stays legal, the price is paid, the scale and the rating do not move; the composer reads «30 → 30» and names the lost gain', () => {
      owned(t, 8, MAX_VENUS_SCALE);
      // The engine's ceiling is a WARNING on the card (`maxvenus`), never a refusal.
      expect(t.card.canAct(t.player)).is.true;
      expect([...t.card.warnings]).deep.eq(['maxvenus']);
      expect(actionUnavailableReasons(t.player, t.card)).deep.eq([]);
      const branch = actionPreview(t.player, t.card).branches[0];
      expect(branch.available).is.true;
      expect(branch.effects[1]).deep.include({direction: 'gain', icon: 'venus', current: 30, resulting: 30});
      const tr = t.player.terraformRating;
      act(t);
      expect(t.player.heat, 'the price is paid — the rulebook lets the action happen').eq(0);
      expect(t.game.getVenusScaleLevel()).eq(MAX_VENUS_SCALE);
      expect(t.player.terraformRating, 'no step → no TR').eq(tr);
      expect(t.player.megaCredits, 'no TR → nothing from the Greens').eq(0);
    });

    it('7 heat at 30 %: the one reason is the heat — the blocker the player can act on; the ceiling is the warning beside it', () => {
      owned(t, 7, MAX_VENUS_SCALE);
      expect(t.card.canAct(t.player)).is.false;
      expect(actionUnavailableReasons(t.player, t.card).map((r) => r.message)).deep.eq(['Not enough heat']);
    });
  });

  describe('rule 4 — the Venus step is an ORDINARY global-parameter step', () => {
    it('6 → 8 %: a card is drawn OFF THE SCALE (`source: globalParameter / venus`), +1 TR, the Greens +2 M€', () => {
      owned(t, 8, 6);
      const hand = t.player.cardsInHand.length;
      const tr = t.player.terraformRating;
      act(t);
      expect(t.game.getVenusScaleLevel()).eq(8);
      expect(t.player.cardsInHand.length).eq(hand + 1);
      expect(t.player.terraformRating).eq(tr + 1);
      expect(t.player.megaCredits).eq(2);
      const reveal = t.player.cardDrawReveals.find((r) => r.source?.type === 'globalParameter');
      expect(reveal, 'the 8 % reward is the SCALE\'s draw, never the card\'s own').is.not.undefined;
      expect(reveal?.source).deep.eq({type: 'globalParameter', parameter: 'venus'});
      expect(reveal?.cards.map((c) => c.name)).deep.eq([t.player.cardsInHand[hand].name]);
    });

    it('14 → 16 %: the step\'s TR AND the track bonus — +2 TR as TWO ratings, and the Greens answer each: +4 M€ as two lines of 2', () => {
      owned(t, 8, 14);
      const tr = t.player.terraformRating;
      const at = t.game.gameLog.length;
      const before = t.game.events.events.length;
      act(t);
      expect(t.game.getVenusScaleLevel()).eq(16);
      expect(t.player.terraformRating).eq(tr + 2);
      expect(t.player.megaCredits).eq(4);
      expect(t.game.events.events.slice(before).filter((e) => e.impact.tr === 1), 'two separate ratings — two causes').has.length(2);
      expect(t.game.gameLog.slice(at).map((m) => formatMessage(m)).filter((l) => /gained 2 megacredits because of Greens/.test(l))).has.length(2);
    });

    it('the census (TR24) in the OWNER\'s tableau takes 2 data; Aphrodite in the OPPONENT\'s takes 2 M€ — the one raise pays each its owner', () => {
      owned(t, 8, 10);
      const census = new VenusianCensus();
      t.player.playedCards.push(census);
      t.opponent.playedCards.push(new Aphrodite());
      act(t);
      expect(census.resourceCount).eq(2);
      expect(t.opponent.megaCredits).eq(2);
      expect(t.player.megaCredits, 'the Greens\' 2 and nothing of Aphrodite\'s').eq(2);
    });

    it('the Alt Venus Board: 16 → 18 % crosses a bonus space — the engine\'s own bonus prompt is raised after the step', () => {
      const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, altVenusBoard: true});
      game.phase = Phase.ACTION;
      const card = new PlasmaFans();
      player.playedCards.push(card);
      player.heat = 8;
      setVenusScaleLevel(game, 16);
      const door = cast(player.playActionCard(), SelectCard);
      door.cb([card]);
      runAllActions(game);
      expect(game.getVenusScaleLevel()).eq(18);
      expect(player.getWaitingFor()?.venusBonusPrompt, 'the alt-track bonus asks its standard resource').deep.include({kind: 'standard', baseCount: 1});
    });

    it('the Venus tag is an ordinary tag', () => {
      owned(t, 0);
      expect(t.player.tags.count(Tag.VENUS)).eq(1);
    });
  });

  describe('rule 6 — the standard heat conversion is untouched: two 8-heat spends, each with its own availability', () => {
    it('with 8 heat both are open; the card\'s use leaves the conversion open on what remains and vice versa', () => {
      owned(t, 16, 0);
      const convert = new ConvertHeat();
      expect(convert.canAct(t.player)).is.true;
      expect(t.card.canAct(t.player)).is.true;
      act(t);
      expect(t.player.heat).eq(8);
      expect(convert.canAct(t.player), 'the conversion still has its 8').is.true;
      expect(t.player.getPlayableActionCards().includes(t.card), 'the card\'s use is spent for the generation').is.false;
    });

    it('the card\'s action is NOT the conversion: Venus moves, the temperature does not', () => {
      owned(t, 8, 0);
      const temperature = t.game.getTemperature();
      act(t);
      expect(t.game.getTemperature()).eq(temperature);
      expect(t.game.getVenusScaleLevel()).eq(2);
    });
  });

  describe('rule 2 (payment) — no mech lane: no Space tag for EVA, no Building tag for Construction Mechs', () => {
    it('the play is paid in M€ only', () => {
      t.player.cardsInHand.push(t.card);
      const lanes = t.player.paymentOptionsForCard(t.card);
      expect(lanes.mechs).is.false;
      expect(lanes.constructionMechs).is.false;
    });
  });

  describe('rule 9 — MarsBot', () => {
    it('the bot\'s own Venus step is nobody\'s use of this card: the human\'s action stays open, the human\'s heat stays', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true});
      game.phase = Phase.ACTION;
      const card = new PlasmaFans();
      human.playedCards.push(card);
      human.heat = 8;
      game.increaseVenusScaleLevel(bot, 1);
      runAllActions(game);
      expect(game.getVenusScaleLevel()).eq(2);
      expect(human.heat).eq(8);
      expect(card.canAct(human)).is.true;
      expect(human.actionsThisGeneration.has(CardName.PLASMA_FANS)).is.false;
    });
  });

  describe('save / reload', () => {
    it('the spent action survives serialization', () => {
      owned(t, 0);
      t.player.actionsThisGeneration.add(CardName.PLASMA_FANS);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      const card = again.playedCards.get(CardName.PLASMA_FANS) as IProjectCard | undefined;
      expect(card, 'the card is on the table after the reload').is.not.undefined;
      expect(again.actionsThisGeneration.has(CardName.PLASMA_FANS)).is.true;
    });
  });
});
