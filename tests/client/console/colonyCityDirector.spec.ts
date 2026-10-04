import {expect} from 'chai';
import {gsap} from 'gsap';
import {ColonyCityStageEls, placeCityProxy, playCityLanding, playCityMaterialize} from '@/client/console/colonyCity/colonyCityDirector';
import {CITY_CONTACT_AT, OWN_CITY_PROFILE, WATCHER_CITY_PROFILE} from '@/client/console/colonyCity/colonyCityModel';

/**
 * THE LANDING'S DIRECTOR under a renderer that does not tick when it should
 * (Turmoil Redux TR22 Nova City; docs/TURMOIL_REDUX_NOVA_CITY.md §6).
 *
 * The descent is ONE progress tween whose `onUpdate` poses the piece, and the
 * contact is the landing hero's shared touch beat — relative tweens on the same
 * piece. On a renderer whose FIRST tick of the landing already lies past the
 * contact (measured on a loaded 4K run: frames 250–300 ms apart against a
 * 304 ms fall) every child of the timeline is initialized in that one tick; a
 * lazily rendered progress tween then runs its `onUpdate` LAST — after the
 * settle has read the hanging `y` as its start — and the piece was left a lift
 * above its seat, touched, for the rest of the beat. The piece must be ON its
 * seat from the contact on, whatever the ticks were.
 */
