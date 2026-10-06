import {expect} from 'chai';
import {SPACESHIP_RECYCLING_NO_MECH_HOLDER, SPACESHIP_RECYCLING_SOURCE_TITLE, SpaceshipRecycling} from '../../../src/server/cards/turmoilRedux/SpaceshipRecycling';
import {FormulaZero} from '../../../src/server/cards/turmoilRedux/FormulaZero';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {MechSports} from '../../../src/server/cards/turmoilRedux/MechSports';
import {AutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {EarthArmyContract} from '../../../src/server/cards/turmoilRedux/EarthArmyContract';
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
import {replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {Vesta} from '../../../src/server/colonies/Vesta';
import {colonyCardResources} from '../../../src/common/colonies/ColonyMetadata';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderEffect, ItemType, isICardRenderEffect, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {ActionPreviewBranch, ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';

/**
 * TR29 — SPACESHIP RECYCLING: ONE action, ONE price, TWO outcomes. The price is
 * a fighter taken from ANY card of the player's own — asked ALWAYS — and the
 * outcome is +2 titanium OR a mech on ANY mech holder of the player's own — the
 * target asked ALWAYS. Every rule reading of the card file's header (1–14) is
 * pinned here through the real blue-action door, and the PREVIEW is held to the
 * ACTION: the source step and the target step are the live prompts read twice,
 * and the composer's batch `[activate, source, variant, target]` replays whole.
 */
const SR = CardName.SPACESHIP_RECYCLING;
const U = PartyName.UNITY;

type Table = {
  game: IGame,
  p1: TestPlayer,
  p2: TestPlayer,
  parliament: Parliament,
  card: SpaceshipRecycling,
};

/** A two-seat Redux table under a QUIET government (the Industrialists: an action-only party), the card PLAYED by p1. */
function table(fighters = 2): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
  const card = new SpaceshipRecycling();
  card.resourceCount = fighters;
  p1.playedCards.push(card);
  p1.titanium = 0;
  p1.megaCredits = 0;
  return {game, p1, p2, parliament, card};
}

/** Put a card with `count` resources into a seat's tableau. */
function holder<T extends ICard>(player: TestPlayer, card: T, count: number): T {
  card.resourceCount = count;
  player.playedCards.push(card);
  return card;
}

/** Activate through the REAL blue-action door: the action's own first prompt (the source pick) is returned. */
function activate(t: Table): SelectCard<ICard> {
  const door = cast(t.p1.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name), 'the card stands among the playable actions').to.include(SR);
  door.cb([t.card]);
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectCard<ICard>);
}

/** Answer the standing card prompt through the REAL input path (the action's scope resumes there) and drain the queue. */
function pick(t: Table, prompt: SelectCard<ICard>, card: ICard): void {
  expect(t.p1.getWaitingFor(), 'the prompt answered is the one standing').eq(prompt);
  t.p1.process({type: 'card', cards: [card.name]});
  runAllActions(t.game);
}

/** Answer the standing variant pick (A = 0, B = 1) through the real input path. */
function variant(t: Table, index: number): void {
  cast(t.p1.getWaitingFor(), OrOptions);
  t.p1.process({type: 'or', index, response: {type: 'option'}});
  runAllActions(t.game);
}

/** The result half of the printed action row (what follows the red arrow). */
function actionRows(card: SpaceshipRecycling): ReadonlyArray<ReadonlyArray<ItemType>> {
  const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
  const action = rows.flat().find((node) => isICardRenderEffect(node)) as ICardRenderEffect;
  return action.rows;
}

function branches(t: Table): ReadonlyArray<ActionPreviewBranch> {
  return actionPreview(t.p1, t.card).branches;
}

function sourceStep(t: Table): Extract<ActionPreviewStep, {kind: 'input'}> {
  const pre = actionPreview(t.p1, t.card).preSteps ?? [];
  expect(pre, 'ONE card-level step: the source').has.length(1);
  const step = pre[0];
  if (step.kind !== 'input') {
    throw new Error(`the source is an input step, got ${step.kind}`);
  }
  return step;
}

