import {expect} from 'chai';
import {testGame} from '../TestGame';
import {buildAdminGameSummary, rollbackAuthorized, savesToDelete, serializedSaveEntry} from '../../src/server/models/adminRollback';
import {SerializedGame} from '../../src/server/SerializedGame';
import {Phase} from '../../src/common/Phase';

// Pure unit test of the admin-rollback helpers (src/server/models/adminRollback.ts).
//   npx mocha --import=tsx --require tests/testing/setup.ts "tests/server/adminRollback.spec.ts"

describe('server/models/adminRollback', () => {
  describe('savesToDelete', () => {
    it('deletes every save strictly above the target', () => {
      expect(savesToDelete([0, 1, 2, 3, 4], 2)).to.eq(2); // 3, 4
      expect(savesToDelete([0, 1, 2, 3, 4], 0)).to.eq(4); // 1..4
    });

    it('is zero when the target is already the latest', () => {
      expect(savesToDelete([0, 1, 2, 3, 4], 4)).to.eq(0);
    });

    it('handles gaps in the persisted save-id set', () => {
      // Saves are not guaranteed contiguous; count those above the target.
      expect(savesToDelete([0, 2, 5, 9], 2)).to.eq(2); // 5, 9
      expect(savesToDelete([0, 2, 5, 9], 9)).to.eq(0);
    });

    it('is zero for a target not present (nothing above a too-high value)', () => {
      expect(savesToDelete([0, 1, 2], 5)).to.eq(0);
    });
  });

  describe('serializedSaveEntry', () => {
    it('projects generation + phase for a save', () => {
      const serialized = {generation: 7, phase: Phase.PRODUCTION} as SerializedGame;
      expect(serializedSaveEntry(serialized, 42)).to.deep.eq({saveId: 42, generation: 7, phase: Phase.PRODUCTION});
    });
  });

  describe('rollbackAuthorized', () => {
    it('admits any name over a loopback connection (local games belong to the machine owner)', () => {
      // ctx.ip socket form is `!address!` (getIPAddress).
      for (const ip of ['!127.0.0.1!', '!::1!', '!::ffff:127.0.0.1!']) {
        expect(rollbackAuthorized(ip, 'Виктор'), ip).to.eq(true);
        expect(rollbackAuthorized(ip, null), ip + ' no name').to.eq(true);
      }
    });

    it('refuses a non-admin LAN guest', () => {
      expect(rollbackAuthorized('!192.168.0.42!', 'Виктор')).to.eq(false);
      expect(rollbackAuthorized('!10.0.0.5!', null)).to.eq(false);
    });

    it('keeps the ADMIN_NAME dev door from anywhere', () => {
      expect(rollbackAuthorized('!192.168.0.42!', 'admin')).to.eq(true);
      expect(rollbackAuthorized('!192.168.0.42!', '  Admin ')).to.eq(true);
    });
  });

  describe('buildAdminGameSummary', () => {
    it('reads the authoritative current generation + roster', () => {
      const [game, player, player2] = testGame(2);
      const summary = buildAdminGameSummary(game);
      expect(summary.id).to.eq(game.id);
      expect(summary.name).to.eq(game.name);
      expect(summary.phase).to.eq(game.phase);
      expect(summary.generation).to.eq(game.getGeneration());
      expect(summary.players.map((p) => p.color)).to.have.members([player.color, player2.color]);
      expect(summary.createdTimeMs).to.eq(game.createdTime.getTime());
    });
  });
});
