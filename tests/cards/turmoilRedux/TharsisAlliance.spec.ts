import {expect} from 'chai';
import {
  THARSIS_ALLIANCE_DRAW_LINE, THARSIS_ALLIANCE_DRAW_NOTE, THARSIS_ALLIANCE_HOLDS_LINE, THARSIS_ALLIANCE_NOTHING_NOTE,
  THARSIS_ALLIANCE_OPENS_CARDS_DELEGATES_NOTE, THARSIS_ALLIANCE_OPENS_DELEGATES_NOTE, THARSIS_ALLIANCE_OPENS_RULING_NOTE,
  THARSIS_ALLIANCE_PARTIES, TharsisAlliance, tharsisAllianceOpenings,
} from '../../../src/server/cards/turmoilRedux/TharsisAlliance';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {RedsNewsOutlet} from '../../../src/server/cards/turmoilRedux/RedsNewsOutlet';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {BackroomDeal} from '../../../src/server/cards/turmoilRedux/BackroomDeal';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {SerializedGame} from '../../../src/server/SerializedGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../../src/server/parliament/ParliamentHandler';
import {getParliamentModel} from '../../../src/server/parliament/ParliamentModel';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requirementEasingOf} from '../../../src/server/models/requirementEasing';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../../src/common/cards/render/CardRenderSymbolType';
import {GameEvent} from '../../../src/common/events/GameEvent';
import {Message} from '../../../src/common/logs/Message';
import {Payment} from '../../../src/common/inputs/Payment';
import {fakeCard, formatMessage, runAllActions} from '../../TestingUtils';
import {atSittingEnd, answerStandingGates, passToParliament, quietResolutionOf, seatEnacted, seatResolution, settleParliamentGates} from '../../parliament/parliamentArrange';

/**
 * TR62 — THARSIS ALLIANCE: the law of access's FOURTH road. Standing by the
 * printed condition with ONE party of the pair (it rules, or two of your own
 * delegates on its resolution) the owner stands with the OTHER too — its
 * effect AND its card requirement. Every rule reading of the card file's
 * header is pinned here on the real card and on the ONE function that judges
 * access (`Parliament.access` ← `alliancesOf`), plus the set's first hook on a
 * change of power (`onRulingPartyChanged` at the sitting's enactment).
 */
const R = PartyName.REDS;
const M = PartyName.MARS;
const S = PartyName.SCIENTISTS;
const G = PartyName.GREENS;
const ID = CardName.THARSIS_ALLIANCE;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: TharsisAlliance};

/** A two-seat Redux table with three QUIET real resolutions (Scientists · Mars First · Reds) — the Greens rule by the starting rule. */
function table(parties: ReadonlyArray<ReduxParty> = [S, M, R]): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parties.forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament, card: new TharsisAlliance()};
}

/** The same table with the card on p1's table. */
function owned(parties?: ReadonlyArray<ReduxParty>): Table {
  const t = table(parties);
  t.p1.playedCards.push(t.card);
  return t;
}

