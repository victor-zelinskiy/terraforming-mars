import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * NO NATIVE `<Teleport>` INTO A TARGET THAT CAN BE ABSENT.
 *
 * Vue's `<Teleport>` mounted while its target is not in the document mounts
 * NOTHING and keeps the never-mounted children as its old vnode; the next patch
 * walks component vnodes with no instance and throws (`emitsOptions` of null,
 * then `bum` / `parentNode` / `exposed` on unmount). The field crash of
 * game-pdb19bfa (2026-11-07): the hand's stale fleet-berth selector reached the
 * colonies hosted by the standard projects, the dock teleported into nothing,
 * and the colony step stopped patching — a server question with no surface.
 *
 * `body` is always there. Every other target — a published slot, a berth, a
 * sibling's `[data-…]` node, an element ref — goes through
 * `foundation/ConsoleTeleport.vue`, which renders nowhere until the target
 * exists. A new native teleport with any other `to` fails here with its file.
 *
 * (That paragraph is the VIRTUAL-DOM teleport's crash. The Vapor one — the only
 * one since V4 — does not throw: mounted into an absent target it mounts
 * nothing and stays silent, and nothing re-resolves its selector. The law is
 * the same and the reason is plainer: the surface would simply never appear.
 * The wrapper itself is the ONE file that owns a native teleport with a
 * computed target — the element it resolved.)
 */
const WRAPPER = 'components/console/foundation/ConsoleTeleport.vue';
const SRC = path.resolve(__dirname, '../../src/client');

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (entry.name.endsWith('.vue')) {
      out.push(p);
    }
  }
  return out;
}

/** Every `<Teleport …>` opening tag of a template, HTML comments skipped (they name the tag in prose). */
function nativeTeleports(text: string): Array<string> {
  const end = text.indexOf('<script');
  const template = (end === -1 ? text : text.slice(0, end)).replace(/<!--[\s\S]*?-->/g, '');
  return template.match(/<Teleport\b[^>]*>/g) ?? [];
}

describe('teleportTargetGuard — a teleport never mounts into nothing', () => {
  const files = walk(SRC).map((file) => ({file: path.relative(SRC, file).replace(/\\/g, '/'), text: fs.readFileSync(file, 'utf8')}));

  it('every native <Teleport> targets the literal body', () => {
    const offenders: Array<string> = [];
    for (const {file, text} of files) {
      if (file === WRAPPER) {
        continue;
      }
      for (const tag of nativeTeleports(text)) {
        if (!/\sto="body"/.test(tag) || /\s:to=/.test(tag)) {
          offenders.push(`${file}: ${tag.replace(/\s+/g, ' ')}`);
        }
      }
    }
    expect(offenders, 'use <ConsoleTeleport> (foundation/ConsoleTeleport.vue) for a target that can be absent').to.deep.eq([]);
  });

  it('the guard sees the teleports it lets through (positive control)', () => {
    expect(files.some(({text}) => nativeTeleports(text).length > 0)).to.eq(true);
    expect(nativeTeleports('<template><!-- a `<Teleport :to="x">` in prose --><Teleport :to="x"></Teleport></template>'))
      .to.deep.eq(['<Teleport :to="x">']);
    expect(files.filter(({text}) => text.includes('<ConsoleTeleport')).length).to.be.greaterThan(5);
  });

  it('the wrapper owns ONE native teleport, and its target is the plan\'s resolved element — never the raw prop', () => {
    const wrapper = files.find(({file}) => file === WRAPPER);
    expect(wrapper, WRAPPER).not.to.eq(undefined);
    expect(nativeTeleports(wrapper!.text).map((tag) => tag.replace(/\s+/g, ' ')))
      .to.deep.eq(['<Teleport v-if="plan.mounted" :key="plan.generation" :to="plan.to" :disabled="plan.disabled">']);
  });

  it('the colonies read only the berth of the host hosting them', () => {
    const section = files.find(({file}) => file.endsWith('console/ConsoleColoniesSection.vue'));
    expect(section?.text).to.include('colonyFleetBerthFor(workspaceFrameHost(\'colonies\'))');
    for (const {file, text} of files) {
      expect(text, file).not.to.match(/setColonyFleetBerth\(/);
    }
  });
});
