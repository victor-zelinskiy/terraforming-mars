import {expect} from 'chai';
import {
  MECHS_ON_PLAY, MECHS_PER_STEP, MINING_MECHS_STEEL_TITLE, MINING_MECHS_TITANIUM_TITLE, MiningMechs,
} from '../../../src/server/cards/turmoilRedux/MiningMechs';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {ConstructionMechs} from '../../../src/server/cards/turmoilRedux/ConstructionMechs';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {MechSports} from '../../../src/server/cards/turmoilRedux/MechSports';
import {RoboticsFactory} from '../../../src/server/cards/turmoilRedux/RoboticsFactory';
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
 * TR57 — MINING MECHS: the Industrialists' fifth plate and the mechs' EIGHTH
 * holder — TR40's `or` declaration with ONE price and two goods («2 mechs →
 * +1 steel OR titanium production»). Every rule reading of the card file's
 * header is pinned here: the plate's two roads, the play's four mechs, the two
 * variants that live and die TOGETHER (one blocker, PL-197's counted reason),
 * TR56's mechs landing here, the Construction Mechs tender, the table's
 * answer as the server forecasts it, futility, MarsBot, save / load.
 */
const I = PartyName.INDUSTRIALISTS;
const COST = 7;
const MM = CardName.MINING_MECHS;
/** PL-197 — the class reason for a mech holder (the template's plural group resolves against the need). */
const SHORT = '${0} of ${1} {mech|mechs} on this card';

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: MiningMechs};

/** A two-seat Redux table in the action phase, the Industrialists RULING by an enacted card, 20 M€. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(I));
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card: new MiningMechs()};
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

/** The card on the player's table with `mechs` here. */
function owned(t: Table, mechs: number): Table {
  t.player.playedCards.push(t.card);
  t.card.resourceCount = mechs;
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
  expect(door.cards.map((c) => c.name)).to.include(MM);
  door.cb([t.card]);
  runAllActions(t.game);
  if (index !== undefined) {
    const or = cast(t.player.popWaitingFor(), OrOptions);
    or.options[index].cb(undefined);
    runAllActions(t.game);
  }
}

