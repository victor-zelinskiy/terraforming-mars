import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {execFileSync} from 'child_process';
import {albumSpecFor, planAlbumPage, planHandAlbum} from '../../src/client/components/console/consoleHandAlbum';

/*
 * THE CARD ALBUM CHASSIS — ONE geometry for every «choose N cards from a hand» surface (P87, the owner 2026-11-01:
 * «"Наследие проектов" решает ту же задачу, что "Карты в руке", а выглядит как отдельный движок»).
 *
 * The hand (`.con-hand__*`) and the host-agnostic album (`.con-album__*`, `foundation/ConsoleCardAlbum.vue` — the
 * campaign's carryover first) must lay a hand out IDENTICALLY by construction, three ways:
 *  1. THE STYLESHEET: compiled with the same `lessc` `make:css` runs, each geometry piece of the album (viewport · strip
 *     · page · row · slot) declares EXACTLY the hand's declarations — the mixins of `console_card_album.less` are the
 *     only source, and neither side restates the geometry beside them;
 *  2. THE PLANNER: both components plan through `consoleHandAlbum.ts` (`planHandAlbum` / `planAlbumPage` /
 *     `stepHandAlbum`), and nothing on the album's road reaches for a second engine (`wsStageLayout` — the old picker's
 *     «own engine»);
 *  3. THE LIMIT: no client file knows the server's default carry limit — the seat's number arrives on the model.
 */
type Decls = Map<string, string>;

function compiled(): Map<string, Decls> {
  const css = execFileSync(process.execPath, [path.resolve('node_modules/less/bin/lessc'), path.resolve('src/styles/common.less')],
    {encoding: 'utf8', maxBuffer: 1 << 26}).replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map<string, Decls>();
  const rule = /([^{}@]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(css)) !== null) {
    for (const raw of m[1].split(',')) {
      const selector = raw.trim().replace(/\s+/g, ' ');
      const decls = out.get(selector) ?? new Map<string, string>();
      for (const d of m[2].split(';')) {
        const at = d.indexOf(':');
        if (at > 0) {
          decls.set(d.slice(0, at).trim(), d.slice(at + 1).trim());
        }
      }
      out.set(selector, decls);
    }
  }
  return out;
}

const read = (p: string) => fs.readFileSync(path.resolve(p), 'utf8');

