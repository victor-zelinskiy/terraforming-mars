import {expect} from 'chai';
import {
  promptCommitLabelKey, promptOutcomeLabelKey, promptToneOf, promptToneTagKey, promptToneWithin,
} from '../../src/client/console/promptTone';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';

/**
 * THE PROMPT TONE — a decision's character (gain / loss / neutral) read off STRUCTURAL markers only (cross-cutting
 * invariant 1: never a title). The owner's case: a tile beside an Ares hazard owned by Philares asks a REWARD and then a
 * PENALTY, and the two must never read as the same kind of screen.
 */
const as = (v: unknown) => v as PlayerInputModel;

const philares = as({
  type: 'resources', title: {message: 'Gain ${0} standard resources', data: [{type: 1, value: '1'}]}, buttonLabel: 'Select', count: 1,
  choiceContext: {source: {kind: 'corporation', card: 'Philares'}, mode: 'reward'},
});
const hazard = as({
  type: 'productionToLose', title: 'Choose 1 unit(s) of production to lose', buttonLabel: 'Save',
  payProduction: {cost: 1, units: {megacredits: 3, steel: 1, titanium: 0, plants: 0, energy: 0, heat: 0}},
  source: {type: 'hazard'},
});
const option = (title: string, effects?: Array<{direction: 'cost' | 'gain', icon: string, amount: number}>, kind?: string) =>
  ({type: 'option', title, buttonLabel: 'Confirm', metadata: {effects, kind}});
const or = (options: Array<unknown>, mode?: string) => as({
  type: 'or', title: 'Choose', buttonLabel: 'Confirm', options,
  ...(mode !== undefined ? {choiceContext: {source: {kind: 'card', card: 'Pharmacy Union'}, mode}} : {}),
});