describe('MiningMechs', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 7, Building, a mech holder, no VP, the INDUSTRIALISTS\' plate, TR57 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(MM);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner holds one brown disc with the house').deep.eq([Tag.BUILDING]);
      expect(card.resourceType).eq(CardResource.MECH);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Industrialists\' cog — a requirement, not a tag').eq(I);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR57');
      expect(card.metadata.description).eq('Requires the Industrialists to be ruling or that you have 2 delegates there. Add 4 mech resources to this card.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[MM];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect([MECHS_ON_PLAY, MECHS_PER_STEP]).deep.eq([4, 2]);
      expect((card as ICard).actionUnavailableReason, 'no reason of its own — the declaration\'s automatic ones').is.undefined;
      expect((card as ICard).onCardPlayed, 'no trigger').is.undefined;
    });

    it('the ACTION is ONE DECLARATION: an `or` of two titled variants with the SAME price, steel then titanium', () => {
      const action = t.card.actionBehavior;
      expect(action).deep.eq({
        or: {
          behaviors: [
            {spend: {resourcesHere: 2}, production: {steel: 1}, title: MINING_MECHS_STEEL_TITLE},
            {spend: {resourcesHere: 2}, production: {titanium: 1}, title: MINING_MECHS_TITANIUM_TITLE},
          ],
          autoSelect: true,
        },
      });
    });

    it('the face reads the scan: ONE action row — the price printed once («[mech] [mech] →»), two production goods split by «OR»; then «4 [mech]»', () => {
      type Node = {type?: string, resource?: string, amount?: number, showDigit?: boolean, rows?: Array<Array<Node | string>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      const json = JSON.stringify(rows);
      expect(json.match(/"production-box"/g)?.length, `two production boxes: ${json}`).eq(2);
      expect(json, `one «OR» between the goods: ${json}`).to.match(/"type":"OR"/);
      expect(json).to.include('"steel"');
      expect(json).to.include('"titanium"');
      const last = rows[rows.length - 1].filter((n): n is Node => typeof n === 'object');
      expect(last.map((n) => [n.resource, n.amount, n.showDigit]), 'the play\'s own «4 [mech]», a digit beside one icon').deep.eq([[CardResource.MECH, 4, true]]);
    });

    it('the structured text prints the requirement, the action row with its short, and the play\'s own line', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Industrialists to be ruling or that you have 2 delegates on its resolution.',
        'Action: Spend 2 mechs from here to increase your steel or titanium production 1 step.',
        'Add 4 mechs to this card.',
      ]);
      expect(blocks.map((b) => [b.kind, b.short])).to.deep.include.members([
        ['action', 'Spend 2 mechs for 1 steel or titanium production'],
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
      const u = owned(redsRule(table()), 2);
      expect(u.card.canAct(u.player)).is.true;
    });
  });

  describe('rule 2 — the play: 4 mechs on THIS card at once, nothing else', () => {
    it('the cost is paid, the card is in the tableau with 4 mechs, nothing is asked; the journal names the four', () => {
      const at = t.game.gameLog.length;
      play(t);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(MM)).eq(t.card);
      expect(t.card.resourceCount).eq(MECHS_ON_PLAY);
      expect(t.player.getWaitingFor()).is.undefined;
      expect([t.player.production.steel, t.player.production.titanium], 'the play raises nothing').deep.eq([0, 0]);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      expect(lines.some((l) => /4 mech/i.test(l) && l.includes(MM)), lines.join('\n')).is.true;
    });

    it('the composer promises the four as the card\'s own chip', () => {
      t.player.cardsInHand.push(t.card);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches[0].effects.find((e) => e.icon === 'mech')).deep.include({direction: 'gain', amount: MECHS_ON_PLAY});
    });
  });

  describe('rule 3 — ONE action, two variants sharing ONE price: live together, dead together', () => {
    it('2 mechs: an OrOptions in the printed order (steel, titanium), marked as this card\'s effect choice; the preview\'s two branches index it, one price chip each', () => {
      owned(t, 2);
      expect(t.card.action(t.player), 'the declarative class DEFERS its question').is.undefined;
      runAllActions(t.game);
      const or = cast(t.player.popWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([MINING_MECHS_STEEL_TITLE, MINING_MECHS_TITANIUM_TITLE]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: MM});
      expect(or.choiceContext?.mode).eq('effect-choice');
      const preview = actionPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches.map((b) => [b.index, b.available])).deep.eq([[0, true], [1, true]]);
      for (const [b, good] of [[preview.branches[0], Resource.STEEL], [preview.branches[1], Resource.TITANIUM]] as const) {
        expect(b.effects[0]).deep.include({direction: 'cost', icon: 'mech', amount: 2, current: 2, resulting: 0, note: 'on this card'});
        expect(b.effects[1]).deep.include({direction: 'gain', icon: good, amount: 1, current: 0, resulting: 1, note: 'production'});
      }
      expect(t.card.resourceCount, 'nothing moved by the question itself').eq(2);
    });

    it('steel: mechs 5 → 3, +1 steel production, the use spent once per generation; titanium: the same with titanium', () => {
      owned(t, 5);
      act(t, 0);
      expect(t.card.resourceCount).eq(3);
      expect([t.player.production.steel, t.player.production.titanium]).deep.eq([1, 0]);
      expect(t.player.actionsThisGeneration.has(MM), 'once per generation').is.true;
      expect(t.player.getPlayableActionCards().includes(t.card), 'not again this generation').is.false;

      const u = owned(table(), 3);
      act(u, 1);
      expect(u.card.resourceCount).eq(1);
      expect([u.player.production.steel, u.player.production.titanium]).deep.eq([0, 1]);
    });

    it('the journal reads the price, then the step, under the card', () => {
      owned(t, 2);
      const at = t.game.gameLog.length;
      act(t, 1);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      const spend = lines.findIndex((l) => /removed 2 /i.test(l) && l.includes(MM));
      const step = lines.findIndex((l) => /titanium/i.test(l) && /production/i.test(l));
      expect(spend, lines.join('\n')).is.gte(0);
      expect(step, lines.join('\n')).is.gt(spend);
    });

    const cases: Array<[mechs: number, canAct: boolean]> = [[0, false], [1, false], [2, true], [5, true]];
    for (const [mechs, expected] of cases) {
      it(`${mechs} mech(s) → canAct ${expected}; both variants share the verdict`, () => {
        owned(t, mechs);
        expect(t.card.canAct(t.player)).eq(expected);
        expect(t.player.getPlayableActionCards().includes(t.card)).eq(expected);
        const branches = actionPreview(t.player, t.card).branches;
        expect(branches.map((b) => b.available), 'one price — never live apart').deep.eq([expected, expected]);
      });
    }
  });

  describe('rule 9 — PL-197: «1 of 2 mechs on this card», ONE blocker with the count', () => {
    it('1 mech: ONE card-level reason — the count, the need and the resource; the two variants\' identical reasons collapse', () => {
      owned(t, 1);
      expect(actionUnavailableReasons(t.player, t.card)).deep.eq([{type: 'count', message: SHORT, params: ['1', '2'], current: 1}]);
    });

    it('0 mechs: «0 of 2»; each refused variant carries the same template and params, SHOWN with its chips', () => {
      owned(t, 0);
      expect(actionUnavailableReasons(t.player, t.card)).deep.eq([{type: 'count', message: SHORT, params: ['0', '2'], current: 0}]);
      for (const b of actionPreview(t.player, t.card).branches) {
        expect(b.unavailableReason).eq(SHORT);
        expect(b.unavailableReasonParams).deep.eq(['0', '2']);
        expect(b.effects.map((e) => e.icon)).has.length(2);
      }
    });
  });

  describe('rule 4 — mechs from other cards: TR56 Robotics Factory may put its three HERE', () => {
    it('Robotics Factory\'s mech branch lists this card among the holders; picked, 1 → 4 and the action is live', () => {
      owned(t, 1);
      const construction = new ConstructionMechs();
      t.player.playedCards.push(construction);
      const rf = new RoboticsFactory();
      t.player.cardsInHand.push(rf);
      t.player.playCard(rf, Payment.of({megacredits: 7}));
      runAllActions(t.game);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).to.have.members([MM, CardName.CONSTRUCTION_MECHS]);
      target.process({type: 'card', cards: [MM]});
      expect(t.card.resourceCount).eq(4);
      expect(t.card.canAct(t.player)).is.true;
    });

    it('the mechs here are nobody\'s money and nobody\'s VP: 0 on the `mechs` / `constructionMechs` units, 0 for Mech Sports', () => {
      owned(t, 4);
      expect(t.player.getSpendable('mechs')).eq(0);
      expect(t.player.getSpendable('constructionMechs')).eq(0);
      const sports = new MechSports();
      t.player.playedCards.push(sports);
      expect(sports.getVictoryPoints(t.player)).eq(0);
      const eva = new EvaMechs();
      eva.resourceCount = 1;
      t.player.playedCards.push(eva);
      expect(t.player.getSpendable('mechs'), 'EVA\'s one mech is the only tender').eq(1);
    });
  });

  describe('rule 5 — the Building tag: Construction Mechs pays for this card, EVA does not', () => {
    it('the `constructionMechs` lane opens, the `mechs` lane stays shut; two Construction mechs pay the 7', () => {
      t.player.cardsInHand.push(t.card);
      const options = t.player.paymentOptionsForCard(t.card);
      expect(options.constructionMechs).is.true;
      expect(options.mechs).is.false;
      const construction = new ConstructionMechs();
      construction.resourceCount = 2;
      t.player.playedCards.push(construction);
      t.player.megaCredits = 0;
      t.player.cardsInHand.pop();
      play(t, Payment.of({constructionMechs: 2}));
      expect(t.player.playedCards.get(MM)).eq(t.card);
      expect(construction.resourceCount).eq(0);
      expect(t.card.resourceCount, 'the play\'s own four, untouched by the price').eq(MECHS_ON_PLAY);
    });
  });

  describe('rule 6 — the table\'s answer to the step is the server\'s forecast', () => {
    it('Manutech answers each variant with ITS good, filed under its branch — +1 steel on A, +1 titanium on B', () => {
      owned(t, 2);
      t.player.playedCards.push(new Manutech());
      const forecast = effectForecastForAction(t.player, t.card, actionPreview(t.player, t.card));
      const manutech = (pos: number) => (forecast.byBranch?.[pos] ?? []).find((f) => f.source?.name === CardName.MANUTECH);
      expect(manutech(0)?.effects[0], JSON.stringify(forecast)).deep.include({direction: 'gain', icon: Resource.STEEL, amount: 1});
      expect(manutech(1)?.effects[0], JSON.stringify(forecast)).deep.include({direction: 'gain', icon: Resource.TITANIUM, amount: 1});
    });

    it('the press answers as forecast: Manutech pays one titanium beside the step', () => {
      owned(t, 2);
      t.player.playedCards.push(new Manutech());
      act(t, 1);
      expect([t.player.production.titanium, t.player.titanium]).deep.eq([1, 1]);
    });
  });

  describe('rules 7–8 — preview = execution; a production step is never futile', () => {
    it('the action is never flagged futile, live or not', () => {
      for (const mechs of [0, 2, 9]) {
        const u = owned(table(), mechs);
        expect(actionFutility(u.player, u.card), `${mechs} mechs`).is.undefined;
      }
    });

    it('the satellite reads ONE PRICE, A CHOICE OF GOODS — 2 mechs → +1 steel OR titanium production (PL-484, the owner\'s К-§6.1)', () => {
      expect(holderActionGoodOf(t.card)).deep.eq({
        spend: 2,
        good: {kind: 'production', resource: 'steel', amount: 1},
        or: [{kind: 'production', resource: 'titanium', amount: 1}],
      });
    });

    it('the previews are pure: building them moves nothing', () => {
      owned(t, 3);
      const before = JSON.stringify(t.game.serialize());
      actionPreview(t.player, t.card);
      actionUnavailableReasons(t.player, t.card);
      effectForecastForAction(t.player, t.card, actionPreview(t.player, t.card));
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  describe('rule 10 — MarsBot and save / load', () => {
    it('the bot\'s building tag is nobody\'s play of this card: nothing moves, nothing is asked', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new MiningMechs();
      card.resourceCount = 2;
      human.playedCards.push(card);
      AutomaResolver.resolveTag(game, Tag.BUILDING);
      runAllActions(game);
      expect(card.resourceCount).eq(2);
      expect([human.production.steel, human.production.titanium]).deep.eq([0, 0]);
    });

    it('the stored mechs and the spent action survive serialization', () => {
      owned(t, 4);
      t.player.actionsThisGeneration.add(MM);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      const card = again.playedCards.get(MM) as IProjectCard | undefined;
      expect(card?.resourceCount).eq(4);
      expect(again.actionsThisGeneration.has(MM)).is.true;
    });
  });
});
