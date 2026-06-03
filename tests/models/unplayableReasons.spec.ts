import {expect} from 'chai';
import {testGame} from '../TestGame';
import {setTemperature} from '../TestingUtils';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {unplayableReasons} from '../../src/server/models/unplayableReasons';
import {GeneRepair} from '../../src/server/cards/base/GeneRepair';
import {ArchaeBacteria} from '../../src/server/cards/base/ArchaeBacteria';
import {CloudSeeding} from '../../src/server/cards/base/CloudSeeding';
import {RoboticWorkforce} from '../../src/server/cards/base/RoboticWorkforce';
import {AerosportTournament} from '../../src/server/cards/venusNext/AerosportTournament';

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

  it('reports an unmet floaters requirement with a specific label (not generic)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 50;
    const reasons = unplayableReasons(player, new AerosportTournament());
    const f = reasons.find((r) => r.message === 'Requires ${0} floater(s)');
    expect(f, 'expected a specific floaters reason').is.not.undefined;
    expect(f?.params?.[0]).eq('5');
    expect(f?.current).eq(0);
  });

  it('names the resource when no production can be reduced (target reason)', () => {
    const [/* game */, player] = testGame(2); // not solo → decreaseAnyProduction is checked
    player.megaCredits = 50;
    const reasons = unplayableReasons(player, new CloudSeeding());
    const t = reasons.find((r) => r.type === 'target');
    expect(t, 'expected a target reason').is.not.undefined;
    expect(t?.resource).eq(Resource.HEAT);
  });

  it('explains Robotic Workforce has no card with the building symbol to copy (bespoke hook)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 50; // affordable → only the bespoke reason
    const reasons = unplayableReasons(player, new RoboticWorkforce());
    const t = reasons.find((r) => r.message === 'No card with the building symbol to copy production from');
    expect(t, 'expected the copy-target reason').is.not.undefined;
    expect(t?.type).eq('target');
    expect(t?.tag).eq(Tag.BUILDING); // popover renders the building symbol
  });

  it('surfaces BOTH affordability and the bespoke block together', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 0; // cannot afford AND nothing to copy
    const reasons = unplayableReasons(player, new RoboticWorkforce());
    expect(reasons.some((r) => r.type === 'megacredits'), 'expected an affordability reason').is.true;
    expect(
      reasons.some((r) => r.message === 'No card with the building symbol to copy production from'),
      'expected the copy-target reason alongside it').is.true;
  });
});
