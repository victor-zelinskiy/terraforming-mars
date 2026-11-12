/*
 * HandCardReasonPopover — the SHARED «why unavailable» renderer (the hand overlay and the board tile placement).
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): two props (`reasons`, `heading`), no emits,
 * nothing exposed — so the spec is what it renders for them. Mounted WITHOUT the i18n plugin on purpose: the
 * component imports `v-i18n` itself, and a Vue warning (an unresolved directive) fails the test.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import HandCardReasonPopover from '@/client/components/handCards/HandCardReasonPopover.vue';
import {unplayableReasonNow, unplayableReasonText} from '@/client/components/handCards/unplayableReasonFormat';

const cost: UnplayableReason = {type: 'megacredits', message: 'Not enough M€ (need ${0} more)', params: ['5']};
const science: UnplayableReason = {type: 'tag', message: 'Requires ${0} science tags', params: ['3'], tag: Tag.SCIENCE, current: 1};
const energy: UnplayableReason = {type: 'production', message: 'Requires ${0} energy production', params: ['1'], resource: Resource.ENERGY, current: 0};
const oxygen: UnplayableReason = {type: 'globalParameter', message: 'Requires ${0}% oxygen', params: ['5'], globalParameter: 'oxygen', current: 2};

function popover(props: {reasons: ReadonlyArray<UnplayableReason>, heading?: string}) {
  return mount(HandCardReasonPopover, {props, global: {config: globalConfig.global.config}});
}

describe('HandCardReasonPopover — the shared «why unavailable» list', () => {
  it('the head: the lock and «Unavailable» by default — a host\'s own heading replaces it', async () => {
    const w = popover({reasons: [cost]});
    expect(w.classes()).to.deep.eq(['hand-reason']);
    expect(w.attributes('role')).to.eq('tooltip');
    expect(w.find('.hand-reason__head > .hand-reason__lock').attributes('aria-hidden')).to.eq('true');
    expect(w.find('.hand-reason__head-label').text()).to.eq($t('Unavailable'));

    await w.setProps({heading: 'Cannot place here'});
    expect(w.find('.hand-reason__head-label').text()).to.eq($t('Cannot place here'));
  });

  it('one row per reason, in order — its category accent, its text, and «now» only where the reason carries a current value', () => {
    const reasons = [cost, science, energy, oxygen];
    const w = popover({reasons});
    const rows = w.findAll('.hand-reason__list > .hand-reason__row');
    expect(rows.map((r) => r.classes().find((c) => c.startsWith('hand-reason__row--'))))
      .to.deep.eq(['megacredits', 'tag', 'production', 'globalParameter'].map((type) => 'hand-reason__row--' + type));
    expect(rows.map((r) => r.find('.hand-reason__text').text())).to.deep.eq(reasons.map((r) => unplayableReasonText(r)));
    expect(rows[1].find('.hand-reason__text').text(), 'the template is filled').to.contain('3').and.not.contain('${0}');
    expect(rows[0].find('.hand-reason__now').exists(), 'no current value — no «now» badge').to.eq(false);
    expect(rows.slice(1).map((r) => r.find('.hand-reason__now').text())).to.deep.eq([science, energy, oxygen].map((r) => unplayableReasonNow(r)));
    expect(rows[2].find('.hand-reason__now').text(), 'a current value of 0 is still a value').to.contain('0');
    expect(rows[3].find('.hand-reason__now').text(), 'the unit rides the value').to.contain('2%');
  });

  it('the icon is the tag\'s when the reason names a tag, the resource\'s when it names a resource, the neutral glyph otherwise', () => {
    const w = popover({reasons: [cost, science, energy]});
    const rows = w.findAll('.hand-reason__row');
    expect(rows[0].find('.hand-reason__glyph').exists()).to.eq(true);
    expect(rows[0].find('.hand-reason__icon').exists()).to.eq(false);

    const tag = rows[1].find('span.hand-reason__icon');
    expect(tag.classes()).to.include.members(['card-tag', 'tag-' + Tag.SCIENCE]);
    expect(rows[1].find('.hand-reason__glyph').exists()).to.eq(false);

    const resource = rows[2].find('i.hand-reason__icon');
    expect(resource.classes()).to.include.members(['resource_icon', 'resource_icon--' + Resource.ENERGY]);
    expect(rows[2].find('.hand-reason__glyph').exists()).to.eq(false);
  });

  it('follows its reasons', async () => {
    const w = popover({reasons: [cost, science]});
    expect(w.findAll('.hand-reason__row')).to.have.lengthOf(2);
    await w.setProps({reasons: [oxygen]});
    const rows = w.findAll('.hand-reason__row');
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].classes()).to.include('hand-reason__row--globalParameter');
    expect(rows[0].find('.hand-reason__text').text()).to.eq(unplayableReasonText(oxygen));
  });
});
