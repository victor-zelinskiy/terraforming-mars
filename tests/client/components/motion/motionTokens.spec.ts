import {expect} from 'chai';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {
  __resetMotionTokensForTesting,
  applyMotionCssScale,
  createFrameGate,
  motionFpsCap,
  motionMs,
  motionScale,
  motionSpeedPreset,
  setMotionFpsCap,
  setMotionSpeedPreset,
} from '@/client/components/motion/motionTokens';

describe('motionTokens', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    __resetMotionTokensForTesting();
  });

  afterEach(() => {
    __resetMotionTokensForTesting();
    FakeLocalStorage.deregister(localStorage);
    document.documentElement.style.removeProperty('--motion-scale');
  });

  it('defaults to the standard preset — motionMs is the identity', () => {
    expect(motionSpeedPreset()).to.eq('standard');
    expect(motionScale()).to.eq(1);
    expect(motionMs(720)).to.eq(720);
  });

  it('reads the preset from localStorage', () => {
    localStorage.setItem('tm_motion_speed', 'swift');
    __resetMotionTokensForTesting();
    expect(motionSpeedPreset()).to.eq('swift');
    expect(motionMs(1000)).to.eq(650);
  });

  it('ignores an invalid stored preset', () => {
    localStorage.setItem('tm_motion_speed', 'warp9');
    __resetMotionTokensForTesting();
    expect(motionSpeedPreset()).to.eq('standard');
  });

  it('setMotionSpeedPreset persists and updates the CSS bridge', () => {
    setMotionSpeedPreset('calm');
    expect(localStorage.getItem('tm_motion_speed')).to.eq('calm');
    expect(motionMs(1000)).to.eq(1300);
    expect(document.documentElement.style.getPropertyValue('--motion-scale')).to.eq('1.3');
  });

  it('applyMotionCssScale writes the active multiplier', () => {
    applyMotionCssScale();
    expect(document.documentElement.style.getPropertyValue('--motion-scale')).to.eq('1');
  });

  it('FPS cap defaults to auto and reads from localStorage', () => {
    expect(motionFpsCap()).to.eq('auto');
    localStorage.setItem('tm_motion_fps', '30');
    __resetMotionTokensForTesting();
    expect(motionFpsCap()).to.eq(30);
  });

  it('setMotionFpsCap persists', () => {
    setMotionFpsCap(30);
    expect(localStorage.getItem('tm_motion_fps')).to.eq('30');
    expect(motionFpsCap()).to.eq(30);
  });

  it('frame gate passes every frame under auto', () => {
    const gate = createFrameGate();
    expect(gate.shouldRender(0)).to.be.true;
    expect(gate.shouldRender(8)).to.be.true;
    expect(gate.shouldRender(16)).to.be.true;
  });

  it('frame gate throttles work under a 30fps cap', () => {
    setMotionFpsCap(30);
    const gate = createFrameGate();
    expect(gate.shouldRender(0)).to.be.true;   // first frame renders
    expect(gate.shouldRender(16)).to.be.false; // ~60Hz tick skipped
    expect(gate.shouldRender(34)).to.be.true;  // ≥ 1000/30 since last render
    expect(gate.shouldRender(50)).to.be.false;
    expect(gate.shouldRender(67)).to.be.true;
  });
});
