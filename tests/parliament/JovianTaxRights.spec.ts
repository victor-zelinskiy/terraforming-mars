import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  JOVIAN_TAX_RIGHTS, JOVIAN_TAX_RIGHTS_CAP, JOVIAN_TAX_RIGHTS_CODE, JOVIAN_TAX_RIGHTS_ID, JOVIAN_TAX_RIGHTS_PRODUCTION, JOVIAN_TAX_RIGHTS_TITANIUM,
  NO_COLONIES,
} from '../../src/server/parliament/resolutions/unity/JovianTaxRights';
import {COLONY_CONTEST_TITANIUM} from '../../src/server/parliament/resolutions/unity/ColonyContest';
import {ARCHITECTURE_AWARD_ID, ARCHITECTURE_AWARD_PRODUCTION} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, passToParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {declaredCountIds, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {ColoniesHandler} from '../../src/server/colonies/ColoniesHandler';
import {Counter} from '../../src/server/behavior/Counter';
import {Colony} from '../../src/server/colonies/Colony';
import {Luna} from '../../src/server/colonies/Luna';
import {Callisto} from '../../src/server/colonies/Callisto';
import {Titan} from '../../src/server/colonies/Titan';
import {Miranda} from '../../src/server/colonies/Miranda';
import {Pluto} from '../../src/server/colonies/Pluto';
import {Io} from '../../src/server/colonies/Io';
import {Europa} from '../../src/server/colonies/Europa';
import {Mine} from '../../src/server/cards/base/Mine';
import {IoMiningIndustries} from '../../src/server/cards/base/IoMiningIndustries';
import {MirandaResort} from '../../src/server/cards/base/MirandaResort';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../src/common/cards/render/CardRenderSymbolType';
import {isICardRenderItem, isICardRenderProductionBox, isICardRenderSymbol} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {cardCountVerdict, countColoniesToward, countSpacesToward, resolutionCountKind, spaceCountVerdict} from '../../src/common/parliament/resolutionCounts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * JOVIAN TAX RIGHTS (Turmoil Redux, RX17) — two finished halves in one card
 * (Colony Contest's titanium by influence, Architecture Award's capped M€
 * production) and the SIXTH kind of counted term: a count over the seat's
 * COLONIES — its CUBES on the colony tiles, explained tile by tile.
 *
 * What these specs pin: the titanium is Colony Contest's step word for word;
 * the production is 1 step per CUBE (two cubes on one tile are 2, another
 * seat's cube on the same tile is 0), capped at 5 on the production part
 * alone (7 cubes → +5, `uncapped` 7 kept), influence never entering it; the
 * number is THE ENGINE's (the one `ColoniesHandler.coloniesOf` the behavior
 * counter and `Player.getColoniesCount` read too) and the LIST of tiles is
 * frozen in the record; zero colonies is a NAMED skip distinct from «no
 * influence» (the card pays one part and skips the other); the printed order
 * is the executed order; nothing is paid twice; MarsBot's cubes count for
 * nobody and it is never paid; the model carries the count with its list.
 *
 * THE ORDER OF THE GENERATION (`Game.ts`): the production phase → the
 * colonies' end-of-generation step (tracks up, fleets back — no colony is
 * built there) → `ParliamentPhase.start`. So the titanium is spendable next
 * generation while the +N M€ production first PAYS in the next generation,
 * and the colonies' step cannot move the count.
 */
const RIGHTS = resolutionInstanceId(JOVIAN_TAX_RIGHTS_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the card in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, RIGHTS);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  return [game, p1, p2, parliament];
}

