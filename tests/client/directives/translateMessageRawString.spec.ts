import {expect} from 'chai';
import {translateTextWithParams} from '@/client/directives/i18n';

/**
 * RAW_STRING params must survive translation UNCHANGED — the type's own
 * contract ("Raw strings are untranslated").
 *
 * The regression this guards is not hypothetical: the settings row that RENAMES
 * the face buttons («Раскладка кнопок» → «Обмен ${0} / ${1}») passes the glyph
 * labels 'A' and 'B' as params, and `game_end.json` happens to key 'A' (an
 * endgame column head) → 'Н'. The value rendered «Обмен Н / B», i.e. the one
 * setting whose whole job is naming a button was naming the wrong one.
 *
 * Any short RAW param — a glyph label, a typed player name, a formatted number
 * — can collide with an unrelated dictionary key, so the fix is at the type,
 * not at the call site.
 */
describe('translateMessage / RAW_STRING params', () => {
  it('leaves a raw param alone even when it collides with a dictionary key', () => {
    // Under the test i18n the template itself stays English; what matters is
    // that the params come through verbatim, whatever the active dictionary.
    expect(translateTextWithParams('Swap ${0} / ${1}', ['A', 'B'])).to.eq('Swap A / B');
  });

  it('does not mangle raw params that look like ordinary words', () => {
    expect(translateTextWithParams('Press ${0} to continue', ['Options'])).to.eq('Press Options to continue');
  });
});
