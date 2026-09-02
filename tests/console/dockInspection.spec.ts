import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {
  INSPECTION_FAN_MAX,
  buildDockInspectionView,
  dockInspectionFor,
  inspectionFan,
} from '@/client/console/handDock/dockInspection';
import {packProfileTuning} from '@/client/console/handDock/handBodies';

/** A public seat fixture — deliberately WITHOUT a private card list: the
 *  module's whole privacy contract is that it can only ever read the one
 *  public integer, so the fixture not carrying more proves it structurally. */
function seat(over: {color: Color, isMarsBot?: boolean, cardsInHandNbr?: number}): PublicPlayerModel {
  return {cardsInHandNbr: 0, ...over} as unknown as PublicPlayerModel;
}

const automa = {actionDeckSize: 7, bonusDeckSize: 4} as unknown as MarsBotModel;

describe('dockInspection — the HandDock inspection seat', () => {
  // ── source selection ───────────────────────────────────────────────────
  it('the viewer\'s own seat is NOT an inspection — the ordinary dock stays', () => {
    expect(dockInspectionFor('red', seat({color: 'red', cardsInHandNbr: 5}), undefined)).to.be.undefined;
    // …even when an automa exists in the game.
    expect(dockInspectionFor('red', seat({color: 'red'}), automa)).to.be.undefined;
  });

  it('another human: the public hand count, nothing else', () => {
    const got = dockInspectionFor('red', seat({color: 'blue', cardsInHandNbr: 9}), automa);
    expect(got).to.deep.eq({kind: 'human', color: 'blue', count: 9});
  });

  it('the MarsBot: the ACTION DECK is its hand — the deck it plays from and, empty, passes on', () => {
    const got = dockInspectionFor('red', seat({color: 'green', isMarsBot: true, cardsInHandNbr: 0}), automa);
    expect(got).to.deep.eq({kind: 'bot', color: 'green', count: 7});
  });

  it('a bot seat with NO automa model degrades to the human presentation (legacy saves)', () => {
    const got = dockInspectionFor('red', seat({color: 'green', isMarsBot: true, cardsInHandNbr: 0}), undefined);
    expect(got).to.deep.eq({kind: 'human', color: 'green', count: 0});
  });

  it('a zero count is an honest empty tray, never a hidden dock', () => {
    const emptyBot = {actionDeckSize: 0} as unknown as MarsBotModel;
    const got = dockInspectionFor('red', seat({color: 'green', isMarsBot: true}), emptyBot);
    expect(got?.count).to.eq(0);
    expect(inspectionFan(0, 'standard').slots).to.have.length(0);
  });

  // ── the closed fan ─────────────────────────────────────────────────────
  it('the fan renders one sleeve per card up to the visual cap; the count stays exact past it', () => {
    expect(inspectionFan(1, 'standard').slots).to.have.length(1);
    expect(inspectionFan(2, 'standard').slots).to.have.length(2);
    expect(inspectionFan(INSPECTION_FAN_MAX, 'standard').slots).to.have.length(INSPECTION_FAN_MAX);
    // 40 cards: the fan SATURATES (a fan is a density abstraction, not an
    // inventory) — the counter is what carries the exact number.
    expect(inspectionFan(40, 'standard').slots).to.have.length(INSPECTION_FAN_MAX);
    const view = buildDockInspectionView({kind: 'human', color: 'blue', count: 40}, 'standard');
    expect(view.count, 'the numeric readout is never clamped').to.eq(40);
    expect(view.fan.slots).to.have.length(INSPECTION_FAN_MAX);
  });

  it('a single card sits centred on the tray axis', () => {
    const fan = inspectionFan(1, 'standard');
    expect(fan.slots[0].xRem).to.eq(0);
    expect(fan.slots[0].deep).to.be.false;
  });

  it('past the readable edges the oldest sleeves fold into the dense-thickness band', () => {
    const fan = inspectionFan(24, 'standard');
    expect(fan.slots.filter((s) => s.deep)).to.have.length(4);
    // deep sleeves come FIRST (lowest z) — handDockPlan's own order.
    expect(fan.slots[0].deep).to.be.true;
    expect(fan.slots[23].deep).to.be.false;
  });

  it('the fan wears the COMPACT pose\'s own profile knobs — the guest hand sits exactly in the own pack\'s tray', () => {
    for (const profile of ['standard', 'handheld']) {
      const tune = packProfileTuning(profile);
      const fan = inspectionFan(5, profile);
      expect(fan.sinkRem, `${profile} sink`).to.eq(tune.compactSink);
      expect(fan.scale, `${profile} scale`).to.eq(tune.compactScale);
      expect(fan.cardWRem, `${profile} card box`).to.eq(tune.cardW);
      expect(fan.cardHRem).to.eq(tune.cardH);
    }
    // The handheld fan is NARROWER (its base spread + card box are smaller).
    const wide = inspectionFan(9, 'standard');
    const tight = inspectionFan(9, 'handheld');
    const width = (f: typeof wide) => Math.max(...f.slots.map((s) => s.xRem)) - Math.min(...f.slots.map((s) => s.xRem));
    expect(width(tight)).to.be.lessThan(width(wide));
  });

  it('the fan is symmetric about the tray axis (the pack-scale is applied about the centre)', () => {
    const fan = inspectionFan(6, 'standard');
    const xs = fan.slots.map((s) => s.xRem);
    const sum = xs.reduce((a, b) => a + b, 0);
    // Both the plan and the fan round to 0.01rem — the residue is rounding.
    expect(Math.abs(sum)).to.be.lessThan(0.05);
  });
});
