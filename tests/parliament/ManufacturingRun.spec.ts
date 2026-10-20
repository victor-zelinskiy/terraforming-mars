import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {IPlayer} from '../../src/server/IPlayer';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {
  MANUFACTURING_RUN, MANUFACTURING_RUN_CODE, MANUFACTURING_RUN_ID, MANUFACTURING_RUN_NO_HOLDER_REASON, MANUFACTURING_RUN_USES,
  MANUFACTURING_RUN_YIELD,
} from '../../src/server/parliament/resolutions/industrialists/ManufacturingRun';
import {PARTY_EFFECTS} from '../../src/server/parliament/parties/PartyEffects';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {CardResource} from '../../src/common/CardResource';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {actionUsesFor, actionUsesStanding} from '../../src/common/parliament/actionUses';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {PlayerInput} from '../../src/server/PlayerInput';
import {ResolutionActionPromptMeta} from '../../src/common/models/PlayerInputModel';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {potentialActions} from '../../src/server/models/potentialActions';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {TitanShuttles} from '../../src/server/cards/colonies/TitanShuttles';
import {SecurityFleet} from '../../src/server/cards/base/SecurityFleet';
import {ConstructionMechs} from '../../src/server/cards/turmoilRedux/ConstructionMechs';
import {MechSports} from '../../src/server/cards/turmoilRedux/MechSports';
import {EventSource} from '../../src/common/events/EventSource';

/**
 * MANUFACTURING RUN (Turmoil Redux, RX37) — «Action: add 2 floaters OR 1
 * fighter OR 1 mech to any card. Twice this generation; players with at
 * least 2 Influence 3 times.» Chairman quest: 2 green cards.
 *
 * What these specs pin (§2 of the prompt, one block per reading): three
 * exclusive outcomes on ONE card of the seat's own, the kind a BRANCH (the
 * Scientists' shape — the one builder both stand on, the party's prompt
 * byte-identical), a kind with no holder never offered, the card always asked
 * (no auto-select); the count is DATA read LIVE at every use (2 → 3 the moment
 * influence reaches 2, mid-generation); every use is an action of the turn,
 * recorded at the answer; unavailable WITH A REASON (no holder · «2 of 2»);
 * the law's source on the journal and the events; the VP box of a scoring
 * holder; the quest moved by green plays only; MarsBot never in it.
 */
