/*
 * ConsoleTenderChip — a tender holding in one line (the map's rail, a podium row, the overview, the dossier). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): the name on a kant in the TIER's metal, the
 * status as a word — and no word at all while the tender is simply held.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {TENDER_IDS, tenderDef, tenderNameKey} from '@/common/campaign/tenders';
import {tenderStatusKey} from '@/client/console/campaign/tenderHoldings';
import ConsoleTenderChip from '@/client/components/console/campaign/ConsoleTenderChip.vue';

describe('ConsoleTenderChip — a tender holding in one line', () => {
  it('a held tender (the default): its name, its tier\'s class, the hooks the map reads — and no status word', () => {
    const w = mount(ConsoleTenderChip, {...globalConfig, props: {id: 'extendedLegacy'}});
    expect(w.classes()).to.deep.eq(['con-tchip', 'con-tchip--held', `con-tchip--tier-${tenderDef('extendedLegacy').tier}`]);
    expect(w.attributes('data-cmap-tender')).to.eq('extendedLegacy');
    expect(w.attributes('data-cmap-tender-status')).to.eq('held');
    expect(w.find('.con-tchip__mark').attributes('aria-hidden')).to.eq('true');
    expect(w.find('.con-tchip__name').text()).to.eq($t(tenderNameKey('extendedLegacy')));
    expect(w.find('.con-tchip__status').exists(), '«held» is the chip\'s resting state — it says nothing').to.eq(false);
  });

  it('an executed and a bought-back tender say so in a word', () => {
    for (const status of ['executed', 'cashed'] as const) {
      const w = mount(ConsoleTenderChip, {...globalConfig, props: {id: 'openCall', status}});
      expect(w.classes(), status).to.contain(`con-tchip--${status}`);
      expect(w.attributes('data-cmap-tender-status'), status).to.eq(status);
      expect(w.find('.con-tchip__status').text(), status).to.eq($t(tenderStatusKey(status)));
      w.unmount();
    }
  });

  it('every kind wears its own name and the metal of its own tier', () => {
    for (const id of TENDER_IDS) {
      const w = mount(ConsoleTenderChip, {...globalConfig, props: {id}});
      expect(w.classes(), id).to.contain(`con-tchip--tier-${tenderDef(id).tier}`);
      expect(w.find('.con-tchip__name').text(), id).to.eq($t(tenderNameKey(id)));
      w.unmount();
    }
  });

  it('follows its props — the same chip, another holding and another status', async () => {
    const w = mount(ConsoleTenderChip, {...globalConfig, props: {id: 'restructuring'}});
    expect(w.classes()).to.contain('con-tchip--tier-decisive');

    await w.setProps({id: 'gambleProjects', status: 'cashed'});
    expect(w.classes()).to.deep.eq(['con-tchip', 'con-tchip--cashed', 'con-tchip--tier-gamble']);
    expect(w.attributes('data-cmap-tender')).to.eq('gambleProjects');
    expect(w.find('.con-tchip__name').text()).to.eq($t(tenderNameKey('gambleProjects')));
    expect(w.find('.con-tchip__status').text()).to.eq($t(tenderStatusKey('cashed')));
  });
});