describe('colonyCityDirector — the landing under an uneven renderer', () => {
  const seat = {x: 100, y: 500, w: 80, h: 88};
  const y = (el: HTMLElement) => Number(gsap.getProperty(el, 'y'));
  const scale = (el: HTMLElement) => Number(gsap.getProperty(el, 'scale'));
  let made: Array<HTMLElement> = [];

  function stage(): ColonyCityStageEls {
    const tile = document.createElement('div');
    const edge = document.createElement('div');
    const art = document.createElement('div');
    const touch = document.createElement('div');
    const shadow = document.createElement('div');
    tile.append(edge, art, touch);
    document.body.append(tile, shadow);
    made.push(tile, shadow);
    return {tile, edge, art, touch, shadow};
  }

  afterEach(() => {
    for (const el of made) {
      gsap.killTweensOf(el);
      gsap.killTweensOf(Array.from(el.children));
      el.remove();
    }
    made = [];
  });

  /** Play the landing and render the global clock at each of `ticks` (seconds from the landing's start). */
  function land(profile: typeof OWN_CITY_PROFILE, ticks: ReadonlyArray<number>) {
    const els = stage();
    expect(placeCityProxy(els, seat, profile)).is.true;
    playCityMaterialize(els, profile, (ms) => ms, () => undefined).finish();
    const hang = y(els.tile);
    let contacts = 0;
    let done = false;
    const t0 = gsap.globalTimeline.time();
    const handle = playCityLanding(els, {seat, profile, ms: (ms) => ms, uiScale: 1, onContact: () => {
      contacts++;
    }}, () => {
      done = true;
    });
    const samples: Array<{t: number, y: number, scale: number, contacts: number}> = [];
    for (const t of ticks) {
      gsap.globalTimeline.time(t0 + t);
      samples.push({t, y: y(els.tile), scale: scale(els.tile), contacts});
    }
    return {els, hang, samples, handle, contacts: () => contacts, done: () => done};
  }

  const contactS = (profile: typeof OWN_CITY_PROFILE) => (profile.landMs / 1000) * CITY_CONTACT_AT;

  it('hangs a lift above its seat before the landing starts', () => {
    const {hang} = land(OWN_CITY_PROFILE, []);
    expect(hang).closeTo(seat.y - OWN_CITY_PROFILE.liftHexes * seat.h, 0.5);
  });

  it('an even renderer: the piece comes down monotonically and is on its seat from the contact on', () => {
    const {samples} = land(OWN_CITY_PROFILE, [0.05, 0.15, 0.25, 0.30, 0.32, 0.36, 0.45, 0.6]);
    const before = samples.filter((s) => s.contacts === 0).map((s) => s.y);
    expect([...before].sort((a, b) => a - b), 'only ever down').deep.eq(before);
    for (const s of samples.filter((s) => s.contacts > 0)) {
      expect(s.y, `on the seat at ${s.t}s (within the settle)`).within(seat.y - 0.5, seat.y + 6);
      expect(s.scale).closeTo(1, 0.001);
    }
  });

  for (const profile of [OWN_CITY_PROFILE, WATCHER_CITY_PROFILE]) {
    const first = contactS(profile) + 0.03;
    it(`THE FIRST TICK LANDS PAST THE CONTACT (${profile === OWN_CITY_PROFILE ? 'own' : 'watcher'}, first tick at ${first.toFixed(2)}s): the piece is on its seat in that very tick — never left hanging, touched`, () => {
      const {samples, hang} = land(profile, [first, first + 0.05, first + 0.12]);
      expect(samples[0].contacts, 'the contact fired in the first tick, once').eq(1);
      for (const s of samples) {
        expect(s.y, `at ${s.t.toFixed(2)}s the piece is on its seat (it hung at ${hang.toFixed(0)}, the seat is ${seat.y})`).within(seat.y - 0.5, seat.y + 6);
        expect(s.scale, 'at the resting scale').closeTo(1, 0.001);
      }
    });
  }

  /*
   * …AND THE SAME ON THE REAL TICKER, which is where it broke. Rendering the root by hand (above) flushes lazily
   * queued tweens differently from a tick of the ticker, and only the ticker's own path reproduced the defect: the
   * main thread is starved right after the landing is created, so the timeline's first tick arrives past the contact.
   * Before the progress tween was made non-lazy this read «CONTACT … y = seat» and then y = the hanging height on every
   * tick until the beat's end.
   */
  it('THE REAL TICKER, STARVED PAST THE CONTACT: from the contact on every tick finds the piece on its seat', async () => {
    const els = stage();
    expect(placeCityProxy(els, seat, OWN_CITY_PROFILE)).is.true;
    // The materialization plays on REAL ticks: the ticker is awake and its clock is running when the landing is
    // created (a ticker woken by the landing itself would not count the starvation as elapsed time).
    await new Promise<void>((resolve) => {
      playCityMaterialize(els, OWN_CITY_PROFILE, (ms) => ms, resolve);
    });
    const hang = y(els.tile);
    let contacts = 0;
    let done = false;
    playCityLanding(els, {seat, profile: OWN_CITY_PROFILE, ms: (ms) => ms, uiScale: 1, onContact: () => {
      contacts++;
    }}, () => {
      done = true;
    });
    // No tick for longer than the fall (304 ms to the contact) — and less than the ticker's own lag threshold (500 ms).
    const until = Date.now() + (OWN_CITY_PROFILE.landMs * CITY_CONTACT_AT) + 50;
    while (Date.now() < until) {
      // busy: the starved main thread
    }
    const offSeat: Array<string> = [];
    let ticks = 0;
    const sample = () => {
      ticks++;
      if (contacts > 0 && (y(els.tile) < seat.y - 0.5 || y(els.tile) > seat.y + 6)) {
        offSeat.push(`tick ${ticks}: y=${y(els.tile).toFixed(1)} (hung at ${hang.toFixed(1)}, seat ${seat.y}) done=${done}`);
      }
    };
    gsap.ticker.add(sample);
    await new Promise((resolve) => setTimeout(resolve, 500));
    gsap.ticker.remove(sample);
    expect(ticks, 'the ticker ran').greaterThan(3);
    expect(contacts, 'the contact fired once').eq(1);
    expect(offSeat, 'a piece that has touched does not hang in the air').deep.eq([]);
    expect(done, 'the beat ended').is.true;
    expect(y(els.tile)).closeTo(seat.y, 0.01);
  }).timeout(8000);

  it('a tick that jumps OVER the contact mid-fall lands the piece too', () => {
    const {samples} = land(OWN_CITY_PROFILE, [0.02, contactS(OWN_CITY_PROFILE) + 0.05]);
    expect(samples[0].contacts).eq(0);
    expect(samples[1].contacts).eq(1);
    expect(samples[1].y).within(seat.y - 0.5, seat.y + 6);
  });

  it('the resting pose is WRITTEN at the end — after the whole beat, after «дожать» and after a kill; the contact is never lost', () => {
    const whole = land(OWN_CITY_PROFILE, [2]);
    expect(whole.done()).is.true;
    expect(whole.samples[0].y).closeTo(seat.y, 0.01);
    expect(whole.contacts()).eq(1);

    const hurried = land(OWN_CITY_PROFILE, [0.05]);
    hurried.handle.finish();
    expect(hurried.done()).is.true;
    expect(y(hurried.els.tile)).closeTo(seat.y, 0.01);
    expect(hurried.contacts(), 'a hurried landing still touches — the commit it gates may not be lost').eq(1);

    const killed = land(OWN_CITY_PROFILE, [0.05]);
    killed.handle.kill();
    expect(killed.done()).is.true;
    expect(y(killed.els.tile)).closeTo(seat.y, 0.01);
    expect(killed.contacts()).eq(1);
  });
});
