/*
 * NomadToken — the Mars Nomads camp marker (the board cell, the premium card face, the console flight proxies). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): four props in, nothing out — the spec is what
 * it renders for them, that the landing entrance is furniture of the `drop` only, and that the gradient ids stay ONE
 * count per page: the counter lives in `nomadTokenState.ts` (R25 — inside `<script setup>` it would start again in
 * every token, and every token on a page would paint with the first one's gradients).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import NomadToken from '@/client/components/NomadToken.vue';

function token(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  return mount(NomadToken, {props, attrs, global: {config: globalConfig.global.config}});
}

/** The ids of a token's gradient defs, in the template's order (lid, side, sheen, seam). */
function defIds(root: Element): Array<string> {
  return Array.from(root.querySelectorAll('.nomad-token__defs defs > *')).map((def) => def.id);
}

/** Every gradient a token's faces point at (`url(#id)` on a fill or a stroke), without repeats. */
function paintedIds(root: Element): Array<string> {
  const ids = new Set<string>();
  for (const el of Array.from(root.querySelectorAll('.nomad-token__cube [fill^="url("], .nomad-token__cube [stroke^="url("]'))) {
    for (const attr of ['fill', 'stroke']) {
      const match = /^url\(#(.+)\)$/.exec(el.getAttribute(attr) ?? '');
      if (match !== null) {
        ids.add(match[1]);
      }
    }
  }
  return [...ids];
}

describe('NomadToken — the Mars Nomads marker', () => {
  it('renders the module for its props: the footprint, three faces with the wayfinder on the lid, the glow and the shadow unless dropped', () => {
    const w = token();
    const root = w.element as HTMLElement;
    expect(root.tagName).to.eq('SPAN');
    expect(w.classes()).to.deep.eq(['nomad-token']);
    expect(w.attributes('role')).to.eq('img');
    expect(w.attributes('aria-label')).to.eq('Mars Nomads');
    expect(root.style.getPropertyValue('--nt-size'), 'the default footprint').to.eq('18px');
    expect(w.findAll('.nomad-token__face').map((face) => face.classes()[1])).to.deep.eq(['nomad-token__face--right', 'nomad-token__face--left', 'nomad-token__face--top']);
    expect(w.find('.nomad-token__face--top .nomad-token__mark').exists(), 'the engraved mark is the identity').to.eq(true);
    expect(w.find('.nomad-token__glow').exists()).to.eq(true);
    expect(w.find('.nomad-token__shadow').exists()).to.eq(true);

    const bare = token({size: 44, glow: false, shadow: false});
    expect((bare.element as HTMLElement).style.getPropertyValue('--nt-size')).to.eq('44px');
    expect(bare.find('.nomad-token__glow').exists()).to.eq(false);
    expect(bare.find('.nomad-token__shadow').exists()).to.eq(false);
  });

  it('the landing entrance is the `drop` only: its class, the cell halo and the dust ring come and go with the prop', async () => {
    const w = token();
    expect(w.find('.nomad-token__halo').exists()).to.eq(false);
    expect(w.find('.nomad-token__dust').exists()).to.eq(false);

    await w.setProps({landing: 'drop'});
    expect(w.classes()).to.deep.eq(['nomad-token', 'nomad-token--landing']);
    expect(w.find('.nomad-token__halo').exists()).to.eq(true);
    expect(w.find('.nomad-token__dust').exists()).to.eq(true);

    await w.setProps({landing: 'none'});
    expect(w.classes()).to.deep.eq(['nomad-token']);
    expect(w.find('.nomad-token__halo').exists()).to.eq(false);
  });

  it('gradient ids are per instance — one count for the whole page — and every face paints with its OWN token\'s defs', () => {
    const first = token();
    const second = token();
    const a = defIds(first.element as Element);
    const b = defIds(second.element as Element);
    expect(a.map((id) => id.replace(/\d+$/, ''))).to.deep.eq(['nt-lid-', 'nt-side-', 'nt-sheen-', 'nt-seam-']);
    expect(new Set([...a, ...b]).size, 'two tokens on one page never share a gradient id').to.eq(8);
    const uid = (ids: Array<string>) => Number(/\d+$/.exec(ids[0])?.[0]);
    expect(uid(b), 'the next token takes the next number of ONE counter').to.eq(uid(a) + 1);
    expect(paintedIds(first.element as Element).sort()).to.deep.eq([...a].sort());
    expect(paintedIds(second.element as Element).sort()).to.deep.eq([...b].sort());
  });

  it('the template STARTS WITH ITS ROOT — what a host puts on the token lands on the token itself', () => {
    const w = token({}, {'class': 'board-space-nomad', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.include.members(['nomad-token', 'board-space-nomad']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