describe('promptTone', () => {
  it('THE OWNER\'S PAIR: Philares\' distribution is a GAIN, the hazard\'s production loss a LOSS', () => {
    expect(promptToneOf(philares)).to.deep.eq({tone: 'gain', basis: 'reward-mode'});
    expect(promptToneOf(hazard)).to.deep.eq({tone: 'loss', basis: 'production-loss'});
  });

  it('a resource distribution is a gain even without a context marker (the behavior DSL\'s standardResource)', () => {
    expect(promptToneOf(as({type: 'resources', title: 'x', buttonLabel: 'Select', count: 2}))).to.deep.eq({tone: 'gain', basis: 'resource-gain'});
  });

  it('a single resource pick is a gain by its GAIN marker (TR54 — `amount`), never by its title; unmarked it stays neutral', () => {
    const include = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];
    expect(promptToneOf(as({type: 'resource', title: 'x', buttonLabel: 'Select', include, amount: 2}))).to.deep.eq({tone: 'gain', basis: 'resource-gain'});
    expect(promptToneOf(as({type: 'resource', title: 'Select resource to discard', buttonLabel: 'Select', include})).tone).to.eq('neutral');
  });

  it('a card attack on the viewer\'s production is a loss — Caesar as the hazard', () => {
    expect(promptToneOf(as({...(hazard as object), source: {type: 'card', card: 'Caesar'}})).tone).to.eq('loss');
  });

  it('a MarsBot attack is a loss whatever its input type', () => {
    expect(promptToneOf(as({type: 'card', title: 'x', buttonLabel: 'Remove', cards: [], min: 1, max: 1, botAttackPrompt: {}})))
      .to.deep.eq({tone: 'loss', basis: 'bot-attack'});
  });

  it('a forced discard that STANDS ALONE is a loss; a discard that BUYS something is a trade (neutral); an optional one a free choice', () => {
    const card = {type: 'card', title: 'x', buttonLabel: 'Discard', cards: [], min: 1, max: 1};
    expect(promptToneOf(as({...card, discardPrompt: {min: 1, max: 1}})).tone).to.eq('loss');
    // Hygiea's colony effect on the VICTIM — no pair, no price of their own: a loss.
    expect(promptToneOf(as({...card, discardPrompt: {min: 1, max: 1, source: {kind: 'colony', colony: 'Hygiea'}}}))).to.deep.eq({tone: 'loss', basis: 'forced-discard'});
    expect(promptToneOf(as({...card, discardPrompt: {min: 1, max: 1, exchange: {icon: 'cards', amount: 1}}})).tone).to.eq('neutral');
    expect(promptToneOf(as({...card, discardPrompt: {min: 0, max: 1}})).tone).to.eq('neutral');
  });

  it('THE TONE IS THE NET OF THE DECISION: Pluto\'s «draw 1, discard 1» closes a pair — neutral, the verb «Discard», never «Accept the loss»', () => {
    const card = {type: 'card', title: 'x', buttonLabel: 'Discard', cards: [], min: 1, max: 1};
    const pluto = as({...card, discardPrompt: {min: 1, max: 1, source: {kind: 'colony', colony: 'Pluto'}, colonyBonus: {colonyName: 'Pluto'}}});
    expect(promptToneOf(pluto)).to.deep.eq({tone: 'neutral', basis: 'draw-pair'});
    expect(promptToneTagKey(promptToneOf(pluto).tone), 'no «УБЫТОК» tag').to.be.undefined;
    expect(promptCommitLabelKey(promptToneOf(pluto).tone, 'Discard')).to.eq('Discard');
    // Colonial Affairs pays Pluto's bonus N times — each repeat is the same pair.
    const repeat = as({...card, discardPrompt: {min: 1, max: 1, source: {kind: 'resolution'}, colonyRepeat: {colonyName: 'Pluto', index: 1, total: 2}}});
    expect(promptToneOf(repeat)).to.deep.eq({tone: 'neutral', basis: 'draw-pair'});
  });

  it('a discard that is the PRICE of the player\'s own play (Old Mining Colony, Project Eden) is a chosen price — neutral', () => {
    const card = {type: 'card', title: 'x', buttonLabel: 'Discard', cards: [], min: 1, max: 1};
    expect(promptToneOf(as({...card, discardPrompt: {min: 1, max: 1, source: {kind: 'card', card: 'Old Mining Colony'}}})))
      .to.deep.eq({tone: 'neutral', basis: 'chosen-price'});
    expect(promptToneOf(as({...card, min: 3, max: 3, discardPrompt: {min: 3, max: 3, source: {kind: 'card', card: 'Project Eden'}}})).tone).to.eq('neutral');
  });

  it('an Ares adjacency card pick (a resource onto a card) is a gain', () => {
    expect(promptToneOf(as({type: 'card', title: 'x', buttonLabel: 'Add', cards: [], min: 1, max: 1, resourceGainPrompt: {amount: 1}})).tone)
      .to.eq('gain');
  });

  it('an attack the viewer AIMS is their own free choice — the victim\'s prompt is the loss, never the aimer\'s', () => {
    const aimed = or([option('Remove 3 plants', [{direction: 'cost', icon: 'plants', amount: 3}])], 'attack');
    expect(promptToneOf(aimed)).to.deep.eq({tone: 'neutral', basis: 'aimed-attack'});
  });

  it('an `or` is read off its answers\' effects — all gains, all costs, or a free choice; the decline never counts', () => {
    const gainA = option('Take 2 steel', [{direction: 'gain', icon: 'steel', amount: 2}]);
    const gainB = option('Take 1 titanium', [{direction: 'gain', icon: 'titanium', amount: 1}]);
    const costA = option('Lose 2 plants', [{direction: 'cost', icon: 'plants', amount: 2}]);
    const costB = option('Lose 3 M€', [{direction: 'cost', icon: 'megacredits', amount: 3}]);
    const trade = option('Pay 3 M€, draw 1', [{direction: 'cost', icon: 'megacredits', amount: 3}, {direction: 'gain', icon: 'cards', amount: 1}]);
    const skip = option('Do nothing', undefined, 'skip');
    expect(promptToneOf(or([gainA, gainB, skip]))).to.deep.eq({tone: 'gain', basis: 'options-gain'});
    expect(promptToneOf(or([costA, costB]))).to.deep.eq({tone: 'loss', basis: 'options-loss'});
    expect(promptToneOf(or([gainA, costA])).tone).to.eq('neutral');
    expect(promptToneOf(or([trade, skip])).tone).to.eq('neutral');
    // An option the client cannot read (no effects declared) is never guessed.
    expect(promptToneOf(or([gainA, option('Something')])).tone).to.eq('neutral');
  });

  it('a nested input inside an `or` keeps its own character', () => {
    expect(promptToneOf(or([hazard, as(option('Lose 2 plants', [{direction: 'cost', icon: 'plants', amount: 2}]))])).tone).to.eq('loss');
  });

  it('a wizard step keeps its own character, else the decision\'s', () => {
    const parent = or([option('Steel', [{direction: 'gain', icon: 'steel', amount: 1}]), option('Titanium', [{direction: 'gain', icon: 'titanium', amount: 1}])]);
    expect(promptToneWithin(parent, undefined)).to.eq('gain');
    expect(promptToneWithin(parent, hazard)).to.eq('loss');
    expect(promptToneWithin(parent, as({type: 'player', title: 'x', buttonLabel: 'x', players: []}))).to.eq('gain');
  });

  it('a payment, a plain amount and an unknown prompt are free choices', () => {
    expect(promptToneOf(as({type: 'payment', title: 'x', buttonLabel: 'Pay', amount: 3})).tone).to.eq('neutral');
    expect(promptToneOf(as({type: 'amount', title: 'x', buttonLabel: 'Ok', min: 0, max: 3})).tone).to.eq('neutral');
    expect(promptToneOf(undefined)).to.deep.eq({tone: 'neutral', basis: 'none'});
  });

  it('every tone speaks its own words: tag, footer, commit', () => {
    expect(promptToneTagKey('gain')).to.eq('Benefit');
    expect(promptToneTagKey('loss')).to.eq('Loss');
    expect(promptToneTagKey('neutral')).to.be.undefined;
    expect(promptOutcomeLabelKey('gain')).to.eq('You will gain');
    expect(promptOutcomeLabelKey('loss')).to.eq('You will lose');
    expect(promptOutcomeLabelKey('neutral')).to.eq('Outcome');
    // A loss is ACCEPTED — never the same verb as taking a reward.
    expect(promptCommitLabelKey('loss', 'Confirm')).to.eq('Accept the loss');
    expect(promptCommitLabelKey('gain', 'Collect')).to.eq('Collect');
  });
});
