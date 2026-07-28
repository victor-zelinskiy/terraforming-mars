import {expect} from 'chai';
import {
  WHEEL_CONTROL_CHOICES,
  WHEEL_CONTROL_LABELS,
  cycleWheelControlMode,
  sanitizeWheelControlMode,
  setWheelControlMode,
  wheelControlState,
} from '@/client/console/quickWheel/wheelControlMode';

describe('wheelControlMode', () => {
  after(() => {
    // Module state is bundle-shared — never leak a non-default mode into
    // later specs.
    setWheelControlMode('quick-select');
  });

  it('defaults to quick-select (existing players keep their control style)', () => {
    expect(wheelControlState.mode).to.eq('quick-select');
  });

  it('sanitizes unknown / corrupted / absent values to quick-select', () => {
    expect(sanitizeWheelControlMode(undefined)).to.eq('quick-select');
    expect(sanitizeWheelControlMode(null)).to.eq('quick-select');
    expect(sanitizeWheelControlMode('')).to.eq('quick-select');
    expect(sanitizeWheelControlMode('turbo-mode')).to.eq('quick-select');
    expect(sanitizeWheelControlMode('focus-confirm')).to.eq('focus-confirm');
    expect(sanitizeWheelControlMode('quick-select')).to.eq('quick-select');
  });

  it('applies a set instantly (reactive — no restart)', () => {
    setWheelControlMode('focus-confirm');
    expect(wheelControlState.mode).to.eq('focus-confirm');
    setWheelControlMode('quick-select');
    expect(wheelControlState.mode).to.eq('quick-select');
  });

  it('cycles through both choices and back', () => {
    expect(cycleWheelControlMode()).to.eq('focus-confirm');
    expect(cycleWheelControlMode()).to.eq('quick-select');
  });

  it('every choice carries an i18n label (the Options row renders it)', () => {
    for (const c of WHEEL_CONTROL_CHOICES) {
      expect(WHEEL_CONTROL_LABELS[c]).to.be.a('string').and.not.eq('');
    }
  });
});
