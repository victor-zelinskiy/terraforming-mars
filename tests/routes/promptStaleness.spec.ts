import {expect} from 'chai';
import {validatePromptId} from '../../src/server/routes/promptStaleness';
import {AppError} from '../../src/server/server/AppError';
import {STALE_PROMPT} from '../../src/common/app/AppErrorId';
import {Server} from '../../src/server/models/ServerModel';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {InputError} from '../../src/server/inputs/InputError';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';

describe('promptStaleness (the prompt identity gate)', () => {
  it('a submit stamped with the CURRENT serial passes, and the stamp is consumed', () => {
    const [/* game */, player] = testGame(2);
    player.setWaitingFor(new SelectOption('a'), () => {});
    const entity: {promptId?: unknown} = {promptId: player.waitingForSerial};
    expect(() => validatePromptId(entity, player)).to.not.throw();
    // Consumed like runId — it must never reach the input response processors.
    expect('promptId' in entity).eq(false);
  });

  it('an unstamped submit (legacy client / test) passes untouched', () => {
    const [/* game */, player] = testGame(2);
    player.setWaitingFor(new SelectOption('a'), () => {});
    expect(() => validatePromptId({}, player)).to.not.throw();
  });

  it('a submit stamped for a REPLACED prompt is refused with STALE_PROMPT', () => {
    const [/* game */, player] = testGame(2);
    player.setWaitingFor(new SelectOption('a'), () => {});
    const captured = player.waitingForSerial;
    // The server moves on: the prompt is rebuilt (game reload, undo, bot turn).
    player.clearWaitingFor();
    player.setWaitingFor(new SelectOption('b'), () => {});
    try {
      validatePromptId({promptId: captured}, player);
      expect.fail('expected STALE_PROMPT');
    } catch (e) {
      expect(cast(e, AppError).id).eq(STALE_PROMPT);
    }
  });

  it('a stamped submit against NO standing prompt is refused with STALE_PROMPT (not «Not waiting for anything»)', () => {
    const [/* game */, player] = testGame(2);
    player.setWaitingFor(new SelectOption('a'), () => {});
    const captured = player.waitingForSerial;
    player.clearWaitingFor();
    try {
      validatePromptId({promptId: captured}, player);
      expect.fail('expected STALE_PROMPT');
    } catch (e) {
      expect(cast(e, AppError).id).eq(STALE_PROMPT);
    }
  });

  it('every setWaitingFor issues a NEW serial — a rebuilt prompt can never inherit the old identity', () => {
    const [/* game */, player, player2] = testGame(2);
    player.setWaitingFor(new SelectOption('a'), () => {});
    const first = player.waitingForSerial;
    player.clearWaitingFor();
    player.setWaitingFor(new SelectOption('a'), () => {});
    expect(player.waitingForSerial).to.not.eq(first);
    // The feed is process-lifetime, not per-player: two players never collide.
    player2.setWaitingFor(new SelectOption('b'), () => {});
    expect(player2.waitingForSerial).to.not.eq(player.waitingForSerial);
  });

  it('a REFUSED submit keeps the prompt identity — the on-screen stamp stays valid for the corrected retry', () => {
    const [/* game */, player] = testGame(2);
    player.setWaitingFor(new SelectOption('a'), () => {});
    const serial = player.waitingForSerial;
    // A structurally wrong response makes process() throw and restore the prompt.
    expect(() => player.process({type: 'card', cards: []})).to.throw(InputError);
    expect(player.getWaitingFor()).to.not.eq(undefined);
    expect(player.waitingForSerial).eq(serial);
    expect(() => validatePromptId({promptId: serial}, player)).to.not.throw();
  });

  it('the serialized waitingFor model carries the live serial as promptId', () => {
    const [/* game */, player] = testGame(2);
    player.setWaitingFor(cast(new SelectCard('pick', 'Pick', []), SelectCard), () => {});
    const model = Server.getWaitingFor(player, player.getWaitingFor());
    expect(model?.promptId).eq(player.waitingForSerial);
  });
});
