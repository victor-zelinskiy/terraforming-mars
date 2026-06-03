import {expect} from 'chai';
import {testGame} from '../TestGame';
import {setTemperature} from '../TestingUtils';
import {unplayableReasons} from '../../src/server/models/unplayableReasons';
import {GeneRepair} from '../../src/server/cards/base/GeneRepair';
import {ArchaeBacteria} from '../../src/server/cards/base/ArchaeBacteria';

describe('unplayableReasons', () => {
  it('returns no reasons for a playable card', () => {
    const [/* game */, player] = testGame(2);
    player.tagsForTest = {science: 3};
    player.megaCredits = 20;
    expect(unplayableReasons(player, new GeneRepair())).has.length(0);
  });

  it('reports an affordability gap in M€', () => {
    const [/* game */, player] = testGame(2);
    player.tagsForTest = {science: 3}; // requirement satisfied → cost is the only blocker
    player.megaCredits = 0;
    const reasons = unplayableReasons(player, new GeneRepair());
    const mc = reasons.find((r) => r.type === 'megacredits');
    expect(mc, 'expected a megacredits reason').is.not.undefined;
    expect(mc?.params?.[0]).eq('12'); // GeneRepair cost
  });

  it('reports an unmet tag requirement with the current count', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 100; // affordable → tag requirement is the only blocker
    const reasons = unplayableReasons(player, new GeneRepair());
    const tag = reasons.find((r) => r.type === 'tag');
    expect(tag, 'expected a tag reason').is.not.undefined;
    expect(tag?.current).eq(0);
    expect(tag?.params?.[0]).eq('3'); // requires 3 science tags
  });

  it('reports an unmet global parameter (max temperature)', () => {
    const [game, player] = testGame(2);
    player.megaCredits = 10;
    setTemperature(game, -16); // ArchaeBacteria requires -18C or colder
    const reasons = unplayableReasons(player, new ArchaeBacteria());
    expect(reasons.some((r) => r.type === 'globalParameter'), 'expected a globalParameter reason').is.true;
  });
});
