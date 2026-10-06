import {expect} from 'chai';
import {EarthArmyContract} from '../../../src/server/cards/turmoilRedux/EarthArmyContract';
import {UnitedNationsMarsInitiative} from '../../../src/server/cards/corporation/UnitedNationsMarsInitiative';
import {TerraformingDeal} from '../../../src/server/cards/prelude2/TerraformingDeal';
import {SecurityFleet} from '../../../src/server/cards/base/SecurityFleet';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Player} from '../../../src/server/Player';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {effectForecastForAction} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {AddResourcesToCard} from '../../../src/server/deferredActions/AddResourcesToCard';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {Vesta} from '../../../src/server/colonies/Vesta';
import {colonyCardResources} from '../../../src/common/colonies/ColonyMetadata';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderEffect, ICardRenderItem, ItemType, isICardRenderEffect, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {ActionEffect} from '../../../src/common/models/ActionPreviewModel';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, questGateOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';

/**
 * TR28 — EARTH ARMY CONTRACT: an action of TWO BEATS ON ONE CARD — a fighter
 * lands here, then, at two, two fighters leave for a TR. Every rule reading of
 * the card file's header (1–11) is pinned here, through the real blue-action
 * door; and the PREVIEW is held to the ACTION by one parity sweep (the chips the
 * composer shows for 0 · 1 · 2 · 3 fighters ARE the deltas the activation makes).
 * Rule 10 — MarsBot never plays a project card — is the bot's general contract;
 * pinned here only as «a human at a bot's table activates it as ever».
 */
const EAC = CardName.EARTH_ARMY_CONTRACT;
const U = PartyName.UNITY;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: EarthArmyContract};

/** A two-seat Redux table under a QUIET government (the Industrialists: an action-only party), the card PLAYED by p1. */
function table(fighters = 0): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
  const card = new EarthArmyContract();
  card.resourceCount = fighters;
  p1.playedCards.push(card);
  p1.megaCredits = 0;
  return {game, p1, p2, parliament, card};
}

/** The same table under the RULING GREENS (a fresh Redux table's own government): every TR step pays 2 M€. */
function greensTable(fighters = 0): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  expect(parliament.rulingParty(), 'a fresh table: the Greens').eq(PartyName.GREENS);
  const card = new EarthArmyContract();
  card.resourceCount = fighters;
  p1.playedCards.push(card);
  p1.megaCredits = 0;
  return {game, p1, p2, parliament, card};
}

/** Activate through the REAL blue-action door, so the action runs inside its own event scope. Returns the chain's root. */
function activate(t: Table, opts: {asks?: boolean} = {}): number {
  const door = cast(t.p1.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name), 'the card stands among the playable actions').to.include(EAC);
  door.cb([t.card]);
  runAllActions(t.game);
  if (opts.asks !== true) {
    expect(t.p1.popWaitingFor(), 'the action asks nothing').is.undefined;
  }
  const roots = t.game.events.events.filter((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === EAC);
  return roots[roots.length - 1].id;
}

/** The result half of the printed action row (what follows the red arrow). */
function actionResult(card: EarthArmyContract): Array<ItemType> {
  const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
  const action = rows.flat().find((node) => isICardRenderEffect(node)) as ICardRenderEffect;
  return action.rows[action.rows.length - 1];
}

/** The chip deltas a preview promises, by pool: the card's own fighters, the rating. */
function promised(effects: ReadonlyArray<ActionEffect>): {fighters: number, tr: number} {
  let fighters = 0;
  let tr = 0;
  for (const e of effects) {
    const signed = e.direction === 'cost' ? -e.amount : e.amount;
    if (e.icon === 'fighter') {
      fighters += signed;
    } else if (e.icon === 'tr') {
      tr += signed;
    }
  }
  return {fighters, tr};
}

