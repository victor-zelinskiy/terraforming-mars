import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {VENUS_TRACK} from '../../src/server/automa/boards/VenusMarsBot';

/**
 * GUARD: every track-tag LABEL a MarsBot log can emit has a Russian entry.
 *
 * Two automa log sites print a track's identity as `tags.join('/')` inside a
 * STRING token (`AutomaAres` — the hazard regression; `MarsBotUtopiaInvest` —
 * the corp pull-back). The client translates the WHOLE token value, so a
 * composite like `jovian/earth` needs its own locale key — the per-tag keys
 * («jovian» → «Юпитер») do not compose by themselves. This walks the REAL
 * track definitions (every supported board + the Venus track), so adding a
 * map profile with a new tag combination fails HERE with the exact missing
 * keys instead of leaking a raw enum composite into the Russian UI.
 */
describe('MarsBot track tag labels — RU localization guard', () => {
  function mergedRuDictionary(): Record<string, string> {
    const dir = path.join(__dirname, '..', '..', 'src', 'locales', 'ru');
    const merged: Record<string, string> = {};
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) {
        continue;
      }
      Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
    }
    return merged;
  }

  it('every tags.join("/") label of every supported board is translated', () => {
    const ru = mergedRuDictionary();
    const labels = new Set<string>();
    for (const board of MARSBOT_BOARDS) {
      for (const track of marsBotMapProfile(board).tracks) {
        labels.add(track.tags.join('/'));
      }
    }
    labels.add(VENUS_TRACK.tags.join('/'));
    const missing = [...labels].filter((label) => ru[label] === undefined);
    expect(missing, `Add RU keys for these track tag labels (locales/ru/automa.json): ${missing.join(', ')}`).to.deep.eq([]);
  });
});
