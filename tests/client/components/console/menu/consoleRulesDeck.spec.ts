/*
 * ConsoleRulesDeck — the creator's RULES deck: the rule toggles as full-width rows with an ON / OFF switch, plus the
 * sub-setting rows (a campaign's reward mode, its tenders dial, a rolled rule's chance, the dev «Guaranteed cards»).
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): pure presentation — the rows, the cursor
 * and the shaking row arrive as props, a press / a pointer move goes UP as `activate` / `hover` with the row's index.
 * It exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {
  RulesDeckRow, campaignChanceRule, campaignRewardModeDesc, campaignRewardModeLabel, campaignTenderOfferLabel, campaignTenderOfferReading,
} from '@/client/console/menu/consoleCreateModel';
import {automaBlockerText} from '@/client/components/create/premium/createGameState';
import {PremiumRuleMeta} from '@/client/components/create/premium/createGameMeta';
import {CAMPAIGN_MODIFIER_CHANCES} from '@/common/campaign/missionModifiers';
import ConsoleRulesDeck from '@/client/components/console/menu/ConsoleRulesDeck.vue';

// The badge is the glyph set's own subject; this spec reads the SEMANTIC control the row asks it for.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

const draft: PremiumRuleMeta = {id: 'draftVariant', labelKey: 'label of the draft', descKey: 'what the draft does', icon: 'draft'};
const randomMA: PremiumRuleMeta = {id: 'randomMilestonesAwards', labelKey: 'label of random goals', descKey: 'what random goals do', icon: 'dice'};

const rule = (meta: PremiumRuleMeta, value: boolean, conflictKey?: string): RulesDeckRow => ({kind: 'rule', rule: {meta, value, conflictKey}});

function deck(props: {rows: ReadonlyArray<RulesDeckRow>, cursor: number, shakeRow?: number}) {
  return mount(ConsoleRulesDeck, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
  });
}

describe('ConsoleRulesDeck — the creator\'s rules as console rows', () => {
  it('a RULE row: its name, what it does, the switch by value; the cursor and the shake by index; a conflict states the blocker instead', () => {
    const w = deck({rows: [rule(draft, true), rule(randomMA, false, 'rule:randomMilestonesAwards')], cursor: 1, shakeRow: 0});
    expect(w.classes()).to.include.members(['cm-deckbody', 'cm-rules']);
    const rows = w.findAll('.cm-rules > button.cm-row.cm-rule');
    expect(rows).to.have.length(2);
    expect(rows.map((row) => row.classes().includes('cm-row--cursor'))).to.deep.eq([false, true]);
    expect(rows.map((row) => row.classes().includes('cm-row--shake'))).to.deep.eq([true, false]);
    expect(rows.map((row) => row.classes().includes('cm-rule--on'))).to.deep.eq([true, false]);
    expect(rows.map((row) => row.classes().includes('cm-row--conflict'))).to.deep.eq([false, true]);
    expect(rows.map((row) => row.classes().includes('cm-rule--sub')), 'a rule is no sub-setting').to.deep.eq([false, false]);
    expect(rows.map((row) => row.find('.cm-row__name').text())).to.deep.eq([$t('label of the draft'), $t('label of random goals')]);

    expect(rows[0].find('.cm-rule__desc').text()).to.eq($t('what the draft does'));
    expect(rows[0].find('.cm-row__issue').exists()).to.eq(false);
    expect(rows[1].find('.cm-row__issue').text()).to.eq($t(automaBlockerText('rule:randomMilestonesAwards')));
    expect(rows[1].find('.cm-rule__desc').exists(), 'the reason takes the description\'s place').to.eq(false);

    expect(rows.map((row) => row.find('.cm-toggle').classes().includes('cm-toggle--on'))).to.deep.eq([true, false]);
    expect(rows.map((row) => row.find('.cm-toggle__state').text())).to.deep.eq([$t('On'), $t('Off')]);
  });

  it('a campaign\'s DIALS: the reward mode, the tenders per bidding in THIS table\'s numbers, a rolled rule\'s chance with its gauge', () => {
    const w = deck({
      rows: [
        {kind: 'rewardMode', mode: 'tenders'},
        {kind: 'tenderOffer', offer: 'minusOne', seats: 3},
        rule(randomMA, true),
        {kind: 'chance', id: 'randomMA', chance: 20},
      ],
      cursor: 3,
    });
    const rows = w.findAll('.cm-rules > button.cm-row');
    expect(rows).to.have.length(4);

    const reward = rows[0];
    expect(reward.attributes('data-rule-sub')).to.eq('rewardMode');
    expect(reward.attributes('data-reward-mode')).to.eq('tenders');
    expect(reward.classes()).to.include.members(['cm-rule--on', 'cm-rule--reward']);
    expect(reward.classes(), 'the reward mode heads the deck — never a sub-setting').to.not.include('cm-rule--sub');
    expect(reward.find('.cm-row__name').text()).to.eq($t('Mission rewards'));
    expect(reward.find('.cm-rule__desc').text()).to.eq($t(campaignRewardModeDesc('tenders')));
    expect(reward.find('[data-reward-mode-value]').text()).to.eq($t(campaignRewardModeLabel('tenders')));

    const tenders = rows[1];
    expect(tenders.attributes('data-rule-sub')).to.eq('tenderOffer');
    expect(tenders.attributes('data-tender-offer')).to.eq('minusOne');
    expect(tenders.classes()).to.include.members(['cm-rule--sub', 'cm-rule--on', 'cm-rule--reward']);
    expect(tenders.find('.cm-row__name').text()).to.eq($t('Tenders per bidding'));
    const reading = campaignTenderOfferReading('minusOne', 3);
    expect(tenders.find('.cm-rule__desc').text(), 'the sentence prints the table\'s numbers').to.eq(translateTextWithParams(reading.key, [...reading.params]));
    expect(tenders.find('.cm-rule__desc').text()).to.not.match(/\$\{\d+\}/);
    expect(tenders.find('[data-tender-offer-value]').text()).to.eq($t(campaignTenderOfferLabel('minusOne')));

    const chance = rows[3];
    const chanceRule = campaignChanceRule('randomMA');
    expect(chance.attributes('data-rule-sub')).to.eq(chanceRule.sub);
    expect(chance.classes()).to.include.members(['cm-rule--sub', 'cm-rule--on', 'cm-row--cursor']);
    expect(chance.find('.cm-row__name').text()).to.eq($t('Chance per mission'));
    expect(chance.find('.cm-rule__desc').text()).to.eq($t(chanceRule.descKey));
    expect(chance.find('.cm-rule__dial-value').text()).to.eq('20%');
    const gauge = chance.findAll('.cm-field__gauge > .cm-field__gauge-seg');
    expect(gauge, 'one segment per chance of the ring').to.have.length(CAMPAIGN_MODIFIER_CHANCES.length);
    expect(gauge.map((seg) => seg.classes().includes('cm-field__gauge-seg--on')), 'lit up to the chosen chance').to.deep.eq(
      CAMPAIGN_MODIFIER_CHANCES.map((value) => value <= 20));
  });

  it('the dev «Guaranteed cards» row is a COUNT that drills in — «None» while empty, marked DEV, never a switch', () => {
    const w = deck({rows: [{kind: 'devCards', count: 0}, {kind: 'devCards', count: 3}], cursor: 0});
    const rows = w.findAll('.cm-rules > button.cm-row.cm-rule--sub');
    expect(rows).to.have.length(2);
    expect(rows.map((row) => row.classes().includes('cm-rule--on'))).to.deep.eq([false, true]);
    expect(rows.map((row) => row.find('.cm-rule__devtag').text())).to.deep.eq(['DEV', 'DEV']);
    expect(rows.map((row) => row.find('.cm-rule__count-value').text())).to.deep.eq([$t('None'), '3']);
    expect(rows.map((row) => row.find('.cm-rule__count').classes().includes('cm-rule__count--on'))).to.deep.eq([false, true]);
    expect(rows.map((row) => row.find('.cm-toggle').exists())).to.deep.eq([false, false]);
    expect(rows[0].find('.cm-rule__desc').text()).to.eq($t('Put cards on top of the decks so they land in the first hand dealt.'));
    expect(w.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['confirm', 'confirm']);
  });

  it('a click ACTIVATES a row and a pointer move HOVERS it — each says the row\'s index, whatever the row\'s kind', async () => {
    const w = deck({
      rows: [{kind: 'rewardMode', mode: 'titles'}, rule(draft, false), {kind: 'chance', id: 'shuffleMap', chance: 10}, {kind: 'devCards', count: 0}],
      cursor: 0,
    });
    const rows = w.findAll('.cm-rules > button.cm-row');
    await rows[3].trigger('click');
    await rows[1].trigger('mousemove');
    await rows[2].trigger('click');
    await rows[0].trigger('click');
    await rows[2].trigger('mousemove');
    expect(w.emitted('activate')).to.deep.eq([[3], [2], [0]]);
    expect(w.emitted('hover')).to.deep.eq([[1], [2]]);
  });
});
