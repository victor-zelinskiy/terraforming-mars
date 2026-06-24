import {expect} from 'chai';
import {privateScoreState, setPrivateScore, togglePrivateScore, shouldMaskOwnPassiveVp} from '@/client/components/overview/privateScoreState';

describe('privateScoreState', () => {
  afterEach(() => setPrivateScore(false));

  it('toggles the reactive flag (persistence is best-effort, guarded)', () => {
    setPrivateScore(true);
    expect(privateScoreState.enabled).is.true;
    setPrivateScore(false);
    expect(privateScoreState.enabled).is.false;
    togglePrivateScore();
    expect(privateScoreState.enabled).is.true;
  });

  it('masks ONLY the viewer\'s own VP, and only when enabled', () => {
    setPrivateScore(false);
    expect(shouldMaskOwnPassiveVp(true)).is.false; // off → never masks
    setPrivateScore(true);
    expect(shouldMaskOwnPassiveVp(true)).is.true; // own VP + on → masked
    expect(shouldMaskOwnPassiveVp(false)).is.false; // an opponent's VP is never masked by this
  });
});
