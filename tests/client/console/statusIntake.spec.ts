import {expect} from 'chai';
import {
  acceptSeatIntake, foldSeatIntake, intakeItemText, intakeSettled, mergeIntakeItems, openSeatIntake, resetStatusIntakes, seatIntakeEnd,
  statusIntakeState,
} from '@/client/console/statusIntake';

/*
 * THE SEAT CHIP'S INTAKE (T06 — the owner's decision 6 = M1 «плашка-хвост»): another seat's gain off the field lands on
 * a plaque under that seat's chip — EXPECTING from before the token's birth, RECEIVED on the touchdown, folded after one
 * read. One item per resource (a sum, never a swarm); a later payout to the same seat extends the standing plaque.
 */
describe('statusIntake — the seat chip\'s intake', () => {
  afterEach(() => resetStatusIntakes());

  it('merges specs into ONE item per resource, the order of first arrival', () => {
    const items = mergeIntakeItems([], [{resource: 'steel', amount: 1}, {resource: 'plants', amount: 2}, {resource: 'steel', amount: 1}, {resource: 'heat', amount: 0}]);
    expect(items).deep.eq([{resource: 'steel', expected: 2, received: 0}, {resource: 'plants', expected: 2, received: 0}]);
    expect(intakeSettled({items})).eq(false);
    expect(intakeItemText(items[0]), 'nothing landed yet — the plaque waits').eq('…');
    expect(intakeItemText({...items[0], received: 2})).eq('+2');
  });

  it('the lifecycle: open (expecting) → each touchdown ticks its item → received once every unit landed → fold', () => {
    void openSeatIntake('red', [{resource: 'steel', amount: 2}, {resource: 'plants', amount: 1}]);
    const intake = () => statusIntakeState.intakes.find((i) => i.seat === 'red');
    expect(intake()?.phase).eq('expecting');
    acceptSeatIntake('red', {resource: 'steel', amount: 2});
    expect(intake()?.phase, 'the plants are still in the air').eq('expecting');
    expect(intake()?.items[0].received).eq(2);
    acceptSeatIntake('red', {resource: 'plants', amount: 1});
    expect(intake()?.phase).eq('received');
    foldSeatIntake('red');
    expect(intake()).eq(undefined);
  });

  it('a later payout to the same seat EXTENDS the standing plaque (one plaque per seat), back to expecting', () => {
    void openSeatIntake('red', [{resource: 'steel', amount: 1}]);
    acceptSeatIntake('red', {resource: 'steel', amount: 1});
    expect(statusIntakeState.intakes[0].phase).eq('received');
    void openSeatIntake('red', [{resource: 'steel', amount: 2}]);
    expect(statusIntakeState.intakes).length(1);
    expect(statusIntakeState.intakes[0]).deep.include({phase: 'expecting'});
    expect(statusIntakeState.intakes[0].items).deep.eq([{resource: 'steel', expected: 3, received: 1}]);
  });

  it('the token lands on the plaque\'s NUMBER for its resource — and nowhere while no plaque stands', () => {
    expect(seatIntakeEnd('red', 'steel')).eq(undefined);
    const plaque = document.createElement('span');
    plaque.setAttribute('data-intake-seat', 'red');
    const item = document.createElement('span');
    item.setAttribute('data-intake-resource', 'steel');
    const num = document.createElement('span');
    num.className = 'con-status__intake-num';
    num.getBoundingClientRect = () => ({left: 10, top: 10, width: 20, height: 14, right: 30, bottom: 24, x: 10, y: 10, toJSON: () => ({})}) as DOMRect;
    item.appendChild(num);
    plaque.appendChild(item);
    document.body.appendChild(plaque);
    try {
      expect(seatIntakeEnd('red', 'steel')?.el).eq(num);
      expect(seatIntakeEnd('red', 'plants')).eq(undefined);
      expect(seatIntakeEnd(undefined, 'steel')).eq(undefined);
    } finally {
      plaque.remove();
    }
  });
});
