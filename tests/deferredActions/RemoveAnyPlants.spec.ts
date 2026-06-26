import {expect} from 'chai';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {RemoveAnyPlants} from '../../src/server/deferredActions/RemoveAnyPlants';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {BotanicalExperience} from '../../src/server/cards/pathfinders/BotanicalExperience';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {formatMessage} from '../TestingUtils';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {cast} from '@/common/utils/utils';

describe('RemoveAnyPlants', () => {
  let player: TestPlayer;
  let target: TestPlayer;

  beforeEach(() => {
    [/* game */, player, target] = testGame(3);
  });

  it('no plants', () => {
    // Nobody has plants, so the caller isn't asked to do anything.
    cast(new RemoveAnyPlants(player, 2).execute(), undefined);
  });

  const executeRuns = [
    {plants: [0, 5], count: 2, options: 2, selected: 0, expected: [0, 3]},
    {plants: [0, 5], count: 2, options: 2, selected: 1, expected: [0, 5]},
    {plants: [0, 5], count: 7, options: 2, selected: 0, expected: [0, 0]},
    {plants: [5, 5], count: 2, options: 3, selected: 0, expected: [5, 3]},
    {plants: [5, 5], count: 2, options: 3, selected: 1, expected: [5, 5]},
    {plants: [5, 5], count: 2, options: 3, selected: 2, expected: [3, 5]},
  ] as const;
  for (const run of executeRuns) {
    it('execute ' + JSON.stringify(run), () => {
      player.plants = run.plants[0];
      target.plants = run.plants[1];
      const orOptions = cast(new RemoveAnyPlants(player, run.count).execute(), OrOptions);

      expect(orOptions.options).has.length(run.options);
      expect(formatMessage(orOptions.options[0].title)).matches(/Remove . plants from red/);
      expect(formatMessage(orOptions.options[1].title)).eq('Skip removing plants');
      if (run.options === 3) {
        const selectOption = cast(orOptions.options[2], SelectOption);
        expect(formatMessage(selectOption.title)).matches(/Remove . plants from blue/);
        expect(selectOption.warnings).contains('removeOwnPlants');
      }
      orOptions.options[run.selected].cb();
      expect(player.plants).eq(run.expected[0]);
      expect(target.plants).eq(run.expected[1]);
    });
  }

  it('Protected Habitats — protected opponent is SHOWN as a disabled target, not silently skipped', () => {
    target.plants = 10;
    target.playedCards.push(new ProtectedHabitats());
    // The prompt is no longer silently skipped: it shows the protected opponent as a
    // non-selectable target with a reason, so the attacker isn't left wondering why
    // nothing happened (and can't mistakenly target themselves).
    const orOptions = cast(new RemoveAnyPlants(player, 4).execute(), OrOptions);
    // Player has no plants, no valid opponent → only the skip option is selectable.
    expect(orOptions.options).has.length(1);
    expect(formatMessage(orOptions.options[0].title)).eq('Skip removing plants');
    // The protected opponent appears in the disabled list with the protection reason.
    expect(orOptions.disabledOptions.some((d) => d.reason === 'Plants are protected')).is.true;
    // Skipping changes nothing.
    orOptions.options[0].cb();
    expect(target.plants).eq(10);
  });

  it('2-player: protected opponent shown disabled; attacker can still skip / self-target, opponent untouched', () => {
    const [/* g */, p1, p2] = testGame(2);
    p2.plants = 8;
    p2.playedCards.push(new ProtectedHabitats());
    p1.plants = 4;
    const orOptions = cast(new RemoveAnyPlants(p1, 4).execute(), OrOptions);
    // The protected opponent is a greyed, non-selectable target (never hidden / auto-skipped).
    expect(orOptions.disabledOptions.some((d) => d.reason === 'Plants are protected')).is.true;
    // Selectable options are ONLY skip + the attacker's own plants (clearly warned),
    // never the protected opponent.
    expect(orOptions.options).has.length(2);
    expect(formatMessage(orOptions.options[0].title)).eq('Skip removing plants');
    const ownOption = cast(orOptions.options[1], SelectOption);
    expect(ownOption.warnings).contains('removeOwnPlants');
    orOptions.options[0].cb();
    expect(p2.plants).eq(8);
  });

  it('2-player: opponent merely out of plants (not protected) → silent no-op (no modal spam)', () => {
    const [/* g */, p1, p2] = testGame(2);
    p2.plants = 0;
    p1.plants = 4;
    // Nobody is protected and no opponent has plants — an expected, non-informative
    // situation, so no prompt is raised (unlike the protection case above).
    cast(new RemoveAnyPlants(p1, 4).execute(), undefined);
  });

  it('Botanical Experience', () => {
    target.plants = 10;
    target.playedCards.push(new BotanicalExperience());
    const orOptions = cast(new RemoveAnyPlants(player, 4).execute(), OrOptions);
    const option = orOptions.options[0];
    expect(formatMessage(option.title)).eq('Remove 2 plants from red');
    option.cb();
    expect(target.plants).eq(8);
  });
});