/** The batch the composer submits: the activation head, the source, the variant (when asked), the target (when asked). */
function composedBatch(t: Table, source: CardName, variant: number, target?: CardName): Array<InputResponse> {
  t.p1.takeAction();
  const menu = cast(t.p1.getWaitingFor(), OrOptions);
  const perform = menu.options.findIndex((o) => o.title === 'Perform an action from a played card');
  expect(perform, 'the action menu offers the card action').gte(0);
  const batch: Array<InputResponse> = [
    {type: 'or', index: perform, response: {type: 'card', cards: [SR]}},
    {type: 'card', cards: [source]},
  ];
  if (variant >= 0) {
    batch.push({type: 'or', index: variant, response: {type: 'option'}});
  }
  if (target !== undefined) {
    batch.push({type: 'card', cards: [target]});
  }
  return batch;
}

describe('SpaceshipRecycling', () => {
  describe('the card as printed', () => {
    it('is a blue card for 7 with Space + Building under Unity\'s plate, a fighter holder, no VP, TR29', () => {
      const card = new SpaceshipRecycling();
      expect(card.name).eq(SR);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(7);
      expect(card.tags).deep.eq([Tag.SPACE, Tag.BUILDING]);
      expect(requiredPartyOf(card), 'the MIN plate holds Unity\'s emblem').eq(U);
      expect(card.requirements).has.length(1);
      expect(card.resourceType).eq(CardResource.FIGHTER);
      expect(card.victoryPoints).is.undefined;
      expect(card.metadata.cardNumber).eq('TR29');
      expect(card.metadata.description).eq('Requires Unity to be ruling or that you have 2 delegates there. Add 2 fighter resources to this card.');
      expect(card.behavior, 'rule 2: the play adds 2 fighters here').deep.eq({addResources: 2});
    });

    it('ONE action row «[fighter]* → [titanium][titanium] OR [mech]*» — the variants\' icons are the commit\'s anchors', () => {
      const card = new SpaceshipRecycling();
      const rows = actionRows(card);
      const shape = (row: ReadonlyArray<ItemType>) => row.map((node) => {
        if (isICardRenderItem(node)) {
          return node.type === CardRenderItemType.RESOURCE ? `${node.type}:${node.resource}` : `${node.type}:${node.amount}`;
        }
        return typeof node === 'object' && node !== null && 'type' in node ? `symbol:${(node as {type: string}).type}` : 'text';
      });
      expect(shape(rows[0]), 'the price: ONE fighter, «from ANY of your cards»').deep.eq([`${CardRenderItemType.RESOURCE}:${CardResource.FIGHTER}`, 'symbol:*']);
      expect(shape(rows[rows.length - 1]), 'two titanium OR a mech on ANY card — one row, the variants\' printed anchors').deep.eq([
        `${CardRenderItemType.TITANIUM}:2`, 'symbol:OR', `${CardRenderItemType.RESOURCE}:${CardResource.MECH}`, 'symbol:*', 'text',
      ]);
      expect(JSON.stringify(card.metadata.renderData)).contains('Spend 1 fighter from ANY of your cards to gain 2 titanium OR to add 1 mech resource to ANY card.');
    });

    it('stands in the Redux manifest with NO compatibility (only the module\'s icon on the scan)', () => {
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = manifest.projectCards[SR]!;
      expect(new entry.Factory().name).eq(SR);
      expect(entry.compatibility).is.undefined;
    });
  });

  describe('rule 1 — the requirement is a condition of the PLAY', () => {
    function handTable(): {game: IGame, p1: TestPlayer, parliament: Parliament, card: SpaceshipRecycling} {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.GREENS, U, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      const card = new SpaceshipRecycling();
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
    });

    it('two delegates on its resolution: playable', () => {
      const t = handTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      expect(t.p1.canPlay(t.card), 'one delegate is not two').is.false;
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('once played the action works whoever rules', () => {
      const t = table(2);
      expect(t.parliament.access(t.p1, U).satisfiesRequirement, 'the seat has no road to Unity').is.false;
      pick(t, activate(t), t.card);
      expect(t.p1.titanium).eq(2);
    });
  });

  describe('rule 2 — the play puts 2 fighters here, and nothing else', () => {
    it('played under Unity: two fighters on the card, nothing asked, no titanium', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(U));
      const card = new SpaceshipRecycling();
      p1.cardsInHand.push(card);
      p1.megaCredits = 7;
      p1.titanium = 0;
      p1.playCard(card);
      runAllActions(game);
      expect(p1.popWaitingFor()).is.undefined;
      expect(p1.playedCards.get(SR)?.resourceCount).eq(2);
      expect(p1.titanium).eq(0);
    });
  });

  describe('rule 3 — available ⇔ a fighter on ANY card of your own', () => {
    it('no fighter anywhere of yours: unavailable, the reason NAMED; an opponent\'s Security Fleet never counts', () => {
      const t = table(0);
      holder(t.p2, new SecurityFleet(), 3);
      expect(t.card.canAct(t.p1)).is.false;
      expect(t.card.actionUnavailableReason(t.p1)).deep.eq({type: 'count', message: 'No fighters on your cards'});
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).not.to.include(SR);
      expect(branches(t).every((b) => !b.available), 'no variant is offered').is.true;
      expect(branches(t)[0].unavailableReason).eq('No fighters on your cards');
    });

    it('a fighter on another card of your own (Formula Zero) is enough — this card may stand at zero', () => {
      const t = table(0);
      holder(t.p1, new FormulaZero(), 1);
      expect(t.card.canAct(t.p1)).is.true;
      expect(t.card.actionUnavailableReason(t.p1)).is.undefined;
    });

    it('once used it leaves the playable actions until the next generation', () => {
      const t = table(2);
      pick(t, activate(t), t.card);
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).not.to.include(SR);
      t.p1.actionsThisGeneration.clear();
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).to.include(SR);
    });
  });

  describe('rule 4 — the source is asked ALWAYS', () => {
    it('one candidate (this card): still a picker, in the spend\'s own words, marked as the card\'s own choice', () => {
      const t = table(2);
      const source = activate(t);
      expect(source.cards.map((c) => c.name)).deep.eq([SR]);
      expect(source.title).eq(SPACESHIP_RECYCLING_SOURCE_TITLE);
      expect(source.buttonLabel, 'a cost is SPENT, never «removed»').eq('Spend resource(s)');
      expect(source.choiceContext).deep.include({mode: 'effect-choice'});
      expect(source.choiceContext?.source).deep.include({kind: 'card', card: SR});
      expect(t.card.resourceCount, 'nothing leaves before the answer').eq(2);
    });

    it('every own fighter holder is offered; a holder at zero is a DISABLED twin with its reason', () => {
      const t = table(2);
      const fz = holder(t.p1, new FormulaZero(), 1);
      const eac = holder(t.p1, new EarthArmyContract(), 0);
      holder(t.p2, new SecurityFleet(), 2);
      const source = activate(t);
      expect(source.cards.map((c) => c.name)).deep.eq([SR, fz.name]);
      const model = source.toModel(t.p1) as SelectCardModel;
      expect(model.disabledCards?.map((c) => [c.name, c.disabledReason])).deep.eq([[eac.name, 'No resources on this card']]);
    });

    it('a spend from Formula Zero costs its point (the VP the step names)', () => {
      const t = table(2);
      const fz = holder(t.p1, new FormulaZero(), 1);
      expect(fz.getVictoryPoints(t.p1)).eq(1);
      pick(t, activate(t), fz);
      expect(fz.resourceCount).eq(0);
      expect(fz.getVictoryPoints(t.p1)).eq(0);
      expect(t.card.resourceCount, 'this card keeps its fighters').eq(2);
    });

    it('Earth Army Contract\'s fighters are a legal source too', () => {
      const t = table(0);
      const eac = holder(t.p1, new EarthArmyContract(), 1);
      pick(t, activate(t), eac);
      expect(eac.resourceCount).eq(0);
      expect(t.p1.titanium).eq(2);
    });
  });

  describe('rules 5 · 6 — one price, two outcomes', () => {
    it('no mech holder: A is the whole action — no OrOptions, +2 titanium', () => {
      const t = table(2);
      pick(t, activate(t), t.card);
      expect(t.p1.getWaitingFor(), 'no variant pick').is.undefined;
      expect(t.card.resourceCount).eq(1);
      expect(t.p1.titanium).eq(2);
    });

    it('a mech holder: the variants are asked in the printed order (A, B), marked as the card\'s own choice', () => {
      const t = table(2);
      holder(t.p1, new EvaMechs(), 1);
      pick(t, activate(t), t.card);
      const variants = cast(t.p1.getWaitingFor(), OrOptions);
      expect(variants.options.map((o) => o.title)).deep.eq(['Gain 2 titanium', 'Add 1 mech to any card']);
      expect(variants.choiceContext).deep.include({mode: 'effect-choice'});
      expect(variants.choiceContext?.source).deep.include({kind: 'card', card: SR});
      expect(t.card.resourceCount, 'the fighter already left').eq(1);
    });

    it('A: +2 titanium, nothing else', () => {
      const t = table(2);
      const eva = holder(t.p1, new EvaMechs(), 1);
      pick(t, activate(t), t.card);
      variant(t, 0);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.titanium).eq(2);
      expect(eva.resourceCount).eq(1);
    });

    it('B: the target is asked ALWAYS (one holder too), the mech lands on it', () => {
      const t = table(2);
      const eva = holder(t.p1, new EvaMechs(), 1);
      pick(t, activate(t), t.card);
      variant(t, 1);
      const target = cast(t.p1.getWaitingFor(), SelectCard<ICard>);
      expect(target.cards.map((c) => c.name), 'rule 7: never this card').deep.eq([eva.name]);
      expect(target.choiceContext).deep.include({mode: 'reward'});
      pick(t, target, eva);
      expect(eva.resourceCount).eq(2);
      expect(t.p1.titanium).eq(0);
    });

    it('B onto Mech Sports scores its point; onto EVA Mechs it is money for a Space card at once', () => {
      const t = table(2);
      const eva = holder(t.p1, new EvaMechs(), 0);
      const sports = holder(t.p1, new MechSports(), 0);
      pick(t, activate(t), t.card);
      variant(t, 1);
      const target = cast(t.p1.getWaitingFor(), SelectCard<ICard>);
      expect(target.cards.map((c) => c.name)).deep.eq([eva.name, sports.name]);
      pick(t, target, sports);
      expect(sports.getVictoryPoints(t.p1)).eq(1);

      const again = table(2);
      const eva2 = holder(again.p1, new EvaMechs(), 0);
      pick(again, activate(again), again.card);
      variant(again, 1);
      pick(again, cast(again.p1.getWaitingFor(), SelectCard<ICard>), eva2);
      expect(again.p1.getSpendable('mechs'), 'rule 9: an ordinary mech of its holder').eq(1);
      expect(eva.resourceCount).eq(0);
    });

    it('rule 9 — Automated Convoys is a mech holder like any other', () => {
      const t = table(2);
      const convoys = holder(t.p1, new AutomatedConvoys(), 0);
      pick(t, activate(t), t.card);
      variant(t, 1);
      pick(t, cast(t.p1.getWaitingFor(), SelectCard<ICard>), convoys);
      expect(convoys.resourceCount).eq(1);
    });
  });

  describe('rule 8 — the order of events is the order of the icons', () => {
    /** The resource moves of the events after `from`, in recorded order: a card's fighters / mechs, the titanium stock. */
    function moves(t: Table, from: number): Array<string> {
      return t.game.events.events.slice(from).flatMap((e) => {
        if (e.type === 'card-resource-changed') {
          return (e.impact.cardResources ?? []).map((r) => `${r.amount > 0 ? '+' : ''}${r.amount}@${r.target}`);
        }
        if (e.type === 'resource-changed' && e.impact.stock?.titanium !== undefined) {
          return [`+${e.impact.stock.titanium} titanium`];
        }
        return [];
      });
    }

    it('A: the fighter leaves its card, then the titanium arrives', () => {
      const t = table(2);
      const fz = holder(t.p1, new FormulaZero(), 1);
      const from = t.game.events.events.length;
      pick(t, activate(t), fz);
      expect(moves(t, from)).deep.eq([`-1@${fz.name}`, '+2 titanium']);
    });

    it('B: the fighter leaves, then the mech lands on the chosen card', () => {
      const t = table(2);
      const sports = holder(t.p1, new MechSports(), 0);
      const from = t.game.events.events.length;
      pick(t, activate(t), t.card);
      variant(t, 1);
      pick(t, cast(t.p1.getWaitingFor(), SelectCard<ICard>), sports);
      expect(moves(t, from)).deep.eq([`-1@${SR}`, `+1@${sports.name}`]);
    });
  });

  describe('rule 10 — the Redux Vesta feeds both halves', () => {
    it('Vesta\'s payout offers this card (fighters) and the mech holders', () => {
      const t = table(0);
      const eva = holder(t.p1, new EvaMechs(), 0);
      const payout = new AddResourcesToCard(t.p1, colonyCardResources(new Vesta().metadata), {count: 1});
      const offered = payout.getCards().map((c) => c.name);
      expect(offered).to.include(SR);
      expect(offered).to.include(eva.name);
      t.p1.addResourceTo(t.card, {qty: 1, log: true});
      expect(t.card.canAct(t.p1), 'a fighter Vesta brought opens the action').is.true;
    });
  });

  describe('rule 11 — nothing at the table answers', () => {
    it('the forecast states no fact for either variant', () => {
      const t = table(2);
      holder(t.p1, new EvaMechs(), 0);
      const facts = effectForecastForAction(t.p1, t.card, actionPreview(t.p1, t.card)).facts;
      expect(facts).deep.eq([]);
    });
  });

  describe('rule 12 — save / load', () => {
    it('the count survives a save, and the action after the load reads it', () => {
      const t = table(1);
      expect(t.p1.serialize().playedCards.find((c) => c.name === SR)?.resourceCount).eq(1);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.p1.id);
      const card = again.playedCards.get(SR) as SpaceshipRecycling | undefined;
      expect(card?.resourceCount).eq(1);
      const door = cast(cast(again, Player).playActionCard(), SelectCard);
      door.cb([card!]);
      runAllActions(reloaded);
      const source = cast(again.getWaitingFor(), SelectCard<ICard>);
      source.cb([card!]);
      runAllActions(reloaded);
      expect(card?.resourceCount).eq(0);
      expect(again.titanium).eq(2);
    });
  });

  describe('rule 13 — a human at MarsBot\'s table', () => {
    it('activates it as ever: the source is still asked, the titanium paid', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.playerIsFinishedWithResearchPhase(human);
      human.popWaitingFor();
      game.phase = Phase.ACTION;
      const card = new SpaceshipRecycling();
      card.resourceCount = 1;
      human.playedCards.push(card);
      const titanium = human.titanium;
      card.action(human);
      runAllActions(game);
      const source = cast(human.popWaitingFor(), SelectCard<ICard>);
      source.cb([card]);
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(human.titanium).eq(titanium + 2);
    });
  });

  describe('rule 14 — the journal', () => {
    it('the class\'s SPEND line (never «removed … from X\'s Y»), then the titanium\'s own line', () => {
      const t = table(2);
      const fz = holder(t.p1, new FormulaZero(), 1);
      const from = t.game.gameLog.length;
      pick(t, activate(t), fz);
      const logged = t.game.gameLog.slice(from);
      const lines = logged.map((m) => m.message);
      const spent = lines.indexOf('${0} spent ${1} ${2} from ${3}');
      expect(spent, JSON.stringify(lines)).greaterThan(-1);
      expect(logged[spent].data.map((d) => d.value)).deep.eq([t.p1.color, '1', CardResource.FIGHTER, fz.name]);
      expect(lines.filter((line) => /removed \$\{1\} resource/.test(line)), 'never the attack\'s line').deep.eq([]);
      const gained = lines.findIndex((line, i) => i > spent && /titanium|\$\{1\} \$\{2\}/.test(line) && line !== lines[spent]);
      expect(gained, JSON.stringify(lines)).greaterThan(spent);
    });

    it('B: the spend, then «added 1 mech to …»', () => {
      const t = table(2);
      const eva = holder(t.p1, new EvaMechs(), 0);
      const from = t.game.gameLog.length;
      pick(t, activate(t), t.card);
      variant(t, 1);
      pick(t, cast(t.p1.getWaitingFor(), SelectCard<ICard>), eva);
      const lines = t.game.gameLog.slice(from).map((m) => m.message);
      const spent = lines.indexOf('${0} spent ${1} ${2} from ${3}');
      const added = lines.indexOf('${0} added ${1} ${2} to ${3}');
      expect(spent, JSON.stringify(lines)).greaterThan(-1);
      expect(added).greaterThan(spent);
    });
  });

  describe('the preview — ONE reading with the action', () => {
    it('the source is a CARD-LEVEL step before the variants: the live picker, −1 each, the fighter named, the VP of each candidate', () => {
      const t = table(2);
      holder(t.p1, new FormulaZero(), 1);
      const step = sourceStep(t);
      expect(step.amount).eq(-1);
      expect(step.cardResource).eq('fighter');
      expect(step.vpBox?.[CardName.FORMULA_ZERO]).deep.eq({from: 1, to: 0});
      expect(step.vpBox?.[SR], 'no VP on this card').is.undefined;
      const live = activate(t);
      const model = step.input as SelectCardModel;
      expect(model.title).deep.eq(live.title);
      expect(model.buttonLabel).eq(live.buttonLabel);
      expect(model.cards.map((c) => c.name)).deep.eq(live.cards.map((c) => c.name));
    });

    it('no mech holder: A is the lone available variant (no branch pick), B disabled with its NAMED reason', () => {
      const t = table(2);
      const [a, b] = branches(t);
      expect(a).deep.include({available: true, index: -1});
      expect(a.effects.map((e) => `${e.direction}:${e.icon}`)).deep.eq(['cost:fighter', 'gain:titanium']);
      expect(a.effects[1]).deep.include({amount: 2, current: 0, resulting: 2});
      expect(b).deep.include({available: false, index: -1, unavailableReason: SPACESHIP_RECYCLING_NO_MECH_HOLDER});
      expect(b.steps).deep.eq([]);
    });

    it('a mech holder: two variants at their runtime indices; B\'s target IS the live target picker, with its VP', () => {
      const t = table(2);
      const eva = holder(t.p1, new EvaMechs(), 1);
      const sports = holder(t.p1, new MechSports(), 0);
      const [a, b] = branches(t);
      expect([a.index, b.index]).deep.eq([0, 1]);
      expect(b.effects.map((e) => `${e.direction}:${e.icon}:${e.note ?? ''}`)).deep.eq(['cost:fighter:', 'gain:mech:to a card']);
      expect(b.steps).has.length(1);
      const target = b.steps[0];
      if (target.kind !== 'input') {
        throw new Error('the target is an input step');
      }
      expect(target.amount).eq(1);
      expect(target.cardResource).eq('mech');
      expect(target.vpBox?.[CardName.MECH_SPORTS]).deep.eq({from: 0, to: 1});
      const model = target.input as SelectCardModel;
      expect(model.cards.map((c) => c.name)).deep.eq([eva.name, sports.name]);

      pick(t, activate(t), t.card);
      variant(t, 1);
      const live = cast(t.p1.getWaitingFor(), SelectCard<ICard>);
      expect(model.title).deep.eq(live.title);
      expect(model.cards.map((c) => c.name)).deep.eq(live.cards.map((c) => c.name));
    });

    it('the composed batch [activate, source, B, target] replays WHOLE: Formula Zero → Mech Sports', () => {
      const t = table(2);
      const fz = holder(t.p1, new FormulaZero(), 1);
      const sports = holder(t.p1, new MechSports(), 0);
      replayBatch(t.p1, composedBatch(t, fz.name, 1, sports.name));
      runAllActions(t.game);
      expect(t.p1.getWaitingFor(), 'the action is over').satisfies((wf: unknown) => wf === undefined || wf instanceof OrOptions);
      expect(fz.resourceCount).eq(0);
      expect(sports.resourceCount).eq(1);
      expect(t.card.resourceCount).eq(2);
      expect(t.p1.titanium).eq(0);
    });

    it('the composed batch [activate, source] with no holder replays WHOLE: +2 titanium', () => {
      const t = table(2);
      replayBatch(t.p1, composedBatch(t, SR, -1));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
      expect(t.p1.titanium).eq(2);
    });
  });
});
