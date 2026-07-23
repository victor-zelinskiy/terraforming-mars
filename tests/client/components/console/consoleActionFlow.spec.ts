import {expect} from 'chai';
import {
  actionFlowStage,
  focusKicker,
  focusCommandRun,
  browseCommandRun,
} from '@/client/console/consoleActionFlow';

describe('consoleActionFlow', () => {
  describe('actionFlowStage', () => {
    it('derives browse / focus / pick / committing from the live signals', () => {
      expect(actionFlowStage({draftOpen: false, pickActive: false, awaiting: false})).to.eq('browse');
      expect(actionFlowStage({draftOpen: true, pickActive: false, awaiting: false})).to.eq('focus');
      expect(actionFlowStage({draftOpen: true, pickActive: true, awaiting: false})).to.eq('pick');
      expect(actionFlowStage({draftOpen: true, pickActive: false, awaiting: true})).to.eq('committing');
    });

    it('the committed hold outranks a pick (input is absorbed regardless)', () => {
      expect(actionFlowStage({draftOpen: true, pickActive: true, awaiting: true})).to.eq('committing');
    });

    it('no draft → browse, whatever the other signals claim', () => {
      expect(actionFlowStage({draftOpen: false, pickActive: true, awaiting: false})).to.eq('browse');
    });
  });

  describe('focusKicker', () => {
    it('decisions → setup, a bare confirm → confirmation', () => {
      expect(focusKicker(true)).to.eq('Action setup');
      expect(focusKicker(false)).to.eq('Confirmation');
    });
  });

  describe('focusCommandRun', () => {
    it('awaiting: ONE honest in-flight beat — nothing else is possible', () => {
      const run = focusCommandRun({state: 'awaiting'});
      expect(run).to.deep.eq([{control: 'confirm', label: 'Performing…', enabled: false}]);
    });

    it('reveal phase: face-down narrates the beat; the shown outcome offers OK + Inspect', () => {
      expect(focusCommandRun({state: 'reveal-pending'}))
        .to.deep.eq([{control: 'confirm', label: 'Revealing the card…', enabled: false}]);
      expect(focusCommandRun({state: 'reveal-shown'}).map((c) => c.label)).to.deep.eq(['OK', 'Inspect']);
    });

    it('sub-list: A selects, X inspects ONLY a card list, B backs', () => {
      const cards = focusCommandRun({state: 'sub-list', cardList: true});
      expect(cards.map((c) => c.label)).to.deep.eq(['Select', 'Inspect', 'Back']);
      const players = focusCommandRun({state: 'sub-list', cardList: false});
      expect(players.map((c) => c.label)).to.deep.eq(['Select', 'Back']);
    });

    it('sub-payment: lanes chords + Done gated on coverage', () => {
      const run = focusCommandRun({state: 'sub-payment', covers: false});
      const done = run.find((c) => c.label === 'Done');
      expect(done?.enabled).to.eq(false);
      expect(run.some((c) => c.label === 'MAX')).to.eq(true);
      expect(run[run.length - 1].label).to.eq('Back');
      expect(focusCommandRun({state: 'sub-payment', covers: true}).find((c) => c.label === 'Done')?.enabled).to.eq(true);
    });

    it('main / amount row: LB/RB + MAX + Next — A never silently confirms', () => {
      const run = focusCommandRun({state: 'main', focused: 'amount', canConfirm: true});
      expect(run.map((c) => c.label)).to.deep.eq(['−1 / +1', 'MAX', 'Next', 'Inspect', 'Cancel']);
    });

    it('main / spend-heat row: LB/RB + Next (no MAX)', () => {
      const run = focusCommandRun({state: 'main', focused: 'spendHeat', canConfirm: false});
      expect(run.map((c) => c.label)).to.deep.eq(['−1 / +1', 'Next', 'Inspect', 'Cancel']);
    });

    it('main / branch + pick rows: A names Select / Change (resolved re-opens)', () => {
      expect(focusCommandRun({state: 'main', focused: 'branch', canConfirm: false})
        .map((c) => c.label)).to.deep.eq(['Select', 'Inspect', 'Cancel']);
      expect(focusCommandRun({state: 'main', focused: 'pick', resolved: false, canConfirm: false})[0].label).to.eq('Select');
      expect(focusCommandRun({state: 'main', focused: 'pick', resolved: true, canConfirm: false})[0].label).to.eq('Change');
    });

    it('main / CTA (or a decision-less confirm): A = Confirm, gated on readiness; X always inspects', () => {
      const cta = focusCommandRun({state: 'main', focused: 'cta', canConfirm: true});
      expect(cta[0]).to.deep.eq({control: 'confirm', label: 'Confirm', enabled: true});
      expect(cta.some((c) => c.label === 'Inspect' && c.control === 'secondary')).to.eq(true);
      const bare = focusCommandRun({state: 'main', focused: 'none', canConfirm: false});
      expect(bare[0]).to.deep.eq({control: 'confirm', label: 'Confirm', enabled: false});
    });

    it('X is NEVER a confirm — the quick-confirm X is retired for grammar consistency', () => {
      const states = [
        focusCommandRun({state: 'main', focused: 'amount', canConfirm: true}),
        focusCommandRun({state: 'main', focused: 'pick', resolved: true, canConfirm: true}),
        focusCommandRun({state: 'main', focused: 'cta', canConfirm: true}),
        focusCommandRun({state: 'sub-list', cardList: true}),
      ];
      for (const run of states) {
        const x = run.filter((c) => c.control === 'secondary');
        expect(x.every((c) => c.label === 'Inspect')).to.eq(true);
      }
    });
  });

  describe('browseCommandRun', () => {
    it('the grid contract: A Perform (gated), X Inspect, R3 Reset, B Close', () => {
      const run = browseCommandRun({empty: false, focusedAvailable: true});
      expect(run.map((c) => c.label)).to.deep.eq(['Perform', 'Inspect', 'Reset', 'Close']);
      expect(run[0].enabled).to.eq(true);
      expect(browseCommandRun({empty: false, focusedAvailable: false})[0].enabled).to.eq(false);
    });

    it('the empty state leads with the filters that emptied the grid', () => {
      const run = browseCommandRun({empty: true, focusedAvailable: false});
      expect(run.map((c) => c.label)).to.deep.eq(['Reset', 'Availability', 'Activation', 'Close']);
    });
  });
});
