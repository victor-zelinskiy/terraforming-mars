import {expect} from 'chai';
import {
  CIVILIAN_SPACEFIGHTERS_BUY_TITLE, CIVILIAN_SPACEFIGHTERS_PAYOUT_TITLE, CivilianSpacefighters, FIGHTERS_ON_PLAY, FIGHTERS_PER_PAYOUT,
  FIGHTERS_PER_PURCHASE, PAYOUT_MEGACREDITS, PAYOUT_PRODUCTION, TITANIUM_PER_STEP,
} from '../../../src/server/cards/turmoilRedux/CivilianSpacefighters';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {RoboticsFactory} from '../../../src/server/cards/turmoilRedux/RoboticsFactory';
import {SpaceshipRecycling} from '../../../src/server/cards/turmoilRedux/SpaceshipRecycling';
import {SecurityFleet} from '../../../src/server/cards/base/SecurityFleet';
import {Manutech} from '../../../src/server/cards/venusNext/Manutech';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {AutomaResolver} from '../../../src/server/automa/AutomaResolver';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {actionFutility} from '../../../src/server/models/actionFutility';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForAction} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {holderActionGoodOf} from '../../../src/server/cards/holderActionGood';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR60 — CIVILIAN SPACEFIGHTERS: the Industrialists' seventh plate, a fighter
 * holder with TR40's `or` form in fighters — «1 titanium → 2 fighters here» OR
 * «1 fighter off here → 3 M€ AND +1 M€ production». Every rule reading of the
 * card file's header is pinned here: the plate's two roads, the play's one
 * fighter, the two variants and what the ENGINE answers for each
 * configuration (both live → `OrOptions`, one live → no question, both dead →
 * the titanium first), B's TWO goods at once, the titanium as the only tender
 * for A, TR56 landing fighters here and TR29 taking them away, the Space tag's
 * payment lanes, the table's answer as the server forecasts it, the holder's
 * SET role (the owner's decision 4a), futility, MarsBot, save / load.
 */
const I = PartyName.INDUSTRIALISTS;
const COST = 6;
const CS = CardName.CIVILIAN_SPACEFIGHTERS;
/** PL-197 — the class reason for a fighter holder (the template's plural group resolves against the need). */
const SHORT = '${0} of ${1} {fighter|fighters} on this card';

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: CivilianSpacefighters};

/** A two-seat Redux table in the action phase, the Industrialists RULING by an enacted card, 20 M€. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(I));
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card: new CivilianSpacefighters()};
}

/** The Reds rule by an enacted card — the Industrialists' plate is open only by delegates. */
function redsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
  return t;
}

/** `n` of `player`'s own cubes on the Industrialists' quiet resolution. */
function industrialistCubes(t: Table, player: TestPlayer, n: number): void {
  let slot = t.parliament.slotOf(I);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(I));
    slot = t.parliament.slotOf(I)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

/** The card on the player's table with `fighters` here and the player at `titanium`. */
function owned(t: Table, fighters: number, titanium: number): Table {
  t.player.playedCards.push(t.card);
  t.card.resourceCount = fighters;
  t.player.titanium = titanium;
  return t;
}

function play(t: Table, payment: Payment = Payment.of({megacredits: COST})): void {
  t.player.cardsInHand.push(t.card);
  t.player.playCard(t.card, payment);
  runAllActions(t.game);
}

/** The blue card's action from the action menu, every deferred step run; answers the variant question with `index`. */
function act(t: Table, index?: number): void {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name)).to.include(CS);
  door.cb([t.card]);
  runAllActions(t.game);
  if (index !== undefined) {
    const or = cast(t.player.popWaitingFor(), OrOptions);
    or.options[index].cb(undefined);
    runAllActions(t.game);
  }
}

