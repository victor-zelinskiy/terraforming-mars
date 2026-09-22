import {Parliament} from '../../src/server/parliament/Parliament';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {PlayerInput} from '../../src/server/PlayerInput';

import {ParliamentPhaseStage, ReduxParty, ResolutionId, ResolutionInstanceId, resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {CLOUD_DEVELOPMENT_ID} from '../../src/server/parliament/resolutions/unity/CloudDevelopment';
import {DEV_COMPOUND_RESOLUTION_ID, DEV_SCIENCE_RESOLUTION_ID} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {runAllActions} from '../TestingUtils';

/**
 * THE VOTING AREA, ARRANGED BY THE SPEC — never assumed from the deal.
 *
 * The deck is made of REAL resolutions only and dealt at random, so «which card
 * landed in which slot» is never a spec's to depend on. A spec that needs a
 * particular table seats it here, and the pool stays CONSISTENT: the seated card
 * leaves the deck, the discard, the enacted slot and any other voting slot, and
 * the card it displaces goes back to the deck — every card stays in exactly one
 * place, as the real refresh assumes.
 */
function asInstance(id: ResolutionId | ResolutionInstanceId): ResolutionInstanceId {
  return id.includes('#') ? id : resolutionInstanceId(id, 0);
}

function lift(parliament: Parliament, instance: ResolutionInstanceId): void {
  parliament.deck = parliament.deck.filter((i) => i !== instance);
  parliament.discard = parliament.discard.filter((i) => i !== instance);
  if (parliament.enacted === instance) {
    parliament.enacted = undefined;
  }
}

/**
 * Seat `id` in voting slot `index`. The area never holds two cards of one
 * party: the slot that held the seated card — or ANOTHER card of its party —
 * takes the displaced one (that other card returns to the deck); otherwise the
 * displaced card returns to the deck. A card lifted from ENACTED leaves the
 * government empty.
 */
export function seatResolution(parliament: Parliament, index: number, id: ResolutionId | ResolutionInstanceId): ResolutionInstanceId {
  const instance = asInstance(id);
  const target = parliament.slots[index];
  if (target === undefined) {
    throw new Error(`no voting slot ${index}`);
  }
  if (target.instance === instance) {
    return instance;
  }
  const displaced = target.instance;
  lift(parliament, instance);
  const party = parliament.resolutionOf(instance).party;
  const rival = parliament.slots.find((slot) => slot !== target &&
    (slot.instance === instance || parliament.resolutionOf(slot.instance).party === party));
  if (rival !== undefined) {
    if (rival.instance !== instance) {
      parliament.deck.push(rival.instance);
    }
    rival.instance = displaced;
  } else {
    parliament.deck.push(displaced);
  }
  target.instance = instance;
  return instance;
}

/**
 * Make `id` the ENACTED card (the government) — it leaves wherever it was. A
 * voting slot it stood in takes a card of another party from the deck, or —
 * exactly as the real refresh does when nothing fits — is left out of the area.
 */
export function seatEnacted(parliament: Parliament, id: ResolutionId | ResolutionInstanceId): ResolutionInstanceId {
  const instance = asInstance(id);
  lift(parliament, instance);
  const slot = parliament.slots.find((s) => s.instance === instance);
  if (slot !== undefined) {
    const taken = new Set(parliament.slots.filter((s) => s !== slot).map((s) => parliament.resolutionOf(s.instance).party));
    taken.add(parliament.resolutionOf(instance).party);
    const replacement = parliament.deck.find((i) => !taken.has(parliament.resolutionOf(i).party));
    if (replacement === undefined) {
      parliament.slots = parliament.slots.filter((s) => s !== slot);
    } else {
      lift(parliament, replacement);
      slot.instance = replacement;
    }
  }
  const previous = parliament.enacted;
  if (previous !== undefined && previous !== instance) {
    parliament.discard.push(previous);
  }
  parliament.enacted = instance;
  return instance;
}

/**
 * A REAL resolution of `party` whose enactment ASKS NOTHING at a fresh table —
 * the stand-in a spec seats when its subject is the PHASE, not a card:
 *  - the Greens: Aquifer Contest (its animals go to a holder, and a fresh
 *    table has none — the share is named and forfeited, nothing is asked);
 *  - Mars First: Architecture Award, the Industrialists: Central Power Grid
 *    (M€ production, never a choice);
 *  - Unity: Cloud Development (its floaters go to a holder, and a fresh table
 *    has none — named and forfeited, nothing asked; a Venus card, seated by
 *    id regardless of the game's expansions).
 * The parties with no real resolution yet are never dealt, so they never need one.
 */
export function quietResolutionOf(party: ReduxParty): ResolutionId {
  switch (party) {
  case PartyName.GREENS: return AQUIFER_CONTEST_ID;
  case PartyName.MARS: return ARCHITECTURE_AWARD_ID;
  case PartyName.INDUSTRIALISTS: return CENTRAL_POWER_GRID_ID;
  case PartyName.UNITY: return CLOUD_DEVELOPMENT_ID;
  // The parties WITHOUT a real card yet seat their DEV substitutes (final polish D.2): a spec or a fixture
  // of the first Reds / Scientists card starts from the table, not from this helper.
  case PartyName.REDS: return DEV_COMPOUND_RESOLUTION_ID;
  case PartyName.SCIENTISTS: return DEV_SCIENCE_RESOLUTION_ID;
  default:
    throw new Error(`no resolution of ${party} exists yet, not even a DEV substitute — a spec cannot meet one in the voting area`);
  }
}

/** Replace slot `index` with its own party's QUIET real resolution (see `quietResolutionOf`). */
export function seatQuiet(parliament: Parliament, index: number): ResolutionInstanceId {
  const party = parliament.resolutionOf(parliament.slots[index].instance).party;
  return seatResolution(parliament, index, quietResolutionOf(party));
}

/**
 * NEVER-DEALT stand-ins of parties that have no real resolution — for a spec
 * that needs a slot, or a government, of a party the deck cannot produce.
 * They are catalogued development examples (`copies: 0`), so a reload knows them.
 */
export const REDS_STAND_IN: ResolutionId = DEV_COMPOUND_RESOLUTION_ID;
export const SCIENTISTS_STAND_IN: ResolutionId = DEV_SCIENCE_RESOLUTION_ID;

/*
 * THE SITTING'S GATES, DRIVEN BY A SPEC. The political phase waits TWICE for
 * every participant (`assembly` before the effects, `adjourn` before the next
 * generation — docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §3); a spec whose
 * subject is a resolution walks them here and keeps reading the resolution's
 * own asks as before. Detection is the server's marker, never a title.
 */

/** The GATE prompt `player` holds (by the marker), if any — of `stage` when given. */
export function gatePromptOf(player: IPlayer, stage?: ParliamentPhaseStage): PlayerInput | undefined {
  const wf = player.getWaitingFor();
  const marker = wf?.parliamentPhasePrompt;
  return marker !== undefined && (stage === undefined || marker.stage === stage) ? wf : undefined;
}

/** Answer the gate `player` holds — the one press the sitting's stage sends. Throws when none stands. */
export function answerGate(player: IPlayer, stage?: ParliamentPhaseStage): void {
  const gate = gatePromptOf(player, stage);
  if (gate === undefined) {
    throw new Error(`${player.color} holds no ${stage ?? 'parliament'} gate (waitingFor: ${player.getWaitingFor()?.type ?? 'nothing'})`);
  }
  player.process({type: 'option'});
}

/*
 * THE CHAIRMAN-QUEST GATE — the same law one flow up: the quest's count was
 * reached and NOTHING is applied until the player answers
 * (`ChairmanSeat.questPrompt`). A spec that completes a quest therefore runs
 * the deferred queue and answers here; detection is the server's own marker.
 */

/** The QUEST gate `player` holds (by the marker), if any. */
export function questGateOf(player: IPlayer): PlayerInput | undefined {
  const wf = player.getWaitingFor();
  return wf?.chairmanQuestPrompt !== undefined ? wf : undefined;
}

/** Run the deferred queue and answer `player`'s quest gate — the one press the console's flow sends. */
export function answerQuestGate(game: IGame, player: IPlayer): void {
  runAllActions(game);
  if (questGateOf(player) === undefined) {
    throw new Error(`${player.color} holds no chairman-quest gate (waitingFor: ${player.getWaitingFor()?.type ?? 'nothing'})`);
  }
  player.process({type: 'option'});
  runAllActions(game);
}

/** Answer every standing gate once, in generation order; how many were answered. */
export function answerStandingGates(game: IGame, stage?: ParliamentPhaseStage): number {
  let answered = 0;
  for (const player of game.playersInGenerationOrder) {
    if (gatePromptOf(player, stage) !== undefined) {
      answerGate(player, stage);
      answered++;
    }
  }
  return answered;
}

/**
 * Walk the gates: answer every standing gate until none stands — past
 * `assembly` the resolution's own asks stand (the spec answers those), past
 * `adjourn` the phase is over. A non-gate prompt is never answered here.
 */
export function settleParliamentGates(game: IGame): void {
  for (let round = 0; round < 8; round++) {
    if (answerStandingGates(game) === 0) {
      return;
    }
  }
  throw new Error('the parliament gates did not settle in 8 rounds');
}

/**
 * Every seat passes; production → the parliament. A seat that PASSES holds no
 * prompt in the engine (the pass IS its answer), but the harness leaves one
 * standing — the action menu of the seat handed the turn after another
 * passed, the research pick of a generation a spec skipped by setting the
 * phase — so it is cleared BEFORE the pass: a prompt standing at the assembly
 * gate would make the gate wait for it. A political phase still in progress
 * (its adjourn gate unanswered) is a spec's mistake, named here rather than
 * as the driver's «already in progress».
 */
export function passToParliament(game: IGame): void {
  if (game.parliament?.phase !== undefined) {
    throw new Error(`a political phase is still in progress (step ${game.parliament.phase.step}) — settle its gates before ending the next generation`);
  }
  for (const player of game.playersInGenerationOrder) {
    if (player.getWaitingFor() !== undefined) {
      player.clearWaitingFor();
    }
    game.playerHasPassed(player);
    game.playerIsFinishedTakingActions();
  }
}

/** Pass everyone and walk the gates: the resolution's first ask stands, or the phase is over (a quiet card). */
export function endGenerationThroughParliament(game: IGame): void {
  passToParliament(game);
  settleParliamentGates(game);
}
