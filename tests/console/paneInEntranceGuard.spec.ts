/*
 * A SIGNAL CARRIED BY AN ENTRANCE IS SAID ON MOUNT TOO — the class of the sixth count's game 1676 (FREEZE ZERO).
 *
 * A `<transition>` plays no entrance for an element present at its first render. Where the entrance hook is what
 * publishes a zone — the pane «has entered» (`noteTableAnswerPaneIn`, `noteParliamentDrawPaneIn`, a receipt's
 * `paneIn = true`), and only then is a question or a reveal teleported in — a surface mounted with the element already
 * up (taken back from «Свернуть», a reload) never published its zone: the question had nowhere to stand, every press was
 * deaf until the liveness ladder parked the screen. Twice so: the sitting's answer LAYER and the section's own answer
 * stage (the chairman quest), both reproduced and red before their fix (`console-sitting-pick-collapse-restore`).
 *
 * The law, read off every console component: a transition whose enter hook says such a signal is `appear` — or the
 * component's mount says the same signal for an element present at the first render.
 */
import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..', 'src', 'client', 'components', 'console');
const SIGNAL = /\b(note\w*PaneIn)\(|(\w+\.paneIn) = true/g;

function vueFiles(dir: string): Array<string> {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? vueFiles(full) : entry.name.endsWith('.vue') ? [full] : [];
  });
}

/** The body of a top-level `function name(…) { … }` of the script (to its closing brace at column 0). */
function functionBody(script: string, name: string): string {
  const at = script.search(new RegExp(`\\nfunction ${name}\\(`));
  if (at === -1) {
    return '';
  }
  const end = script.indexOf('\n}\n', at);
  return script.slice(at, end === -1 ? undefined : end);
}

/** The bodies of every `onMounted(` block of the script. */
function mountBodies(script: string): string {
  const out: Array<string> = [];
  for (let at = script.indexOf('onMounted('); at !== -1; at = script.indexOf('onMounted(', at + 1)) {
    const end = script.indexOf('\n});\n', at);
    out.push(script.slice(at, end === -1 ? undefined : end));
  }
  return out.join('\n');
}

describe('a signal carried by an entrance is said on mount too', () => {
  const offenders: Array<string> = [];
  let carriers = 0;
  for (const file of vueFiles(ROOT)) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const script = text.slice(text.indexOf('<script'));
    const mounted = mountBodies(script);
    for (const tag of text.matchAll(/<transition\b[^>]*>/g)) {
      const enter = /@enter="(\w+)"/.exec(tag[0]);
      if (enter === null) {
        continue;
      }
      const body = functionBody(script, enter[1]);
      const signals = [...body.matchAll(SIGNAL)].map((m) => m[1] ?? m[2]);
      if (signals.length === 0) {
        continue;
      }
      carriers++;
      if (/\sappear\b/.test(tag[0])) {
        continue;
      }
      const unsaid = [...new Set(signals)].filter((signal) => !mounted.includes(signal));
      if (unsaid.length > 0) {
        offenders.push(`${path.relative(ROOT, file).split(path.sep).join('/')}: <transition @enter="${enter[1]}"> says ${unsaid.join(', ')} — not appear, and the mount never says it`);
      }
    }
  }

  it('the carriers are found (anti-vacuous): the sitting\'s layers and the section\'s stage', () => {
    expect(carriers, 'transitions whose entrance publishes a pane').to.be.at.least(5);
  });

  it('every one of them enters on mount (`appear`) or its component says the signal on mount', () => {
    expect(offenders).to.deep.equal([]);
  });
});