const RUN = resolutionInstanceId(MANUFACTURING_RUN_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** The card ENACTED without a sitting (the government holds it), the table in its action phase. */
function enacted(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatEnacted(parliament, RUN);
  expect(parliament.enactedDefinition()).eq(MANUFACTURING_RUN);
  return [game, p1, p2, parliament];
}

/** Influence exactly `n` (0–5) for a seat whose Agenda no sitting moves. */
function setInfluence(parliament: Parliament, player: IPlayer, n: number): void {
  parliament.agenda.set(player.id, [0, 1, 3, 5, 8, 12][n]);
  parliament.influenceBonus.set(player.id, []);
  expect(parliament.influence(player)).eq(n);
}

/** One holder of each kind on the seat's table: Dirigibles (floater), Security Fleet (fighter), Construction Mechs (mech). */
function threeHolders(player: TestPlayer): {floater: ICard, fighter: ICard, mech: ICard} {
  const floater = new Dirigibles();
  const fighter = new SecurityFleet();
  const mech = new ConstructionMechs();
  player.playedCards.push(floater, fighter, mech);
  return {floater, fighter, mech};
}

function markerOf(input: PlayerInput): ResolutionActionPromptMeta | undefined {
  return (input as {resolutionActionPrompt?: ResolutionActionPromptMeta}).resolutionActionPrompt;
}

/** The law's option of the action menu, by its MARKER (never by its title). */
function actionOption(player: IPlayer): OrOptions | undefined {
  const option = ParliamentHandler.resolutionActionOptions(player).find((o) => markerOf(o) !== undefined);
  return option === undefined ? undefined : cast(option, OrOptions);
}

/** The branch of `kind` inside the law's prompt. */
function branchOf(option: OrOptions, kind: CardResource): SelectCard<ICard> | undefined {
  const icon = String(kind).toLowerCase().replace(/\s+/g, '-');
  return option.options.map((o) => o as SelectCard<ICard>).find((o) => o.resourceGainPrompt?.cardResource === icon);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

describe('ManufacturingRun', () => {
  describe('the catalog entry', () => {
    it('is RX37 of the Industrialists — one copy, no expansion needed, an action and nothing else, the two-green-cards quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(MANUFACTURING_RUN_ID)).eq(MANUFACTURING_RUN);
      expect(MANUFACTURING_RUN.code).eq(MANUFACTURING_RUN_CODE).eq('RX37');
      expect(MANUFACTURING_RUN.party).eq(PartyName.INDUSTRIALISTS);
      expect(MANUFACTURING_RUN.copies).eq(1);
      expect(MANUFACTURING_RUN.compatibility, 'floaters, fighters and mechs all exist without Venus').is.undefined;
      expect(MANUFACTURING_RUN.scaled).is.undefined;
      expect(MANUFACTURING_RUN.immediateSteps).is.undefined;
      expect(MANUFACTURING_RUN.winnerSteps).is.undefined;
      expect(MANUFACTURING_RUN.passive).is.undefined;
      expect(MANUFACTURING_RUN.action).is.not.undefined;
      expect(MANUFACTURING_RUN.text).deep.eq({
        name: 'Manufacturing Run', action: 'Add 2 floaters, 1 fighter or 1 mech to one of your cards.', quest: 'Play 2 green cards',
      });
      expect(MANUFACTURING_RUN.quest).deep.eq({goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2});
      expect(familyOf(MANUFACTURING_RUN)).is.a('string');
    });

    it('declares its count as DATA beside the action — 2, 3 at influence 2+ — read by the ONE function', () => {
      expect(MANUFACTURING_RUN.actionUses).deep.eq({base: 2, atInfluence: {influence: 2, uses: 3}});
      expect(MANUFACTURING_RUN.actionUses).eq(MANUFACTURING_RUN_USES);
      expect([0, 1, 2, 3, 5].map((i) => actionUsesFor(MANUFACTURING_RUN_USES, i))).deep.eq([2, 2, 3, 3, 3]);
      expect(actionUsesFor(undefined, 4), 'a law that declares nothing is taken once').eq(1);
      expect(actionUsesStanding(MANUFACTURING_RUN_USES, 1)).deep.eq({uses: 2, raised: false, short: 1});
      expect(actionUsesStanding(MANUFACTURING_RUN_USES, 2)).deep.eq({uses: 3, raised: true, short: 0});
      expect(actionUsesStanding(undefined, 2)).deep.eq({uses: 1, raised: false, short: undefined});
      expect(MANUFACTURING_RUN_YIELD.map((y) => [y.resource, y.amount])).deep.eq([
        [CardResource.FLOATER, 2], [CardResource.FIGHTER, 1], [CardResource.MECH, 1],
      ]);
    });

    it('the face prints ONE action box: «2 [influence]» → 2 floaters OR a fighter OR a mech', () => {
      const rows = MANUFACTURING_RUN.renderData.rows;
      expect(rows).has.length(1);
      const json = JSON.stringify(rows);
      expect(json).includes('"2"');
      expect(json).includes(CardResource.FLOATER);
      expect(json).includes(CardResource.FIGHTER);
      expect(json).includes(CardResource.MECH);
      expect(json, 'the influence mark rides as a superscript (decision Р4)').includes('"isSuperscript":true');
    });
  });

  describe('the prompt — the kind is a BRANCH, the card is always asked', () => {
    it('three kinds held → three branches in the printed order, 2 / 1 / 1, every prompt marked as the law\'s', () => {
      const [, p1, , parliament] = enacted();
      const {floater, fighter, mech} = threeHolders(p1);
      const option = actionOption(p1)!;
      expect(option, 'offered').is.not.undefined;
      const meta = {resolution: MANUFACTURING_RUN_ID, party: PartyName.INDUSTRIALISTS, stage: 'choose' as const, usesLeft: 2, usesPerGeneration: 2};
      expect(option.resolutionActionPrompt).deep.eq(meta);
      expect(option.choiceContext?.source).deep.eq({kind: 'resolution', resolution: MANUFACTURING_RUN_ID});
      expect(option.options).has.length(3);
      const branches = option.options.map((o) => cast(o, SelectCard<ICard>));
      expect(branches.map((b) => b.resourceGainPrompt?.cardResource)).deep.eq(['floater', 'fighter', 'mech']);
      expect(branches.map((b) => b.resourceGainPrompt?.amount)).deep.eq([2, 1, 1]);
      expect(branches.map((b) => b.cards.map((c) => c.name))).deep.eq([[floater.name], [fighter.name], [mech.name]]);
      for (const b of branches) {
        expect(b.resolutionActionPrompt).deep.eq(meta);
        expect(b.config.min).eq(1);
        expect(b.config.max).eq(1);
      }
      // …and the markers survive the wire (the input's own toModel — nesting-safe).
      const model = option.toModel(p1);
      expect(model.type).eq('or');
      expect(model.resolutionActionPrompt).deep.eq(meta);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(2);
    });

    it('a kind with NO holder is not offered; ONE kind is one branch — and its card is still asked, even alone (no auto-select)', () => {
      const [, p1] = enacted();
      p1.playedCards.push(new ConstructionMechs());
      const option = actionOption(p1)!;
      expect(option.options).has.length(1);
      const only = cast(option.options[0], SelectCard<ICard>);
      expect(only.resourceGainPrompt?.cardResource).eq('mech');
      expect(only.cards.map((c) => c.name)).deep.eq([CardName.CONSTRUCTION_MECHS]);
      expect(only.config.min).eq(1);
      // The tile's chips follow: with a seat, only the kinds it can hold; without one, the printed rate.
      expect(MANUFACTURING_RUN.action!.preview(p1)).deep.eq([{direction: 'gain', icon: 'mech', amount: 1, note: 'to a card'}]);
      expect(MANUFACTURING_RUN.action!.preview().map((e) => e.icon)).deep.eq(['floater', 'fighter', 'mech']);
    });

    it('a scoring holder carries its VP box (Security Fleet, Mech Sports) — the same reading as the Scientists\'', () => {
      const [, p1] = enacted();
      p1.playedCards.push(new SecurityFleet(), new MechSports(), new ConstructionMechs());
      const option = actionOption(p1)!;
      const fighter = branchOf(option, CardResource.FIGHTER)!;
      expect(fighter.resourceGainPrompt?.vpBox?.[CardName.SECURITY_FLEET]).deep.eq({from: 0, to: 1});
      const mech = branchOf(option, CardResource.MECH)!;
      expect(mech.cards.map((c) => c.name)).deep.eq([CardName.MECH_SPORTS, CardName.CONSTRUCTION_MECHS]);
      expect(mech.resourceGainPrompt?.vpBox?.[CardName.MECH_SPORTS]).is.not.undefined;
      expect(mech.resourceGainPrompt?.vpBox?.[CardName.CONSTRUCTION_MECHS], 'a holder that scores nothing has no box').is.undefined;
    });

    it('the Scientists\' party action stands on the same builder and asks the same prompt it always did', () => {
      const [, p1, , parliament] = reduxGame();
      parliament.grantPartyEffect(p1, PartyName.SCIENTISTS, 'test');
      const scientists = PARTY_EFFECTS[PartyName.SCIENTISTS];
      expect(scientists.actionInput, 'the Scientists have an action').is.not.undefined;
      const meta = {party: PartyName.SCIENTISTS, actionId: 'scientists-lab' as const, stage: 'choose' as const, usesLeft: 1, usesPerGeneration: 1};
      expect(() => scientists.actionInput!(p1, parliament, meta), 'no holder: the belt to the gate\'s braces').to.throw(/No card can hold data or microbes/);
      const microbes = fakeCard({name: CardName.TARDIGRADES, resourceType: CardResource.MICROBE});
      p1.playedCards.push(microbes);
      const option = cast(scientists.actionInput!(p1, parliament, meta), OrOptions);
      expect(option.title).eq('Add 2 data or 2 microbes to a card');
      expect(option.buttonLabel).eq('Add');
      expect(option.partyActionPrompt).deep.eq(meta);
      expect(option.choiceContext).deep.eq({source: {kind: 'party', party: PartyName.SCIENTISTS}, trigger: 'The Scientists\' action', mode: 'effect-choice'});
      const branch = cast(option.options[0], SelectCard<ICard>);
      expect(branch.resourceGainPrompt).deep.include({amount: 2, cardResource: 'microbe'});
      expect(branch.partyActionPrompt).deep.eq(meta);
      expect(scientists.preview!(p1).map((e) => [e.icon, e.amount, e.note])).deep.eq([['data', 2, 'to a card'], ['microbe', 2, 'to a card']]);
    });
  });

  describe('the commit — one card, the law\'s source, the use at the answer', () => {
    for (const [kind, amount] of [[CardResource.FLOATER, 2], [CardResource.FIGHTER, 1], [CardResource.MECH, 1]] as const) {
      it(`${amount} ${kind} onto the chosen card — under the law's own source; the use spent; the journal names it`, () => {
        const [game, p1, , parliament] = enacted();
        const holders = threeHolders(p1);
        const card = kind === CardResource.FLOATER ? holders.floater : kind === CardResource.FIGHTER ? holders.fighter : holders.mech;
        const option = actionOption(p1)!;
        expect(parliament.resolutionActionUsesLeft(p1), 'building the prompt spends nothing').eq(2);
        const eventsBefore = game.events.events.length;
        branchOf(option, kind)!.process({type: 'card', cards: [card.name]});
        runAllActions(game);
        expect(card.resourceCount).eq(amount);
        for (const other of Object.values(holders).filter((c) => c !== card)) {
          expect(other.resourceCount, `${other.name} untouched`).eq(0);
        }
        expect(parliament.resolutionActionUsesOf(p1)).eq(1);
        expect(parliament.resolutionActionUsesLeft(p1)).eq(1);
        const mine = game.events.events.slice(eventsBefore).filter((e) => e.source !== undefined);
        expect(mine.length).greaterThan(0);
        expect(mine.every((e) => e.source?.kind === 'resolution' && e.source.id === MANUFACTURING_RUN_ID && e.source.owner === p1.color),
          `every event sourced by the law (${mine.map((e) => JSON.stringify(e.source)).join(' ')})`).is.true;
        expect(game.events.events.slice(eventsBefore).some((e) => e.type === 'action' && e.category === 'parliament')).is.true;
        expect(game.events.events.slice(eventsBefore).some((e) => (e.impact?.cardResources ?? []).some((r) => r.target === card.name && r.amount === amount)),
          'the gain is an event of the card it landed on').is.true;
        expect(game.gameLog.some((e) => e.message === '${0} used the action of ${1}')).is.true;
      });
    }
  });

  describe('how many times — 2, or 3 at influence 2+, read LIVE', () => {
    it('influence 0 and 1 → 2 uses; influence 2 → 3 — the menu\'s marker and the model carry the same count', () => {
      for (const [influence, uses] of [[0, 2], [1, 2], [2, 3], [4, 3]] as const) {
        const [game, p1, , parliament] = enacted();
        threeHolders(p1);
        setInfluence(parliament, p1, influence);
        expect(parliament.resolutionActionUsesLeft(p1), `influence ${influence}`).eq(uses);
        expect(actionOption(p1)!.resolutionActionPrompt).deep.include({usesLeft: uses, usesPerGeneration: uses});
        expect(getParliamentModel(game, p1)!.viewer!.resolutionAction).deep.include({usesLeft: uses, usesPerGeneration: uses, available: true});
      }
    });

    it('spent twice at influence 1 → gone, with its numbers named; the seat becomes chairman (influence 2) → the THIRD use appears in the same generation', () => {
      const [game, p1, , parliament] = enacted();
      const {floater} = threeHolders(p1);
      setInfluence(parliament, p1, 1);
      for (let use = 0; use < 2; use++) {
        branchOf(actionOption(p1)!, CardResource.FLOATER)!.process({type: 'card', cards: [floater.name]});
        runAllActions(game);
      }
      expect(floater.resourceCount).eq(4);
      expect(actionOption(p1), 'both uses spent').is.undefined;
      const model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({usesLeft: 0, usesPerGeneration: 2, available: false});
      expect(JSON.stringify(model.reason)).includes('This resolution action was already used ${0} of ${1} times this generation');
      expect(JSON.stringify(model.reason)).includes('"2"');
      // The Agenda +1 (the chairman's seat): influence 1 → 2, mid-generation — the limit is read at the use.
      setInfluence(parliament, p1, 2);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(1);
      const third = actionOption(p1)!;
      expect(third.resolutionActionPrompt).deep.include({usesLeft: 1, usesPerGeneration: 3});
      branchOf(third, CardResource.FLOATER)!.process({type: 'card', cards: [floater.name]});
      runAllActions(game);
      expect(floater.resourceCount).eq(6);
      expect(actionOption(p1)).is.undefined;
      expect(JSON.stringify(getParliamentModel(game, p1)!.viewer!.resolutionAction!.reason)).includes('"3"');
    });

    it('EVERY USE IS AN ACTION OF THE TURN — both actions of one turn may be this law', () => {
      const [game, p1] = enacted();
      const {mech} = threeHolders(p1);
      game.activePlayer = p1;
      p1.actionsTakenThisRound = 0;
      p1.takeAction();
      for (const n of [1, 2]) {
        const menu = cast(p1.getWaitingFor(), OrOptions);
        const index = menu.options.findIndex((o) => markerOf(o) !== undefined);
        expect(index, `the law stands in the menu of action ${n}`).is.greaterThanOrEqual(0);
        const branch = cast(menu.options[index], OrOptions).options.findIndex((o) => (o as SelectCard<ICard>).resourceGainPrompt?.cardResource === 'mech');
        p1.process({type: 'or', index, response: {type: 'or', index: branch, response: {type: 'card', cards: [mech.name]}}});
        runAllActions(game);
        expect(mech.resourceCount).eq(n);
      }
      expect(game.parliament!.resolutionActionUsesOf(p1)).eq(2);
    });

    it('the generation boundary restores every use; a reload keeps the spent ones', () => {
      const [game, p1, , parliament] = enacted();
      const {fighter} = threeHolders(p1);
      branchOf(actionOption(p1)!, CardResource.FIGHTER)!.process({type: 'card', cards: [fighter.name]});
      runAllActions(game);
      const again = reload(game);
      const seat = again.getPlayerById(p1.id);
      expect(again.parliament!.resolutionActionUsesOf(seat)).eq(1);
      expect(again.parliament!.resolutionActionUsesLeft(seat)).eq(1);
      expect(seat.playedCards.get(CardName.SECURITY_FLEET)?.resourceCount).eq(1);
      parliament.resetGenerationUses();
      expect(parliament.resolutionActionUsesLeft(p1)).eq(2);
    });
  });

  describe('availability — with a reason, never hidden', () => {
    it('no holder of any of the three kinds → not offered, the model names it; the wheel does not count it', () => {
      const [game, p1] = enacted();
      expect(actionOption(p1)).is.undefined;
      expect(getParliamentModel(game, p1)!.viewer!.resolutionAction).deep.include({
        resolution: MANUFACTURING_RUN_ID, party: PartyName.INDUSTRIALISTS, hasAccess: true, usesLeft: 2, usesPerGeneration: 2,
        available: false, reason: MANUFACTURING_RUN_NO_HOLDER_REASON,
      });
      const before = potentialActions(p1).partyActions ?? 0;
      p1.playedCards.push(new TitanShuttles());
      expect(actionOption(p1)).is.not.undefined;
      expect(potentialActions(p1).partyActions).eq(before + 1);
    });

    it('MarsBot never holds it: no option, no access', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'none'});
      game.playerIsFinishedWithResearchPhase(human);
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatEnacted(parliament, RUN);
      human.playedCards.push(new ConstructionMechs());
      bot.playedCards.push(new MechSports());
      expect(ParliamentHandler.resolutionActionOptions(bot)).is.empty;
      expect(getParliamentModel(game, bot)!.viewer!.resolutionAction).deep.include({hasAccess: false, available: false});
      expect(ParliamentHandler.resolutionActionOptions(human), 'the human holds it').has.length(1);
    });
  });

  describe('the chairman quest — play 2 green cards', () => {
    function enactedRun(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, RUN);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGenerationThroughParliament(game);
      settleParliamentGates(game);
      expect(parliament.enactedDefinition()).eq(MANUFACTURING_RUN);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2});
      expect(parliament.quest?.source).eq(MANUFACTURING_RUN_ID);
      game.phase = Phase.ACTION;
      return [game, p1, p2, parliament];
    }

    function asOwnAction(player: IPlayer, f: () => void, source: EventSource = {kind: 'card', card: CardName.TREES, owner: player.color}): void {
      player.game.events.beginAction(player, source, {category: 'card-play'});
      try {
        f();
      } finally {
        player.game.events.endScope();
      }
    }

    it('the action itself moves no progress (it plays nothing and its resources count for no quest); a green PLAY does', () => {
      const [game, p1, , parliament] = enactedRun();
      const {mech} = threeHolders(p1);
      parliament.resetGenerationUses();
      branchOf(actionOption(p1)!, CardResource.MECH)!.process({type: 'card', cards: [mech.name]});
      runAllActions(game);
      expect(mech.resourceCount).eq(1);
      expect(parliament.questProgressOf(p1), 'the law\'s own action').eq(0);
      const green = fakeCard({name: CardName.MICRO_MILLS, type: CardType.AUTOMATED}) as IProjectCard;
      p1.cardsInHand.push(green);
      asOwnAction(p1, () => p1.playCard(green));
      expect(parliament.questProgressOf(p1)).eq(1);
    });
  });
});
