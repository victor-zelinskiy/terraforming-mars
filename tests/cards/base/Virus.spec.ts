import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {Birds} from '../../../src/server/cards/base/Birds';
import {Predators} from '../../../src/server/cards/base/Predators';
import {ProtectedHabitats} from '../../../src/server/cards/base/ProtectedHabitats';
import {Virus} from '../../../src/server/cards/base/Virus';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {TabbedTargetsStep} from '../../../src/common/models/ActionPreviewModel';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';

describe('Virus', () => {
  let card: Virus;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    card = new Virus();
    [/* game */, player, player2] = testGame(2);
  });

  it('Should play', () => {
    const birds = new Birds();
    const predators = new Predators();
    player.playedCards.push(birds, predators);
    player.addResourceTo(birds);
    player.addResourceTo(predators);
    player.plants = 5;

    const orOptions = cast(card.play(player2), OrOptions);

    orOptions.options[0].cb([birds]);
    expect(birds.resourceCount).to.eq(0);

    orOptions.options[1].cb();
    expect(player.plants).to.eq(0);
  });

  it('Can play when no other player has resources', () => {
    player.plants = 5;
    cast(card.play(player), undefined);
    expect(player.plants).to.eq(5);
  });

  it('Works in solo mode', () => {
    const [game, player] = testGame(1);
    expect(card.canPlay(player)).is.true;
    cast(card.play(player), undefined);
    expect(game.someoneHasRemovedOtherPlayersPlants).is.true;
  });

  it('cardPlayPreview: a plant-protected opponent is shown as a disabled plant target (not hidden)', () => {
    const [/* game */, p1, p2, p3] = testGame(3);
    p2.plants = 7;
    p2.playedCards.push(new ProtectedHabitats());
    p3.plants = 5; // a valid plant target keeps the (mandatory) tab satisfiable.

    const steps = card.cardPlayPreview(p1).branches[0].steps;
    const tabbed = steps.find((s): s is TabbedTargetsStep => s.kind === 'tabbedTargets');
    expect(tabbed, 'tabbed step present').to.exist;
    expect(tabbed!.plant, 'plant tab present').to.exist;
    // p3 is a selectable target; p2 is shown greyed as protected (never hidden).
    const selectable = tabbed!.plant!.targets.find((t) => t.color === p3.color);
    expect(selectable?.disabled, 'valid opponent is selectable').to.not.equal(true);
    const disabled = tabbed!.plant!.targets.find((t) => t.disabled === true);
    expect(disabled, 'protected opponent shown as a disabled plant row').to.exist;
    expect(disabled!.reason).eq('Plants are protected');
    expect(disabled!.color).eq(p2.color);
  });

  it('cardPlayPreview: protected opponent and nothing else actionable → a warning (no silent no-op)', () => {
    player2.plants = 7;
    player2.playedCards.push(new ProtectedHabitats());
    const branch = card.cardPlayPreview(player).branches[0];
    // No actionable target → no (mandatory) tab, but a warning surfaces the protection
    // instead of the play silently doing nothing.
    expect(branch.steps.some((s) => s.kind === 'tabbedTargets')).is.false;
    expect(branch.steps.some((s) => s.kind === 'note' && s.noteKind === 'warning')).is.true;
  });
});