describe('CivilianSpacefighters', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 6, Space, a fighter holder, no VP, the INDUSTRIALISTS\' plate, TR60 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(CS);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner holds one black disc with the yellow star').deep.eq([Tag.SPACE]);
      expect(card.resourceType).eq(CardResource.FIGHTER);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Industrialists\' cog — a requirement, not a tag').eq(I);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR60');
      expect(card.metadata.description).eq('Requires the Industrialists to be ruling or that you have 2 delegates there. Add 1 fighter resource to this card.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CS];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect([FIGHTERS_ON_PLAY, TITANIUM_PER_STEP, FIGHTERS_PER_PURCHASE, FIGHTERS_PER_PAYOUT, PAYOUT_MEGACREDITS, PAYOUT_PRODUCTION])
        .deep.eq([1, 1, 2, 1, 3, 1]);
      expect((card as ICard).actionUnavailableReason, 'no reason of its own — the declaration\'s automatic ones').is.undefined;
      expect((card as ICard).onCardPlayed, 'no trigger').is.undefined;
    });

    it('the ACTION is ONE DECLARATION: an `or` of two titled variants — A buys with TITANIUM, B pays the production THEN the 3 M€', () => {
      expect(t.card.actionBehavior).deep.eq({
        or: {
          behaviors: [
            {spend: {titanium: 1}, addResources: 2, title: CIVILIAN_SPACEFIGHTERS_BUY_TITLE},
            {spend: {resourcesHere: 1}, production: {megacredits: 1}, stock: {megacredits: 3}, title: CIVILIAN_SPACEFIGHTERS_PAYOUT_TITLE},
          ],
          autoSelect: true,
        },
      });
      const payout = t.card.actionBehavior?.or?.behaviors[1] ?? {};
      expect(Object.keys(payout).filter((k) => k === 'production' || k === 'stock'), 'the printed order: the production box first').deep.eq(['production', 'stock']);
    });

    it('the face reads the scan: «[titanium] → 2 [fighter]» / «OR» / «[fighter] → [M€ production 1] [3 M€]»; then «[fighter]»', () => {
      type Node = {type?: string, resource?: string, amount?: number, showDigit?: boolean, rows?: Array<Array<Node | string>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      const json = JSON.stringify(rows);
      expect(json.match(/"production-box"/g)?.length, `one production box: ${json}`).eq(1);
      expect(json, `one «OR» between the rows: ${json}`).to.match(/"type":"OR"/);
      expect(json).to.include('"titanium"');
      // The production box stands BEFORE the 3 M€ in the B row (the scan's order, not the text's).
      const box = json.indexOf('"production-box"');
      const stockMc = json.indexOf('"amount":3');
      expect(box, json).is.gte(0);
      expect(stockMc, json).is.gt(box);
      const last = rows[rows.length - 1].filter((n): n is Node => typeof n === 'object');
      expect(last.map((n) => [n.resource, n.amount]), 'the play\'s own fighter under the art').deep.eq([[CardResource.FIGHTER, 1]]);
    });

    it('the structured text prints the requirement, the two action rows with B\'s short, and the play\'s own line', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      const texts = blocks.map((b) => b.text);
      expect(texts[0]).eq('Requires Industrialists to be ruling or that you have 2 delegates on its resolution.');
      expect(texts).to.include('Action: Pay 1 titanium to add 2 fighter resources to this card.');
      expect(texts).to.include('Action: Spend 1 fighter from here to gain 3 M€ and increase your M€ production 1 step.');
      expect(texts[texts.length - 1]).to.match(/fighter/i);
      expect(blocks.map((b) => [b.kind, b.short])).to.deep.include.members([
        ['action', 'Spend 1 fighter for 3 M€ and 1 M€ production'],
      ]);
    });
  });

  describe('rule 1 — the requirement: the Industrialists rule, or 2 of your delegates on their resolution', () => {
    it('ruling: playable with no delegate anywhere', () => {
      t.player.cardsInHand.push(t.card);
      expect(t.parliament.rulingParty()).eq(I);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      t.player.cardsInHand.push(t.card);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [I, '2'], party: I, current: 0, requirement: true,
      });
      industrialistCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: I, current: 1});
      industrialistCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never the REQUIREMENT: one cube with the Seat still reads «1 of 2»', () => {
      redsRule(t);
      t.player.cardsInHand.push(t.card);
      t.player.playedCards.push(new CouncilSeat());
      industrialistCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: I, current: 1, params: [I, '2']});
    });

    it('checked at the PLAY only: on the table, the action works whoever rules', () => {
      const u = owned(redsRule(table()), 1, 0);
      expect(u.card.canAct(u.player)).is.true;
    });
  });

  describe('rule 2 — the play: 1 fighter on THIS card, nothing else', () => {
    it('the cost is paid, the card is in the tableau with 1 fighter, nothing is asked; the journal names the fighter', () => {
      const at = t.game.gameLog.length;
      play(t);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(CS)).eq(t.card);
      expect(t.card.resourceCount).eq(FIGHTERS_ON_PLAY);
      expect(t.player.getWaitingFor()).is.undefined;
      expect(t.player.production.megacredits, 'the play raises nothing').eq(0);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      expect(lines.some((l) => /fighter/i.test(l) && l.includes(CS)), lines.join('\n')).is.true;
    });

    it('the composer promises the fighter as the card\'s own chip', () => {
      t.player.cardsInHand.push(t.card);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches[0].effects.find((e) => e.icon === 'fighter')).deep.include({direction: 'gain', amount: FIGHTERS_ON_PLAY});
    });
  });

  describe('rules 3–4 — ONE action, two variants, their availability (what the `or` engine answers)', () => {
    it('both live: an OrOptions in the printed order (A, then B), marked as this card\'s effect choice; the preview\'s two branches index it', () => {
      owned(t, 1, 1);
      expect(t.card.action(t.player), 'the declarative class DEFERS its question').is.undefined;
      runAllActions(t.game);
      const or = cast(t.player.popWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([CIVILIAN_SPACEFIGHTERS_BUY_TITLE, CIVILIAN_SPACEFIGHTERS_PAYOUT_TITLE]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CS});
      expect(or.choiceContext?.mode).eq('effect-choice');
      const preview = actionPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches.map((b) => [b.index, b.available])).deep.eq([[0, true], [1, true]]);
      expect([t.player.titanium, t.card.resourceCount, t.player.megaCredits], 'nothing moved by the question itself').deep.eq([1, 1, 20]);
    });

    it('A alone (no fighter, 1 titanium): no prompt — 1 titanium → 2 fighters here', () => {
      owned(t, 0, 1);
      expect(actionPreview(t.player, t.card).branches.map((b) => [b.index, b.available])).deep.eq([[-1, true], [-1, false]]);
      expect(t.card.action(t.player), 'one live variant is the whole action').is.undefined;
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
      expect([t.player.titanium, t.card.resourceCount]).deep.eq([0, FIGHTERS_PER_PURCHASE]);
    });

    it('B alone (a fighter, no titanium): no prompt — the fighter leaves, +3 M€ AND +1 M€ production at once', () => {
      owned(t, 1, 0);
      expect(actionPreview(t.player, t.card).branches.map((b) => [b.index, b.available])).deep.eq([[-1, false], [-1, true]]);
      expect(t.card.action(t.player)).is.undefined;
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
      expect([t.card.resourceCount, t.player.megaCredits, t.player.production.megacredits]).deep.eq([0, 23, 1]);
    });

    it('A refused at 0 titanium is SHOWN with the automatic titanium reason; B at 0 fighters with the class count — never hidden', () => {
      owned(t, 1, 0);
      const a = actionPreview(t.player, t.card).branches[0];
      expect(a.available).is.false;
      expect(a.unavailableReason).eq('Not enough titanium');
      expect(a.effects.map((e) => e.icon), 'the refused variant still shows its chips').deep.eq([Resource.TITANIUM, 'fighter']);

      const u = owned(table(), 0, 1);
      const b = actionPreview(u.player, u.card).branches[1];
      expect(b.available).is.false;
      expect(b.unavailableReason).eq(SHORT);
      expect(b.unavailableReasonParams, '«0 of 1 fighter» (PL-197)').deep.eq(['0', '1']);
    });

    describe('both dead — `canAct` is false and the FIRST card-level reason is the titanium', () => {
      const cases: Array<[titanium: number, fighters: number, canAct: boolean]> = [[1, 0, true], [0, 1, true], [1, 1, true], [0, 0, false]];
      for (const [titanium, fighters, expected] of cases) {
        it(`titanium ${titanium}, fighters ${fighters} → ${expected}`, () => {
          owned(t, fighters, titanium);
          expect(t.card.canAct(t.player)).eq(expected);
          expect(t.player.getPlayableActionCards().includes(t.card)).eq(expected);
        });
      }

      it('no fighter and no titanium: the titanium first, the fighter count second — both named, nothing invented (rule 8)', () => {
        owned(t, 0, 0);
        const reasons = actionUnavailableReasons(t.player, t.card);
        expect(reasons.map((r) => r.message)).deep.eq(['Not enough titanium', SHORT]);
        expect(reasons[0]).deep.include({type: 'resource', resource: Resource.TITANIUM, current: 0});
        expect(reasons[1]).deep.include({type: 'count', params: ['0', '1'], current: 0});
        expect(actionPreview(t.player, t.card).branches.map((b) => b.available), 'two branches, both shown').deep.eq([false, false]);
      });
    });

    it('once per generation, as any blue card\'s action', () => {
      owned(t, 2, 2);
      act(t, 0);
      expect(t.player.actionsThisGeneration.has(CS)).is.true;
      expect(t.player.getPlayableActionCards().includes(t.card), 'not again this generation').is.false;
    });
  });

  describe('rule 4 — A is paid in TITANIUM the player owns, never in M€ with titanium accepted', () => {
    it('titanium 1 → 0, fighters +2; the M€ and every other stock untouched; the titanium value changes nothing', () => {
      owned(t, 0, 1);
      t.player.increaseTitaniumValue();
      t.player.steel = 5;
      t.player.heat = 5;
      act(t);
      expect([t.player.titanium, t.card.resourceCount, t.player.megaCredits, t.player.steel, t.player.heat]).deep.eq([0, 2, 20, 5, 5]);
    });

    it('20 M€ and no titanium: A is refused — M€ never stands in for it', () => {
      owned(t, 0, 0);
      expect(t.player.megaCredits).eq(20);
      expect(t.card.canAct(t.player)).is.false;
    });

    it('A\'s events: the titanium leaves, then the two fighters arrive, under the card\'s source', () => {
      owned(t, 0, 1);
      const before = t.game.events.events.length;
      act(t);
      const events = t.game.events.events.slice(before);
      const titanium = events.findIndex((e) => e.impact.stock?.titanium === -1);
      const fighters = events.findIndex((e) => (e.impact.cardResources ?? []).some((cr) =>
        cr.target === CS && cr.cardResource === CardResource.FIGHTER && cr.amount === 2));
      expect(titanium, JSON.stringify(events.map((e) => e.type))).is.gte(0);
      expect(fighters, JSON.stringify(events.map((e) => e.type))).is.gt(titanium);
    });
  });

  describe('rule 5 — B pays TWO goods for ONE fighter at once', () => {
    it('fighters 3 → 2, M€ 20 → 23, M€ production 0 → 1 — «and», never «or» (no second question)', () => {
      owned(t, 3, 1);
      act(t, 1);
      expect(t.player.getWaitingFor()).is.undefined;
      expect([t.card.resourceCount, t.player.megaCredits, t.player.production.megacredits]).deep.eq([2, 23, 1]);
    });

    it('the preview of B carries the price chip «1 → 0 on this card» and BOTH goods — the production step, then the 3 M€', () => {
      owned(t, 1, 0);
      const b = actionPreview(t.player, t.card).branches[1];
      expect(b.effects[0]).deep.include({direction: 'cost', icon: 'fighter', amount: 1, current: 1, resulting: 0, note: 'on this card'});
      const mc = b.effects.filter((e) => e.icon === Resource.MEGACREDITS && e.direction === 'gain');
      expect(mc.map((e) => [e.amount, e.note ?? '']), JSON.stringify(b.effects)).to.deep.include.members([[1, 'production'], [3, '']]);
    });

    it('the journal reads the price, then both goods, under the card', () => {
      owned(t, 1, 0);
      const at = t.game.gameLog.length;
      act(t);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      const spend = lines.findIndex((l) => /removed 1 /i.test(l) && l.includes(CS));
      const production = lines.findIndex((l) => /gained 1 megacredits production/i.test(l));
      const stock = lines.findIndex((l) => /gained 3 megacredits$/i.test(l));
      expect(spend, lines.join('\n')).is.gte(0);
      expect(production, `the production step after the price, as printed:\n${lines.join('\n')}`).is.gt(spend);
      expect(stock, `the 3 M€ after the production step, as printed:\n${lines.join('\n')}`).is.gt(production);
    });

    it('Manutech answers B\'s production step — the forecast files «+1 M€» under branch 1 and the press pays it', () => {
      owned(t, 1, 1);
      t.player.playedCards.push(new Manutech());
      const forecast = effectForecastForAction(t.player, t.card, actionPreview(t.player, t.card));
      const manutech = (pos: number) => (forecast.byBranch?.[pos] ?? []).find((f) => f.source?.name === CardName.MANUTECH);
      expect(manutech(1)?.effects[0], JSON.stringify(forecast)).deep.include({direction: 'gain', icon: Resource.MEGACREDITS, amount: 1});
      expect(manutech(0), 'A raises no production — Manutech is silent there').is.undefined;
      act(t, 1);
      expect([t.player.megaCredits, t.player.production.megacredits]).deep.eq([24, 1]);
    });
  });

  describe('rule 6 — fighters from OTHER cards: TR56 lands them here, TR29 may take them away; nobody\'s VP', () => {
    it('Robotics Factory\'s fighter branch lists this card; picked, 0 → 3 and B is live', () => {
      owned(t, 0, 0);
      const rf = new RoboticsFactory();
      t.player.cardsInHand.push(rf);
      t.player.playCard(rf, Payment.of({megacredits: 7}));
      runAllActions(t.game);
      const waiting = t.player.getWaitingFor();
      const target = waiting instanceof OrOptions ?
        cast(waiting.options.map((o) => o).find((o) => o.title === 'Add 3 fighters to ANY card')?.cb(undefined), SelectCard) :
        cast(waiting, SelectCard);
      expect(target.cards.map((c) => c.name)).to.include(CS);
      target.process({type: 'card', cards: [CS]});
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(3);
      expect(actionPreview(t.player, t.card).branches[1].available).is.true;
    });

    it('Spaceship Recycling may spend a fighter from HERE — B loses its fuel', () => {
      owned(t, 1, 0);
      const rec = new SpaceshipRecycling();
      t.player.playedCards.push(rec);
      expect(rec.canAct(t.player), 'a fighter on this card is a fighter on the player\'s cards').is.true;
      rec.action(t.player);
      runAllActions(t.game);
      const pick = cast(t.player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).to.include(CS);
      pick.cb([t.card]);
      runAllActions(t.game);
      const rest = t.player.popWaitingFor();
      if (rest instanceof OrOptions) {
        rest.options[0].cb(undefined);
        runAllActions(t.game);
      }
      expect(t.card.resourceCount).eq(0);
      expect(actionPreview(t.player, t.card).branches[1].available, 'B has no fuel left').is.false;
    });

    it('the fighters here are nobody\'s VP: 0 on this card, Security Fleet scores its own only', () => {
      owned(t, 4, 0);
      expect(t.card.getVictoryPoints(t.player)).eq(0);
      const fleet = new SecurityFleet();
      t.player.playedCards.push(fleet);
      expect(fleet.getVictoryPoints(t.player)).eq(0);
    });
  });

  describe('rule 7 — the Space tag: titanium and EVA Mechs\' mechs pay for the PLAY', () => {
    it('the titanium lane and the `mechs` lane (EVA, Space) open; the `constructionMechs` lane (Building) stays shut', () => {
      t.player.cardsInHand.push(t.card);
      const options = t.player.paymentOptionsForCard(t.card);
      expect(options.titanium).is.true;
      expect(options.mechs).is.true;
      expect(options.constructionMechs).is.false;
    });

    it('two titanium pay the 6 (titanium at 3 M€); one EVA mech pays 5 of it', () => {
      t.player.megaCredits = 0;
      t.player.titanium = 2;
      play(t, Payment.of({titanium: 2}));
      expect(t.player.playedCards.get(CS)).eq(t.card);
      expect(t.player.titanium).eq(0);

      const u = table();
      const eva = new EvaMechs();
      eva.resourceCount = 1;
      u.player.playedCards.push(eva);
      u.player.megaCredits = 1;
      play(u, Payment.of({mechs: 1, megacredits: 1}));
      expect(u.player.playedCards.get(CS)).eq(u.card);
      expect(eva.resourceCount).eq(0);
    });
  });

  describe('rules 9–11 — futility, the holder\'s SET role, preview purity', () => {
    it('the action is never flagged futile, live or not', () => {
      for (const [fighters, titanium] of [[0, 0], [1, 0], [0, 1], [5, 5]]) {
        const u = owned(table(), fighters, titanium);
        expect(actionFutility(u.player, u.card), `${fighters} fighters, ${titanium} titanium`).is.undefined;
      }
    });

    it('the satellite reads ONE PRICE, A SET OF GOODS — 1 fighter → +1 M€ production AND 3 M€ (the owner\'s decision 4a)', () => {
      expect(holderActionGoodOf(t.card)).deep.eq({
        spend: 1,
        good: {kind: 'production', resource: 'megacredits', amount: 1},
        with: [{kind: 'stock', resource: 'megacredits', amount: 3}],
      });
    });

    it('the previews are pure: building them moves nothing', () => {
      owned(t, 2, 2);
      const before = JSON.stringify(t.game.serialize());
      actionPreview(t.player, t.card);
      actionUnavailableReasons(t.player, t.card);
      effectForecastForAction(t.player, t.card, actionPreview(t.player, t.card));
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  describe('rule 12 — MarsBot and save / load', () => {
    it('the bot\'s space tag is nobody\'s play of this card: nothing moves, nothing is asked', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new CivilianSpacefighters();
      card.resourceCount = 2;
      human.playedCards.push(card);
      AutomaResolver.resolveTag(game, Tag.SPACE);
      runAllActions(game);
      expect(card.resourceCount).eq(2);
      expect(human.production.megacredits).eq(0);
    });

    it('the stored fighters and the spent action survive serialization', () => {
      owned(t, 3, 0);
      t.player.actionsThisGeneration.add(CS);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      const card = again.playedCards.get(CS) as IProjectCard | undefined;
      expect(card?.resourceCount).eq(3);
      expect(again.actionsThisGeneration.has(CS)).is.true;
    });
  });
});
