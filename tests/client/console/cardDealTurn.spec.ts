import {expect} from 'chai';
import {gsap} from 'gsap';
import {DealHandle, runCardDealTimeline} from '@/client/console/cardDeal/cardDealDirector';
import {dealTimings, flightPlan, HANDOFF_AT} from '@/client/console/cardDeal/cardDealModel';

/**
 * THE DEAL TURNS EACH CARD IN FLIGHT — a real 3D turn (`rotationY` 180 → 0 on the proxy's flip, an eased tween), judged
 * on the ANIMATION CLOCK, never on what a renderer happened to paint.
 *
 * The e2e (`console-parliament-sitting-reward`, the take's deal) used to ask for a recorded frame between 20° and 160°;
 * the whole turn lasts 0.55 × 420 ms ≈ 231 ms, and a software-rasterized 4K frame on CI is ~300 ms — one tick went
 * 170° → 2° (CI 43998786293) and the check called a real turn a snap. Whether a frame lands mid-turn is the machine's
 * speed; that the turn IS a tween through every angle is the director's, and is read here by seeking the global
 * timeline. The e2e keeps the journey: born face-down, the turn written on the flip, the card dealt.
 */
describe('cardDealDirector — the deal turns each card in flight', () => {
  const made: Array<HTMLElement> = [];
  let handle: DealHandle | undefined;

  function proxy(): {body: HTMLElement, flip: HTMLElement} {
    const body = document.createElement('div');
    body.className = 'con-deal-proxy';
    const flip = document.createElement('div');
    flip.className = 'con-deal-proxy__flip';
    body.appendChild(flip);
    document.body.appendChild(body);
    made.push(body);
    return {body, flip};
  }

  afterEach(() => {
    handle?.kill();
    handle = undefined;
    for (const el of made.splice(0)) {
      gsap.killTweensOf(el);
      el.remove();
    }
  });

  it('born face-down, every angle in between on the way, face-up before the hand-off — for each card of the deal', () => {
    const cards = [proxy(), proxy(), proxy()];
    const timings = dealTimings(cards.length);
    const rot = (flip: HTMLElement) => Number(gsap.getProperty(flip, 'rotationY'));
    const t0 = gsap.globalTimeline.time();
    handle = runCardDealTimeline({
      proxies: cards.map((c) => c.body),
      targets: cards.map((_c, i) => ({left: 200 + i * 360, top: 300, width: 320, height: 445})),
      deck: null,
      deckAnchor: {x: 960, y: 1000},
      timings,
      onReveal: () => undefined,
      onDone: () => undefined,
    });
    for (const [i, card] of cards.entries()) {
      expect(rot(card.flip), `card ${i} is born face-down`).to.eq(180);
    }
    cards.forEach((card, i) => {
      const launchMs = flightPlan(i, timings).delayMs;
      const angles: Array<number> = [];
      // The clock walked in 5 ms steps from the launch to the hand-off (the proxy fades out past `HANDOFF_AT`).
      for (let ms = launchMs; ms <= launchMs + timings.flightMs * HANDOFF_AT; ms += 5) {
        gsap.globalTimeline.time(t0 + ms / 1000);
        angles.push(rot(card.flip));
      }
      expect(angles.some((a) => a > 30 && a < 150), `card ${i} passes through its plane (${angles.map(Math.round).join(',')})`).to.eq(true);
      for (let k = 1; k < angles.length; k++) {
        expect(angles[k], `card ${i} never turns back`).to.be.at.most(angles[k - 1] + 0.01);
      }
      expect(angles[angles.length - 1], `card ${i} is face-up before its hand-off`).to.be.lessThan(1);
    });
  });
});
