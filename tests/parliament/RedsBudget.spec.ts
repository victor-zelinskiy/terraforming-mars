import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {SerializedGame} from '../../src/server/SerializedGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  REDS_BUDGET, REDS_BUDGET_CODE, REDS_BUDGET_GRANT, REDS_BUDGET_ID, REDS_BUDGET_LEVY, REDS_BUDGET_LEVY_AMOUNT, REDS_BUDGET_MEGACREDITS,
  REDS_BUDGET_NO_TAGS_REASON,
} from '../../src/server/parliament/resolutions/reds/RedsBudget';
import {GREENS_BUDGET} from '../../src/server/parliament/resolutions/greens/GreensBudget';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, gatePromptOf, passToParliament, seatResolution, settleParliamentGates, sittingOf, sittingOpen, atSittingEnd} from './parliamentArrange';
import {declaredCountIds, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {botWinnerRewardKind, botWinsSomething, declaresWinnerPart} from '../../src/server/automa/BotWinnerReward';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {cardCountVerdict, resolutionCountKind} from '../../src/common/parliament/resolutionCounts';
import {LEVY_STEP_KEY, levyNothingReasonKey, levyShortReasonKey} from '../../src/common/parliament/resolutionLevy';
import {AGENDA_GRANT_END_OF_TRACK_REASON, AGENDA_GRANT_STEP_KEY, agendaGrantEligibility, agendaWalkAhead} from '../../src/common/parliament/agendaGrant';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {MarsArmyShips} from '../../src/server/cards/turmoilRedux/MarsArmyShips';
import {MechSports} from '../../src/server/cards/turmoilRedux/MechSports';
import {Satellites} from '../../src/server/cards/base/Satellites';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {Comet} from '../../src/server/cards/base/Comet';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {Mine} from '../../src/server/cards/base/Mine';

/**
 * REDS BUDGET (Turmoil Redux, RX39) — the SEVENTH and last card of the BUDGET
 * family, ASSEMBLED whole: the shared levy of 10 M€ (RX15), a count over TWO
 * tags (space + Mars) + influence (RX38's form), and the second DEED a law
 * hands the seats — a step of the Career for every seat, paid by the shared
 * `agendaGrantStep` on the track's ONE walk (`ChairmanSeat.walkAgenda`, the
 * cause `resolution`).
 *
 * What these specs pin (docs/claude/prompts/resolution-rx39-reds-budget.md
 * §2): the printed order is the executed order, seat by seat (levy → payout →
 * step, then the next seat); the levy is the family's (15 / 4 / 0 M€); the
 * count is space + Mars tags added up (a card with both is 2, a wild tag none,
 * the asteroids' space tags face down, the per-tag breakdown on the record);
 * the payout reads the influence BEFORE this law's step; every participant
 * walks one step — voter or not, a neutral winner cancelling nothing — and each
 * step pays its own bonus on the spot (+1 TR, a card under the Agenda's source,
 * a level); a marker with no cube stands on position 1; the winner walks TWICE
 * in one sitting; the end of the track is a NAMED skip; the quest never counts
 * the step; the walk is recorded per seat (the phase's `agenda` records) while
 * `lastAdvance` keeps only the last; a reload after the sitting pays nothing
 * twice.
 */
const BUDGET = resolutionInstanceId(REDS_BUDGET_ID, 0);
const STEP = AGENDA_GRANT_STEP_KEY;

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the budget in slot 0 with p1's delegate on it, so p1 wins it; both seats hold 15 M€ and earn no TR income. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, BUDGET);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  for (const player of [p1, p2]) {
    player.megaCredits = 15;
    player.terraformRating = 0;
  }
  return [game, p1, p2, parliament];
}

/**
 * The generation ends into the sitting, which runs its whole chain at once (the soft gates — nothing of this law
 * asks): the sitting is finished, its summary is `lastPhase` and every seat holds its confirmation «Закрыть
 * заседание» while the game already stands in the next generation.
 */