/** `n` of `player`'s own cubes on the slot of `party`. */
function cubes(t: Table, player: TestPlayer, party: ReduxParty, n: number): void {
  const slot = t.parliament.slotOf(party)!;
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

function announced(game: IGame, from = 0): Array<GameEvent> {
  return game.events.events.slice(from).filter((e) => e.type === 'party-effect-gained' || e.type === 'party-effect-lost');
}

const linesOf = (t: Table, key: string) => t.game.gameLog.filter((entry) => entry.message === key);

const notesOf = (t: Table, player: TestPlayer) => cardPlayPreview(player, t.card).branches[0].steps
  .filter((step) => step.kind === 'note')
  .map((step) => step.text)
  .map((text) => typeof text === 'string' ? text : (text as Message).message);

describe('TharsisAlliance', () => {
  it('registers with source-backed metadata (the scan: 8 · Mars + Building · blue · no requirement · no VP · the pair in this file)', () => {
    const card = new TharsisAlliance();
    expect(card.name).eq(ID);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(8);
    expect(card.tags).deep.eq([Tag.MARS, Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR62');
    expect(card.requirements, 'the MIN plate is empty').deep.eq([]);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.behavior, 'the play puts nothing on the table').is.undefined;
    expect(card.partyAlliance, 'rule 1 — the pair, declared here').deep.eq([M, R]);
    expect(THARSIS_ALLIANCE_PARTIES).deep.eq([M, R]);
    const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
    const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ID];
    expect(entry, 'in the Redux manifest').is.not.undefined;
    expect(entry.compatibility, 'only the module\'s icon at the bottom left').is.undefined;
    // The graphic: TWO effect rows — «[Mars First] = [Reds]» and «[Mars First][Reds] RULING : [card]».
    type Node = {is?: string, type?: string, amount?: number, party?: PartyName, stacked?: true, innerText?: string, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    const boxes = rows.flat().filter((n) => n.is === 'effect');
    expect(boxes).has.length(2);
    const [pair, draw] = boxes;
    expect((pair.rows![0] as Array<Node>)[0]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: M});
    expect((pair.rows![1] as Array<Node>)[0]).deep.include({type: CardRenderSymbolType.EQUALS});
    expect((pair.rows![2] as Array<Node>)[0]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: R});
    expect(pair.rows![2]).deep.include('Effect: While Mars First is ruling or you have 2 delegates there, you may also use the Reds\' effect and cards. And vice versa.');
    const cause = draw.rows![0] as Array<Node>;
    expect(cause[0]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: M});
    expect(cause[1]).deep.include({type: CardRenderItemType.PARTY_SEAL, party: R, stacked: true, innerText: 'Ruling'});
    expect((draw.rows![2] as Array<Node>)[0]).deep.include({type: CardRenderItemType.CARDS, amount: 1});
    expect(draw.rows![2]).deep.include('Effect: Draw a card when either of those parties becomes ruling.');
  });

  describe('rule 1 — the pair is read off the tableau, live', () => {
    it('the card on the table — the alliance exists; gone — it does not; the Parliament names the card, never by name lookup', () => {
      const t = table();
      expect(t.parliament.alliancesOf(t.p1)).deep.eq([]);
      t.p1.playedCards.push(t.card);
      expect(t.parliament.alliancesOf(t.p1)).deep.eq([{parties: [M, R], source: ID}]);
      expect(t.parliament.access(t.p1, R).alliances).deep.eq([{partner: M, source: ID}]);
      expect(t.parliament.access(t.p1, M).alliances).deep.eq([{partner: R, source: ID}]);
      expect(t.parliament.access(t.p1, S).alliances, 'a party outside the pair').deep.eq([]);
      expect(t.parliament.alliancesOf(t.p2), 'the other seat has no pair').deep.eq([]);
      t.p1.playedCards.set();
      expect(t.parliament.alliancesOf(t.p1)).deep.eq([]);
    });
  });

  describe('rule 2 — the trigger is the PARTNER\'s PRINTED road', () => {
    it('Mars First rules → the Reds\' effect AND requirement are the owner\'s, by the alliance road', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(M));
      const reds = t.parliament.access(t.p1, R);
      expect(reds).deep.include({ruling: false, delegates: 0, byDelegates: false, hasEffect: true, satisfiesRequirement: true});
      expect(reds.allied).deep.eq([{via: M, source: ID, road: 'ruling'}]);
      expect(t.parliament.accessBasis(t.p1, R)).eq('alliance');
      expect(t.parliament.access(t.p2, R), 'the rival has no pair').deep.include({hasEffect: false, satisfiesRequirement: false});
    });

    it('two own cubes on Mars First → the Reds, by the delegates road of the partner; one cube → nothing', () => {
      const t = owned();
      cubes(t, t.p1, M, 1);
      expect(t.parliament.access(t.p1, R)).deep.include({hasEffect: false, satisfiesRequirement: false});
      cubes(t, t.p1, M, 1);
      expect(t.parliament.access(t.p1, R).allied).deep.eq([{via: M, source: ID, road: 'delegates'}]);
      expect(t.parliament.access(t.p1, R)).deep.include({hasEffect: true, satisfiesRequirement: true});
    });

    it('NOT a lowered threshold: one cube on Mars First under Council Seat gives Mars First\'s effect, never the Reds\' (FAQ p.19)', () => {
      const t = owned();
      t.p1.playedCards.push(new CouncilSeat());
      cubes(t, t.p1, M, 1);
      expect(t.parliament.hasPartyEffect(t.p1, M), 'Mars First\'s effect by the lowered threshold').is.true;
      expect(t.parliament.access(t.p1, R)).deep.include({hasEffect: false, satisfiesRequirement: false});
      expect(t.parliament.access(t.p1, R).allied).deep.eq([]);
    });

    it('NOT a grant: Mars First granted by a card does not set the alliance off', () => {
      const t = owned();
      t.parliament.grantPartyEffect(t.p1, M, 'Septem Tribus');
      expect(t.parliament.hasPartyEffect(t.p1, M)).is.true;
      expect(t.parliament.access(t.p1, R)).deep.include({hasEffect: false, satisfiesRequirement: false});
    });

    it('NO chain: one pair, one hop — the alliance road of a party never stands for its partner\'s partner', () => {
      const t = owned();
      // A second (test) pair Reds = Scientists: the Reds hold only by the alliance with Mars First — the Scientists stay closed.
      t.p1.playedCards.push(fakeCard({name: 'alliance-two' as CardName, partyAlliance: [R, S]}));
      seatEnacted(t.parliament, quietResolutionOf(M));
      expect(t.parliament.access(t.p1, R).hasEffect, 'Mars First → the Reds').is.true;
      expect(t.parliament.access(t.p1, S), 'the Reds stand by the ALLIANCE, never by their printed road — no second hop').deep.include({hasEffect: false, satisfiesRequirement: false});
    });
  });

  describe('rule 3 — what it gives, both ways', () => {
    it('vice versa: the Reds rule → Mars First is the owner\'s', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(R));
      expect(t.parliament.access(t.p1, M).allied).deep.eq([{via: R, source: ID, road: 'ruling'}]);
      expect(t.parliament.satisfiesPartyRequirement(t.p1, M)).is.true;
    });

    it('the Reds\' ACTION is offered in the action menu (the effect reader is `hasPartyEffect`), once a generation', () => {
      const t = owned();
      const offered = () => ParliamentHandler.partyActionOptions(t.p1).some((o) => (o as {partyActionPrompt?: {party: PartyName}}).partyActionPrompt?.party === R);
      expect(offered()).is.false;
      seatEnacted(t.parliament, quietResolutionOf(M));
      expect(offered(), 'Mars First rules: the Reds\' action is the owner\'s').is.true;
      expect(t.parliament.partyActionUsesLeft(t.p1, R)).eq(1);
    });

    it('a Reds CARD is playable: the requirement is met through Mars First (no delegate on the Reds anywhere)', () => {
      const t = owned();
      const outlet = new RedsNewsOutlet();
      t.p1.megaCredits = 30;
      t.p1.cardsInHand.push(outlet);
      expect(t.p1.canPlay(outlet)).is.false;
      seatEnacted(t.parliament, quietResolutionOf(M));
      expect(t.p1.canPlay(outlet)).is.true;
      expect(unplayableReasons(t.p1, outlet)).deep.eq([]);
    });

    it('Mars First\'s passive (a steel per tile on Mars) under the Reds\' rule', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(R));
      const steel = t.p1.steel;
      const space = t.game.board.getAvailableSpacesForGreenery(t.p1).find((s) => s.bonus.length === 0)!;
      t.game.addGreenery(t.p1, space);
      runAllActions(t.game);
      expect(t.p1.steel, 'Mars First\'s effect, through the alliance').eq(steel + 1);
    });
  });

  describe('rule 4 — the diff of the law announces the alliance road', () => {
    it('the second cube on Mars First → the Reds GAINED by the alliance (its own line, the typed event with via + source); Mars First by the delegates road', () => {
      const t = owned();
      t.parliament.announceAccessChanges(t.game);
      const at = t.game.events.events.length;
      const logAt = t.game.gameLog.length;
      cubes(t, t.p1, M, 2);
      t.parliament.announceAccessChanges(t.game);
      const told = announced(t.game, at);
      const reds = told.find((e) => e.impact.partyEffect?.party === R)!;
      expect(reds).deep.include({type: 'party-effect-gained', player: t.p1.color});
      expect(reds.impact.partyEffect).deep.eq({party: R, basis: 'alliance', via: M, source: ID});
      expect(told.find((e) => e.impact.partyEffect?.party === M)?.impact.partyEffect).deep.include({basis: 'delegates'});
      const lines = t.game.gameLog.slice(logAt).map((m) => formatMessage(m));
      expect(lines.some((l) => /gains the Reds party effect — allied with Mars First \(Tharsis Alliance\)/.test(l)), lines.join('\n')).is.true;
    });

    it('the cubes gone → the Reds LOST («the alliance with Mars First no longer holds»)', () => {
      const t = owned();
      cubes(t, t.p1, M, 2);
      t.parliament.announceAccessChanges(t.game);
      const at = t.game.events.events.length;
      const logAt = t.game.gameLog.length;
      t.parliament.slotOf(M)!.votes.length = 0;
      t.parliament.announceAccessChanges(t.game);
      const lost = announced(t.game, at).find((e) => e.impact.partyEffect?.party === R)!;
      expect(lost.type).eq('party-effect-lost');
      expect(lost.impact.partyEffect).deep.eq({party: R, basis: 'alliance', via: M, source: ID});
      const lines = t.game.gameLog.slice(logAt).map((m) => formatMessage(m));
      expect(lines.some((l) => /loses the Reds party effect — the alliance with Mars First no longer holds/.test(l)), lines.join('\n')).is.true;
    });

    it('Mars First ENACTED: the Reds are announced by the alliance road (it is not everyone\'s), Mars First is not (the sitting tells it once)', () => {
      const t = owned();
      cubes(t, t.p2, M, 3);
      t.parliament.announceAccessChanges(t.game);
      const at = t.game.events.events.length;
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.rulingParty()).eq(M);
      const told = announced(t.game, at).filter((e) => e.player === t.p1.color);
      expect(told.filter((e) => e.impact.partyEffect?.party === M), 'the ruling party is everyone\'s').deep.eq([]);
      const reds = told.filter((e) => e.impact.partyEffect?.party === R);
      expect(reds).has.length(1);
      expect(reds[0].impact.partyEffect).deep.eq({party: R, basis: 'alliance', via: M, source: ID});
      expect(t.parliament.partyEffectAccess?.get(t.p1.id)?.[R]).eq('alliance');
    });
  });

  describe('rule 5 — «becomes ruling» → a card, at the enactment', () => {
    it('Mars First enacted: the owner draws ONE card under this card\'s source, the journal names the party; the rival draws nothing', () => {
      const t = owned();
      cubes(t, t.p2, M, 3);
      const hand = t.p1.cardsInHand.length;
      const rival = t.p2.cardsInHand.length;
      const at = t.game.events.events.length;
      passToParliament(t.game);
      settleParliamentGates(t.game);
      expect(t.parliament.rulingParty()).eq(M);
      expect(t.p1.cardsInHand.length, 'one card').eq(hand + 1);
      expect(t.p2.cardsInHand.length, 'the rival holds no alliance').eq(rival);
      expect(linesOf(t, THARSIS_ALLIANCE_DRAW_LINE)).has.length(1);
      expect(formatMessage(linesOf(t, THARSIS_ALLIANCE_DRAW_LINE)[0])).match(/draws a card: Mars First is the new ruling party \(Tharsis Alliance\)/);
      const drawn = t.game.events.events.slice(at).find((e) => e.type === 'cards-drawn' && e.player === t.p1.color && e.source?.kind === 'card' && e.source.card === ID);
      expect(drawn, 'the draw is the card\'s, inside its own effect scope').is.not.undefined;
    });

    it('the Reds enacted draw too («either of those parties»); the Scientists do not', () => {
      const reds = owned();
      cubes(reds, reds.p2, R, 3);
      const hand = reds.p1.cardsInHand.length;
      passToParliament(reds.game);
      settleParliamentGates(reds.game);
      expect(reds.parliament.rulingParty()).eq(R);
      expect(reds.p1.cardsInHand.length).eq(hand + 1);

      const sci = owned();
      cubes(sci, sci.p2, S, 3);
      const before = sci.p1.cardsInHand.length;
      passToParliament(sci.game);
      settleParliamentGates(sci.game);
      expect(sci.parliament.rulingParty()).eq(S);
      expect(sci.p1.cardsInHand.length).eq(before);
      expect(linesOf(sci, THARSIS_ALLIANCE_DRAW_LINE)).deep.eq([]);
    });

    it('the hook is told both parties and judges «becomes» itself: the same party is no change', () => {
      const t = owned();
      const hand = t.p1.cardsInHand.length;
      t.card.onRulingPartyChanged(t.p1, M, M);
      t.card.onRulingPartyChanged(t.p1, G, M);
      expect(t.p1.cardsInHand.length).eq(hand);
      t.card.onRulingPartyChanged(t.p1, R, M);
      expect(t.p1.cardsInHand.length).eq(hand + 1);
    });

    it('playing the card while Mars First ALREADY rules draws nothing («becomes»)', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(M));
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      const hand = t.p1.cardsInHand.length;
      t.p1.playCard(t.card, Payment.of({megacredits: 8}));
      runAllActions(t.game);
      expect(t.p1.cardsInHand.length, 'the card left the hand, nothing came in').eq(hand - 1);
    });

    it('a RELOAD mid-sitting (at its last step) never calls the hook twice', () => {
      const t = owned();
      cubes(t, t.p2, M, 3);
      const hand = t.p1.cardsInHand.length;
      // The sitting runs its whole chain at once (the soft gates): the save is taken at its LAST step — the
      // enactment and its hook already behind it, nothing closed yet — and the resumed chain only finishes.
      let save: SerializedGame | undefined;
      atSittingEnd(t.game, () => (save = structuredClone(t.game.serialize())));
      passToParliament(t.game);
      expect(save?.parliament?.phase?.step, 'saved inside the sitting').eq('done');
      const game = Game.deserialize(save!);
      settleParliamentGates(game);
      const p1 = game.getPlayerById(t.p1.id);
      expect(game.parliament!.rulingParty()).eq(M);
      expect(p1.cardsInHand.length).eq(hand + 1);
      expect(game.gameLog.filter((m) => m.message === THARSIS_ALLIANCE_DRAW_LINE)).has.length(1);
    });

    it('MarsBot is never asked: outside the party-effects aspect, no pair, no card', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([S, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      bot.playedCards.push(new TharsisAlliance());
      expect(parliament.alliancesOf(bot)).deep.eq([]);
      seatEnacted(parliament, quietResolutionOf(M));
      expect(parliament.access(bot, R)).deep.include({hasEffect: false, satisfiesRequirement: false});
      human.playedCards.push(new TharsisAlliance());
      expect(parliament.access(human, R).hasEffect).is.true;
    });
  });

  describe('rule 6 — a requirement under the alliance', () => {
    it('a Reds card under Mars First\'s rule: effective `allied`, via Mars First, the source this card (`ally`), decisive', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(M));
      const [easing] = requirementEasingOf(t.p1, new RedsNewsOutlet());
      expect(easing).deep.include({type: RequirementType.PARTY, party: R, printed: 2, current: 0, effective: 'allied', via: M, met: true, decisive: true, max: false});
      expect(easing.sources).deep.eq([{source: {kind: 'card', card: ID}, kind: 'ally', via: M, road: 'ruling', oneShot: false}]);
    });

    it('met ANYWAY (two own cubes on the Reds): the reading stands, not decisive (quiet on every surface)', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(M));
      cubes(t, t.p1, R, 2);
      const [easing] = requirementEasingOf(t.p1, new RedsNewsOutlet());
      expect(easing).deep.include({effective: 'allied', met: true, decisive: false});
    });

    it('no alliance holding → no reading; a waiver (TR70) stands FIRST and names itself alone', () => {
      const t = owned();
      expect(requirementEasingOf(t.p1, new RedsNewsOutlet())).deep.eq([]);
      seatEnacted(t.parliament, quietResolutionOf(M));
      const deal = new BackroomDeal();
      t.p1.megaCredits = 40;
      t.p1.cardsInHand.push(deal);
      t.p1.playCard(deal, Payment.of({megacredits: 2}));
      runAllActions(t.game);
      const readings = requirementEasingOf(t.p1, new RedsNewsOutlet());
      expect(readings).has.length(1);
      expect(readings[0]).deep.include({effective: 'waived', decisive: false});
      expect(readings[0].sources.map((s) => s.kind)).deep.eq(['waive']);
    });

    it('the play RECORDS it: `requirement-eased` kind `ally` with the partner, and the journal\'s line', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(M));
      const outlet = new RedsNewsOutlet();
      t.p1.megaCredits = 30;
      t.p1.cardsInHand.push(outlet);
      const at = t.game.events.events.length;
      t.p1.playCard(outlet, Payment.of({megacredits: 7}));
      runAllActions(t.game);
      const eased = t.game.events.events.slice(at).find((e) => e.type === 'requirement-eased')!;
      expect(eased.source).deep.eq({kind: 'card', card: ID});
      expect(eased.impact.requirementEased).deep.eq({
        kind: 'ally', via: M, oneShot: false,
        requirements: [{type: RequirementType.PARTY, party: R, max: false, printed: 2, effective: 'allied'}],
      });
      const line = t.game.gameLog.find((m) => m.message === '${0} met the ${1} party requirement of ${2} through the alliance with ${3} (${4})');
      expect(line, 'the journal names the partner and the card').is.not.undefined;
    });

    it('vice versa on a Mars First card (Martian Census) under the Reds\' rule', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(R));
      const [easing] = requirementEasingOf(t.p1, new MartianCensus());
      expect(easing).deep.include({party: M, effective: 'allied', via: R, decisive: true});
    });
  });

  describe('rule 7 — the reason while no road holds names the alliance\'s second road', () => {
    it('owned, nothing standing: ONE blocker + `alliedVia`; without the card: the plain reason', () => {
      const t = owned();
      const outlet = new RedsNewsOutlet();
      t.p1.megaCredits = 30;
      expect(unplayableReasons(t.p1, outlet)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [R, '2'], party: R, current: 0,
        alliedVia: {party: M, card: ID}, requirement: true, requirementKey: 'req:party',
      }]);
      const plain = table();
      plain.p1.megaCredits = 30;
      expect(unplayableReasons(plain.p1, outlet)[0].alliedVia).is.undefined;
    });
  });

  describe('rule 8 — the preview says what opens NOW, and the play journals the same list', () => {
    it('nothing standing: the honest «nothing yet» and the draw note; read-only', () => {
      const t = table();
      t.p1.megaCredits = 20;
      const before = JSON.stringify(t.game.serialize());
      expect(notesOf(t, t.p1)).deep.eq([THARSIS_ALLIANCE_NOTHING_NOTE, THARSIS_ALLIANCE_DRAW_NOTE]);
      expect(JSON.stringify(t.game.serialize()), 'read-only').eq(before);
      expect(tharsisAllianceOpenings(t.p1, t.parliament)).deep.eq([]);
    });

    it('Mars First rules: «opens the Reds — Mars First is ruling»; the play journals one line', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(M));
      expect(tharsisAllianceOpenings(t.p1, t.parliament)).deep.eq([{party: R, via: M, road: 'ruling', effectHeld: false}]);
      expect(notesOf(t, t.p1)).deep.eq([THARSIS_ALLIANCE_OPENS_RULING_NOTE, THARSIS_ALLIANCE_DRAW_NOTE]);
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      t.p1.playCard(t.card, Payment.of({megacredits: 8}));
      runAllActions(t.game);
      expect(linesOf(t, THARSIS_ALLIANCE_HOLDS_LINE)).has.length(1);
      expect(formatMessage(linesOf(t, THARSIS_ALLIANCE_HOLDS_LINE)[0])).match(/holds the Reds party effect and cards: allied with Mars First \(Tharsis Alliance\)/);
    });

    it('two cubes on the Reds: «opens Mars First — two of your delegates are on <the Reds\' resolution>»', () => {
      const t = table();
      cubes(t, t.p1, R, 2);
      const [opening] = tharsisAllianceOpenings(t.p1, t.parliament);
      expect(opening).deep.include({party: M, via: R, road: 'delegates', effectHeld: false});
      expect(opening.resolution).eq(t.parliament.resolutionOf(t.parliament.slotOf(R)!.instance).id);
      expect(notesOf(t, t.p1)[0]).eq(THARSIS_ALLIANCE_OPENS_DELEGATES_NOTE);
    });

    it('the effect already held by another road (one cube under Council Seat): the play opens the CARDS only', () => {
      const t = table();
      t.p1.playedCards.push(new CouncilSeat());
      cubes(t, t.p1, M, 1);
      cubes(t, t.p1, R, 2);
      const [opening] = tharsisAllianceOpenings(t.p1, t.parliament);
      expect(opening).deep.include({party: M, via: R, effectHeld: true});
      expect(notesOf(t, t.p1)[0]).eq(THARSIS_ALLIANCE_OPENS_CARDS_DELEGATES_NOTE);
    });
  });

  describe('the vote reads the alliance before the press', () => {
    it('one cube on Mars First: the second one\'s projection names the Reds it opens; with the Reds held already — nothing', () => {
      const t = owned();
      cubes(t, t.p1, M, 1);
      const slot = t.parliament.slotOf(M)!;
      const projection = getParliamentModel(t.game, t.p1)!.viewer!.vote.projections.find((p) => p.instance === slot.instance)!;
      expect(projection.unlocksRequirement).is.true;
      expect(projection.unlocksAlliance).deep.eq({party: R, source: ID});
      cubes(t, t.p1, R, 2);
      const again = getParliamentModel(t.game, t.p1)!.viewer!.vote.projections.find((p) => p.instance === slot.instance)!;
      expect(again.unlocksAlliance, 'the Reds are the owner\'s by their own printed road').is.undefined;
    });

    it('the access model carries the roads on the wire', () => {
      const t = owned();
      seatEnacted(t.parliament, quietResolutionOf(M));
      const model = getParliamentModel(t.game, t.p1)!.players.find((p) => p.color === t.p1.color)!.access.find((a) => a.party === R)!;
      expect(model.allied).deep.eq([{via: M, source: ID, road: 'ruling'}]);
      expect(model.alliances).deep.eq([{partner: M, source: ID}]);
      const scientists = getParliamentModel(t.game, t.p1)!.players.find((p) => p.color === t.p1.color)!.access.find((a) => a.party === S)!;
      expect(scientists.allied, 'absent on a party outside the pair').is.undefined;
      expect(scientists.alliances).is.undefined;
    });
  });

  it('save / load: nothing new is serialized — the alliance is read off the tableau again', () => {
    const t = owned();
    seatEnacted(t.parliament, quietResolutionOf(M));
    expect(JSON.stringify(t.parliament.serialize()), 'nothing of the card in the parliament\'s save').not.includes(ID);
    const game = Game.deserialize(structuredClone(t.game.serialize()));
    const p1 = game.getPlayerById(t.p1.id);
    expect(game.parliament!.access(p1, R).allied).deep.eq([{via: M, source: ID, road: 'ruling'}]);
    expect(answerStandingGates(game)).eq(0);
  });
});
