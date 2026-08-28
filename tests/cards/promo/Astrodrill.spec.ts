import {expect} from 'chai';
import {runAllActions, testGame} from '../../TestingUtils';
import {ICard} from '../../../src/server/cards/ICard';
import {Astrodrill} from '../../../src/server/cards/promo/Astrodrill';
import {CometAiming} from '../../../src/server/cards/promo/CometAiming';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {cast} from '../../../src/common/utils/utils';

describe('Astrodrill', () => {
  let card: Astrodrill;
  let player: TestPlayer;

  beforeEach(() => {
    card = new Astrodrill();
    [/* game */, player/* , player2 */] = testGame(2);
    player.playedCards.push(card);
    card.play(player);
    runAllActions(player.game);
  });

  it('Starts with 3 asteroid resources', () => {
    expect(card.resourceCount).to.eq(3);
  });

  it('Should play - can spend asteroid resource', () => {
    const action = cast(card.action(player), OrOptions);
    expect(action.options).has.lengthOf(3);

    // spend asteroid resource
    const spendAsteroidOption = action.options[0];
    spendAsteroidOption.cb();
    expect(player.titanium).to.eq(3);
    expect(player.game.deferredActions).has.lengthOf(0);
  });

  it('Should play - the single candidate (self) is STILL shown (no auto-select)', () => {
    const action = cast(card.action(player), OrOptions);
    expect(action.options).has.lengthOf(3);

    // Even with one candidate (this card), the player picks it via the SelectCard.
    const addAsteroidOption = cast(action.options[1], SelectCard<ICard>);
    expect(addAsteroidOption.cards).deep.eq([card]);
    const result = addAsteroidOption.cb([card]);
    expect(card.resourceCount).to.eq(4);
    expect(result).is.undefined;
  });

  it('Should play - can add asteroid resource to other card', () => {
    const cometAiming = new CometAiming();
    player.playedCards.push(cometAiming);

    const action = cast(card.action(player), OrOptions);
    const addAsteroidOption = cast(action.options[1], SelectCard<ICard>);

    const result = addAsteroidOption.cb([cometAiming]);
    expect(cometAiming.resourceCount).to.eq(1);
    expect(result).is.undefined;
  });

  it('Should play - can gain a standard resource', () => {
    const action = cast(card.action(player), OrOptions);
    expect(action.options).has.lengthOf(3);

    const resourceChoices = cast(action.options[2].cb(), OrOptions);
    expect(resourceChoices.options).has.lengthOf(6);

    resourceChoices.options[1].cb();
    expect(player.steel).to.eq(1);

    resourceChoices.options[4].cb();
    expect(player.heat).to.eq(1);
  });

  /*
   * The «which standard resource» pick is PRE-COLLECTED: it is declared as the
   * branch's own step, so the console composer hosts it inside the workspace and
   * the batch answers it in the same submit. Left undeclared it arrived after the
   * confirm as a bare generic band — the exact failure the pre-collect contract
   * exists to prevent (guarded corpus-wide by actionPromptCoverage.spec).
   */
  it('the resource pick is a DECLARED step of the branch, not a follow-up', () => {
    const preview = card.actionPreview(player);
    const branch = preview.branches[2];
    expect(branch.title).to.eq('Gain a standard resource');
    expect(branch.steps).has.lengthOf(1);
    const step = branch.steps[0];
    expect(step.kind).to.eq('input');
    const input = (step as {input: {type: string, options: ReadonlyArray<unknown>}}).input;
    expect(input.type).to.eq('or');
    expect(input.options).has.lengthOf(6);
  });

  it('every option carries premium metadata — the icon AND this player\'s before→after', () => {
    player.titanium = 4;
    const step = card.actionPreview(player).branches[2].steps[0] as
      {input: {options: ReadonlyArray<{title: unknown, metadata?: {icon?: string, effects?: ReadonlyArray<{current?: number, resulting?: number}>}}>}};
    // Branch order mirrors `action()`: titanium first.
    const titanium = step.input.options[0];
    expect(titanium.metadata?.icon).to.eq('titanium');
    expect(titanium.metadata?.effects?.[0].current).to.eq(4);
    expect(titanium.metadata?.effects?.[0].resulting).to.eq(5);
    // …and every one of the six is premium, not just the first.
    for (const opt of step.input.options) {
      expect(opt.metadata?.icon, String(opt.title)).to.be.a('string');
      expect(opt.metadata?.effects, String(opt.title)).has.lengthOf(1);
    }
  });

  it('the preview\'s OrOptions is READ-ONLY — building it grants nothing', () => {
    const before = {ti: player.titanium, st: player.steel, pl: player.plants, mc: player.megaCredits};
    card.actionPreview(player);
    expect(player.titanium).to.eq(before.ti);
    expect(player.steel).to.eq(before.st);
    expect(player.plants).to.eq(before.pl);
    expect(player.megaCredits).to.eq(before.mc);
  });
});
