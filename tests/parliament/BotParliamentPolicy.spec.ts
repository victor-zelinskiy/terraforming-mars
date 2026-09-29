import {expect} from 'chai';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {
  BOT_PARLIAMENT_MODES, BotParliamentMode, PARLIAMENT_ASPECTS, PARLIAMENT_DELEGATES_PER_PLAYER, ParliamentAspect,
} from '../../src/common/parliament/ParliamentTypes';
import {Parliament} from '../../src/server/parliament/Parliament';
import {botParliamentPolicy} from '../../src/server/parliament/BotParliamentPolicy';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SerializedParliament} from '../../src/server/parliament/SerializedParliament';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {testGame} from '../TestGame';

/**
 * THE SEAM — `BotParliamentPolicy.participates(player, aspect)`, the ONE
 * question every parliamentary call site asks (docs/TURMOIL_REDUX_MARSBOT.md
 * §9). The table below IS the design: a mode × aspect matrix, exhaustive
 * over both unions, so a new aspect or a new mode fails here first with the
 * cell that has no answer.
 */
const TABLE: Record<BotParliamentMode, Record<ParliamentAspect, boolean>> = {
  // Iteration 0's observer — byte for byte what shipped: the bot is in no aspect at all.
  none: {'delegates': false, 'winner-reward': false, 'enactment': false, 'party-effects': false, 'quest': false, 'prompts': false},
  // The political seat: it holds delegates, may win a vote, progresses the
  // chairman quest by its own play — and an enacted law never pays it
  // (decision D3), it holds no party effect (RB-C p.6) and it is never asked.
  politics: {'delegates': true, 'winner-reward': true, 'enactment': false, 'party-effects': false, 'quest': true, 'prompts': false},
};

