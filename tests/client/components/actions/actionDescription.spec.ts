import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {playerActionGroups} from '@/client/components/actions/actionExtraction';
import {actionRules, actionRuleText, ACTION_RULE_LABEL} from '@/client/components/actions/actionDescription';
import {CardModel} from '@/common/models/CardModel';

function groupOf(name: CardName) {
  const group = playerActionGroups([{name} as CardModel])[0];
  expect(group, `no action group for ${name}`).to.not.eq(undefined);
  return group;
}

describe('actionDescription — the rule text of ONE action', () => {
  it('a two-action card gives each variant ITS OWN text, never the card‘s whole wording', () => {
    // Extreme Cold Fungus draws two action boxes: «gain 1 plant» / «add 2
    // microbes to ANOTHER card». Addressing must follow the NODE.
    const group = groupOf(CardName.EXTREME_COLD_FUNGUS);
    expect(group.nodes.length).to.eq(2);
    const first = actionRules(group, 0);
    const second = actionRules(group, 1);
    expect(first?.summary).to.contain('plant');
    expect(second?.summary).to.contain('microbe');
    expect(first?.summary).to.not.eq(second?.summary);
  });

  it('the text comes from the card‘s own information block, matched by the action‘s GRAPHIC id', () => {
    const group = groupOf(CardName.EXTREME_COLD_FUNGUS);
    const info = getCard(CardName.EXTREME_COLD_FUNGUS)?.metadata.information;
    const actionGroups = (info?.groups ?? []).filter((g) => g.kind === 'action');
    expect(actionGroups.length, 'the fixture card must carry per-action information').to.eq(2);
    // Every resolved line is a text the information model actually holds —
    // the resolver never invents wording, and never crosses the variants.
    for (const [i, g] of actionGroups.entries()) {
      const resolved = actionRules(group, i);
      expect(resolved).to.not.eq(undefined);
      const texts = g.blocks.map((b) => b.text);
      expect(texts, `variant ${i} took another action's text`).to.contain(resolved?.summary);
    }
  });

  it('a single-action card resolves its one rule; an out-of-range / combined draft resolves nothing', () => {
    const group = groupOf(CardName.SEARCH_FOR_LIFE);
    expect(actionRules(group, 0)?.summary ?? '').to.not.eq('');
    // nodeIndex < 0 is the Viron whole-card handoff: no single rule exists.
    expect(actionRules(group, -1)).to.eq(undefined);
    expect(actionRules(group, 99)).to.eq(undefined);
  });

  it('falls back to the branch title only when the card carries no rule text at all', () => {
    const group = groupOf(CardName.SEARCH_FOR_LIFE);
    const withFallback = actionRules(group, 0, 'A fallback title');
    // The card HAS its own wording — the fallback must not win.
    expect(withFallback?.summary).to.not.eq('A fallback title');
    // …but a source with NO action wording at all (neither a curated
    // information action group nor a printed description) falls through to it.
    const bare = actionRules(
      {...group, cardName: CardName.ALGAE, nodes: [{key: 'x#0', actionNode: undefined, renderRoot: undefined, text: undefined}]},
      0, 'A fallback title');
    expect(bare?.summary).to.eq('A fallback title');
    expect(actionRules({...group, cardName: CardName.ALGAE, nodes: [{key: 'x#0', actionNode: undefined, renderRoot: undefined, text: undefined}]}, 0))
      .to.eq(undefined);
  });

  it('formats a rule as a sentence: the co-located «Action:» prefix is the KIND chip, not the text', () => {
    expect(ACTION_RULE_LABEL.rule).to.eq('Action');
    expect(ACTION_RULE_LABEL.note).to.eq('Special rule');
    // Under the test runner translateText is identity, so this exercises the
    // strip + capitalize contract shared with the fullscreen rules tab.
    expect(actionRuleText('Action: gain 1 plant.')).to.eq('Gain 1 plant.');
    expect(actionRuleText('')).to.eq('');
  });
});
