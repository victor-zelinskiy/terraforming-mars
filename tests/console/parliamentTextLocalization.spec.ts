import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {REDUX_PARTIES} from '../../src/common/parliament/ParliamentTypes';
import {PARTY_EFFECTS, toClientPartyEffect} from '../../src/server/parliament/parties/PartyEffects';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';

/*
 * EVERY SENTENCE THE PARLIAMENT PRINTS IS RUSSIAN ON THE TV (ONE FRAMEWORK — the owner's frame of 2026-10-24: Unity's
 * action in the card composer read «Trade for free. You may advance the colony track 1 step first.» under the RU
 * «ДЕЙСТВИЕ»). A party's / a law's action has no curated card information, so the composer prints its RENDER-DSL
 * sentence — stored WITH its kind («Action: …») — and the formatter looks the BARE sentence up. This walks every
 * sentence the client manifest carries (each node's `description`, prefix stripped as the client strips it; every
 * `text` field of a party and a law) and demands a key in the RU locale. Fails with the list.
 */
const ROOT = path.join(__dirname, '..', '..');
const RU_DIR = path.join(ROOT, 'src', 'locales', 'ru');

function ruKeys(): Set<string> {
  const keys = new Set<string>();
  for (const f of fs.readdirSync(RU_DIR).filter((n) => n.endsWith('.json'))) {
    for (const k of Object.keys(JSON.parse(fs.readFileSync(path.join(RU_DIR, f), 'utf8')))) {
      keys.add(k);
    }
  }
  return keys;
}

function ruValues(): Map<string, string> {
  const values = new Map<string, string>();
  for (const f of fs.readdirSync(RU_DIR).filter((n) => n.endsWith('.json'))) {
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(RU_DIR, f), 'utf8')) as Record<string, unknown>)) {
      if (typeof v === 'string') {
        values.set(k, v);
      }
    }
  }
  return values;
}

const stripKind = (s: string) => s.replace(/^\s*(Effect|Action)\s*:\s*/i, '');

/** Every `description` string of a render tree (a node's printed sentence). */
function descriptions(node: unknown, out: Array<string>): void {
  if (Array.isArray(node)) {
    node.forEach((n) => descriptions(n, out));
    return;
  }
  if (node === null || typeof node !== 'object') {
    return;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'description' && typeof v === 'string' && v.trim() !== '') {
      out.push(stripKind(v.trim()));
    } else {
      descriptions(v, out);
    }
  }
}

function textFields(text: unknown, out: Array<string>): void {
  if (text === null || typeof text !== 'object') {
    return;
  }
  for (const v of Object.values(text as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim() !== '') {
      out.push(v.trim());
    }
  }
}

describe('the Parliament speaks Russian — every printed sentence has an RU key (ONE FRAMEWORK)', () => {
  const keys = ruKeys();
  const missing = (sentences: ReadonlyArray<string>) => [...new Set(sentences)].filter((s) => !keys.has(s));

  it('every party: the action / effect sentences of its render data and its text', () => {
    const sentences: Array<string> = [];
    for (const party of REDUX_PARTIES) {
      const effect = toClientPartyEffect(PARTY_EFFECTS[party]);
      descriptions(effect.passiveRenderData, sentences);
      descriptions(effect.actionRenderData, sentences);
      textFields(effect.text, sentences);
    }
    expect(sentences.length, 'anti-vacuous: the parties print sentences').to.be.greaterThan(6);
    expect(missing(sentences), missing(sentences).join('\n')).to.deep.eq([]);
  });

  it('every resolution: the sentences of its face and its text', () => {
    const sentences: Array<string> = [];
    for (const definition of REDUX_RESOLUTION_CATALOG.all()) {
      descriptions(definition.renderData, sentences);
      textFields(definition.text, sentences);
    }
    expect(sentences.length, 'anti-vacuous: the laws print sentences').to.be.greaterThan(40);
    expect(missing(sentences), missing(sentences).join('\n')).to.deep.eq([]);
  });

  // The effects explorer captions an N-block passive ONE SENTENCE PER BLOCK by splitting the TRANSLATION (a half of the
  // English key has no key of its own: «ВАШИ ЭФФЕКТЫ» printed «2 M€ per TR step you gain.», the owner's frame of
  // 2026-10-24). So a translation keeps the English sentence count, or the blocks fall back to one shared caption.
  it('a passive printed as N sentences keeps N sentences in Russian (the explorer captions one per block)', () => {
    const ru = ruValues();
    const split = (t: string) => t.split(/(?<=\.)\s+/).filter((x) => x.trim() !== '');
    const passives: Array<string> = [];
    for (const party of REDUX_PARTIES) {
      const passive = toClientPartyEffect(PARTY_EFFECTS[party]).text.passive;
      if (passive !== undefined) {
        passives.push(passive);
      }
    }
    for (const definition of REDUX_RESOLUTION_CATALOG.all()) {
      const passive = (definition.text as {passive?: string}).passive;
      if (passive !== undefined) {
        passives.push(passive);
      }
    }
    const multi = passives.filter((t) => split(t).length > 1);
    expect(multi.length, 'anti-vacuous: some passives read as several sentences').to.be.greaterThan(0);
    const broken = multi.filter((t) => ru.has(t) && split(ru.get(t) ?? '').length !== split(t).length);
    expect(broken, broken.join('\n')).to.deep.eq([]);
  });
});