describe('BotParliamentPolicy', () => {
  it('the table is exhaustive over every mode and every aspect', () => {
    expect(Object.keys(TABLE).sort()).deep.eq([...BOT_PARLIAMENT_MODES].sort());
    for (const mode of BOT_PARLIAMENT_MODES) {
      expect(Object.keys(TABLE[mode]).sort(), mode).deep.eq([...PARLIAMENT_ASPECTS].sort());
    }
  });

  for (const mode of BOT_PARLIAMENT_MODES) {
    describe(`mode '${mode}'`, () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: mode});
      const policy = botParliamentPolicy(mode);

      it('names its mode', () => {
        expect(policy.mode).eq(mode);
        expect(game.parliament?.botMode).eq(mode);
      });

      for (const aspect of PARLIAMENT_ASPECTS) {
        it(`${aspect}: the bot ${TABLE[mode][aspect] ? 'IS' : 'is NOT'} in it, the human always is`, () => {
          expect(policy.participates(bot, aspect)).eq(TABLE[mode][aspect]);
          expect(policy.participates(human, aspect)).is.true;
          // …and the parliament's own door says the same (it only forwards).
          expect(game.parliament?.participates(bot, aspect)).eq(TABLE[mode][aspect]);
          expect(game.parliament?.participates(human, aspect)).is.true;
        });
      }
    });
  }

  describe('what the aspects DECIDE on a fresh table', () => {
    it("'politics': the bot holds delegates — the setup's free one in the lobby, the rest in reserve, the ledger whole", () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
      const parliament = game.parliament!;
      expect(parliament.lobby.has(bot.id)).is.true;
      expect(parliament.reserve(bot)).eq(PARLIAMENT_DELEGATES_PER_PLAYER - 1);
      expect(parliament.lobby.has(human.id)).is.true;
      expect(parliament.reserve(human)).eq(PARLIAMENT_DELEGATES_PER_PLAYER - 1);
      expect(() => parliament.assertLedger(game)).not.to.throw();
      expect(parliament.participants(game, 'delegates').map((p) => p.id)).includes(bot.id);
      // …and it can vote (the seam's own verdict, the vote action's gate).
      expect(parliament.canVote(bot).ok).is.true;
    });

    it("'politics': the bot holds NO party effect, is NOT a seat of the enactment, is NOT asked", () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
      const parliament = game.parliament!;
      // The Greens rule the empty government — every human has their effect; the bot ignores the ruling party's policy.
      expect(parliament.hasPartyEffect(human, PartyName.GREENS)).is.true;
      expect(parliament.hasPartyEffect(bot, PartyName.GREENS)).is.false;
      expect(parliament.access(bot, PartyName.GREENS)).deep.include({ruling: false, delegates: 0, byDelegates: false, hasEffect: false, satisfiesRequirement: false});
      expect(parliament.participants(game, 'enactment').map((p) => p.id)).deep.eq([human.id]);
      expect(parliament.participants(game, 'prompts').map((p) => p.id)).deep.eq([human.id]);
    });

    it("'politics': the bot's quest aspect is open at the seam — the tracker's other rules still judge the chain", () => {
      const [game, , bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      expect(game.parliament?.participates(bot, 'quest')).is.true;
      // No live chain at all: not eligible — the seam opened, the recorder's rule closed.
      expect(QuestTracker.eligible(bot)).is.false;
    });

    it("'none': byte for byte iteration 0 — no lobby delegate, no reserve, no vote, no effect", () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      expect(parliament.lobby.has(bot.id)).is.false;
      expect(parliament.reserve(bot)).eq(0);
      expect(parliament.canVote(bot)).deep.eq({ok: false, reason: 'MarsBot takes no part in the parliament', source: 'none', cost: 0});
      expect(parliament.hasPartyEffect(bot, PartyName.GREENS)).is.false;
      expect(parliament.participants(game, 'delegates').map((p) => p.id)).deep.eq([human.id]);
      expect(() => parliament.assertLedger(game)).not.to.throw();
    });
  });

  describe('the model states BOTH aspects on the wire', () => {
    it("'politics': the bot's seat takes part (delegates) and is never paid (enactment)", () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
      const model = getParliamentModel(game, human)!;
      const botSeat = model.players.find((p) => p.color === bot.color)!;
      const humanSeat = model.players.find((p) => p.color === human.color)!;
      expect(model.botMode).eq('politics');
      expect(botSeat).deep.include({participates: true, enactment: false, lobby: true, reserve: PARLIAMENT_DELEGATES_PER_PLAYER - 1, agenda: 0, influence: 0});
      expect(botSeat.access.every((a) => !a.hasEffect)).is.true;
      expect(humanSeat).deep.include({participates: true, enactment: true});
      // The payout readings of the model are a paid seat's: the bot has none.
      expect(botSeat.counts).is.undefined;
      expect(botSeat.stock).is.undefined;
      expect(humanSeat.counts).is.not.undefined;
    });

    it("'none': the bot's seat is in neither", () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const model = getParliamentModel(game, human)!;
      const botSeat = model.players.find((p) => p.color === bot.color)!;
      expect(model.botMode).eq('none');
      expect(botSeat).deep.include({participates: false, enactment: false, lobby: false, reserve: 0});
    });
  });

  describe('the mode is the game\'s own', () => {
    it('a NEW game seats the bot under politics — with or without a bot at the table the mode reads the same', () => {
      const [withBot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      expect(withBot.parliament?.botMode).eq('politics');
      const [humansOnly] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true});
      expect(humansOnly.parliament?.botMode).eq('politics');
    });

    it('a save keeps the mode it was written under — both round-trip, and a save from before the field is the observer mode', () => {
      const [game] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const table = {expansions: game.gameOptions.expansions, rng: game.rng};
      for (const mode of BOT_PARLIAMENT_MODES) {
        const serialized: SerializedParliament = {...game.parliament!.serialize(), botMode: mode};
        const loaded = Parliament.deserialize(JSON.parse(JSON.stringify(serialized)), table);
        expect(loaded.botMode, mode).eq(mode);
        expect(loaded.serialize().botMode, mode).eq(mode);
      }
      const legacy = {...game.parliament!.serialize()} as Partial<SerializedParliament>;
      delete legacy.botMode;
      expect(Parliament.deserialize(legacy as SerializedParliament, table).botMode).eq('none');
    });
  });
});
