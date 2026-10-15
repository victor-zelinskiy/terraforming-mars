import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {ActionFutility, ActionFutilityVerdict} from '@/common/models/ActionFutilityModel';
import {arrangeGroupsForGrid, buildConsoleActionsModel, defaultCardActionsFilter} from '@/client/console/consoleCardActions';
import {countTone} from '@/client/console/potentialAvailability';
import {variantQuiet} from '@/client/console/variantChoiceModel';

/*
 * THE FUTILE BAND (the owner's decision of 2026-10-15): an action the server PROVED changes nothing right now stays
 * listed and activatable, but its card sinks below the blocked ones, its variants carry the verdict, and the header's
 * count keeps the number while losing its «go» register.
 */

const MAXED: ActionFutilityVerdict = {kind: 'parameter-maxed', parameter: 'temperature', reason: 'The temperature is at its maximum'};
const NO_RESOURCES = new Map<CardName, {type: CardResource, count: number}>();

function entry(cardName: string, status: ActionStatus, nodes: number, futility?: ActionFutility): ActionEntry {
  return {
    group: {
      key: cardName,
      cardName: cardName as CardName,
      isCorporation: false,
      isDisabled: false,
      nodes: Array.from({length: nodes}, (_v, i) => ({key: cardName + '#' + i, actionNode: undefined, renderRoot: undefined, text: 'act ' + i})),
    },
    cardName: cardName as CardName,
    isCorporation: false,
    state: {status, activatable: status === 'available', reasons: [], softReason: undefined},
    ...(futility !== undefined ? {futility} : {}),
  };
}

function branch(index: number, available: boolean, title: string): ActionPreviewBranch {
  return {index, title, available, renderKeys: [], effects: [], steps: []};
}

describe('consoleCardActions — the futile band', () => {
  it('a whole-futile card sinks below the blocked ones and stays available', () => {
    const entries = [
      entry('Heater', 'available', 1, {verdict: MAXED}),
      entry('Blocked', 'rules', 1),
      entry('Useful', 'available', 1),
    ];
    const model = buildConsoleActionsModel(entries, new Map(), NO_RESOURCES, defaultCardActionsFilter());
    expect(model.groups.map((g) => g.cardName)).deep.eq(['Useful', 'Blocked', 'Heater']);
    const heater = model.groups[2];
    expect(heater.futile).deep.eq(MAXED);
    expect(heater.tiles[0].status, 'still a live verb').eq('available');
    expect(heater.tiles[0].futile).deep.eq(MAXED);
    expect(model.availableTiles, 'the count keeps every allowed action').eq(2);
    expect(model.futileTiles).eq(1);
  });

  it('a card with one live branch that does something is not futile; only the futile variant carries the verdict', () => {
    const futility: ActionFutility = {branches: [{futile: true, verdict: MAXED}, {futile: false}]};
    const previews = new Map<CardName, ActionPreview>([[
      'Pair' as CardName,
      {card: 'Pair' as CardName, isCorporation: false, kind: 'declarative', branches: [branch(0, true, 'act 0'), branch(1, true, 'act 1')]},
    ]]);
    const model = buildConsoleActionsModel([entry('Pair', 'available', 2, futility)], previews, NO_RESOURCES, defaultCardActionsFilter());
    const [g] = model.groups;
    expect(g.futile, 'the card sorts with the useful ones').eq(undefined);
    expect(g.tiles[0].futile).deep.eq(MAXED);
    expect(g.tiles[1].futile).eq(undefined);
    expect(model.futileTiles).eq(1);
  });

  it('a blocked variant is never painted futile — it already says why', () => {
    const futility: ActionFutility = {verdict: MAXED, branches: [{futile: true, verdict: MAXED}, {futile: false}]};
    const previews = new Map<CardName, ActionPreview>([[
      'Pair' as CardName,
      {card: 'Pair' as CardName, isCorporation: false, kind: 'declarative', branches: [branch(0, true, 'act 0'), branch(1, false, 'act 1')]},
    ]]);
    const model = buildConsoleActionsModel([entry('Pair', 'available', 2, futility)], previews, NO_RESOURCES, defaultCardActionsFilter());
    const [g] = model.groups;
    expect(g.tiles[0].futile).deep.eq(MAXED);
    expect(g.tiles[1].status).eq('rules');
    expect(g.tiles[1].futile).eq(undefined);
  });

  it('the repeat pick ignores the verdict (a copy is its own question)', () => {
    const model = buildConsoleActionsModel([entry('Heater', 'activated', 1, {verdict: MAXED})], new Map(), NO_RESOURCES,
      {availability: 'all', activation: 'activated'},
      {candidates: new Set(['Heater' as CardName]), used: new Set(['Heater' as CardName])});
    expect(model.groups[0].futile).eq(undefined);
    expect(model.groups[0].tiles[0].futile).eq(undefined);
  });

  it('the grid filler never pulls a futile single into a useful band', () => {
    const groups = [
      {key: 'a', tiles: [1], sortStatus: 'available' as ActionStatus},
      {key: 'wide', tiles: [1, 2], sortStatus: 'available' as ActionStatus},
      {key: 'f', tiles: [1], sortStatus: 'available' as ActionStatus, futile: MAXED},
    ];
    expect(arrangeGroupsForGrid(groups).map((g) => g.key)).deep.eq(['a', 'wide', 'f']);
  });

  it('countTone: white only when every counted action is futile', () => {
    expect(countTone(0, 0)).eq('go');
    expect(countTone(3, 2)).eq('go');
    expect(countTone(3, 3)).eq('neutral');
  });

  it('variantQuiet: a live option with a reason, never a refused one', () => {
    expect(variantQuiet({state: {focused: false, selected: false, off: false}, quiet: 'x'})).eq(true);
    expect(variantQuiet({state: {focused: false, selected: false, off: true}, quiet: 'x'})).eq(false);
    expect(variantQuiet({state: {focused: false, selected: false, off: false}})).eq(false);
  });
});
