import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import {buildCardAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';
import {UnplayableReason} from '@/common/cards/UnplayableReason';

const TEMP_MIN: UnplayableReason = {
  type: 'globalParameter', globalParameter: 'temperature', requirement: true,
  message: 'Requires ${0}°C', params: ['0'], current: -22,
};
const TEMP_MAX_MISSED: UnplayableReason = {
  type: 'globalParameter', globalParameter: 'temperature', requirement: true, unattainable: true,
  message: 'Requires ${0}°C or colder', params: ['-18'], current: -10, effectiveCount: -14,
};
const TAGS: UnplayableReason = {
  type: 'tag', requirement: true, message: 'Requires ${0} tag(s)', params: ['3'], current: 1,
};

function view(reasons: ReadonlyArray<UnplayableReason>, context: 'draft' | 'play' = 'draft', turnReason?: string): CardAvailabilityView {
  const v = buildCardAvailability({reasons, turnReason}, context);
  expect(v, 'fixture must produce a view').to.not.eq(undefined);
  return v!;
}

function panel(props: Record<string, unknown>) {
  return mount(ConsoleCardAvailabilityPanel as any, {...globalConfig, props});
}

describe('ConsoleCardAvailabilityPanel — one view, two densities', () => {
  it('COMPACT: name + loud status on row one, the comparison line on row two', () => {
    const w = panel({view: view([TEMP_MIN]), variant: 'compact', cardTitle: 'Lake Marineris'});
    expect(w.find('.con-cardavail__name').text()).to.eq('Lake Marineris');
    expect(w.find('.con-cardavail__title').text()).to.eq('Requirement not met yet');
    expect(w.find('.con-cardavail__icon').text()).to.eq('◈');
    expect(w.find('.con-cardavail__line').text()).to.contain('Requires 0°C · Now: -22°C');
    expect(w.classes()).to.contain('con-cardavail--pending');
    expect(w.attributes('data-severity')).to.eq('pending');
  });

  it('COMPACT: shows the PRIMARY reason and an honest «+N more» chip, never the whole list', () => {
    const w = panel({view: view([TEMP_MAX_MISSED, TAGS]), variant: 'compact', cardTitle: 'X'});
    // The decisive missed reason leads; the pending tag reason waits behind the chip.
    expect(w.find('.con-cardavail__line').text()).to.contain('Requires -18°C or colder');
    expect(w.find('.con-cardavail__more').text()).to.eq('+1 more');
    expect(w.findAll('.con-cardavail__text')).to.have.length(1);
    expect(w.classes()).to.contain('con-cardavail--missed');
  });

  it('PANEL: kicker + big verdict + the FULL reason list with per-reason voices', () => {
    const w = panel({view: view([TEMP_MAX_MISSED, TAGS])});
    expect(w.find('.con-cardavail__kickertitle').text()).to.eq('Availability');
    expect(w.find('.con-cardavail__verdict').text()).to.contain('Requirement can no longer be met');
    const rows = w.findAll('.con-cardavail__reason');
    expect(rows).to.have.length(2);
    expect(rows[0].classes()).to.contain('con-cardavail__reason--danger');
    expect(rows[1].classes()).to.contain('con-cardavail__reason--warning');
    // The modifier note renders as its own muted line under its reason.
    expect(rows[0].find('.con-cardavail__mods').text()).to.eq('With your modifiers: -14°C');
  });

  it('PANEL: the waiting state carries no list — the headline says everything once', () => {
    const w = panel({view: view([], 'play', 'Not your turn to take any actions')});
    expect(w.find('.con-cardavail__verdict').text()).to.contain('Not your turn to take any actions');
    expect(w.find('.con-cardavail__list').exists()).to.eq(false);
    expect(w.classes()).to.contain('con-cardavail--waiting');
  });

  it('re-pointing the view REPLACES the content — a previous card\'s reason cannot linger', async () => {
    const w = panel({view: view([TEMP_MIN])});
    expect(w.text()).to.contain('Requires 0°C');
    await w.setProps({view: view([TAGS])});
    expect(w.text()).to.contain('Requires 3 tag(s)');
    expect(w.text()).to.not.contain('Requires 0°C');
    expect(w.find('.con-cardavail__verdict').text()).to.contain('Requirement not met yet');
  });
});
