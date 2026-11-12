/*
 * ConsoleCardResourceChip — the self-target proxy's resource reading. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): a leaf with no children and no emits — its contract is what it renders for its props.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import ConsoleCardResourceChip from '@/client/components/console/played/ConsoleCardResourceChip.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

function chip(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleCardResourceChip as any, {...globalConfig, props, attrs});
}

/** The classes the shared resolver gives a NORMALISED key — what the chip's icon must wear. */
const spriteOf = (key: string): Array<string> => iconClassFor(key).split(' ').filter((c) => c !== '');

describe('ConsoleCardResourceChip — the proxy\'s resource reading', () => {
  it('prints the count beside the resource\'s icon, on the proxy variant by default', () => {
    const w = chip({icon: 'microbe', count: 3});
    expect(w.classes()).to.include.members(['con-cardres', 'con-cardres--proxy']);
    expect(w.classes()).to.not.include('con-cardres--zero');
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.find('.con-cardres__n').text()).to.eq('3');
    expect(spriteOf('microbe').length, 'the resolver knows the key').to.be.greaterThan(0);
    expect(w.find('.con-cardres__icon').classes()).to.include.members(spriteOf('microbe'));
  });

  it('normalises a raw resource name the way every console surface does — lower case, spaces to hyphens', () => {
    const w = chip({icon: 'Hydroelectric resource', count: 1});
    expect(w.find('.con-cardres__icon').classes()).to.have.members(['con-cardres__icon', ...spriteOf('hydroelectric-resource')]);
  });

  it('a standing zero is marked, the variant is the host\'s — and it follows its props', async () => {
    const w = chip({icon: 'floater', count: 0, variant: 'row'});
    expect(w.classes()).to.include.members(['con-cardres--row', 'con-cardres--zero']);
    expect(w.find('.con-cardres__n').text()).to.eq('0');

    await w.setProps({count: 2, icon: 'animal'});
    expect(w.classes()).to.not.include('con-cardres--zero');
    expect(w.find('.con-cardres__n').text()).to.eq('2');
    expect(w.find('.con-cardres__icon').classes()).to.have.members(['con-cardres__icon', ...spriteOf('animal')]);
  });

  it('the template STARTS WITH ITS ROOT — what a host lets fall through lands on the chip', () => {
    const w = chip({icon: 'microbe', count: 1}, {'class': 'from-host', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.include.members(['con-cardres', 'from-host']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
