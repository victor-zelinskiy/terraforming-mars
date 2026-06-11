import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {
  cardHasAction,
  playerActions,
  playerActionGroups,
  playerActionSourceCount,
  allScopeActionCardNames,
  overriddenActionCards,
  flaggedActionCandidates,
  branchActionNode,
} from '@/client/components/actions/actionExtraction';
import {ICardRenderEffect, isICardRenderSymbol} from '@/common/cards/render/Types';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';

function opensWithOr(node: ICardRenderEffect): boolean {
  const first = node.rows[0]?.[0];
  return first !== undefined && isICardRenderSymbol(first) && first.type === CardRenderSymbolType.OR;
}

function model(name: CardName, isDisabled = false): CardModel {
  return {name, isDisabled} as CardModel;
}

describe('actionExtraction', () => {
  it('detects a clean blue-card action with a render node (AI Central)', () => {
    expect(cardHasAction(CardName.AI_CENTRAL)).to.eq(true);
    const entries = playerActions([model(CardName.AI_CENTRAL)]);
    expect(entries.length).to.be.greaterThan(0);
    expect(entries[0].actionNode).to.not.eq(undefined);
    expect(entries[0].isCorporation).to.eq(false);
  });

  it('excludes effect-only / passive blue cards (no action)', () => {
    expect(cardHasAction(CardName.SPACE_STATION)).to.eq(false);
    expect(playerActions([model(CardName.SPACE_STATION)])).to.have.length(0);
  });

  it('detects a corporation action (United Nations Mars Initiative)', () => {
    expect(cardHasAction(CardName.UNITED_NATIONS_MARS_INITIATIVE)).to.eq(true);
    const entries = playerActions([model(CardName.UNITED_NATIONS_MARS_INITIATIVE)]);
    expect(entries.length).to.be.greaterThan(0);
    expect(entries[0].isCorporation).to.eq(true);
    expect(entries[0].actionNode).to.not.eq(undefined);
  });

  it('orders corporation actions before card actions', () => {
    const entries = playerActions([model(CardName.AI_CENTRAL), model(CardName.UNITED_NATIONS_MARS_INITIATIVE)]);
    expect(entries[0].isCorporation).to.eq(true); // corp first
    expect(entries[1].isCorporation).to.eq(false);
  });

  it('groups an `or` action (Aerial Mappers) into ONE source with several nodes', () => {
    const groups = playerActionGroups([model(CardName.AERIAL_MAPPERS)]);
    expect(groups).to.have.length(1);
    expect(groups[0].cardName).to.eq(CardName.AERIAL_MAPPERS);
    expect(groups[0].nodes.length).to.be.greaterThan(1); // two action alternatives, one source
  });

  it('counts action SOURCES (one per card, not per node)', () => {
    expect(playerActionSourceCount([
      model(CardName.UNITED_NATIONS_MARS_INITIATIVE),
      model(CardName.AI_CENTRAL),
      model(CardName.AERIAL_MAPPERS), // multi-node, still ONE source
      model(CardName.SPACE_STATION), // no action — excluded
    ])).to.eq(3);
  });

  it('flags a disabled card so it can be dimmed', () => {
    const groups = playerActionGroups([model(CardName.AI_CENTRAL, true)]);
    expect(groups[0].isDisabled).to.eq(true);
  });

  it('enumerates a substantial set of in-scope action cards for the playground', () => {
    expect(allScopeActionCardNames().length).to.be.greaterThan(30);
  });

  it('AUDIT: every in-scope action card has an extractable action graphic', () => {
    const flagged = flaggedActionCandidates();
    // Log any remaining flagged cards so the playground "flagged" tab matches;
    // an empty list means every in-scope action card renders cleanly (generic
    // scan or override).
    if (flagged.length > 0) {
      console.log('Flagged action cards (no clean action node):', flagged.join(', '));
    }
    // The two bespoke-render cards (raw text / raw rows) are covered by an
    // override, so nothing falls back to a misleading description.
    expect(flagged).to.have.length(0);
  });

  it('covers the bespoke-render edge cases via overrides', () => {
    const overridden = overriddenActionCards();
    // Arcadian Communities still needs a text override (action drawn as raw ce.text()).
    expect(cardHasAction(CardName.ARCADIAN_COMMUNITIES)).to.eq(true);
    expect(overridden).to.include(CardName.ARCADIAN_COMMUNITIES);
    expect(flaggedActionCandidates()).to.not.include(CardName.ARCADIAN_COMMUNITIES);
    expect(playerActions([model(CardName.ARCADIAN_COMMUNITIES)])[0].text).to.not.eq(undefined);

    // Weather Balloons now uses proper action() boxes — generic scan picks it up,
    // no override needed.
    expect(cardHasAction(CardName.WEATHER_BALLOONS)).to.eq(true);
    expect(overridden).to.not.include(CardName.WEATHER_BALLOONS);
    expect(flaggedActionCandidates()).to.not.include(CardName.WEATHER_BALLOONS);
    const wbActions = playerActions([model(CardName.WEATHER_BALLOONS)]);
    expect(wbActions.length).to.be.greaterThan(0);
    expect(wbActions[0].actionNode).to.not.eq(undefined);
  });

  it('strips the leading OR connector from a split `or`-action branch (Weather Balloons)', () => {
    // Weather Balloons draws its second action box opening with `or()` so the FULL
    // card reads "box1 OR box2". The overlay/confirm modal split the boxes into
    // their own per-branch blocks, where that leading OR is orphaned.
    const nodes = playerActionGroups([model(CardName.WEATHER_BALLOONS)])[0].nodes;
    const withOr = nodes.find((n) => n.actionNode !== undefined && opensWithOr(n.actionNode));
    expect(withOr, 'expected an action node opening with OR').to.not.eq(undefined);
    const original = withOr!.actionNode as ICardRenderEffect;

    const stripped = branchActionNode(original);
    // The leading OR is gone; the rest of the cause (the spent floater) remains.
    expect(opensWithOr(stripped)).to.eq(false);
    expect(stripped.rows[0].length).to.eq(original.rows[0].length - 1);
    // Delimiter (the action arrow) + effect rows are untouched.
    expect(stripped.rows[1]).to.eq(original.rows[1]);
    expect(stripped.rows[2]).to.eq(original.rows[2]);
    // The shared manifest node is NOT mutated.
    expect(opensWithOr(original)).to.eq(true);
  });

  it('returns an action node WITHOUT a leading OR unchanged (identity)', () => {
    const nodes = playerActionGroups([model(CardName.WEATHER_BALLOONS)])[0].nodes;
    const noOr = nodes.find((n) => n.actionNode !== undefined && !opensWithOr(n.actionNode));
    expect(noOr, 'expected an action node without a leading OR').to.not.eq(undefined);
    const original = noOr!.actionNode as ICardRenderEffect;
    expect(branchActionNode(original)).to.eq(original);
  });
});
