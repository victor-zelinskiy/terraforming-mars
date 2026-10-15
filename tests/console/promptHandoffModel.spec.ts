import {expect} from 'chai';
import {
  PROMPT_ARRIVE_MS, PROMPT_ARRIVE_OVERLAP_MS, PROMPT_COMPOSE_AT_MS, PROMPT_COMPOSE_MAX, PROMPT_COMPOSE_MS, PROMPT_COMPOSE_STEP_MS,
  PROMPT_HANDOFF_WINDOW_MS, PROMPT_RELEASE_MS, PROMPT_SURFACES, isPromptSurface, notePromptRelease, promptArrivalDelayMs,
  promptArrivalSpanMs, promptComposeOffsets, promptHandoffDelayNow, resetPromptHandoff,
} from '../../src/client/console/surfaceMotion/promptHandoffModel';

/**
 * THE PROMPT HANDOFF (PL-384) — one decision gives way to the next as ONE phrase: the answered plate lets go, the next
 * arrives a beat before the release has fully gone (never an empty stage, never two legible plates) and composes from
 * the top. «Not drawn out»: the plate is legible well inside half a second, the last block settles inside ~0.6 s.
 */
describe('promptHandoffModel', () => {
  afterEach(() => resetPromptHandoff());

  it('the next plate waits out the release minus the overlap — in the SAME flush that is the whole wait', () => {
    expect(promptArrivalDelayMs(1000, 1000)).to.eq(PROMPT_RELEASE_MS - PROMPT_ARRIVE_OVERLAP_MS);
    // A slow frame between the two is absorbed, never added on top.
    expect(promptArrivalDelayMs(1000, 1050)).to.eq(PROMPT_RELEASE_MS - PROMPT_ARRIVE_OVERLAP_MS - 50);
    // A keyed swap (`out-in`) enters after the release has gone: no wait at all.
    expect(promptArrivalDelayMs(1000, 1000 + PROMPT_RELEASE_MS)).to.eq(0);
  });

  it('the arrival starts BEFORE the release ends (the stage is never empty) and after it has mostly gone', () => {
    expect(PROMPT_ARRIVE_OVERLAP_MS).to.be.greaterThan(0);
    expect(PROMPT_ARRIVE_OVERLAP_MS).to.be.lessThan(PROMPT_RELEASE_MS / 2);
  });

  it('no recent release → an ordinary open, not a handoff', () => {
    expect(promptArrivalDelayMs(undefined, 5000)).to.be.undefined;
    expect(promptArrivalDelayMs(1000, 1000 + PROMPT_HANDOFF_WINDOW_MS + 1)).to.be.undefined;
    expect(promptArrivalDelayMs(1000, 999), 'a clock that went backwards is no handoff').to.be.undefined;
  });

  it('the shared fact: a release is read, never consumed — the head (its beat) and the director (its wait) agree', () => {
    expect(promptHandoffDelayNow(10)).to.be.undefined;
    notePromptRelease(100);
    expect(promptHandoffDelayNow(100)).to.eq(PROMPT_RELEASE_MS - PROMPT_ARRIVE_OVERLAP_MS);
    expect(promptHandoffDelayNow(100)).to.eq(PROMPT_RELEASE_MS - PROMPT_ARRIVE_OVERLAP_MS);
    resetPromptHandoff();
    expect(promptHandoffDelayNow(100)).to.be.undefined;
  });

  it('the compose cascade is capped and in reading order', () => {
    expect(promptComposeOffsets(0)).to.deep.eq([]);
    expect(promptComposeOffsets(3)).to.deep.eq([
      PROMPT_COMPOSE_AT_MS, PROMPT_COMPOSE_AT_MS + PROMPT_COMPOSE_STEP_MS, PROMPT_COMPOSE_AT_MS + 2 * PROMPT_COMPOSE_STEP_MS,
    ]);
    expect(promptComposeOffsets(40)).to.have.length(PROMPT_COMPOSE_MAX);
  });

  it('NOT DRAWN OUT: from the press, the plate stands by ~0.45 s and the last block settles inside ~0.65 s', () => {
    const wait = PROMPT_RELEASE_MS - PROMPT_ARRIVE_OVERLAP_MS;
    expect(wait + PROMPT_ARRIVE_MS, 'the plate itself').to.be.at.most(450);
    expect(wait + promptArrivalSpanMs(PROMPT_COMPOSE_MAX), 'the whole phrase').to.be.at.most(650);
    expect(promptArrivalSpanMs(0), 'a plate with nothing to compose still materializes').to.eq(PROMPT_ARRIVE_MS);
    expect(promptArrivalSpanMs(2)).to.eq(Math.max(PROMPT_ARRIVE_MS, PROMPT_COMPOSE_AT_MS + PROMPT_COMPOSE_STEP_MS + PROMPT_COMPOSE_MS));
  });

  it('the family is a closed table — every standalone decision plate, the wheel confirm included', () => {
    for (const id of ['task-host', 'production-loss', 'effect-decision', 'bot-attack', 'gov-support', 'spend-heat', 'venus-bonus', 'ares-globals', 'confirm'] as const) {
      expect(isPromptSurface(id), id).to.be.true;
    }
    for (const id of ['reveal', 'action-composer', 'play-composer', 'card-actions', 'section', 'quick', 'sheet', 'info-mode'] as const) {
      expect(isPromptSurface(id), id).to.be.false;
    }
    expect(isPromptSurface(undefined)).to.be.false;
    expect(PROMPT_SURFACES.size).to.eq(9);
  });
});
