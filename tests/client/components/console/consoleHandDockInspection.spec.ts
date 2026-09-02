import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleHandDock from '@/client/components/console/ConsoleHandDock.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {buildDockInspectionView} from '@/client/console/handDock/dockInspection';

/**
 * THE DOCK'S INSPECTION CONTEXT (Information Workspace integration): while a
 * FOREIGN seat is inspected the dock carries a read-only closed fan + the
 * seat's exact public count — and by construction can leak nothing (the fan
 * is derived from ONE integer). These specs pin the read-only contract, the
 * bay's three-state priority and the privacy shape of the DOM.
 */

const OWN_HAND = [
  {name: CardName.BIRDS}, {name: CardName.FISH}, {name: CardName.PETS},
] as unknown as ReadonlyArray<CardModel>;

function mountDock(over: Record<string, unknown> = {}) {
  return mount(ConsoleHandDock, {
    ...globalConfig,
    props: {
      cards: OWN_HAND,
      playableCount: 2,
      interactive: true,
      ...over,
    },
  });
}

const guest = (count: number, kind: 'human' | 'bot' = 'human') =>
  buildDockInspectionView({kind, color: 'blue', count}, 'standard');

describe('ConsoleHandDock — the inspection context', () => {
  it('the ordinary dock: own counter, no fan, click opens', async () => {
    const w = mountDock();
    expect(w.find('.con-handdock__insp').exists()).to.be.false;
    expect(w.find('.con-handdock__status--insp').exists()).to.be.false;
    expect(w.find('.con-handdock__num--active').text()).to.eq('2');
    expect(w.find('.con-handdock__num--total').text()).to.eq('3');
    await w.trigger('click');
    expect(w.emitted('open')).to.have.length(1);
  });

  it('a foreign seat: the closed fan + the exact count replace the own presentation', () => {
    const w = mountDock({inspecting: true, inspection: guest(9)});
    expect(w.classes()).to.include('con-handdock--guest');
    expect(w.classes()).to.include('con-handdock--insp');
    // The fan: one sleeve per card, each a pure back — no text, no name.
    const sleeves = w.findAll('.con-handdock__insp-sleeve');
    expect(sleeves).to.have.length(9);
    expect(w.find('.con-handdock__insp').text().trim()).to.eq('');
    // The counter: ONE number (the guest count) — the playable half is the
    // viewer's own private fact and never renders for a guest.
    const insp = w.find('.con-handdock__status--insp');
    expect(insp.exists()).to.be.true;
    expect(insp.find('.con-handdock__num').text()).to.eq('9');
    expect(insp.find('.con-handdock__sep').exists(), 'no ratio slash for a guest').to.be.false;
    expect(w.find('.con-handdock__num--active').exists(), 'no own playable digit').to.be.false;
  });

  it('privacy is structural: the fan DOM carries no hand-body anchors and no card identity', () => {
    const w = mountDock({inspecting: true, inspection: guest(12)});
    expect(w.find('[data-hand-dock-card]').exists()).to.be.false;
    const html = w.find('.con-handdock__insp').html();
    for (const c of OWN_HAND) {
      expect(html).to.not.contain(c.name);
    }
  });

  it('read-only by construction: a click on a guest dock emits NOTHING, even if interactive leaked true', async () => {
    const w = mountDock({inspecting: true, inspection: guest(5), interactive: true});
    expect(w.classes(), 'the live affordance goes dark').to.not.include('con-handdock--live');
    expect(w.classes(), 'the playable accent is an own-hand fact').to.not.include('con-handdock--hot');
    await w.trigger('click');
    expect(w.emitted('open')).to.be.undefined;
  });

  it('the fan saturates at the visual cap while the counter stays exact', () => {
    const w = mountDock({inspecting: true, inspection: guest(40)});
    expect(w.findAll('.con-handdock__insp-sleeve').length).to.be.lessThan(40);
    expect(w.find('.con-handdock__status--insp .con-handdock__num').text()).to.eq('40');
  });

  it('the bay priority: a guest outranks the album spine (the spine returns on close untouched)', () => {
    const album = {page: 2, pages: 4, canPrev: true, canNext: true};
    const w = mountDock({album, inspecting: true, inspection: guest(7)});
    expect(w.find('.con-handdock__pager').exists(), 'the spine yields to the guest readout').to.be.false;
    expect(w.find('.con-handdock__status--insp').exists()).to.be.true;
  });

  it('inspecting the VIEWER\'S OWN seat changes only the accent — the real dock stays', async () => {
    const w = mountDock({inspecting: true, inspection: undefined});
    expect(w.classes()).to.include('con-handdock--insp');
    expect(w.classes()).to.not.include('con-handdock--guest');
    expect(w.find('.con-handdock__insp').exists()).to.be.false;
    expect(w.find('.con-handdock__num--active').text(), 'own playable/total readout intact').to.eq('2');
    await w.trigger('click');
    expect(w.emitted('open'), 'the own dock keeps its click affordance').to.have.length(1);
  });

  it('a11y states the shown number: the guest count while inspecting, the own count otherwise', () => {
    expect(mountDock().attributes('aria-label')).to.contain(': 3');
    expect(mountDock({inspecting: true, inspection: guest(11)}).attributes('aria-label')).to.contain(': 11');
  });

  it('an empty guest hand is an honest empty tray with an exact «0»', () => {
    const w = mountDock({inspecting: true, inspection: guest(0, 'bot')});
    expect(w.findAll('.con-handdock__insp-sleeve')).to.have.length(0);
    expect(w.find('.con-handdock__status--insp .con-handdock__num').text()).to.eq('0');
  });
});
