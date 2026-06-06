import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Resource} from '../../src/common/Resource';
import {actionUnavailableReasons} from '../../src/server/models/actionUnavailableReasons';
import {AICentral} from '../../src/server/cards/base/AICentral';
import {Ants} from '../../src/server/cards/base/Ants';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {UnitedNationsMarsInitiative} from '../../src/server/cards/corporation/UnitedNationsMarsInitiative';
import {PowerInfrastructure} from '../../src/server/cards/base/PowerInfrastructure';
import {Predators} from '../../src/server/cards/base/Predators';

describe('actionUnavailableReasons', () => {
  it('returns no reasons when the action can be taken', () => {
    const [/* game */, player] = testGame(2);
    // AI Central just draws 2 cards — always actionable (deck is full).
    expect(actionUnavailableReasons(player, new AICentral())).has.length(0);
  });

  it('declarative card: surfaces "no target" for addResourcesToAnyCard (Dirigibles)', () => {
    const [/* game */, player] = testGame(2);
    // No floater-holding card in play → the action has no valid target.
    const reasons = actionUnavailableReasons(player, new Dirigibles());
    const target = reasons.find((r) => r.type === 'target');
    expect(target, 'expected a target reason').is.not.undefined;
  });

  it('bespoke card: Ants reports no microbe to remove', () => {
    const [/* game */, player] = testGame(2);
    const reasons = actionUnavailableReasons(player, new Ants());
    const target = reasons.find((r) => r.type === 'target');
    expect(target, 'expected a target reason').is.not.undefined;
    expect(target?.message).eq('No card has a microbe to remove');
  });

  it('bespoke corp: UNMI reports the TR-not-raised rule', () => {
    const [/* game */, player] = testGame(2);
    // Fresh generation — TR not raised yet.
    const reasons = actionUnavailableReasons(player, new UnitedNationsMarsInitiative());
    const rule = reasons.find((r) => r.message === 'Your terraform rating was not raised this generation');
    expect(rule, 'expected the TR-not-raised rule').is.not.undefined;
  });

  it('bespoke corp: UNMI reports the affordability gap once TR was raised', () => {
    const [/* game */, player] = testGame(2);
    player.hasIncreasedTerraformRatingThisGeneration = true;
    player.megaCredits = 0;
    const reasons = actionUnavailableReasons(player, new UnitedNationsMarsInitiative());
    const mc = reasons.find((r) => r.type === 'megacredits');
    expect(mc, 'expected a megacredits reason').is.not.undefined;
  });

  it('co-located hook: Power Infrastructure reports not-enough-energy', () => {
    const [/* game */, player] = testGame(2);
    player.energy = 0;
    const reasons = actionUnavailableReasons(player, new PowerInfrastructure());
    const energy = reasons.find((r) => r.type === 'resource' && r.resource === Resource.ENERGY);
    expect(energy, 'expected an energy reason').is.not.undefined;
  });

  it('co-located hook: Predators reports no animal to remove', () => {
    const [/* game */, player] = testGame(2);
    const reasons = actionUnavailableReasons(player, new Predators());
    const target = reasons.find((r) => r.message === 'No card has an animal to remove');
    expect(target, 'expected the no-animal reason').is.not.undefined;
  });

  it('never returns an empty-but-unavailable result (honest generic fallback)', () => {
    const [/* game */, player] = testGame(2);
    // Ants in solo would be actionable; in 2p with no microbes it is not, and a
    // reason is always present.
    const reasons = actionUnavailableReasons(player, new Ants());
    expect(reasons.length).is.greaterThan(0);
  });
});