function throughTheSitting(game: IGame): void {
  passToParliament(game);
  runAllActions(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function allRecords(parliament: Parliament): Array<SerializedEnactOutcome> {
  const summary = parliament.lastPhase ?? parliament.phase?.summary;
  return summary?.outcomes ?? [];
}

function recordsOf(parliament: Parliament, player: IPlayer): Array<SerializedEnactOutcome> {
  return allRecords(parliament).filter((o) => o.player === player.id && o.kind !== 'reaction');
}

function outcomeOf(parliament: Parliament, player: IPlayer, step: string): SerializedEnactOutcome | undefined {
  return recordsOf(parliament, player).find((o) => o.step === step);
}

describe('RedsBudget', () => {
  describe('the catalog entry', () => {
    it('is RX39 of the Reds, dealt as ONE card, with the 2-space-tag quest and no winner, world, passive or action part', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(REDS_BUDGET_ID)).eq(REDS_BUDGET);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode(REDS_BUDGET_CODE)).eq(REDS_BUDGET);
      expect(REDS_BUDGET_CODE).eq('RX39');
      expect(REDS_BUDGET.party).eq(PartyName.REDS);
      expect(REDS_BUDGET.copies).eq(1);
      expect(REDS_BUDGET.compatibility, 'a base card — no expansion is needed').is.undefined;
      expect(REDS_BUDGET.quest).deep.eq({goal: {kind: 'tag', tag: Tag.SPACE}, count: 2});
      expect(REDS_BUDGET.winnerSteps).is.undefined;
      expect(REDS_BUDGET.winnerReward).is.undefined;
      expect(REDS_BUDGET.worldSteps).is.undefined;
      expect(REDS_BUDGET.tileGrant).is.undefined;
      expect(REDS_BUDGET.passive).is.undefined;
      expect(REDS_BUDGET.action).is.undefined;
      expect(familyOf(REDS_BUDGET), 'a budget').eq(familyOf(GREENS_BUDGET));
      expect(familyOf(REDS_BUDGET)).eq('counted-tags');
      // No winner's part: the bot's winner pass pays nothing, the vote chooser sees no ★.
      expect(declaresWinnerPart(REDS_BUDGET)).is.false;
      expect(botWinnerRewardKind(REDS_BUDGET)).is.undefined;
      expect(botWinsSomething(REDS_BUDGET)).is.false;
    });

    it('is ASSEMBLED: the family\'s levy at 10 first, a count over TWO tags, and the Career step (one, for everyone) last', () => {
      expect(REDS_BUDGET.levy).eq(REDS_BUDGET_LEVY);
      expect(REDS_BUDGET_LEVY).deep.eq({resource: Resource.MEGACREDITS, amount: REDS_BUDGET_LEVY_AMOUNT, recipient: 'each'});
      expect(REDS_BUDGET.scaled).deep.eq([REDS_BUDGET_MEGACREDITS]);
      expect(REDS_BUDGET_MEGACREDITS.count).deep.eq({id: 'spaceMarsTags', per: 1});
      expect(resolutionCountKind('spaceMarsTags')).deep.eq({kind: 'tags', tags: [Tag.SPACE, Tag.MARS]});
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('spaceMarsTags');
      expect(REDS_BUDGET.agendaGrant).eq(REDS_BUDGET_GRANT);
      expect(REDS_BUDGET_GRANT).deep.eq({steps: 1, recipients: {kind: 'everyone'}});
      expect(agendaGrantEligibility(REDS_BUDGET_GRANT, {winner: false, influence: 0}), 'every seat walks').eq('everyone');
      expect(REDS_BUDGET.immediateSteps?.map((s) => s.key), 'the printed order').deep.eq([LEVY_STEP_KEY, 'megacredits', STEP]);
    });

    it('the face prints the step as the CAREER INSIGNIA (never the winner\'s star)', () => {
      const json = JSON.stringify(REDS_BUDGET.renderData);
      expect(json).includes(`"type":"${CardRenderItemType.AGENDA_STEP}"`);
      expect(json, 'the winner\'s star is the vote\'s, never a step').not.includes(`"type":"${CardRenderItemType.VOTE_WINNER}"`);
    });

    it('the shared count asks ONE question of a card — does it PRINT a space or a Mars tag, face up', () => {
      const up = {eventTagsInPlay: false};
      expect(cardCountVerdict('spaceMarsTags', new MarsArmyShips(), up)).deep.eq({counts: true});
      expect(cardCountVerdict('spaceMarsTags', new Satellites(), up)).deep.eq({counts: true});
      expect(cardCountVerdict('spaceMarsTags', new MechSports(), up)).deep.eq({counts: true});
      expect(cardCountVerdict('spaceMarsTags', new NobelPrize(), up)).deep.eq({counts: false, reason: 'No space or Mars tag'});
      expect(cardCountVerdict('spaceMarsTags', new Mine(), up)).deep.eq({counts: false, reason: 'No space or Mars tag'});
      expect(cardCountVerdict('spaceMarsTags', new Asteroid(), up), 'an asteroid is an EVENT — its space tag lies face down').deep.eq({counts: false, reason: 'A played event is face down'});
    });

    it('the walk ahead reads the printed track: a TR step, a card step, an influence level, the end', () => {
      expect(agendaWalkAhead(3, 1)).deep.eq([{to: 4, step: {kind: 'tr'}, level: 2}]);
      expect(agendaWalkAhead(6, 1)).deep.eq([{to: 7, step: {kind: 'card'}, level: 3}]);
      expect(agendaWalkAhead(4, 1)).deep.eq([{to: 5, step: {kind: 'influence', influence: 3}, level: 3}]);
      expect(agendaWalkAhead(0, 1), 'no cube yet — the first step reaches position 1').deep.eq([{to: 1, step: {kind: 'influence', influence: 1}, level: 1}]);
      expect(agendaWalkAhead(11, 2), 'the end cuts the walk').deep.eq([{to: 12, step: {kind: 'influence', influence: 5}, level: 5}]);
      expect(agendaWalkAhead(12, 1)).deep.eq([]);
    });
  });

  describe('the enactment — the printed order, seat by seat', () => {
    it('levy → payout → step for p1, THEN all three for p2; each step pays its own bonus on the spot; the walks are recorded per seat', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 2 → 3 in the phase (influence 2); Mars Army Ships (2) + Satellites (1) + an asteroid (face down) = 3.
      parliament.agenda.set(p1.id, 2);
      p1.playedCards.push(new MarsArmyShips(), new Satellites(), new Asteroid());
      // p2 never voted — Agenda 6 (influence 3), no card: the law's step reaches the CARD step 7.
      parliament.agenda.set(p2.id, 6);
      const hand2 = p2.cardsInHand.length;
      throughTheSitting(game);
      expect(parliament.enacted).eq(BUDGET);
      expect(parliament.rulingParty(), 'the law takes the ENACTED slot before its steps run').eq(PartyName.REDS);
      expect(parliament.phase, 'the chain ran to its end').is.undefined;
      expect(gatePromptOf(p1), 'every seat holds its confirmation').is.not.undefined;
      expect(gatePromptOf(p2)).is.not.undefined;
      // p1: −10 → 5, +5 → 10 M€; the winner's step 2 → 3, then the law's 3 → 4 (a TR step).
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10, before: 15, after: 5});
      const paid1 = outcomeOf(parliament, p1, 'megacredits')!;
      expect(paid1).deep.include({kind: 'stock', effect: 'megacredits', amount: 5, count: 3, influence: 2, before: 5, after: 10});
      expect(paid1.counted).deep.eq([CardName.MARS_ARMY_SHIPS, CardName.SATELLITES]);
      expect(paid1.countedUnits).deep.eq([2, 1]);
      expect(paid1.countedByTag).deep.eq([{tag: Tag.SPACE, count: 2}, {tag: Tag.MARS, count: 1}]);
      expect(outcomeOf(parliament, p1, STEP)).deep.eq({
        player: p1.id, step: STEP, part: 'effect', kind: 'agenda', influence: 2, amount: 1, walk: {from: 3, to: 4, steps: [{to: 4, bonus: 'tr'}]}, tr: 1,
      });
      expect(parliament.agendaOf(p1)).eq(4);
      expect(p1.terraformRating, '+1 TR from the step it reached').eq(1);
      expect(p1.megaCredits).eq(10);
      // p2: −10 → 5, +3 (influence 3) → 8 M€; the law's step 6 → 7 deals a card under the Agenda's own source.
      expect(outcomeOf(parliament, p2, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({kind: 'stock', amount: 3, count: 0, influence: 3, before: 5, after: 8});
      expect(outcomeOf(parliament, p2, STEP)).deep.eq({
        player: p2.id, step: STEP, part: 'effect', kind: 'agenda', influence: 3, amount: 1, walk: {from: 6, to: 7, steps: [{to: 7, bonus: 'card'}]}, drawn: 1,
      });
      expect(p2.cardsInHand.length).eq(hand2 + 1);
      // THE ORDER, whole: every record of p1 before any of p2.
      expect(allRecords(parliament).filter((o) => o.kind !== 'reaction').map((o) => `${o.player}:${o.step}`)).deep.eq([
        `${p1.id}:${LEVY_STEP_KEY}`, `${p1.id}:megacredits`, `${p1.id}:${STEP}`,
        `${p2.id}:${LEVY_STEP_KEY}`, `${p2.id}:megacredits`, `${p2.id}:${STEP}`,
      ]);
      // The game keeps ONE last walk — p2's, by the law; the seats' walks are the phase's records above.
      expect(parliament.lastAdvance).deep.include({player: p2.id, from: 6, to: 7, reason: 'resolution', resolution: REDS_BUDGET_ID});
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
    });

    it('the winner walks TWICE in one sitting — its winner\'s step and the law\'s — a consequence of the rules, never a double', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      throughTheSitting(game);
      const summary = sittingOf(parliament)!;
      expect(summary.agenda, 'the winner\'s step of the sitting').deep.include({player: p1.id, from: 4, to: 5});
      expect(outcomeOf(parliament, p1, STEP)?.walk, '…and the law\'s, from where the first one stopped').deep.eq({from: 5, to: 6, steps: [{to: 6, bonus: 'tr'}]});
      expect(parliament.agendaOf(p1)).eq(6);
      const walks = game.events.events.filter((e) => e.type === 'agenda-advanced' && e.player === p1.color);
      expect(walks.map((e) => e.impact.agenda?.reason)).deep.eq(['phase', 'resolution']);
    });

    it('the payout reads the influence BEFORE this law\'s step: a step onto an influence level is not seen by the enactment\'s payout', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 2);
      // p2 at 4 (influence 2): the law walks it onto 5 (influence 3) — AFTER the payout.
      parliament.agenda.set(p2.id, 4);
      throughTheSitting(game);
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({amount: 2, influence: 2});
      expect(outcomeOf(parliament, p2, STEP)).deep.include({kind: 'agenda', influence: 2, walk: {from: 4, to: 5, steps: [{to: 5}]}});
      expect(outcomeOf(parliament, p2, STEP)?.tr, 'an influence step pays nothing on the spot').is.undefined;
      expect(parliament.influence(p2), 'the new level stands after the walk').eq(3);
    });

    it('a marker with no cube yet stands on position 1 after its step (influence 1)', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 2);
      expect(parliament.agendaOf(p2)).eq(0);
      throughTheSitting(game);
      expect(outcomeOf(parliament, p2, 'megacredits'), 'no tags, no influence yet — a named zero').deep.include(
        {kind: 'skipped', amount: 0, count: 0, influence: 0, reason: REDS_BUDGET_NO_TAGS_REASON});
      expect(game.gameLog.filter((e) => e.message.startsWith('${0} has no space or Mars tags and no influence')), 'p2\'s zero is named').has.length(1);
      expect(outcomeOf(parliament, p2, STEP)).deep.include({kind: 'agenda', influence: 0, walk: {from: 0, to: 1, steps: [{to: 1}]}});
      expect(parliament.agendaOf(p2)).eq(1);
      expect(parliament.influence(p2)).eq(1);
    });

    it('the levy is the family\'s, bounded by the seat: 15 M€ leaves 5; 4 M€ pays 4 of 10 and says so; 0 M€ is a named skip — every seat still gets its payout and its step', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 2);
      p2.megaCredits = 4;
      parliament.agenda.set(p2.id, 1);
      throughTheSitting(game);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10, before: 15, after: 5});
      expect(outcomeOf(parliament, p2, LEVY_STEP_KEY)).deep.include(
        {kind: 'stock', amount: -4, owed: 10, before: 4, after: 0, reason: levyShortReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({kind: 'stock', amount: 1, influence: 1, before: 0, after: 1});
      expect(outcomeOf(parliament, p2, STEP)).deep.include({kind: 'agenda', walk: {from: 1, to: 2, steps: [{to: 2, bonus: 'tr'}]}, tr: 1});

      const [game2, q1, , parl2] = stage();
      parl2.agenda.set(q1.id, 2);
      q1.megaCredits = 0;
      throughTheSitting(game2);
      expect(outcomeOf(parl2, q1, LEVY_STEP_KEY)).deep.eq(
        {player: q1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, owed: 10, reason: levyNothingReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parl2, q1, 'megacredits')).deep.include({kind: 'stock', amount: 2, before: 0, after: 2});
      expect(outcomeOf(parl2, q1, STEP)).deep.include({kind: 'agenda'});
    });

    it('the count is TWO tags added up: a card printing both counts twice, a wild tag is none, the asteroids and comets lie face down', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 2);
      // Mars Army Ships (Mars + space = 2) + Mech Sports (Mars) + Satellites (space) = 4; Nobel Prize (wild) nothing;
      // Asteroid and Comet (EVENTS with a space tag) face down.
      p1.playedCards.push(new MarsArmyShips(), new MechSports(), new Satellites(), new NobelPrize(), new Asteroid(), new Comet());
      const live = resolutionCount(p1, 'spaceMarsTags');
      expect(live.count).eq(4);
      expect(live.cards).deep.eq([CardName.MARS_ARMY_SHIPS, CardName.MECH_SPORTS, CardName.SATELLITES]);
      expect(live.units).deep.eq([2, 1, 1]);
      expect(live.byTag).deep.eq([{tag: Tag.SPACE, count: 2}, {tag: Tag.MARS, count: 2}]);
      throughTheSitting(game);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 6, count: 4, influence: 2});
    });

    it('the END of the track: no step is taken — a NAMED skip; the seat\'s levy and payout are paid as usual', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 2);
      parliament.agenda.set(p2.id, 12);
      const rating = p2.terraformRating;
      throughTheSitting(game);
      expect(outcomeOf(parliament, p2, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({kind: 'stock', amount: 5, influence: 5});
      expect(outcomeOf(parliament, p2, STEP)).deep.eq({
        player: p2.id, step: STEP, part: 'effect', kind: 'skipped', influence: 5, amount: 0, walk: {from: 12, to: 12, steps: []}, reason: AGENDA_GRANT_END_OF_TRACK_REASON,
      });
      expect(parliament.agendaOf(p2)).eq(12);
      expect(p2.terraformRating).eq(rating);
      expect(game.gameLog.filter((e) => e.message === '${0} is already at the end of the Agenda track'), 'the walk\'s own line names it').has.length(1);
    });

    it('a neutral winner cancels nothing: every participant is levied, paid and walks its step', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, BUDGET);
      parliament.addNeutralVote(parliament.slots[0]);
      for (const player of [p1, p2]) {
        player.megaCredits = 15;
        player.terraformRating = 0;
      }
      parliament.agenda.set(p1.id, 3);
      parliament.agenda.set(p2.id, 6);
      throughTheSitting(game);
      expect(sittingOf(parliament)?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(BUDGET);
      expect(sittingOf(parliament)?.agenda, 'no winner\'s step').is.undefined;
      expect(outcomeOf(parliament, p1, STEP)?.walk).deep.eq({from: 3, to: 4, steps: [{to: 4, bonus: 'tr'}]});
      expect(outcomeOf(parliament, p2, STEP)?.walk).deep.eq({from: 6, to: 7, steps: [{to: 7, bonus: 'card'}]});
    });

    it('the journal names the LAW: the walk is sourced by the resolution under the sitting\'s chain, its TR under the Agenda track', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 2);
      parliament.agenda.set(p2.id, 3);
      throughTheSitting(game);
      const walks = game.events.events.filter((e) => e.type === 'agenda-advanced' && e.impact.agenda?.reason === 'resolution');
      expect(walks.map((e) => e.player)).deep.eq([p1.color, p2.color]);
      for (const walk of walks) {
        expect(walk.source, 'the law is the source').deep.include({kind: 'resolution', id: REDS_BUDGET_ID});
      }
      expect(walks[1].impact.agenda).deep.eq({from: 3, to: 4, steps: [{to: 4, bonus: 'tr'}], reason: 'resolution', influence: 2});
      expect(p2.terraformRatingSources.some((s) => s.sourceName === 'Agenda track'), 'the TR segment is the track\'s').is.true;
    });

    it('a reload at the sitting\'s LAST step, or with its confirmations standing, pays nothing twice: no levy, no payout, no step, no second card', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 2);
      parliament.agenda.set(p2.id, 6);
      // The save at `done` — every step applied, nothing closed yet (where the retired adjourn gate once stood).
      let save: SerializedGame | undefined;
      atSittingEnd(game, () => (save = structuredClone(game.serialize())));
      throughTheSitting(game);
      expect(save?.parliament?.phase?.step).eq('done');
      expect(gatePromptOf(p1)).is.not.undefined;
      // Resumed from `done`, the chain only finishes: the seats stand where the uninterrupted sitting left them.
      const resumed = Game.deserialize(save!);
      settleParliamentGates(resumed);
      const r1 = resumed.getPlayerById(p1.id);
      const r2 = resumed.getPlayerById(p2.id);
      expect([r1.megaCredits, r2.megaCredits], 'no levy, no payout a second time').deep.eq([p1.megaCredits, p2.megaCredits]);
      expect(r2.cardsInHand.length, 'the card step is never dealt twice').eq(p2.cardsInHand.length);
      expect([resumed.parliament!.agendaOf(r1), resumed.parliament!.agendaOf(r2)]).deep.eq([4, 7]);
      expect(recordsOf(resumed.parliament!, r2).filter((o) => o.step === STEP)).has.length(1);
      // …and a reload AFTER the sitting, the confirmations standing: they are re-issued, nothing is paid again.
      const live = reload(game);
      const q1 = live.getPlayerById(p1.id) as TestPlayer;
      const q2 = live.getPlayerById(p2.id) as TestPlayer;
      const parl = live.parliament!;
      const mc = [q1.megaCredits, q2.megaCredits];
      const hand = q2.cardsInHand.length;
      settleParliamentGates(live);
      expect([q1.megaCredits, q2.megaCredits]).deep.eq(mc);
      expect(q2.cardsInHand.length, 'the card step is never dealt twice').eq(hand);
      expect([parl.agendaOf(q1), parl.agendaOf(q2)]).deep.eq([4, 7]);
      expect(recordsOf(parl, q2).filter((o) => o.step === STEP)).has.length(1);
    });
  });

  describe('the chairman quest — play 2 space tags', () => {
    it('the sitting\'s step (and its TR) moves no progress; the player\'s OWN space tags complete it', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 2);
      endGenerationThroughParliament(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(REDS_BUDGET_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.SPACE}, count: 2});
      expect(parliament.questProgressOf(p1), 'the sitting plays no tag').eq(0);
      p1.playCard(new Satellites());
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
      p1.playCard(new MarsArmyShips());
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('the model — what the client reads', () => {
    it('every seat\'s two-tag count rides the model; the walk record and the law on the last advance', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new MarsArmyShips());
      parliament.agenda.set(p1.id, 2);
      parliament.agenda.set(p2.id, 3);
      const before = getParliamentModel(game, p1)!;
      expect(before.players.find((p) => p.color === p1.color)?.counts?.find((c) => c.id === 'spaceMarsTags')).deep.include(
        {count: 2, cards: [CardName.MARS_ARMY_SHIPS], units: [2], byTag: [{tag: Tag.SPACE, count: 1}, {tag: Tag.MARS, count: 1}]});
      throughTheSitting(game);
      const model = getParliamentModel(game, p1)!;
      const outcome = (model.phase?.summary ?? model.lastPhase)?.outcomes?.find((o) => o.player === p2.color && o.step === STEP);
      expect(outcome).deep.include({kind: 'agenda', walk: {from: 3, to: 4, steps: [{to: 4, bonus: 'tr'}]}, tr: 1});
      expect(model.lastAdvance).deep.include({player: p2.color, reason: 'resolution', resolution: REDS_BUDGET_ID});
    });
  });

  describe('MarsBot — a seat of the step AND of the money (decisions D11 + D16)', () => {
    type Table = {game: IGame; human: TestPlayer; bot: IPlayer; parliament: Parliament};

    function seated(mode: 'politics' | 'none' = 'politics', arrange?: (t: Table) => void): Table {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: mode});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, BUDGET);
      parliament.slots.forEach((slot) => (slot.votes = []));
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(new MarsArmyShips());
      human.terraformRating = 0;
      const table = {game, human, bot, parliament};
      arrange?.(table);
      return table;
    }

    /**
     * The human passes, the bot (an empty deck) passes, the generation ends into the sitting — which runs its whole
     * chain at once (nothing asks). The bot's cash and rating are read BEFORE the pass: no gate stops the chain ahead
     * of the enactment any more, and MarsBot has no production phase to move them in between.
     */
    function intoTheSitting(t: Table): {cash: number, rating: number} {
      t.game.automa!.actionDeck = [];
      const before = {cash: t.bot.megaCredits, rating: t.bot.terraformRating};
      t.human.popWaitingFor();
      t.game.playerHasPassed(t.human);
      t.game.playerIsFinishedTakingActions();
      expect(sittingOpen(t.game), 'the sitting has convened').is.true;
      expect(t.bot.getWaitingFor(), 'the bot is never asked').is.undefined;
      runAllActions(t.game);
      return before;
    }

    /** The bot's DEED records (its step of the Career) — its levy and its payout (D16) are read apart. */
    function botRecords(t: Table): Array<SerializedEnactOutcome> {
      return allRecords(t.parliament).filter((o) => o.player === t.bot.id && !o.step.startsWith('bot:') && o.step !== LEVY_STEP_KEY);
    }

    /** What the bot's money records moved, in M€ (the levy negative, the payout's hidden M€ positive — D16). */
    function botMoneyDelta(t: Table): number {
      return allRecords(t.parliament)
        .filter((o) => o.player === t.bot.id && (o.step.startsWith('bot:') || o.step === LEVY_STEP_KEY))
        .reduce((sum, o) => sum + (o.megacredits ?? 0) + (o.step === LEVY_STEP_KEY && o.amount !== undefined && o.amount < 0 ? o.amount : 0), 0);
    }

    it('levied and paid like every seat (D16) — and it walks its own step IN ITS PLACE after the human: a card step is 1 M€ under the hood', () => {
      const t = seated('politics', ({parliament, bot}) => parliament.agenda.set(bot.id, 6));
      const before = intoTheSitting(t);
      expect(botRecords(t), 'the step').deep.eq([{
        player: t.bot.id, step: STEP, part: 'effect', kind: 'agenda', influence: 3, amount: 1, walk: {from: 6, to: 7, steps: [{to: 7, bonus: 'card'}]}, megacredits: 1, drawn: 1,
      }]);
      expect(t.parliament.agendaOf(t.bot)).eq(7);
      expect(t.bot.megaCredits, 'the levy, the payout and the card step\'s 1 M€').eq(before.cash + 1 + botMoneyDelta(t));
      expect(t.game.gameLog.filter((e) => e.message === '${0} draws ${1} card(s) from the Agenda track')).has.length(1);
      // The human's three parts first (generation order), then the bot's: its levy, its payout, its step.
      expect(allRecords(t.parliament).filter((o) => o.kind !== 'reaction').map((o) => `${o.player === t.bot.id ? 'bot' : 'human'}:${o.step}`)).deep.eq([
        `human:${LEVY_STEP_KEY}`, 'human:megacredits', `human:${STEP}`, `bot:${LEVY_STEP_KEY}`, 'bot:bot:megacredits', `bot:${STEP}`,
      ]);
      expect(t.bot.getWaitingFor()).is.undefined;
      settleParliamentGates(t.game);
      expect(t.parliament.phase).is.undefined;
    });

    it('a TR step raises the bot\'s rating by 1, under the Agenda track', () => {
      const t = seated('politics', ({parliament, bot}) => parliament.agenda.set(bot.id, 3));
      const before = intoTheSitting(t);
      expect(botRecords(t)[0]).deep.include({kind: 'agenda', walk: {from: 3, to: 4, steps: [{to: 4, bonus: 'tr'}]}, tr: 1});
      expect(t.bot.terraformRating).eq(before.rating + 1);
      expect(t.bot.megaCredits).eq(before.cash + botMoneyDelta(t));
      expect(t.bot.terraformRatingSources.some((s) => s.sourceName === 'Agenda track')).is.true;
    });

    it('a FIRST-PLAYER bot walks FIRST — before the human\'s levy', () => {
      const t = seated('politics', ({game, parliament, bot}) => {
        parliament.agenda.set(bot.id, 3);
        game.overrideFirstPlayer(bot);
      });
      intoTheSitting(t);
      expect(allRecords(t.parliament).filter((o) => o.kind !== 'reaction').map((o) => (o.player === t.bot.id ? 'bot' : 'human'))).deep.eq(['bot', 'bot', 'bot', 'human', 'human', 'human']);
      const walks = t.game.events.events.filter((e) => e.type === 'agenda-advanced' && e.impact.agenda?.reason === 'resolution');
      expect(walks.map((e) => e.player)).deep.eq([t.bot.color, t.human.color]);
      expect(walks[0].source, 'the law is the source of the bot\'s walk too').deep.include({kind: 'resolution', id: REDS_BUDGET_ID, owner: t.bot.color});
    });

    it('the bot at the END of the track — the same named skip as a human\'s', () => {
      const t = seated('politics', ({parliament, bot}) => parliament.agenda.set(bot.id, 12));
      const before = intoTheSitting(t);
      expect(botRecords(t)).deep.eq([{
        player: t.bot.id, step: STEP, part: 'effect', kind: 'skipped', influence: 5, amount: 0, walk: {from: 12, to: 12, steps: []}, reason: AGENDA_GRANT_END_OF_TRACK_REASON,
      }]);
      expect(t.bot.megaCredits).eq(before.cash + botMoneyDelta(t));
    });

    it('a bot WINNER walks TWICE — its winner\'s step (\'phase\') and the law\'s (\'resolution\'); the winner pass pays nothing more', () => {
      const t = seated('politics', ({parliament, human, bot}) => {
        parliament.slots[0].votes = [];
        parliament.placeVote(bot, parliament.slots[0], 'lobby');
        parliament.agenda.set(bot.id, 4);
        expect(human.color).not.eq(bot.color);
      });
      intoTheSitting(t);
      expect(sittingOf(t.parliament)?.winner.player).eq(t.bot.id);
      expect(sittingOf(t.parliament)?.agenda).deep.include({player: t.bot.id, from: 4, to: 5});
      expect(botRecords(t).map((o) => `${o.step}:${o.part}:${o.kind}`), 'one record — the law\'s step; no winner record').deep.eq([`${STEP}:effect:agenda`]);
      expect(botRecords(t)[0].walk).deep.eq({from: 5, to: 6, steps: [{to: 6, bonus: 'tr'}]});
      const walks = t.game.events.events.filter((e) => e.type === 'agenda-advanced' && e.player === t.bot.color);
      expect(walks.map((e) => e.impact.agenda?.reason)).deep.eq(['phase', 'resolution']);
    });

    it('the bot\'s step is keyed under ITS seat — a reload at the sitting\'s last step walks nobody twice', () => {
      const t = seated('politics', ({game, parliament, bot}) => {
        parliament.agenda.set(bot.id, 6);
        game.overrideFirstPlayer(bot);
      });
      // The save at `done` — every step applied, nothing closed yet (where the retired adjourn gate once stood).
      let keyed: boolean | undefined;
      let save: SerializedGame | undefined;
      atSittingEnd(t.game, () => {
        keyed = t.parliament.phase?.appliedBySeat?.[t.bot.id]?.some((key) => key.endsWith(`:${STEP}`));
        save = structuredClone(t.game.serialize());
      });
      intoTheSitting(t);
      expect(keyed, 'the idempotency key lives under the bot').is.true;
      expect(save?.parliament?.phase?.step).eq('done');
      const live = Game.deserialize(save!);
      const bot = live.getPlayerById(t.bot.id);
      const human = live.getPlayerById(t.human.id);
      const cash = bot.megaCredits;
      settleParliamentGates(live);
      expect(live.parliament!.agendaOf(bot)).eq(7);
      expect(bot.megaCredits, 'the card step\'s 1 M€ is never paid twice').eq(cash);
      expect(allRecords(live.parliament!).filter((o) => o.step === STEP).map((o) => o.player)).deep.eq([bot.id, human.id]);
    });

    it('mode \'none\' — the bot takes no seat of anything: no step, no record', () => {
      const t = seated('none', ({parliament, bot}) => parliament.agenda.set(bot.id, 3));
      intoTheSitting(t);
      settleParliamentGates(t.game);
      expect(botRecords(t)).deep.eq([]);
      expect(t.parliament.agendaOf(t.bot)).eq(3);
    });

    it('the model: the bot\'s seat performs the grant and is PAID by its own counts (D16); under \'none\' it performs neither', () => {
      const politics = seated('politics');
      const seat = getParliamentModel(politics.game, politics.human)!.players.find((p) => p.color === politics.bot.color)!;
      expect(seat).deep.include({participates: true, enactment: true, seatGrant: true});
      expect(seat.counts, 'its own counts — its tracks for the tags').is.not.undefined;
      const none = seated('none');
      const quiet = getParliamentModel(none.game, none.human)!.players.find((p) => p.color === none.bot.color);
      expect(quiet === undefined || quiet.seatGrant === false).is.true;
    });
  });
});
