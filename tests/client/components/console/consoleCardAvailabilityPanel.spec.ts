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

describe('ConsoleCardAvailabilityPanel — one view, three densities', () => {
  it('LINE: verdict + COMPACT primary reason on one run, NO name (the host names the card)', () => {
    const w = panel({view: view([TEMP_MIN]), variant: 'line'});
    expect(w.find('.con-cardavail__name').exists(), 'the host\'s bar already names the card').to.eq(false);
    expect(w.find('.con-cardavail__title').text()).to.eq('Requirement not met yet');
    expect(w.find('.con-cardavail__icon').text()).to.eq('◈');
    // The counter form — never the full sentence (that is fullscreen's voice).
    expect(w.find('.con-cardavail__text').text()).to.eq('Temperature -22/0°C');
    expect(w.classes()).to.contain('con-cardavail--line');
    expect(w.classes()).to.contain('con-cardavail--pending');
  });

  it('LINE: no view renders NOTHING at all — no empty chip in the host\'s row', () => {
    const w = panel({variant: 'line'});
    expect(w.find('.con-cardavail').exists()).to.eq(false);
  });

  it('LINE: the «+N more» chip keeps the compact honesty (one reason shown)', () => {
    const w = panel({view: view([TEMP_MAX_MISSED, TAGS]), variant: 'line'});
    expect(w.findAll('.con-cardavail__text')).to.have.length(1);
    expect(w.find('.con-cardavail__more').text()).to.eq('+1 more');
    expect(w.classes()).to.contain('con-cardavail--missed');
  });
});

describe('ConsoleCardAvailabilityPanel — one view, two densities', () => {
  it('COMPACT: ONE row — name + loud status + the compact counter reason (never the full sentence)', () => {
    const w = panel({view: view([TEMP_MIN]), variant: 'compact', cardTitle: 'Lake Marineris'});
    expect(w.find('.con-cardavail__name').text()).to.eq('Lake Marineris');
    expect(w.find('.con-cardavail__title').text()).to.eq('Requirement not met yet');
    expect(w.find('.con-cardavail__icon').text()).to.eq('◈');
    expect(w.find('.con-cardavail__text').text()).to.eq('Temperature -22/0°C');
    // The two-row chassis is GONE — the card-status contract is one line.
    expect(w.find('.con-cardavail__head').exists(), 'no head row wrapper').to.eq(false);
    expect(w.find('.con-cardavail__line').exists(), 'no second-line wrapper').to.eq(false);
    expect(w.classes()).to.contain('con-cardavail--pending');
    expect(w.attributes('data-severity')).to.eq('pending');
  });

  it('COMPACT: with NOTHING to say the block still stands and still carries the name', () => {
    // The status zone always names the focused card; only the verdict is
    // conditional. It must be the SAME element in both states — the draft's
    // old bare-name span carried no console typography and read tiny beside
    // it on a TV the moment a card had a requirement.
    const w = panel({variant: 'compact', cardTitle: 'Casino'});
    expect(w.find('.con-cardavail__name').text()).to.eq('Casino');
    expect(w.find('.con-cardavail__status').exists(), 'no verdict, no status row').to.eq(false);
    expect(w.find('.con-cardavail__line').exists()).to.eq(false);
    expect(w.attributes('data-severity')).to.eq('clear');
    expect(w.classes()).to.contain('con-cardavail--clear');
  });

  it('PANEL: no view renders nothing at all (never an empty container)', () => {
    const w = panel({variant: 'panel'});
    expect(w.find('.con-cardavail__box').exists()).to.eq(false);
  });

  it('COMPACT: shows the PRIMARY reason (compact form) and an honest «+N more» chip, never the whole list', () => {
    const w = panel({view: view([TEMP_MAX_MISSED, TAGS]), variant: 'compact', cardTitle: 'X'});
    // The decisive missed reason leads (as the compact counter, at the
    // EFFECTIVE bound); the pending tag reason waits behind the chip.
    expect(w.find('.con-cardavail__text').text()).to.eq('Temperature -10/≤-14°C');
    expect(w.find('.con-cardavail__more').text()).to.eq('+1 more');
    expect(w.findAll('.con-cardavail__text')).to.have.length(1);
    expect(w.classes()).to.contain('con-cardavail--missed');
  });

  it('PANEL: ONE compact status line is the header — no second kicker level', () => {
    const w = panel({view: view([TEMP_MAX_MISSED, TAGS])});
    expect(w.find('.con-cardavail__kickertitle').exists(), 'the generic «Availability» level is gone').to.eq(false);
    const verdict = w.find('.con-cardavail__verdict');
    expect(verdict.text()).to.contain('Requirement can no longer be met');
    expect(verdict.text()).to.contain('✕'); // the marker rides the same line
    expect(w.findAll('.con-cardavail__verdict'), 'exactly one header').to.have.length(1);
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