/** THE TABLE: the tiles in this order, each with the given seats' cubes on it (a seat listed twice holds two cubes). */
function arrangeColonies(game: IGame, table: Array<[Colony, Array<IPlayer>]>): void {
  game.colonies = table.map(([colony, owners]) => {
    colony.isActive = true;
    colony.colonies = owners.map((p) => p.id);
    return colony;
  });
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function recordsOf(parliament: Parliament, player: TestPlayer): Array<SerializedEnactOutcome> {
  return (parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === player.id && o.kind !== 'reaction');
}

function outcomeOf(parliament: Parliament, player: TestPlayer, step: string): SerializedEnactOutcome | undefined {
  return recordsOf(parliament, player).find((o) => o.step === step);
}

/** The behavior counter's reading of the player's colonies — the canonical «colonies» countable. */
function counterColonies(player: TestPlayer): number {
  return new Counter(player, new Mine()).count({colonies: {colonies: {}}});
}

describe('JovianTaxRights', () => {
  describe('the catalog entry', () => {
    it('is RX17 of Unity, ONE card, no compatibility (colonies are mandatory in Redux), the two-Jovian-tags quest, nothing for the winner or the world', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(JOVIAN_TAX_RIGHTS_ID)).eq(JOVIAN_TAX_RIGHTS);
      expect(JOVIAN_TAX_RIGHTS_CODE).eq('RX17');
      expect(JOVIAN_TAX_RIGHTS_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX17')).eq(JOVIAN_TAX_RIGHTS);
      expect(JOVIAN_TAX_RIGHTS.party).eq(PartyName.UNITY);
      expect(JOVIAN_TAX_RIGHTS.copies).eq(1);
      expect(JOVIAN_TAX_RIGHTS.compatibility, 'colonies are mandatory in Redux — no compatibility marker').is.undefined;
      expect(JOVIAN_TAX_RIGHTS.quest).deep.eq({goal: {kind: 'tag', tag: Tag.JOVIAN}, count: 2});
      expect(JOVIAN_TAX_RIGHTS.winnerSteps, 'no winner-only part').is.undefined;
      expect(JOVIAN_TAX_RIGHTS.winnerReward, 'no winner tile').is.undefined;
      expect(JOVIAN_TAX_RIGHTS.worldSteps, 'no world part').is.undefined;
      expect(JOVIAN_TAX_RIGHTS.passive, 'no passive').is.undefined;
      expect(JOVIAN_TAX_RIGHTS.levy, 'no levy').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === RIGHTS)).has.length(1);
    });

    it('declares the two halves: Colony Contest\'s titanium WORD FOR WORD, and +1 M€ production per COLONY with the cap on that part alone — influence does not enter it', () => {
      expect(JOVIAN_TAX_RIGHTS.scaled).deep.eq([JOVIAN_TAX_RIGHTS_TITANIUM, JOVIAN_TAX_RIGHTS_PRODUCTION]);
      expect(JOVIAN_TAX_RIGHTS_TITANIUM, 'RX09\'s formula').deep.eq(COLONY_CONTEST_TITANIUM);
      expect(JOVIAN_TAX_RIGHTS_TITANIUM.cap, 'the titanium is not capped').is.undefined;
      expect(JOVIAN_TAX_RIGHTS_PRODUCTION).deep.eq({
        id: 'production', unit: {kind: 'production', resource: Resource.MEGACREDITS}, perInfluence: 0, count: {id: 'colonies', per: 1}, cap: 5, recipient: 'each',
      });
      expect(JOVIAN_TAX_RIGHTS_PRODUCTION.unit, 'the same unit as Architecture Award\'s production').deep.eq(ARCHITECTURE_AWARD_PRODUCTION.unit);
      expect(JOVIAN_TAX_RIGHTS_PRODUCTION.perInfluence, 'unlike Architecture Award, influence is NOT a term of the production').eq(0);
      expect(JOVIAN_TAX_RIGHTS_CAP).eq(5);
      // THE SIXTH KIND of counted term.
      expect(resolutionCountKind('colonies')).deep.eq({kind: 'colonies'});
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('colonies');
      // THE PRINTED ORDER: the titanium first, the production second.
      expect(JOVIAN_TAX_RIGHTS.immediateSteps?.map((step) => step.key)).deep.eq(['titanium', 'production']);
      expect(familyOf(JOVIAN_TAX_RIGHTS), 'the stand opens the colonies-count family from the declaration alone').eq('counted-colonies');
    });

    it('the face prints «[titanium] / [influence]» and «[1 M€ production] / [colony]» on one row, «max 5» under them; the quest graphic is two Jovian tags', () => {
      const [formulas, cap] = JOVIAN_TAX_RIGHTS.renderData.rows;
      const items = formulas.filter(isICardRenderItem);
      expect(items.map((item) => item.type)).deep.eq([CardRenderItemType.TITANIUM, CardRenderItemType.INFLUENCE, CardRenderItemType.COLONIES]);
      expect(items[0].amount).eq(1);
      expect(items[2].amount, 'ONE colony symbol — the counted object, never a number of colonies').eq(1);
      expect(formulas.filter(isICardRenderSymbol).map((symbol) => symbol.type)).deep.eq([CardRenderSymbolType.SLASH, CardRenderSymbolType.NBSP, CardRenderSymbolType.NBSP, CardRenderSymbolType.SLASH]);
      const box = formulas.find(isICardRenderProductionBox);
      expect(box, 'the production part is a production box').is.not.undefined;
      expect(box!.rows[0].filter(isICardRenderItem).map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.MEGACREDITS, 1]]);
      const text = cap.filter(isICardRenderItem).find((item) => item.type === CardRenderItemType.TEXT);
      expect(text?.text, 'the cap, under the production formula it bounds').eq('max 5');
      expect(text?.isUppercase).is.true;
      const [quest] = questRenderData(JOVIAN_TAX_RIGHTS.quest!).rows;
      const questItems = quest.filter(isICardRenderItem);
      expect(questItems.map((item) => item.type)).deep.eq([CardRenderItemType.TAG]);
      expect(questItems[0].tag).eq(Tag.JOVIAN);
      expect(questItems[0].amount).eq(2);
    });
  });

  describe('the formula — the ONE arithmetic', () => {
    it('titanium = influence, uncapped; production = colonies, capped at 5, influence never a term of it', () => {
      expect(scaledAmount(JOVIAN_TAX_RIGHTS_TITANIUM, 0)).eq(0);
      expect(scaledAmount(JOVIAN_TAX_RIGHTS_TITANIUM, 3)).eq(3);
      expect(scaledAmount(JOVIAN_TAX_RIGHTS_TITANIUM, 8), 'no cap on the titanium').eq(8);
      expect(scaledAmount(JOVIAN_TAX_RIGHTS_PRODUCTION, 0, 0)).eq(0);
      expect(scaledAmount(JOVIAN_TAX_RIGHTS_PRODUCTION, 0, 4)).eq(4);
      expect(scaledAmount(JOVIAN_TAX_RIGHTS_PRODUCTION, 5, 4), 'influence 5 adds nothing to the production').eq(4);
      expect(scaledAmount(JOVIAN_TAX_RIGHTS_PRODUCTION, 0, 5)).eq(5);
      expect(scaledAmount(JOVIAN_TAX_RIGHTS_PRODUCTION, 0, 7), 'the cap bites').eq(5);
      expect(uncappedAmount(JOVIAN_TAX_RIGHTS_PRODUCTION, 0, 7), 'the sum before the cap is kept').eq(7);
      expect(uncappedAmount(JOVIAN_TAX_RIGHTS_PRODUCTION, 3, 7), 'influence is not in the sum either').eq(7);
    });
  });

  describe('the count — the seat\'s colonies, by THE ENGINE\'s list', () => {
    it('counts CUBES, not tiles: two cubes on one tile are 2, another seat\'s cube on the same tile is 0; the list names the tiles in the table\'s order, a name per cube', () => {
      const [game, p1, p2] = reduxGame();
      arrangeColonies(game, [[new Luna(), [p1, p2, p1]], [new Titan(), [p2]], [new Miranda(), [p1]], [new Pluto(), []]]);
      expect(resolutionCount(p1, 'colonies')).deep.eq({id: 'colonies', count: 3, cards: [], colonies: [ColonyName.LUNA, ColonyName.LUNA, ColonyName.MIRANDA]});
      expect(resolutionCount(p2, 'colonies')).deep.eq({id: 'colonies', count: 2, cards: [], colonies: [ColonyName.LUNA, ColonyName.TITAN]});
      // A tile the seat only trades with (a visitor, an inactive tile) is not theirs.
      game.colonies[3].visitor = p1.id;
      game.colonies[1].isActive = false;
      expect(resolutionCount(p1, 'colonies').count).eq(3);
      expect(resolutionCount(p2, 'colonies').count, 'a cube on an inactive tile is still a colony').eq(2);
    });

    it('THE NUMBER IS THE ENGINE\'S: the resolution\'s count, the behavior counter\'s «colonies» countable and Player.getColoniesCount all read ColoniesHandler.coloniesOf — one list', () => {
      const [game, p1, p2] = reduxGame();
      arrangeColonies(game, [[new Luna(), [p1, p1]], [new Callisto(), [p2]], [new Io(), [p1]], [new Europa(), [p1]]]);
      const shared = ColoniesHandler.coloniesOf(game, p1);
      expect(shared.map((c) => c.name)).deep.eq([ColonyName.LUNA, ColonyName.LUNA, ColonyName.IO, ColonyName.EUROPA]);
      expect(resolutionCount(p1, 'colonies').count).eq(shared.length);
      expect(counterColonies(p1), 'the behavior counter reads the same list').eq(shared.length);
      expect(p1.getColoniesCount(), 'and so does the player\'s own count').eq(shared.length);
      expect(resolutionCount(p2, 'colonies').count).eq(1);
      expect(counterColonies(p2)).eq(1);
      expect(p2.getColoniesCount()).eq(1);
      // No colony at all — every reader agrees on zero, none guesses.
      arrangeColonies(game, [[new Luna(), [p2]]]);
      expect(resolutionCount(p1, 'colonies')).deep.eq({id: 'colonies', count: 0, cards: [], colonies: []});
      expect(counterColonies(p1)).eq(0);
      expect(p1.getColoniesCount()).eq(0);
    });

    it('the shared predicates: the STAND\'s reading is the same function over a list of names; a card and a cell never count, and say why', () => {
      expect(countColoniesToward('colonies', [ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN]))
        .deep.eq({id: 'colonies', count: 3, cards: [], colonies: [ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN]});
      expect(countColoniesToward('colonies', [])).deep.eq({id: 'colonies', count: 0, cards: [], colonies: []});
      expect(countColoniesToward('powerTags', [ColonyName.LUNA]), 'a non-colonies id counts nothing this way').deep.eq({id: 'powerTags', count: 0, cards: []});
      const mine = new Mine();
      expect(cardCountVerdict('colonies', mine, {eventTagsInPlay: false})).deep.eq({counts: false, reason: 'Counted by your colonies, not among cards'});
      expect(spaceCountVerdict('colonies', {id: '03', spaceType: SpaceType.LAND})).deep.eq({counts: false, reason: 'Counted by your colonies, not on the board'});
      expect(countSpacesToward('colonies', [{id: '03', spaceType: SpaceType.LAND}]).count).eq(0);
    });
  });

  describe('the enactment — titanium, then production, for every participant', () => {
    it('p1 (influence 3, four cubes) gets 3 titanium and +4 M€ production; p2 (influence 1, no colony) gets 1 titanium and a NAMED production skip — the records, the events and the journal', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 4 → step 5 in the phase = influence 3; Luna ×2, Titan, Miranda = 4 cubes.
      parliament.agenda.set(p1.id, 4);
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      arrangeColonies(game, [[new Luna(), [p1, p1]], [new Titan(), [p1]], [new Miranda(), [p1]], [new Pluto(), []]]);
      const production1 = p1.production.megacredits;
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.enacted).eq(RIGHTS);
      expect(parliament.rulingParty()).eq(PartyName.UNITY);
      // THE ORDER, by the record list.
      expect(recordsOf(parliament, p1).map((o) => o.step)).deep.eq(['titanium', 'production']);
      expect(recordsOf(parliament, p2).map((o) => o.step)).deep.eq(['titanium', 'production']);
      const titanium1 = outcomeOf(parliament, p1, 'titanium')!;
      const prod1 = outcomeOf(parliament, p1, 'production')!;
      expect(titanium1).deep.eq({player: p1.id, step: 'titanium', part: 'effect', kind: 'stock', effect: 'titanium', stock: Resource.TITANIUM, amount: 3, influence: 3, before: 0, after: 3});
      expect(prod1).deep.eq({
        player: p1.id, step: 'production', part: 'effect', kind: 'production', effect: 'production', production: Resource.MEGACREDITS, influence: 3,
        count: 4, counted: [], countedColonies: [ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN, ColonyName.MIRANDA], uncapped: 4, amount: 4,
        before: production1, after: production1 + 4,
      });
      expect(p1.titanium).eq(3);
      expect(p1.production.megacredits).eq(production1 + 4);
      // p2: the titanium comes; the production is a NAMED skip — «no colonies», never «no influence».
      const titanium2 = outcomeOf(parliament, p2, 'titanium')!;
      const prod2 = outcomeOf(parliament, p2, 'production')!;
      expect(titanium2).deep.include({kind: 'stock', amount: 1, influence: 1, before: 0, after: 1});
      expect(prod2).deep.eq({
        player: p2.id, step: 'production', part: 'effect', kind: 'skipped', effect: 'production', production: Resource.MEGACREDITS, influence: 1,
        count: 0, counted: [], countedColonies: [], uncapped: 0, amount: 0, reason: NO_COLONIES,
      });
      expect(p2.titanium).eq(1);
      expect(p2.production.megacredits).eq(0);
      // The events say the same order under the resolution's source: +3 titanium, then the production step.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === JOVIAN_TAX_RIGHTS_ID && e.player === p1.color && e.type !== 'action');
      expect(mine.map((e) => e.type)).deep.eq(['resource-changed', 'production-changed']);
      expect(mine[0].impact?.stock?.titanium).eq(3);
      expect(mine[1].impact?.production?.megacredits).eq(4);
      // The journal: Colony Contest's titanium line, the production line with its inputs, the named skip.
      const titaniumLine = game.gameLog.find((entry) => entry.message === '${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})');
      expect(titaniumLine?.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(JOVIAN_TAX_RIGHTS_ID);
      expect(game.gameLog.some((entry) => entry.message === '${0} gained ${1} ${2} production from ${3}: 1 per colony, ${4} colony(-ies) (${5} → ${6})')).is.true;
      expect(game.gameLog.some((entry) => entry.message === '${0} has no colonies — no ${1} production from ${2}')).is.true;
      expect(game.gameLog.some((entry) => entry.message.includes('limited to the maximum')), 'no cap bit — no cap line').is.false;
    });

    it('SEVEN cubes → +5: the cap bites the production part alone, the record keeps `uncapped` 7 and the whole list, the titanium is untouched by it', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 12); // → step 13 is off the track: influence 5 at the top
      arrangeColonies(game, [[new Luna(), [p1, p1]], [new Titan(), [p1, p1]], [new Miranda(), [p1]], [new Pluto(), [p1]], [new Io(), [p1]]]);
      endGeneration(game);
      runAllActions(game);
      const titanium = outcomeOf(parliament, p1, 'titanium')!;
      const prod = outcomeOf(parliament, p1, 'production')!;
      expect(titanium.amount, 'influence at the top of the track, uncapped').eq(titanium.influence);
      expect(titanium.amount).is.greaterThan(JOVIAN_TAX_RIGHTS_CAP - 1);
      expect(prod).deep.include({kind: 'production', amount: 5, count: 7, uncapped: 7});
      expect(prod.countedColonies).deep.eq([ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN, ColonyName.TITAN, ColonyName.MIRANDA, ColonyName.PLUTO, ColonyName.IO]);
      expect(p1.production.megacredits).eq(prod.before! + 5);
      const line = game.gameLog.find((entry) => entry.message === '${0} gained ${1} ${2} production from ${3}: 1 per colony, ${4} colony(-ies) = ${5}, limited to the maximum of ${1} (${6} → ${7})');
      expect(line, 'the cap line names the sum and the maximum').is.not.undefined;
      const numbers = line!.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value);
      expect(numbers).deep.eq(['5', '7', '7', String(prod.before), String(prod.after)]);
    });

    it('exactly FIVE cubes stand AT the cap: +5, uncapped 5 — the maximum reached, not passed', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      arrangeColonies(game, [[new Luna(), [p1]], [new Titan(), [p1]], [new Miranda(), [p1]], [new Pluto(), [p1]], [new Io(), [p1]]]);
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1, 'production')).deep.include({kind: 'production', amount: 5, count: 5, uncapped: 5});
    });

    it('influence 0 and three cubes: the titanium is a NAMED skip («No influence»), the production comes (+3) — two parts, two different reasons, each on its own', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 0);
      arrangeColonies(game, [[new Luna(), [p2]], [new Titan(), [p2, p2]]]);
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p2, 'titanium')).deep.include({kind: 'skipped', effect: 'titanium', stock: Resource.TITANIUM, amount: 0, influence: 0, reason: 'No influence'});
      expect(outcomeOf(parliament, p2, 'production')).deep.include({kind: 'production', amount: 3, count: 0 + 3, influence: 0, uncapped: 3});
      expect(outcomeOf(parliament, p2, 'production')?.countedColonies).deep.eq([ColonyName.LUNA, ColonyName.TITAN, ColonyName.TITAN]);
      expect(p2.titanium).eq(0);
      expect(p2.production.megacredits).eq(3);
      expect(game.gameLog.some((entry) => entry.message === '${0} has no influence — no titanium from ${1}')).is.true;
      // …and p1 (the winner, influence 1 after its step, no colony) reads the opposite pair.
      expect(outcomeOf(parliament, p1, 'titanium')).deep.include({kind: 'stock', amount: 1, influence: 1});
      expect(outcomeOf(parliament, p1, 'production')).deep.include({kind: 'skipped', amount: 0, count: 0, reason: NO_COLONIES});
    });

    it('a neutral winner cancels nothing: every participant is paid by its own influence and its own cubes', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, RIGHTS);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, agendaForInfluence(2));
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      arrangeColonies(game, [[new Luna(), [p1, p2]], [new Titan(), [p2]]]);
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.enacted).eq(RIGHTS);
      expect(outcomeOf(parliament, p1, 'titanium')).deep.include({kind: 'stock', amount: 2, influence: 2});
      expect(outcomeOf(parliament, p1, 'production')).deep.include({kind: 'production', amount: 1, count: 1});
      expect(outcomeOf(parliament, p2, 'titanium')).deep.include({kind: 'stock', amount: 1, influence: 1});
      expect(outcomeOf(parliament, p2, 'production')).deep.include({kind: 'production', amount: 2, count: 2});
    });
  });

  describe('the order of the generation — the sitting runs AFTER the production phase and the colonies\' own step', () => {
    it('(1) the titanium is in the supply at once; the +N M€ production first PAYS in the NEXT generation', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.megaCredits = 0;
      p1.terraformRating = 20;
      arrangeColonies(game, [[new Luna(), [p1]], [new Titan(), [p1]]]);
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(p1.titanium, 'the titanium is there, spendable next generation').eq(3);
      // This generation: income 20 (no M€ production yet) — and not one M€ of the +2.
      expect(p1.production.megacredits).eq(2);
      expect(p1.megaCredits).eq(20);
      // The next production phase pays TR + the 2 steps the law raised.
      const before = p1.megaCredits;
      p1.runProductionPhase();
      runAllActions(game);
      expect(p1.megaCredits - before).eq(p1.terraformRating + 2);
    });

    it('(2) the colonies\' end-of-generation step (tracks up, fleets back) runs BEFORE the sitting and moves no cube: the count before the phase is the count recorded', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      const luna = new Luna();
      const titan = new Titan();
      arrangeColonies(game, [[luna, [p1, p2]], [titan, [p1]]]);
      luna.trackPosition = 2;
      luna.visitor = p2.id;
      titan.trackPosition = 4;
      p1.colonies.usedTradeFleets = 1;
      const beforePhase = resolutionCount(p1, 'colonies');
      expect(beforePhase.count).eq(2);
      endGeneration(game);
      runAllActions(game);
      // The colonies' step ran: the tracks moved on, the visitor left, the fleet came back…
      expect(luna.trackPosition).eq(3);
      expect(luna.visitor).is.undefined;
      expect(titan.trackPosition).eq(5);
      expect(p1.colonies.usedTradeFleets).eq(0);
      // …and no cube moved: the record is the pre-phase count with the same list.
      expect(luna.colonies).deep.eq([p1.id, p2.id]);
      const recorded = outcomeOf(parliament, p1, 'production')!;
      expect(recorded.count).eq(beforePhase.count);
      expect(recorded.countedColonies).deep.eq(beforePhase.colonies);
      expect(recorded.amount).eq(2);
    });
  });

  describe('once per enactment — the record is frozen with its list', () => {
    it('a later colony, a later influence and a change of government never recompute what was paid; the live count moves, the record does not', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      arrangeColonies(game, [[new Luna(), [p1]], [new Titan(), []]]);
      endGeneration(game);
      runAllActions(game);
      const titanium = p1.titanium;
      const production = p1.production.megacredits;
      const records = recordsOf(parliament, p1);
      expect(records.find((o) => o.step === 'production')).deep.include({amount: 1, count: 1});
      game.colonies[1].colonies.push(p1.id, p1.id);
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.titanium).eq(titanium);
      expect(p1.production.megacredits).eq(production);
      expect(recordsOf(parliament, p1)).deep.eq(records);
      expect(resolutionCount(p1, 'colonies').count, 'the live count moved — the record did not').eq(3);
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(p1.titanium).eq(titanium);
      expect(p1.production.megacredits).eq(production);
    });

    it('a reload after the enactment pays nothing again; the records survive the save with the list of tiles', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      arrangeColonies(game, [[new Luna(), [p1, p1]], [new Titan(), [p1]]]);
      endGeneration(game);
      runAllActions(game);
      const titanium = p1.titanium;
      const production = p1.production.megacredits;
      const live = reload(game);
      settleParliamentGates(live);
      settleParliamentGates(live);
      const one = live.getPlayerById(p1.id);
      expect(one.titanium).eq(titanium);
      expect(one.production.megacredits).eq(production);
      expect(live.parliament!.lastPhase?.outcomes?.filter((o) => o.player === p1.id)).deep.eq(parliament.lastPhase?.outcomes?.filter((o) => o.player === p1.id));
      expect(live.parliament!.lastPhase?.outcomes?.find((o) => o.player === p1.id && o.step === 'production')?.countedColonies)
        .deep.eq([ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN]);
    });
  });

  describe('the chairman quest — play 2 Jovian tags', () => {
    function playAsAction(player: TestPlayer, card: ICard): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: card.name, owner: player.color}, {category: 'card-play'});
      try {
        player.playCard(card as IProjectCard);
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    it('the enactment itself and a colony move no progress; two Jovian tags played as the player\'s own actions complete it — a building tag does not', () => {
      const [game, p1, p2, parliament] = stage();
      arrangeColonies(game, [[new Luna(), [p1]]]);
      endGeneration(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(JOVIAN_TAX_RIGHTS_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.JOVIAN}, count: 2});
      expect(parliament.questProgressOf(p1), 'the enactment is not a Jovian play').eq(0);
      playAsAction(p1, new Mine());
      expect(parliament.questProgressOf(p1), 'a building tag is not a Jovian tag').eq(0);
      playAsAction(p1, new IoMiningIndustries());
      expect(parliament.questProgressOf(p1)).eq(1);
      playAsAction(p1, new MirandaResort());
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      playAsAction(p2, new IoMiningIndustries());
      expect(parliament.questProgressOf(p2), 'once per generation: nobody else completes it').eq(0);
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot (mode none) is never paid, and its cubes count for nobody — the human\'s record lists the human\'s tiles alone; the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, RIGHTS);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      arrangeColonies(game, [[new Luna(), [bot, human]], [new Callisto(), [bot, bot]]]);
      const botTitanium = bot.titanium;
      const botProduction = bot.production.megacredits;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.player), 'every record is the human\'s').deep.eq([human.id, human.id]);
      const prod = parliament.lastPhase?.outcomes?.find((o) => o.step === 'production');
      // The bot's own turn may have settled a colony of its own before the sitting — the human's cubes are the ones counted.
      expect(prod).deep.include({kind: 'production', amount: 1, count: 1});
      expect(prod?.countedColonies).deep.eq([ColonyName.LUNA]);
      expect(human.production.megacredits).eq(1);
      expect(bot.titanium, 'the bot is never paid').eq(botTitanium);
      expect(bot.production.megacredits).eq(botProduction);
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.participates, 'the bot takes no part').is.false;
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
    });

    it('every seat\'s count (number and LIST) rides the model; the record reaches the client with the list', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      arrangeColonies(game, [[new Luna(), [p1, p2, p1]], [new Titan(), [p1]]]);
      const model = getParliamentModel(game, p2);
      const one = model?.players.find((p) => p.color === p1.color);
      expect(one?.counts?.find((c) => c.id === 'colonies')).deep.eq({id: 'colonies', count: 3, cards: [], colonies: [ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN]});
      const two = model?.players.find((p) => p.color === p2.color);
      expect(two?.counts?.find((c) => c.id === 'colonies')).deep.eq({id: 'colonies', count: 1, cards: [], colonies: [ColonyName.LUNA]});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      const paid = last?.outcomes?.find((o) => o.player === p1.color && o.step === 'production');
      expect(paid).deep.include({kind: 'production', amount: 3, count: 3, influence: 3});
      expect(paid?.countedColonies).deep.eq([ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN]);
      expect(last?.outcomes?.find((o) => o.player === p1.color && o.step === 'titanium')).deep.include({kind: 'stock', amount: 3, influence: 3});
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes).has.length(4);
    });
  });

  describe('the family\'s other members stand', () => {
    it('the earlier count kinds read as before beside the new one (cards, tags, board, threshold, production)', () => {
      expect(resolutionCountKind('buildingCardsWithNonNegativeVp')).deep.eq({kind: 'cards'});
      expect(resolutionCountKind('powerTags')).deep.eq({kind: 'tags', tags: ['power' as never]});
      expect(resolutionCountKind('spaceCities')).deep.eq({kind: 'board', tiles: 'spaceCity', measure: 'cells'});
      expect(resolutionCountKind('terraformRatingSets').kind).eq('threshold');
      expect(resolutionCountKind('steelTitaniumEnergyProduction').kind).eq('production');
      const [game, p1] = reduxGame();
      arrangeColonies(game, [[new Luna(), [p1]]]);
      p1.terraformRating = 24;
      expect(resolutionCount(p1, 'terraformRatingSets').count).eq(1);
      expect(resolutionCount(p1, 'powerTags').count).eq(0);
      expect(resolutionCount(p1, 'spaceCities').count).eq(0);
      expect(resolutionCount(p1, 'steelTitaniumEnergyProduction').count).eq(0);
      expect(resolutionCount(p1, 'colonies').count).eq(1);
    });

    it('the generation passes on to the next sitting — the deck is not disturbed', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      arrangeColonies(game, [[new Luna(), [p1]]]);
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.slots).has.length(3);
      expect(parliament.slots.some((slot) => slot.instance === RIGHTS), 'the enacted card left the area').is.false;
      passToParliament(game);
      expect(parliament.phase, 'a second sitting convenes').is.not.undefined;
    });
  });
});
