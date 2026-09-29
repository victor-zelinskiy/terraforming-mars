import {expect} from 'chai';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Parliament} from '../../src/server/parliament/Parliament';
import {botDelegateSupply, botWinsWith, chooseVoteSlot, humanDelegatesOn, voteDeficits} from '../../src/server/parliament/BotVoteChooser';
import {botWinnerRewardKind} from '../../src/server/automa/BotWinnerReward';
import {AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {COLONIZATION_FUNDING_ID} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {testAutomaGame, testAutomaMultiplayerGame} from '../automa/AutomaTestGame';
import {TestPlayer} from '../TestPlayer';
import {seatResolution} from './parliamentArrange';

/**
 * THE CHOOSER'S TABLE (docs/TURMOIL_REDUX_MARSBOT.md §3.3) — every scenario of
 * «how it reads at the table», pinned. The table is arranged by the spec
 * (`seatResolution`), the votes placed through the ledger; the chooser is
 * pure and the assertion is where the NEXT delegate goes and by which rule.
 *
 * The three cards WITHOUT a winner's reward the bot can execute: Architecture
 * Award (Mars First), Central Power Grid (Industrialists), Colonization
 * Funding (Unity). The one WITH: Aquifer Contest (Greens — an ocean, ★).
 */
function table(mode: 'plain' | 'star-at-2' = 'plain'): [IGame, TestPlayer, IPlayer, Parliament] {
  const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
  const parliament = game.parliament!;
  game.phase = Phase.ACTION;
  seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
  seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
  seatResolution(parliament, 2, mode === 'star-at-2' ? AQUIFER_CONTEST_ID : COLONIZATION_FUNDING_ID);
  for (const slot of parliament.slots) {
    slot.votes = [];
  }
  return [game, human, bot, parliament];
}

/** `count` delegates of `player` onto slot `index` — the free one first, the reserve after. */
function vote(parliament: Parliament, player: IPlayer, index: number, count: number): void {
  for (let i = 0; i < count; i++) {
    parliament.placeVote(player, parliament.slots[index], parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

describe('BotVoteChooser', () => {
  it('the ★ predicate is ONE function: Aquifer Contest is an ocean the bot can place, the others declare no winner part', () => {
    const [, , , parliament] = table('star-at-2');
    expect(botWinnerRewardKind(parliament.resolutionOf(parliament.slots[2].instance))).eq('ocean');
    expect(botWinnerRewardKind(parliament.resolutionOf(parliament.slots[0].instance))).is.undefined;
    expect(botWinnerRewardKind(parliament.resolutionOf(parliament.slots[1].instance))).is.undefined;
  });

  it('an EMPTY table → slot 0 (the tie priority); with a ★ on another slot → that one', () => {
    const [, , bot, plain] = table();
    expect(voteDeficits(plain, bot)).deep.eq([1, 1, 1]);
    expect(chooseVoteSlot(plain, bot)).deep.include({slotIndex: 0, rules: ['win-now', 'nearest-slot'], deficit: 1});
    const [, , bot2, starred] = table('star-at-2');
    expect(chooseVoteSlot(starred, bot2)).deep.include({slotIndex: 2, rules: ['win-now', 'star'], deficit: 1});
  });

  it('the human put 1 on A (slot 1), B (slot 0) is empty → B: 1 = 1, the tie goes to slot 0 — the bot wins with one cube', () => {
    const [, human, bot, parliament] = table();
    vote(parliament, human, 1, 1);
    expect(voteDeficits(parliament, bot)).deep.eq([1, 2, 2]);
    expect(chooseVoteSlot(parliament, bot)).deep.include({slotIndex: 0, rules: ['win-now'], deficit: 1});
  });

  it('the human holds A with 2, three NEUTRAL delegates stand on C → C: 4 > 2 and the bot is its only player — it rides the popular support', () => {
    const [, human, bot, parliament] = table();
    vote(parliament, human, 1, 2);
    for (let i = 0; i < 3; i++) {
      expect(parliament.addNeutralVote(parliament.slots[2])).is.not.undefined;
    }
    expect(voteDeficits(parliament, bot)[2]).eq(1);
    expect(chooseVoteSlot(parliament, bot)).deep.include({slotIndex: 2, rules: ['win-now'], deficit: 1});
  });

  it('CONCENTRATION: the bot leads B (slot 2) with 1, the human A (slot 0) with 2 → the next cube STRENGTHENS B (deficit 2), never opens C', () => {
    const [, human, bot, parliament] = table();
    vote(parliament, human, 0, 2);
    vote(parliament, bot, 2, 1);
    expect(voteDeficits(parliament, bot)).deep.eq([3, 3, 2]);
    expect(chooseVoteSlot(parliament, bot)).deep.include({slotIndex: 2, rules: ['closest'], deficit: 2});
  });

  it('the human ahead everywhere (3 / 2 / 2) → the smallest deficit; a tie of deficits → the ★, else the tie priority', () => {
    const [, human, bot, plain] = table();
    vote(plain, human, 0, 3);
    vote(plain, human, 1, 2);
    vote(plain, human, 2, 2);
    expect(voteDeficits(plain, bot)).deep.eq([4, 3, 3]);
    expect(chooseVoteSlot(plain, bot)).deep.include({slotIndex: 1, rules: ['closest', 'nearest-slot'], deficit: 3});
    const [, human2, bot2, starred] = table('star-at-2');
    vote(starred, human2, 0, 3);
    vote(starred, human2, 1, 2);
    vote(starred, human2, 2, 2);
    expect(chooseVoteSlot(starred, bot2)).deep.include({slotIndex: 2, rules: ['closest', 'star'], deficit: 3});
  });

  it('a tie of deficits with no ★ → the LESS CONTESTED card (the fewest delegates of the players): 3 / 2 / 1', () => {
    const [, human, bot, parliament] = table();
    vote(parliament, human, 0, 3);
    vote(parliament, human, 1, 2);
    vote(parliament, human, 2, 1);
    // Slot 2 needs 3 too: 2 cubes lead the human's 1, but 3 votes only TIE slot 0's 3 and the tie goes to slot 0.
    expect(voteDeficits(parliament, bot)).deep.eq([4, 3, 3]);
    expect(chooseVoteSlot(parliament, bot)).deep.include({slotIndex: 2, rules: ['closest', 'fewest-human'], deficit: 3});
  });

  it('the lead\'s tie goes to the EARLIER first delegate: the bot placing second is not the leader — it needs strictly more', () => {
    const [, human, bot, parliament] = table();
    vote(parliament, human, 0, 1);
    expect(botWinsWith(parliament, bot, 0, 1), 'one cube ties the human, who came earlier').is.false;
    expect(botWinsWith(parliament, bot, 0, 2), 'two cubes lead').is.true;
    expect(voteDeficits(parliament, bot)).deep.eq([2, 2, 2]);
    // Every card at 2: the ★ narrows nothing, the human's cube on slot 0 makes it the contested one, the tie priority picks slot 1.
    expect(chooseVoteSlot(parliament, bot)).deep.include({slotIndex: 1, rules: ['closest', 'fewest-human', 'nearest-slot'], deficit: 2});
  });

  it('a REPEATED delegate: the bot won slot 0 with one cube, the human answered with 2 on slot 1 → the bot stacks slot 0 (2 = 2, the tie is its)', () => {
    const [, human, bot, parliament] = table();
    vote(parliament, bot, 0, 1);
    vote(parliament, human, 1, 2);
    expect(voteDeficits(parliament, bot)).deep.eq([1, 3, 3]);
    expect(chooseVoteSlot(parliament, bot)).deep.include({slotIndex: 0, rules: ['win-now'], deficit: 1});
  });

  it('NOTHING reachable within its supply (the human\'s 7 on slot 0) → the ties alone: the ★, else the fewest players\' cubes, else the tie priority', () => {
    const [, human, bot, plain] = table();
    vote(plain, human, 0, 7);
    expect(botDelegateSupply(plain, bot)).eq(7);
    expect(voteDeficits(plain, bot)).deep.eq([undefined, undefined, undefined]);
    const choice = chooseVoteSlot(plain, bot);
    expect(choice).deep.include({slotIndex: 1, rules: ['fewest-human', 'nearest-slot']});
    expect(choice?.deficit).is.undefined;
    const [, human2, bot2, starred] = table('star-at-2');
    vote(starred, human2, 0, 7);
    expect(chooseVoteSlot(starred, bot2)).deep.include({slotIndex: 2, rules: ['star']});
  });

  it('MULTIPLAYER: «the players\' delegates» is the SUM of every human\'s, never one seat\'s', () => {
    const [game, humans, bot] = testAutomaMultiplayerGame(2, {coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
    const parliament = game.parliament!;
    game.phase = Phase.ACTION;
    seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
    for (const slot of parliament.slots) {
      slot.votes = [];
    }
    vote(parliament, humans[0], 1, 1);
    vote(parliament, humans[1], 1, 1);
    vote(parliament, humans[0], 2, 1);
    expect(humanDelegatesOn(parliament.slots[1], bot)).eq(2);
    expect(humanDelegatesOn(parliament.slots[2], bot)).eq(1);
    expect(humanDelegatesOn(parliament.slots[0], bot)).eq(0);
    // Every card at deficit 2 (two cubes lead any single human and the table alike); the empty slot is the least contested.
    expect(voteDeficits(parliament, bot)).deep.eq([2, 2, 2]);
    expect(chooseVoteSlot(parliament, bot)).deep.include({slotIndex: 0, rules: ['closest', 'fewest-human'], deficit: 2});
  });

  it('an EMPTY voting area has no answer', () => {
    const [, , bot, parliament] = table();
    parliament.slots = [];
    expect(chooseVoteSlot(parliament, bot)).is.undefined;
  });

  it('is PURE: the table is exactly as it was after every question', () => {
    const [, human, bot, parliament] = table('star-at-2');
    vote(parliament, human, 0, 2);
    vote(parliament, bot, 2, 1);
    const before = JSON.stringify(parliament.serialize());
    chooseVoteSlot(parliament, bot);
    voteDeficits(parliament, bot);
    botWinsWith(parliament, bot, 1, 3);
    expect(JSON.stringify(parliament.serialize())).eq(before);
  });
});
