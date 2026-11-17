import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE PARLIAMENT'S DEAL TURNS EACH RESOLUTION ON ITS WAY — the source half of the claim the e2e can no longer make by
 * frames (`console-parliament-sitting-motion` ИТОГИ). The turn itself — a `rotationY` tween through every angle, never
 * an opacity on the body — is `addCard3DTurn`'s, proven on its own (`tests/client/components/console/card3dInner.spec.ts`
 * § the turn). What is pinned here is that the deal LAYERS it: born face-down, turned to face-up on the flight's own
 * timeline, inside the flight. A painted frame inside a ~350 ms turn is the renderer's speed, never the product's
 * (CI 43998786293 — the reward stage's deal, one 300 ms tick 170° → 2°).
 */
describe('parliament — the deal layers the real 3D turn onto its flight', () => {
  const FLIGHTS = path.resolve('src/client/console/parliament/parliamentFlights.ts');
  const raw = fs.readFileSync(FLIGHTS, 'utf8').replace(/\r\n/g, '\n');
  const deal = raw.slice(raw.indexOf('export function dealResolutionCard('), raw.indexOf('export const LEAVE_TURN_MS'));

  it('reads the deal (anti-vacuous)', () => {
    expect(deal.length, 'dealResolutionCard was found').to.be.greaterThan(500);
  });

  it('the body is born FACE-DOWN', () => {
    expect(deal).to.include('faceUp: false');
    expect(deal).to.include('setCard3DFace(card, false);');
  });

  it('the turn is `addCard3DTurn` from face-down to face-up, on the FLIGHT\'s own timeline, within the flight', () => {
    const turn = deal.slice(deal.indexOf('addCard3DTurn(handle.tween, {'));
    expect(turn.length, 'the turn rides the flight\'s timeline (one gesture)').to.be.greaterThan(0);
    const opts = turn.slice(0, turn.indexOf('});'));
    expect(opts).to.include('from: FACE_DOWN_DEG');
    expect(opts).to.include('to: FACE_UP_DEG');
    // Starts after the lift-off, ends before the touchdown: at + dur < 1 of the flight.
    const at = Number(/at: dur \* ([\d.]+)/.exec(opts)?.[1]);
    const len = Number(/dur: dur \* ([\d.]+)/.exec(opts)?.[1]);
    expect(at, 'the turn starts after the lift-off').to.be.greaterThan(0);
    expect(at + len, 'the turn ends inside the flight').to.be.lessThan(1);
  });
});
