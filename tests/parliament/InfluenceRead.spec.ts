import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SerializedInfluenceRead} from '../../src/server/parliament/SerializedParliament';
import {COLONIAL_AFFAIRS_ID} from '../../src/server/parliament/resolutions/unity/ColonialAffairs';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {Luna} from '../../src/server/colonies/Luna';
import {ColonialRepresentation} from '../../src/server/cards/prelude2/ColonialRepresentation';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {influenceAtAgenda, resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';

/**
 * THE INFLUENCE A LAW READ, AND WHAT IT WAS MADE OF (P71 · ledger CY): the sitting SNAPSHOTS every paid seat's
 * influence once — the Career's level at its step, then every giver beyond it (the facade's named entries in
 * their order, then a tableau card's own `getInfluenceBonus` hook under its name) — so the results' breakdown
 * can say «влияние 3 = Карьера 1 + Колониальное представительство +1 + …» about a PAST sitting without reading
 * the live sources. The terms sum to the `influence` every record of the seat carries.
 */
describe('ParliamentPhase — the influence read (snapshot)', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament};

  /** Colonial Affairs up for the vote, p2's delegate on it (p2 wins); a Luna cube each; p1's Career at step 1. */
  function colonialTable(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    seatResolution(parliament, 0, resolutionInstanceId(COLONIAL_AFFAIRS_ID, 0));
    parliament.placeVote(p2, parliament.slots[0], 'lobby');
    const luna = new Luna();
    luna.isActive = true;
    luna.colonies = [p1.id, p2.id];
    game.colonies = [luna];
    parliament.agenda.set(p1.id, 1);
    return {game, p1, p2, parliament};
  }

  function readOf(parliament: Parliament, player: TestPlayer): SerializedInfluenceRead | undefined {
    const summary = parliament.phase?.summary ?? parliament.lastPhase;
    return summary?.influenceRead?.find((entry) => entry.player === player.id);
  }

  function sit(t: Table): void {
    endGenerationThroughParliament(t.game);
    settleParliamentGates(t.game);
  }

  it('a seat with three givers: the Career\'s level, then the facade\'s named entries in their order, then a card\'s own hook — summing to every record\'s influence', () => {
    const t = colonialTable();
    const card = new ColonialRepresentation();
    t.p1.cardsInHand.push(card);
    t.p1.playCard(card);
    runAllActions(t.game);
    t.game.politics!.addInfluenceBonus(t.p1, 1, CardName.EVENT_ANALYSTS);
    t.p1.playedCards.push(fakeCard({name: 'Hook Card' as CardName, getInfluenceBonus: () => 1}));
    expect(t.parliament.influence(t.p1)).eq(4);
    sit(t);
    const read = readOf(t.parliament, t.p1)!;
    expect(read).deep.eq({
      player: t.p1.id, total: 4, agendaStep: 1, track: influenceAtAgenda(1),
      sources: [{amount: 1, source: CardName.COLONIAL_REPRESENTATION}, {amount: 1, source: CardName.EVENT_ANALYSTS}, {amount: 1, source: 'Hook Card'}],
    });
    expect(read.track + read.sources.reduce((sum, s) => sum + s.amount, 0), 'the terms sum to the total').eq(read.total);
    const outcomes = (t.parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === t.p1.id && o.kind !== 'reaction');
    expect(outcomes.length).greaterThan(0);
    for (const outcome of outcomes) {
      expect(outcome.influence, JSON.stringify(outcome)).eq(read.total);
    }
  });

  it('the winner\'s Career step has already moved when the law reads it — the snapshot is the read, never the pre-sitting track', () => {
    const t = colonialTable();
    t.parliament.agenda.set(t.p2.id, 0);
    sit(t);
    const read = readOf(t.parliament, t.p2)!;
    expect(read.agendaStep, 'the winner stepped 0 → 1').eq(1);
    expect(read).deep.include({track: influenceAtAgenda(1), total: influenceAtAgenda(1), sources: []});
  });

  it('ONE entry per seat — every step of the seat reads the same number', () => {
    const t = colonialTable();
    sit(t);
    const entries = t.parliament.lastPhase?.influenceRead ?? [];
    expect(entries.map((e) => e.player).sort()).deep.eq([t.p1.id, t.p2.id].sort());
  });

  it('a SNAPSHOT: a giver added after the sitting rewrites nothing of what the law read', () => {
    const t = colonialTable();
    sit(t);
    const before = structuredClone(readOf(t.parliament, t.p1));
    t.game.politics!.addInfluenceBonus(t.p1, 1, CardName.COLONIAL_REPRESENTATION);
    expect(readOf(t.parliament, t.p1)).deep.eq(before);
    const model = getParliamentModel(t.game, t.p1)!.lastPhase!;
    expect(model.influenceRead?.find((e) => e.player === t.p1.color)).deep.eq({
      player: t.p1.color, total: before!.total, agendaStep: before!.agendaStep, track: before!.track, sources: [],
    });
  });

  it('the model carries it in colours; save / reload keeps it; an OLDER save without the field reads none (never «bonuses 0»)', () => {
    const t = colonialTable();
    t.game.politics!.addInfluenceBonus(t.p1, 1, CardName.COLONIAL_REPRESENTATION);
    sit(t);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    const model = getParliamentModel(reloaded, owner)!.lastPhase!;
    expect(model.influenceRead?.find((e) => e.player === t.p1.color)?.sources).deep.eq([{amount: 1, source: CardName.COLONIAL_REPRESENTATION}]);
    const old = structuredClone(t.game.serialize());
    for (const summary of [old.parliament?.lastPhase, ...(old.parliament?.phaseHistory ?? [])]) {
      if (summary !== undefined) {
        delete summary.influenceRead;
      }
    }
    const legacy = Game.deserialize(old);
    expect(getParliamentModel(legacy, legacy.getPlayerById(t.p1.id))!.lastPhase!.influenceRead).is.undefined;
  });

  for (const mode of ['politics', 'none'] as const) {
    it(`MarsBot under «${mode}»: an entry exactly when a seat step read its influence (D16 pays it by the printed formula; «none» never)`, () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: mode});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, resolutionInstanceId(COLONIAL_AFFAIRS_ID, 0));
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      const luna = new Luna();
      luna.isActive = true;
      luna.colonies = [human.id, bot.id];
      game.colonies = [luna];
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      const summary = parliament.phase?.summary ?? parliament.lastPhase;
      const entries = summary?.influenceRead ?? [];
      const botRecords = (summary?.outcomes ?? []).filter((o) => o.player === bot.id && o.kind !== 'reaction');
      expect(entries.some((e) => e.player === human.id)).is.true;
      const botEntry = entries.find((e) => e.player === bot.id);
      expect(botEntry !== undefined, JSON.stringify({entries, botRecords})).eq(botRecords.length > 0);
      if (mode === 'none') {
        expect(botEntry).is.undefined;
      }
      for (const record of botRecords) {
        expect(record.influence).eq(botEntry?.total);
      }
    });
  }
});
