import {expect} from 'chai';

/*
 * THE UNIT BUNDLE COMPILES A COMPONENT AS THE PRODUCT DOES (docs/claude/stack.md, decision S3).
 *
 * The product's build (vite.config.mts) compiles every `<script setup vapor>` component's template INLINE — into its
 * setup, by `compileScript` — and so must the bundle the specs run on (scripts/client-tests.mts: the same
 * `vuePluginOptions`, the compile told it is the shipped one). Under webpack the two differed (the unit bundle compiled
 * the template separately, the product inline), and nothing said so. This spec says it for EVERY component of the
 * client, as THIS bundle compiled it: a Vapor component, its template in its setup, no separate render.
 */
const COMPONENTS = import.meta.glob<{default: Record<string, unknown>}>('/src/client/**/*.vue', {eager: true});

describe('the unit bundle compiles every component of the client as the product ships it', () => {
  it('finds the components of src/client (the glob is not empty)', () => {
    expect(Object.keys(COMPONENTS).length).to.be.greaterThan(400);
  });

  it('every one is a Vapor component whose template is compiled INTO its setup — no separate render function', () => {
    const notVapor: Array<string> = [];
    const separate: Array<string> = [];
    for (const [file, module] of Object.entries(COMPONENTS)) {
      const definition = module.default;
      if (definition.__vapor !== true) {
        notVapor.push(file);
      }
      if (typeof definition.render === 'function' || typeof definition.setup !== 'function') {
        separate.push(file);
      }
    }
    expect(notVapor, 'not compiled as Vapor').to.deep.eq([]);
    expect(separate, 'a template compiled apart from its setup (the product inlines it)').to.deep.eq([]);
  });
});