describe('EarthArmyContract', () => {
  describe('the card as printed', () => {
    it('is a blue card for 8 with Earth + Space under Unity\'s plate, a fighter holder, no VP, no on-play text, TR28', () => {
      const card = new EarthArmyContract();
      expect(card.name).eq(EAC);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(8);
      expect(card.tags).deep.eq([Tag.EARTH, Tag.SPACE]);
      expect(requiredPartyOf(card), 'the MIN plate holds Unity\'s emblem').eq(U);
      expect(card.requirements).has.length(1);
      expect(card.resourceType).eq(CardResource.FIGHTER);
      expect(card.victoryPoints).is.undefined;
      expect(card.metadata.cardNumber).eq('TR28');
      expect(card.metadata.description, 'the lower block holds the requirement alone — the plate states it').is.undefined;
      expect(card.behavior, 'rule 2: nothing happens on play').is.undefined;
    });

    it('the action row is «→ [fighter] , −2 [fighter] : [TR]» — THREE separate icons, the anchors of the commit', () => {
      const card = new EarthArmyContract();
      const items = actionResult(card).filter((node) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      const shape = items.map((item) => item.type === CardRenderItemType.RESOURCE ? `${item.type}:${item.resource}:${Math.abs(item.amount)}` : item.type);
      expect(shape).deep.eq([
        `${CardRenderItemType.RESOURCE}:${CardResource.FIGHTER}:1`,
        CardRenderItemType.TEXT,
        `${CardRenderItemType.RESOURCE}:${CardResource.FIGHTER}:2`,
        CardRenderItemType.TR,
      ]);
      expect(items[2].showDigit, '«−2» is a digit beside ONE icon').is.true;
      const flat = JSON.stringify(card.metadata.renderData);
      expect(flat).contains('Add 1 fighter to this card. If there are at least 2 fighters here, discard 2 of them to gain 1 TR.');
    });

    it('stands in the Redux manifest with NO compatibility (only the Turmoil hexagon on the scan)', () => {
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = manifest.projectCards[EAC]!;
      expect(new entry.Factory().name).eq(EAC);
      expect(entry.compatibility).is.undefined;
    });
  });

  describe('rule 1 — the requirement is a condition of the PLAY', () => {
    /** Three QUIET real resolutions in the voting area: Greens · Unity · Industrialists; the card in hand. */
    function handTable(): {game: IGame, p1: TestPlayer, parliament: Parliament, card: EarthArmyContract} {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.GREENS, U, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      const card = new EarthArmyContract();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      return {game, p1, parliament, card};
    }

    it('neither road: unplayable with the party class\'s NAMED reason — Unity\'s, and only it', () => {
      const t = handTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('Unity rules: playable', () => {
      const t = handTable();
      seatEnacted(t.parliament, quietResolutionOf(U));
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('two delegates on its resolution: playable', () => {
      const t = handTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      expect(t.p1.canPlay(t.card), 'one delegate is not two').is.false;
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('once played the action works whoever rules: no Unity in the chair, no delegate anywhere', () => {
      const t = table(1);
      expect(t.parliament.rulingParty()).not.eq(U);
      expect(t.parliament.access(t.p1, U).satisfiesRequirement, 'the seat has no road to Unity at all').is.false;
      const tr = t.p1.terraformRating;
      activate(t);
      expect(t.p1.terraformRating).eq(tr + 1);
    });
  });

  describe('rule 2 — the play does nothing but put the card down', () => {
    it('played under Unity: the cost paid, a fighter holder at zero, nothing asked', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(U));
      const card = new EarthArmyContract();
      p1.cardsInHand.push(card);
      p1.megaCredits = 8;
      const tr = p1.terraformRating;
      p1.playCard(card);
      runAllActions(game);
      expect(p1.popWaitingFor()).is.undefined;
      expect(p1.playedCards.get(EAC)?.resourceCount).eq(0);
      expect(p1.terraformRating).eq(tr);
    });
  });

  describe('rule 3 — ONE sequence, no choice: +1 here, then at two exactly two leave for 1 TR', () => {
    const cases: ReadonlyArray<{before: number, after: number, tr: number}> = [
      {before: 0, after: 1, tr: 0},
      {before: 1, after: 0, tr: 1},
      {before: 2, after: 1, tr: 1},
      {before: 3, after: 2, tr: 1},
    ];
    for (const c of cases) {
      it(`${c.before} fighter(s): ${c.before} → ${c.before + 1}${c.tr > 0 ? ` → ${c.after} and +1 TR` : ', no TR'}`, () => {
        const t = table(c.before);
        const tr = t.p1.terraformRating;
        activate(t);
        expect(t.card.resourceCount).eq(c.after);
        expect(t.p1.terraformRating).eq(tr + c.tr);
      });
    }

    it('the discard is MANDATORY and happens ONCE: at 3 the card keeps 2, never 0', () => {
      const t = table(3);
      activate(t);
      expect(t.card.resourceCount).eq(2);
    });

    it('`activationAt` — the one reading — is the table above', () => {
      expect(cases.map((c) => EarthArmyContract.activationAt(c.before))).deep.eq([
        {before: 0, added: 1, discarded: 0, tr: 0},
        {before: 1, added: 2, discarded: 2, tr: 1},
        {before: 2, added: 3, discarded: 2, tr: 1},
        {before: 3, added: 4, discarded: 2, tr: 1},
      ]);
    });
  });

  describe('rule 4 — always available, once per generation', () => {
    it('with nothing at all (0 fighters, 0 M€, no Unity) the action can be taken', () => {
      const t = table(0);
      expect(t.card.canAct(t.p1)).is.true;
      expect(actionPreview(t.p1, t.card).branches[0].available).is.true;
    });

    it('once used it leaves the playable actions until the next generation', () => {
      const t = table(0);
      activate(t);
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).not.to.include(EAC);
      t.p1.actionsThisGeneration.clear();
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).to.include(EAC);
    });
  });

  describe('rule 5 — the TR is an ordinary TR of the action phase, sourced by the card', () => {
    it('a «gain 1 TR» chairman quest is closed by it', () => {
      const t = table(1);
      t.parliament.quest = {definition: {goal: {kind: 'tr'}, count: 1}, source: 'starter', generation: t.game.generation, progress: new Map()};
      activate(t, {asks: true});
      expect(t.parliament.quest?.completedBy).eq(t.p1.id);
      expect(questGateOf(t.p1), 'the gate rises with the action\'s own answer').is.not.undefined;
    });

    it('the ruling Greens pay their 2 M€ on it — as THEIR effect, inside the action\'s chain', () => {
      const t = greensTable(1);
      const root = activate(t);
      expect(t.p1.megaCredits).eq(2);
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const reaction = chain.find((e) => e.type === 'effect-triggered' && e.source?.kind === 'party');
      expect(reaction?.source).deep.include({kind: 'party', name: PartyName.GREENS});
    });

    it('with no conversion the Greens pay nothing', () => {
      const t = greensTable(0);
      activate(t);
      expect(t.p1.megaCredits).eq(0);
    });

    it('`trThisGeneration` grows and the UNMI corporation\'s action is live after it', () => {
      const t = table(1);
      const unmi = new UnitedNationsMarsInitiative();
      t.p1.playedCards.push(unmi);
      t.p1.megaCredits = 3;
      expect(unmi.canAct(t.p1), 'no TR raised yet this generation').is.false;
      activate(t);
      expect(t.p1.trThisGeneration).eq(1);
      expect(t.p1.hasIncreasedTerraformRatingThisGeneration).is.true;
      expect(unmi.canAct(t.p1)).is.true;
    });

    it('the score breakdown attributes the point to the card', () => {
      const t = table(1);
      activate(t);
      expect(t.p1.terraformRatingSources).deep.eq([
        {sourceType: 'card', sourceName: EAC, sourceCardId: EAC, amount: 1, generation: t.game.generation},
      ]);
    });

    it('`onIncreaseTerraformRatingByAnyPlayer` hooks fire (Terraforming Deal: +2 M€)', () => {
      const t = table(1);
      t.p1.playedCards.push(new TerraformingDeal());
      activate(t);
      expect(t.p1.megaCredits).eq(2);
    });
  });

  describe('rule 6 — fighters others put here count', () => {
    it('the Redux Vesta\'s payout offers the card, and its fighter is the one the next activation converts', () => {
      const t = table(0);
      t.p1.playedCards.push(new SecurityFleet());
      expect(new Vesta().tradeIncomeBlockedReason(t.p1, 1), 'the card is a Vesta holder').is.undefined;
      const payout = new AddResourcesToCard(t.p1, colonyCardResources(new Vesta().metadata), {count: 1});
      expect(payout.getCards().map((c) => c.name)).to.include(EAC);
      t.p1.addResourceTo(t.card, {qty: 1, log: true});
      const tr = t.p1.terraformRating;
      activate(t);
      expect(t.card.resourceCount).eq(0);
      expect(t.p1.terraformRating).eq(tr + 1);
    });
  });

  describe('rule 7 — fighters here are worth nothing', () => {
    it('no VP at any count', () => {
      const t = table(3);
      expect(t.card.getVictoryPoints(t.p1)).eq(0);
    });
  });

  describe('rule 8 — the order of events is the order of the icons', () => {
    it('added → two discarded → TR, three records under the card\'s source, none twice', () => {
      const t = table(1);
      const root = activate(t);
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const moves = chain.flatMap((e) => {
        if (e.type === 'card-resource-changed') {
          return (e.impact.cardResources ?? []).map((r) => `fighter ${r.amount > 0 ? '+' : ''}${r.amount}@${r.target}`);
        }
        return e.type === 'tr-changed' ? [`tr +${e.impact.tr}`] : [];
      });
      expect(moves).deep.eq([`fighter +1@${EAC}`, `fighter -2@${EAC}`, 'tr +1']);
    });
  });

  describe('rule 9 — save / load', () => {
    it('the count survives a save, and the action after the load reads it', () => {
      const t = table(1);
      expect(t.p1.serialize().playedCards.find((c) => c.name === EAC)?.resourceCount).eq(1);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.p1.id);
      const card = again.playedCards.get(EAC) as (IProjectCard & EarthArmyContract) | undefined;
      expect(card?.resourceCount).eq(1);
      const tr = again.terraformRating;
      const door = cast(cast(again, Player).playActionCard(), SelectCard);
      door.cb([card!]);
      runAllActions(reloaded);
      expect(card?.resourceCount).eq(0);
      expect(again.terraformRating).eq(tr + 1);
    });
  });

  describe('rule 10 — a human at MarsBot\'s table', () => {
    it('activates it as ever', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.playerIsFinishedWithResearchPhase(human);
      human.popWaitingFor();
      game.phase = Phase.ACTION;
      const card = new EarthArmyContract();
      card.resourceCount = 1;
      human.playedCards.push(card);
      const tr = human.terraformRating;
      card.action(human);
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(human.terraformRating).eq(tr + 1);
    });
  });

  describe('rule 11 — the journal', () => {
    it('«added», then «discarded … to gain 1 TR»; the TR itself is its typed event, never a second line', () => {
      const t = table(1);
      const from = t.game.gameLog.length;
      activate(t);
      const lines = t.game.gameLog.slice(from).map((m) => m.message);
      const added = lines.indexOf('${0} added ${1} ${2} to ${3}');
      const discarded = lines.indexOf('${0} discarded ${1} ${2} from ${3} to gain ${4} TR');
      expect(added, JSON.stringify(lines)).greaterThan(-1);
      expect(discarded).greaterThan(added);
      expect(lines.filter((line) => /removed \$\{1\} resource/.test(line)), 'the discard is written once — by its own line').deep.eq([]);
      expect(lines.filter((line) => /gained \$\{1\} \$\{2\}/.test(line)), 'no «gained 1 TR» log line beside the event').deep.eq([]);
    });
  });

  describe('the preview — ONE reading with the action', () => {
    for (const before of [0, 1, 2, 3]) {
      it(`${before} fighter(s): the chips ARE the deltas the activation makes, in the printed order`, () => {
        const t = table(before);
        const preview = actionPreview(t.p1, t.card);
        expect(preview.kind).eq('bespoke');
        expect(preview.branches).has.length(1);
        const effects = preview.branches[0].effects;
        expect(effects.map((e) => `${e.direction}:${e.icon}`), 'the printed order').deep.eq(before === 0 ?
          ['gain:fighter'] :
          ['gain:fighter', 'cost:fighter', 'gain:tr']);
        // The spend starts from the count the +1 left — never a «c → c − 2» no frame shows.
        expect(effects[0]).deep.include({amount: 1, current: before, resulting: before + 1, note: 'on this card'});
        if (before > 0) {
          expect(effects[1]).deep.include({amount: 2, current: before + 1, resulting: before - 1, note: 'on this card'});
        }
        const fightersBefore = t.card.resourceCount;
        const tr = t.p1.terraformRating;
        activate(t);
        expect(promised(effects)).deep.eq({fighters: t.card.resourceCount - fightersBefore, tr: t.p1.terraformRating - tr});
      });
    }

    it('is read-only: building it changes nothing', () => {
      const t = table(1);
      const before = JSON.stringify(t.game.serialize());
      actionPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });

    it('the forecast: the ruling Greens\' +2 M€ is read before the press at ≥ 1 fighter, and nothing at 0', () => {
      const withTr = greensTable(1);
      const facts = effectForecastForAction(withTr.p1, withTr.card, actionPreview(withTr.p1, withTr.card)).facts;
      expect(facts.some((f) => f.source.kind === 'party' && f.source.name === PartyName.GREENS), JSON.stringify(facts)).is.true;
      const none = greensTable(0);
      const quiet = effectForecastForAction(none.p1, none.card, actionPreview(none.p1, none.card)).facts;
      expect(quiet.filter((f) => f.source.kind === 'party')).deep.eq([]);
    });
  });
});
