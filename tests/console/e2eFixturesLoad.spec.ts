import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {Game} from '../../src/server/Game';
import {SerializedGame} from '../../src/server/SerializedGame';
import {Phase} from '../../src/common/Phase';
import {parliamentGatePending} from '../../src/server/parliament/ParliamentPhase';

/**
 * E2E FIXTURES LOAD GUARD — every fixture must deserialize against the
 * CURRENT engine (docs/E2E_ARCHITECTURE_REWORK.md phase 4).
 *
 * A fixture is a `game.serialize()` dump consumed by POST /api/dev/load-game
 * through `Game.deserialize` — the same path real saves ride. When the
 * serialization schema evolves, this spec fails in SECONDS with the
 * deserializer's own error and the fixture's name, instead of an e2e spec
 * failing minutes in with a 400 nobody attributes. The fix is one command:
 * `npm run e2e:fixtures` (regenerates through the live engine) + commit.
 */
const FIXTURES_DIR = path.resolve(__dirname, '..', 'e2e', 'fixtures');

function fixtureFiles(): Array<string> {
  return fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json')).sort();
}

describe('e2e fixtures load', () => {
  it('there are fixtures to guard (anti-vacuity)', () => {
    expect(fixtureFiles().length).to.be.greaterThanOrEqual(2);
  });

  for (const file of fixtureFiles()) {
    it(`${file} deserializes with the current engine and resumes a live prompt`, () => {
      const serialized = JSON.parse(
        fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8')) as SerializedGame;
      const game = Game.deserialize(serialized);
      expect(game.players.length).to.be.greaterThan(0);
      // The whole point of a fixture is a PLAYABLE state: action-phase
      // deserialize re-primes the active player's prompt (Game.deserialize's
      // resume block), so a fixture that loads but asks nothing is broken.
      if (game.phase === Phase.ACTION) {
        expect(game.activePlayer.getWaitingFor(),
          'the resumed game must be asking its active player something').is.not.undefined;
      }
      // A fixture saved INSIDE a gate of the political phase resumes it: every
      // participant without the gate's key holds the gate prompt (by the
      // server's marker, never a title), the seats that answered hold nothing.
      const parliament = game.parliament;
      const step = parliament?.phase?.step;
      if (game.phase === Phase.PARLIAMENT && parliament !== undefined && (step === 'assembly' || step === 'adjourn')) {
        const pending = parliamentGatePending(game, parliament, step);
        expect(pending.length, 'a gate fixture still waits for someone').to.be.greaterThan(0);
        for (const seat of parliament.participants(game)) {
          const marker = seat.getWaitingFor()?.parliamentPhasePrompt;
          if (pending.includes(seat)) {
            expect(marker?.stage, `${seat.color} holds the ${step} gate`).to.eq(step);
          } else {
            expect(marker, `${seat.color} answered already`).is.undefined;
          }
        }
      }
    });
  }
});
