/*
 * ConsoleVpBadge — the console's victory-points emblem: an inline SVG shield with the host's PRE-LOCALIZED label in
 * its centre. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): ONE prop in, nothing emitted,
 * nothing exposed — so the spec is what it renders for that prop, and the one thing its script owns: gradient ids
 * that are the badge's OWN (same-id `<defs>` of two mounted copies all resolve to the first one in the document).
 * The number behind those ids is the MODULE's (`consoleVpBadgeState.ts`) — a counter of the script itself would be
 * one per instance, and every badge would be number 1.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';

function badge(label: string) {
  return mount(ConsoleVpBadge, {props: {label}});
}

/** The ids the badge declares, and the ids its two fills point at. */
function gradientsOf(root: Element): {declared: Array<string>, used: Array<string>} {
  const declared = Array.from(root.querySelectorAll('defs > linearGradient')).map((g) => g.getAttribute('id') ?? '');
  const used = Array.from(root.querySelectorAll('path[fill^="url("]')).map((p) => p.getAttribute('fill') ?? '');
  return {declared, used};
}

describe('ConsoleVpBadge — the console\'s VP emblem', () => {
  it('the template starts with its root: a decorative SVG shield carrying the host\'s label, and following it', async () => {
    const w = badge('VP');
    const root = w.element as Element;
    expect(root.tagName.toLowerCase()).to.eq('svg');
    expect(w.classes()).to.deep.eq(['con-vp-badge']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.attributes('viewBox')).to.eq('0 0 40 44');
    expect(w.find('text.con-vp-badge__label').text()).to.eq('VP');
    expect(w.find('text.con-vp-badge__label').attributes('text-anchor'), 'one optical centre for every locale').to.eq('middle');

    await w.setProps({label: 'ПО'});
    expect(w.find('text.con-vp-badge__label').text()).to.eq('ПО');
  });

  it('the rim and the core are filled from the badge\'s OWN two gradients', () => {
    const {declared, used} = gradientsOf(badge('VP').element as Element);
    expect(declared).to.have.length(2);
    expect(declared[0]).to.match(/^con-vpb-\d+-rim$/);
    expect(declared[1]).to.match(/^con-vpb-\d+-core$/);
    expect(used).to.deep.eq([`url(#${declared[0]})`, `url(#${declared[1]})`]);
  });

  it('two badges never share an id — the counter is the module\'s, not the instance\'s — and a badge keeps its own', async () => {
    const first = badge('VP');
    const second = badge('VP');
    const a = gradientsOf(first.element as Element).declared;
    const b = gradientsOf(second.element as Element).declared;
    expect(new Set([...a, ...b]).size, 'four ids, all different').to.eq(4);

    // A re-render changes the label and nothing else: the ids were taken once, in setup.
    await first.setProps({label: 'ПО'});
    expect(gradientsOf(first.element as Element).declared).to.deep.eq(a);
  });
});