describe('albumChassisParity — the hand and the album are ONE chassis (P87)', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60_000);
  let rules = new Map<string, Decls>();
  before(() => {
    rules = compiled();
  });

  /** The geometry pieces: [hand selector, album selector, the properties the chassis owns]. */
  const PIECES: ReadonlyArray<[string, string, ReadonlyArray<string>]> = [
    ['.con-hand__album', '.con-album', ['position', 'flex', 'min-width', 'min-height', 'overflow']],
    ['.con-hand__pagestrip', '.con-album__strip', ['position', 'inset']],
    ['.con-hand__pagestrip--live', '.con-album__strip--live', ['transition']],
    ['.con-hand__pagestrip--turning', '.con-album__strip--turning', ['will-change']],
    ['.con-hand__page', '.con-album__page', ['position', 'left', 'top', 'display', 'flex-direction']],
    ['.con-hand__row', '.con-album__row', ['display', 'align-items', 'justify-content']],
    ['.con-hand__slot', '.con-album__slot', ['position', 'flex-shrink', 'zoom', '--con-hand-fx', 'transform', '--con-cursor-on', '--con-cursor-z']],
    ['.con-hand__slot--selected', '.con-album__slot--selected', ['--con-cursor-on', '--con-cursor-zdelay', 'z-index']],
    ['.con-hand__slot::after', '.con-album__slot::after', ['position', 'inset', 'border-radius', 'box-shadow', 'opacity', 'transition']],
    ['.con-hand__slot .con-cards__pickband', '.con-album__slot .con-cards__pickband', ['zoom']],
  ];

  for (const [hand, album, props] of PIECES) {
    it(`${album} declares the hand's ${hand} geometry, byte for byte`, () => {
      const h = rules.get(hand);
      const a = rules.get(album);
      expect(h, `${hand} compiled`).not.undefined;
      expect(a, `${album} compiled`).not.undefined;
      for (const prop of props) {
        if (!h!.has(prop)) {
          continue; // a pseudo layer may not set every property of the list
        }
        expect(a!.get(prop), `${album} { ${prop} }`).eq(h!.get(prop));
      }
    });
  }

  it('the geometry is written ONCE — the hand and the album apply the chassis mixins, neither restates them', () => {
    const consoleLess = read('src/styles/console.less');
    const chassis = read('src/styles/console_card_album.less');
    for (const call of ['.con-album-viewport();', '.con-album-strip();', '.con-album-page();', '.con-album-row();', '.con-album-slot();']) {
      expect(consoleLess, `the hand applies ${call}`).include(call);
      expect(chassis.split(call).length - 1, `the album applies ${call}`).greaterThan(0);
    }
    // The hand's slot no longer spells the chassis' own lines.
    const handSlot = consoleLess.slice(consoleLess.indexOf('    &__slot {\n        /* THE CHASSIS'));
    expect(handSlot.slice(0, 400)).not.include('zoom: var(--con-hand-zoom');
  });

  it('both albums plan through ONE planner, and the carryover road knows no second engine', () => {
    const album = read('src/client/components/console/foundation/ConsoleCardAlbum.vue');
    const hand = read('src/client/components/console/ConsoleHandSection.vue');
    for (const fn of ['planHandAlbum', 'planAlbumPage', 'pageRowsFor']) {
      expect(album, `ConsoleCardAlbum uses ${fn}`).include(fn);
      expect(hand, `ConsoleHandSection uses ${fn}`).include(fn);
    }
    expect(album).include('stepHandAlbum');
    const picker = read('src/client/components/console/campaign/ConsoleCarryoverPicker.vue');
    expect(picker).include('ConsoleCardAlbum');
    expect(picker).include('ConsoleAlbumSpine');
    expect(picker).include('ConsoleWsHead');
    expect(picker, 'no second grid engine').not.include('wsStageLayout');
    expect(picker, 'no keep-slots / empty sockets').not.match(/data-carry-slot|--away|slotIndex in/);
  });

  it('the same box and profile give ONE plan for 1…15 cards (the planner the two albums share)', () => {
    for (const profile of ['tv', 'standard', 'handheld'] as const) {
      const spec = albumSpecFor(profile);
      for (let n = 1; n <= 15; n++) {
        const input = {availW: 3200, availH: 1300, count: n, spec, uiScale: profile === 'tv' ? 2 : 1};
        const base = planHandAlbum(input);
        expect(base.pageCount).eq(Math.ceil(n / base.perPage));
        expect(base.cardZoom, 'the standard card does not depend on the count').eq(planHandAlbum({...input, count: 1}).cardZoom);
        const onLast = n - (base.pageCount - 1) * base.perPage;
        const page = planAlbumPage(input, onLast, base);
        expect(page.rows.reduce((a, b) => a + b, 0)).eq(onLast);
      }
    }
  });

  it('the client never knows the default carry limit — the seat\'s number arrives on the model', () => {
    const offenders: Array<string> = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(p);
        } else if (/\.(ts|vue)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('CARRYOVER_MAX_CARDS')) {
          offenders.push(p);
        }
      }
    };
    walk(path.resolve('src/client'));
    expect(offenders).deep.eq([]);
    const map = read('src/client/components/console/campaign/ConsoleCampaignMap.vue');
    expect(map, 'the toggle reads the seat limit').include('yourCarryLimit');
    // `<script setup>`: the script reads the draft as `carryDraft.value.length`, the template as `carryDraft.length`.
    expect(map).not.match(/carryDraft(?:\.value)?\.length < 2/);
  });
});
