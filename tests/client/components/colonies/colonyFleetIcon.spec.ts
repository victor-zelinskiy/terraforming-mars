import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';

/*
 * What the fleet ship renders for its props — the owner's hue, the presentation mode, the cinematic state and the
 * «free» exhaust are CLASSES of its root (the stylesheet draws the rest) — and the one thing it holds itself: a
 * gradient id of its own, because many ships stand on one screen and `url(#…)` resolves document-wide. The ship
 * emits nothing and exposes nothing.
 */
describe('ColonyFleetIcon', () => {
  it('draws the owner\'s hue and the compact mode as classes of the root — nothing more while idle', () => {
    const ship = mount(ColonyFleetIcon, {...globalConfig, props: {color: 'red'}});
    expect(ship.classes()).to.have.members(['colony-fleet-icon', 'fleet-hue--red', 'colony-fleet-icon--icon']);
    expect(ship.attributes('aria-hidden')).to.eq('true');
  });

  it('the flight proxy\'s mode, the cinematic state and the free exhaust are classes too — and follow the props', async () => {
    const ship = mount(ColonyFleetIcon, {...globalConfig, props: {color: 'blue', mode: 'hero', state: 'launch', free: true}});
    expect(ship.classes()).to.have.members([
      'colony-fleet-icon', 'fleet-hue--blue', 'colony-fleet-icon--hero', 'colony-fleet-icon--launch', 'colony-fleet-icon--free',
    ]);

    await ship.setProps({color: 'green', state: 'idle', free: false});
    expect(ship.classes()).to.have.members(['colony-fleet-icon', 'fleet-hue--green', 'colony-fleet-icon--hero']);
  });

  it('every ship has a gradient id of its own, fills both jets from it and keeps it for life', async () => {
    const first = mount(ColonyFleetIcon, {...globalConfig, props: {color: 'red'}});
    const second = mount(ColonyFleetIcon, {...globalConfig, props: {color: 'red'}});
    const firstId = first.find('[id$="-plume"]').attributes('id');
    const secondId = second.find('[id$="-plume"]').attributes('id');
    expect(firstId).to.match(/^cfi\d+-plume$/);
    expect(secondId).to.match(/^cfi\d+-plume$/);
    expect(secondId, 'two ships never share an id').to.not.eq(firstId);

    expect(first.find('.cfi-thrust').attributes('fill')).to.eq(`url(#${firstId})`);
    expect(first.find('.cfi-flame').attributes('fill')).to.eq(`url(#${firstId})`);
    expect(second.find('.cfi-thrust').attributes('fill')).to.eq(`url(#${secondId})`);

    await first.setProps({state: 'flight'});
    expect(first.find('[id$="-plume"]').attributes('id'), 'an update takes no new id').to.eq(firstId);
  });
});
