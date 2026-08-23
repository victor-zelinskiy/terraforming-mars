/*
 * GUARD: every resource-icon class the client can emit DYNAMICALLY has a
 * definition in the styles.
 *
 * `BenefitGlyph` (colony track / trade / bonus slots) builds its icon class
 * from the SERVER's enums at runtime — `resource.toLowerCase()` /
 * `cardResource.toLowerCase()` — so NO string literal exists in any template.
 * A live-class corpus built from source literals cannot see this shape: the
 * LESS-debt cut dropped `.plants` (an `:extend(.plant)` alias) and `.fighter`
 * exactly this way, and Ganymede's plant icons rendered as empty boxes on
 * both the track and the bonus rows.
 *
 * This spec pins the contract by ENUM, not by grep: every `Resource` value
 * and every card resource the colony/help surfaces can name must have a
 * top-level definition (rule, group member or `:extend` alias) in
 * card_render_dsl.less.
 */
import * as fs from 'fs';
import * as path from 'path';
import {expect} from 'chai';
import {ALL_RESOURCES} from '../../src/common/Resource';

// Card resources the bare-icon language ships art for (the original
// cards.less set). Exotic expansion resources without a bare class never had
// one — extend this list when one gains art.
const CARD_RESOURCE_CLASSES = [
  'animal', 'microbe', 'fighter', 'science', 'floater', 'asteroid', 'camp', 'data',
];

describe('resource icon definitions', () => {
  const less = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'card_render_dsl.less'), 'utf-8');

  function defined(cls: string): boolean {
    // A definition is `.cls {`, `.cls,` (grouped selector) or `.cls:extend`/
    // an alias block `.cls {\n &:extend(...)` — the leading-dot + boundary
    // check covers them all without matching substrings (.plant vs .plants).
    return new RegExp(String.raw`\.${cls}\s*[{,:\s]`).test(less);
  }

  it('every Resource enum value has a bare icon class (BenefitGlyph emits them dynamically)', () => {
    const missing = ALL_RESOURCES.filter((r) => !defined(r));
    expect(missing, `card_render_dsl.less is missing bare classes for: ${missing.join(', ')}`).to.deep.eq([]);
  });

  it('every shipped card-resource icon class is defined', () => {
    const missing = CARD_RESOURCE_CLASSES.filter((r) => !defined(r));
    expect(missing, `card_render_dsl.less is missing card-resource classes for: ${missing.join(', ')}`).to.deep.eq([]);
  });
});
