import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  COLONY_CONTEST, COLONY_CONTEST_CODE, COLONY_CONTEST_ID, COLONY_CONTEST_TITANIUM, NO_COLONY_AVAILABLE,
} from '../../src/server/parliament/resolutions/unity/ColonyContest';
import {COLONIZATION_FUNDING} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../src/common/cards/render/CardRenderSymbolType';
import {isICardRenderItem, isICardRenderSymbol} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {BuildColony} from '../../src/server/deferredActions/BuildColony';
import {Colony} from '../../src/server/colonies/Colony';
import {Luna} from '../../src/server/colonies/Luna';
import {Callisto} from '../../src/server/colonies/Callisto';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Titan} from '../../src/server/colonies/Titan';
import {Europa} from '../../src/server/colonies/Europa';
import {AtmoCollectors} from '../../src/server/cards/colonies/AtmoCollectors';
import {JovianLanterns} from '../../src/server/cards/colonies/JovianLanterns';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * COLONY CONTEST (Turmoil Redux, RX09) — titanium by influence for every
 * participant (the family's plainest payout) and the FIRST winner's part that
 * is a COLONY: the winner builds one for free through the standard build.
 *
 * What these specs pin: the titanium by each seat's OWN influence (the winner
 * after its Agenda step), a stock gain with its named zero; the winner's pick
 * as a resolution-sourced SelectColony offering exactly what the ordinary
 * rules allow (the rest disabled with reasons); the build FREE (no M€, no
 * fleet) with the tile's own build bonus paid by the colony — a quiet one
 * (Luna's production) and the interactive ones (Titan's floater target,
 * Europa's ocean) asked by the COLONY and waited out by the phase; the named
 * skip of an empty table; a neutral winner building nothing; a reload inside
 * the question building once; the chairman quest untouched by the free colony
 * (Q5) and completed by the player's own builds; MarsBot never paid.
 */
const CONTEST = resolutionInstanceId(COLONY_CONTEST_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Colony Contest in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, CONTEST);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** The Agenda position that reads as influence `n` for a seat that takes no step during the phase. */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

/** THE TABLE: the tiles in this order, each with the given seats' cubes on it (activated unless said otherwise). */
function arrangeColonies(game: IGame, table: Array<[Colony, Array<IPlayer>, {inactive?: boolean}?]>): void {
  game.colonies = table.map(([colony, owners, opts]) => {
    colony.isActive = opts?.inactive !== true;
    colony.colonies = owners.map((p) => p.id);
    return colony;
  });
}

function colonyOf(game: IGame, name: ColonyName): Colony {
  const colony = game.colonies.find((c) => c.name === name);
  if (colony === undefined) {
    throw new Error(`${name} is not on the table`);
  }
  return colony as Colony;
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function outcomesOf(parliament: Parliament, player: IPlayer): Array<SerializedEnactOutcome> {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === player.id && o.kind !== 'reaction');
}

/** The winner's pick as it stands: the tiles offered and the disabled ones with their reasons. */
function offerOf(prompt: SelectColony): {offered: Array<ColonyName>, disabled: Record<string, string>} {
  const disabled: Record<string, string> = {};
  for (const d of prompt.disabledColonies ?? []) {
    disabled[d.colony.name] = typeof d.reason === 'string' ? d.reason : d.reason.message;
  }
  return {offered: prompt.colonies.map((c) => c.name), disabled};
}

describe('ColonyContest', () => {
  describe('the catalog entry', () => {
    it('is RX09 of Unity, ONE card: titanium by influence for everyone (stock, no cap), the winner\'s COLONY as data, the two-colonies quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(COLONY_CONTEST_ID)).eq(COLONY_CONTEST);
      expect(COLONY_CONTEST_CODE).eq('RX09');
      expect(COLONY_CONTEST_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX09')).eq(COLONY_CONTEST);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX08'), 'earlier codes stand — a code is assigned by hand').eq(COLONIZATION_FUNDING);
      expect(COLONY_CONTEST.party).eq(PartyName.UNITY);
      expect(COLONY_CONTEST.compatibility, 'colonies are mandatory in Redux — no compatibility marker').is.undefined;
      expect(COLONY_CONTEST.scaled).deep.eq([COLONY_CONTEST_TITANIUM]);
      expect(COLONY_CONTEST_TITANIUM).deep.eq({id: 'titanium', unit: {kind: 'stock', resource: Resource.TITANIUM}, perInfluence: 1, recipient: 'each'});
      expect(scaledAmount(COLONY_CONTEST_TITANIUM, 3), 'no count, no cap').eq(3);
      expect(scaledAmount(COLONY_CONTEST_TITANIUM, 0)).eq(0);
      expect(COLONY_CONTEST.winnerReward, 'the winner\'s part is a COLONY, declared as data').deep.eq({kind: 'colony'});
      expect(COLONY_CONTEST.immediateSteps?.map((s) => s.key)).deep.eq(['titanium']);
      expect(COLONY_CONTEST.winnerSteps?.map((s) => s.key)).deep.eq(['colony']);
      expect(COLONY_CONTEST.quest).deep.eq({goal: {kind: 'colony'}, count: 2});
      expect(familyOf(COLONY_CONTEST), 'the stand reads it as the winner-part family, like RX01 / RX03').eq('winner-tile');
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === CONTEST)).has.length(1);
    });

    it('the face prints titanium / influence and the colony with the winner star; the quest graphic is two colonies', () => {
      const [formula, winner] = COLONY_CONTEST.renderData.rows;
      expect(formula.filter(isICardRenderItem).map((item) => item.type)).deep.eq([CardRenderItemType.TITANIUM, CardRenderItemType.INFLUENCE]);
      expect(formula.filter(isICardRenderSymbol).map((symbol) => symbol.type)).deep.eq([CardRenderSymbolType.SLASH]);
      expect(winner.filter(isICardRenderItem).map((item) => item.type)).deep.eq([CardRenderItemType.COLONIES, CardRenderItemType.VOTE_WINNER]);
      expect(winner.filter(isICardRenderItem)[0].amount).eq(1);
      const [quest] = questRenderData(COLONY_CONTEST.quest!).rows;
      const items = quest.filter(isICardRenderItem);
      expect(items.map((item) => item.type)).deep.eq([CardRenderItemType.COLONIES]);
      expect(items[0].amount).eq(2);
    });

    it('the reward address of the colony kind: the colonies screen, a tile unit that is never a skip by its absence, read as the winner\'s part', () => {
      expect(REWARD_ADDRESS.colony).deep.include({surface: 'colonies', source: 'none', unit: 'tile', stage: 'colonies', reading: 'winner-reward'});
      const built = rewardAddressOf({player: 'blue' as never, step: 'colony', part: 'winner', kind: 'colony', colony: ColonyName.LUNA}, 'blue' as never);
      expect(built.skipped).is.undefined;
      expect(built.payload).deep.eq({colony: 'Luna'});
      const skipped = rewardAddressOf({player: 'blue' as never, step: 'colony', part: 'winner', kind: 'skipped', reason: NO_COLONY_AVAILABLE}, 'blue' as never);
      expect(skipped.skipped).eq(NO_COLONY_AVAILABLE);
    });
  });

  describe('the titanium', () => {
    it('pays EVERY participant 1 titanium per point of its OWN influence — the winner after its Agenda step — into the supply, never production; the record and the journal line', () => {
      const [game, p1, p2, parliament] = stage();
      arrangeColonies(game, []);
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(p1.titanium).eq(2);
      expect(p2.titanium).eq(3);
      expect(p1.production.titanium, 'a stock gain, never production').eq(0);
      expect(outcomesOf(parliament, p1).map((o) => `${o.step}:${o.kind}`)).deep.eq(['titanium:stock', 'colony:skipped']);
      expect(outcomesOf(parliament, p2).map((o) => `${o.step}:${o.kind}`), 'the colony is the winner\'s part alone').deep.eq(['titanium:stock']);
      expect(outcomesOf(parliament, p1)[0]).deep.include({part: 'effect', effect: 'titanium', stock: Resource.TITANIUM, amount: 2, influence: 2, before: 0, after: 2});
      const line = game.gameLog.find((entry) => entry.message === '${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})');
      expect(line, 'one journal line with the whole calculation').is.not.undefined;
      expect(line?.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(COLONY_CONTEST_ID);
    });

    it('influence 0 is a NAMED skip: nothing is added, the record and the journal say why', () => {
      const [game, p1, p2, parliament] = stage();
      arrangeColonies(game, []);
      parliament.agenda.set(p2.id, 0);
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(p2.titanium).eq(0);
      expect(outcomesOf(parliament, p2)[0]).deep.include({kind: 'skipped', effect: 'titanium', stock: Resource.TITANIUM, amount: 0, influence: 0, reason: 'No influence'});
      expect(game.gameLog.some((entry) => entry.message === '${0} has no influence — no titanium from ${1}')).is.true;
      expect(p1.titanium, 'the winner (influence 1 after its step) is paid').eq(1);
    });
  });

  describe('the winner\'s colony', () => {
    it('asks the winner right after its titanium: a SelectColony with the resolution as its SOURCE, offering exactly what the ordinary rules allow (the rest disabled with reasons); the other seat reads who is asked', () => {
      const [game, p1, p2, parliament] = stage();
      arrangeColonies(game, [[new Luna(), [p1]], [new Callisto(), [p2, p2, p2]], [new Titan(), [], {inactive: true}], [new Ceres(), []]]);
      endGeneration(game);
      const prompt = cast(p1.getWaitingFor(), SelectColony);
      expect(prompt.title).eq('Select where to build the free colony');
      expect(prompt.placementContext).deep.eq({
        cancellable: false,
        reason: 'The winner of the vote builds this colony — the resolution is already enacted',
        source: {kind: 'resolution', resolution: COLONY_CONTEST_ID},
      });
      expect(offerOf(prompt)).deep.eq({
        offered: [ColonyName.CERES],
        disabled: {[ColonyName.LUNA]: 'You already have a colony here', [ColonyName.CALLISTO]: 'Colony is full', [ColonyName.TITAN]: 'Colony is inactive'},
      });
      expect(outcomesOf(parliament, p1).map((o) => o.step), 'the titanium was paid before the question').deep.eq(['titanium']);
      expect(getParliamentModel(game, p2)?.phase?.pending).deep.eq({player: p1.color, key: 'colony', input: 'colony'});
      expect(p2.getWaitingFor(), 'the other seat waits — nothing is asked of it').is.undefined;
    });

    it('the answer builds the colony FOR FREE — the cube on the tile, no M€ spent, no fleet used — with the tile\'s own build bonus (Luna: +2 M€ production); the record names the tile, the journal the resolution; the phase goes on', () => {
      const [game, p1, p2, parliament] = stage();
      arrangeColonies(game, [[new Luna(), []], [new Callisto(), []]]);
      endGeneration(game);
      const prompt = cast(p1.getWaitingFor(), SelectColony);
      expect(offerOf(prompt).offered).deep.eq([ColonyName.LUNA, ColonyName.CALLISTO]);
      const production = p1.production.megacredits;
      const megacredits = p1.megaCredits; // after the production phase's income — the build must not move it
      p1.process({type: 'colony', colonyName: ColonyName.LUNA});
      runAllActions(game);
      expect(colonyOf(game, ColonyName.LUNA).colonies).deep.eq([p1.id]);
      expect(colonyOf(game, ColonyName.CALLISTO).colonies).deep.eq([]);
      expect(p1.megaCredits, 'free: no 17 M€').eq(megacredits);
      expect(p1.colonies.usedTradeFleets, 'no fleet is spent').eq(0);
      expect(p1.production.megacredits, 'the tile\'s printed build bonus, paid by the colony').eq(production + 2);
      const record = outcomesOf(parliament, p1).find((o) => o.step === 'colony');
      expect(record).deep.include({part: 'winner', kind: 'colony', colony: ColonyName.LUNA});
      const line = game.gameLog.find((entry) => entry.message === '${0} built the free colony of ${1} on ${2}');
      expect(line, 'the journal names the resolution and the tile').is.not.undefined;
      expect(line?.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(COLONY_CONTEST_ID);
      expect(line?.data.find((d) => d.type === LogMessageDataType.COLONY)?.value).eq(ColonyName.LUNA);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.outcomes?.find((o) => o.kind === 'colony')).deep.include({player: p1.id, colony: ColonyName.LUNA});
      expect(getParliamentModel(game, p2)?.lastPhase?.outcomes?.find((o) => o.kind === 'colony'), 'the record reaches the client with the tile').deep.include({player: p1.color, part: 'winner', colony: ColonyName.LUNA});
      expect(parliament.quest?.source).eq(COLONY_CONTEST_ID);
    });

    it('no available colony (full, inactive, already yours): the part is NAMED and skipped — nothing is built, nothing substitutes — and the phase goes on', () => {
      const [game, p1, p2, parliament] = stage();
      arrangeColonies(game, [[new Luna(), [p1]], [new Callisto(), [p2, p2, p2]], [new Titan(), [], {inactive: true}]]);
      endGeneration(game);
      runAllActions(game);
      expect(p1.getWaitingFor(), 'no empty question').is.not.instanceOf(SelectColony);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(outcomesOf(parliament, p1).find((o) => o.step === 'colony')).deep.include({part: 'winner', kind: 'skipped', reason: NO_COLONY_AVAILABLE});
      expect(game.gameLog.some((entry) => entry.message === 'No colony can be built — the winner\'s colony from ${0} is skipped')).is.true;
      expect(p1.megaCredits, 'nothing substitutes for the colony — the winner\'s M€ are the other seat\'s (the same income, nothing more)').eq(p2.megaCredits);
      expect(game.colonies.map((c) => c.colonies.length)).deep.eq([1, 3, 0]);
    });

    it('a NEUTRAL winner builds nothing; the titanium still reaches every participant', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, CONTEST);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, agendaForInfluence(1));
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      arrangeColonies(game, [[new Luna(), []]]);
      endGeneration(game);
      runAllActions(game);
      expect(p1.getWaitingFor()).is.not.instanceOf(SelectColony);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.lastPhase?.outcomes?.some((o) => o.step === 'colony'), 'no colony step for a neutral winner').is.false;
      expect(p1.titanium).eq(1);
      expect(p2.titanium).eq(2);
      expect(colonyOf(game, ColonyName.LUNA).colonies).deep.eq([]);
    });

    it('the build bonus is the TILE\'s own — an interactive one is asked by the colony, not the resolution: Titan with two floater holders asks WHERE the 3 floaters go, and the phase waits for it', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Titan(), []]]);
      p1.playedCards.push(new AtmoCollectors(), new JovianLanterns());
      endGeneration(game);
      p1.process({type: 'colony', colonyName: ColonyName.TITAN});
      const target = cast(p1.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.ATMO_COLLECTORS, CardName.JOVIAN_LANTERNS]);
      expect(target.choiceContext?.source, 'the COLONY asks — the engine\'s own marker, not the resolution').deep.eq({kind: 'colony', name: ColonyName.TITAN});
      expect(colonyOf(game, ColonyName.TITAN).colonies, 'the cube is already on the tile').deep.eq([p1.id]);
      expect(outcomesOf(parliament, p1).find((o) => o.step === 'colony'), 'the record is in').deep.include({kind: 'colony', colony: ColonyName.TITAN});
      expect(parliament.phase?.step, 'the phase waits out the colony\'s own question').eq('effects');
      p1.process({type: 'card', cards: [CardName.JOVIAN_LANTERNS]});
      runAllActions(game);
      expect(p1.tableau.get(CardName.JOVIAN_LANTERNS)?.resourceCount).eq(3);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
    });

    it('Europa: the colony\'s ocean is a plain board placement of the ENGINE (no resolution source) that the phase waits out before it goes on', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Europa(), []]]);
      endGeneration(game);
      p1.process({type: 'colony', colonyName: ColonyName.EUROPA});
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      const source = (ocean as {placementContext?: {source?: {kind?: string}}}).placementContext?.source;
      expect(source?.kind, 'the ocean is the colony\'s build bonus — the engine\'s placement, never the resolution\'s ask').not.eq('resolution');
      expect(parliament.phase?.step).eq('effects');
      expect(game.board.getOceanSpaces()).has.length(0);
      p1.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(game);
      expect(game.board.getOceanSpaces()).has.length(1);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.outcomes?.find((o) => o.kind === 'colony')).deep.include({colony: ColonyName.EUROPA});
    });

    it('a reload inside the question rebuilds the same pick with the same source; the answer builds ONCE', () => {
      const [game, p1] = stage();
      arrangeColonies(game, [[new Luna(), []], [new Callisto(), []]]);
      endGeneration(game);
      const before = cast(p1.getWaitingFor(), SelectColony);
      const game2 = reload(game);
      const p1b = game2.getPlayerById(p1.id);
      const after = cast(p1b.getWaitingFor(), SelectColony);
      expect(offerOf(after)).deep.eq(offerOf(before));
      expect(after.placementContext).deep.eq(before.placementContext);
      p1b.process({type: 'colony', colonyName: ColonyName.LUNA});
      runAllActions(game2);
      settleParliamentGates(game2);
      expect(game2.parliament?.phase).is.undefined;
      expect(colonyOf(game2, ColonyName.LUNA).colonies, 'one cube').deep.eq([p1.id]);
      expect(game2.parliament?.lastPhase?.outcomes?.filter((o) => o.kind === 'colony')).has.length(1);
      expect(p1b.production.megacredits, 'the build bonus once').eq(2);
    });
  });

  describe('the chairman quest — build 2 colonies', () => {
    /** A colony built by the player's OWN action (the standard build under an action scope). */
    function buildAsAction(player: TestPlayer, colony: ColonyName): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: CardName.SPACE_PORT, owner: player.color}, {category: 'card-play'});
      try {
        const pick = cast(new BuildColony(player).execute(), SelectColony);
        pick.process({type: 'colony', colonyName: colony});
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    it('the free colony moves no progress (Q5); two colonies the player builds as its own actions complete it', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Luna(), []], [new Callisto(), []], [new Ceres(), []]]);
      endGeneration(game);
      p1.process({type: 'colony', colonyName: ColonyName.LUNA});
      runAllActions(game);
      settleParliamentGates(game);
      game.phase = Phase.ACTION;
      p1.popWaitingFor(); // the next generation's research pick — not this spec's subject
      expect(parliament.quest?.source).eq(COLONY_CONTEST_ID);
      expect(parliament.questProgressOf(p1), 'the enactment\'s own colony is not the player\'s action').eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      buildAsAction(p1, ColonyName.CALLISTO);
      expect(parliament.questProgressOf(p1)).eq(1);
      buildAsAction(p1, ColonyName.CERES);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
    });
  });

  describe('MarsBot', () => {
    it('MarsBot (mode none) is never paid, never asked and never a winner; the human\'s free colony stands alone', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, CONTEST);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      arrangeColonies(game, [[new Luna(), []]]);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      const pick = cast(human.getWaitingFor(), SelectColony);
      expect(offerOf(pick).offered).deep.eq([ColonyName.LUNA]);
      human.process({type: 'colony', colonyName: ColonyName.LUNA});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.outcomes?.map((o) => o.player), 'every record is the human\'s').deep.eq([human.id, human.id]);
      expect(colonyOf(game, ColonyName.LUNA).colonies).deep.eq([human.id]);
      expect(bot.titanium).eq(0);
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.participates, 'the bot takes no part').is.false;
    });
  });
});
