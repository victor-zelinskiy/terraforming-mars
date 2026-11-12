/*
 * ConsoleWsStageHead — the ONE heading of an embedded workspace stage («Получены карты · ПОЛУЧЕНО 2»). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): the host's sentence as it is, the live state
 * as a `badges` slot beside it, the host's own identity as fall-through classes on the root.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleWsStageHead from '@/client/components/console/foundation/ConsoleWsStageHead.vue';

describe('ConsoleWsStageHead — the embedded stage heading', () => {
  it('prints the host\'s sentence as it is — and with no badges there is no badge cell', () => {
    const w = mount(ConsoleWsStageHead, {...globalConfig, props: {title: 'Получены карты'}});
    expect((w.element as HTMLElement).tagName).to.eq('HEADER');
    expect(w.classes()).to.deep.eq(['con-ws-stage-head']);
    expect(w.find('.con-ws-stage-head__title.con-ws-stage-title').text()).to.eq('Получены карты');
    expect(w.find('.con-ws-stage-head__badges').exists()).to.eq(false);
  });

  // (A render function, not a template string: the runtime compiler is not in this build.)
  it('a `badges` slot stands beside the title and marks the head badged', () => {
    const w = mount(ConsoleWsStageHead as any, {
      ...globalConfig,
      props: {title: 'Buy the revealed cards?'},
      slots: {badges: () => h('b', {class: 'badge-probe'}, '0/1')},
    });
    expect(w.classes()).to.include.members(['con-ws-stage-head', 'con-ws-stage-head--badged']);
    expect(w.find('.con-ws-stage-head__title').text()).to.eq('Buy the revealed cards?');
    expect(w.find('.con-ws-stage-head__badges > .badge-probe').text()).to.eq('0/1');
  });

  it('the host\'s identity falls through onto the root (`.con-reveal__head` / `.con-task__head`)', () => {
    const w = mount(ConsoleWsStageHead, {
      ...globalConfig,
      props: {title: 'x'},
      attrs: {'class': 'con-task__head', 'data-from-host': 'yes'},
    });
    expect(w.classes()).to.include.members(['con-ws-stage-head', 'con-task__head']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
