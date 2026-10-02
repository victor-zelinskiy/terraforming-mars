import {expect} from 'chai';
import {iconNeedlesFor} from '@/client/console/consoleActionCommitMotion';
import {cardResourceIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import {CardResource} from '@/common/CardResource';

/**
 * The ACTION COMMIT's impulse lands on the result icon it finds by sprite URL. A
 * key with no needle silently degrades the impulse to the whole plate — which is
 * how mech, fighter, graphene and then data (TR18 Martian Fiber) each shipped.
 */
describe('consoleActionCommitMotion — iconNeedlesFor', () => {
  it('every CARD resource finds its result icon by the sprite the face paints — no row per resource', () => {
    const missing: Array<string> = [];
    for (const resource of Object.values(CardResource)) {
      // The preview's key for a card resource (`actionPreviews.cardResourceIcon`).
      const key = resource.toLowerCase().replace(/\s+/g, '-');
      const painted = `url("${cardResourceIconUrl(resource)}")`;
      const needles = iconNeedlesFor(key);
      if (needles === undefined || !needles.some((n) => painted.includes(n))) {
        missing.push(`${resource} (${key})`);
      }
    }
    expect(missing, 'card resources whose commit impulse cannot find its icon').deep.eq([]);
  });

  it('data is matched by its own sprite and never by a `data:` URI', () => {
    const needles = iconNeedlesFor('data') ?? [];
    expect(needles.some((n) => 'url("assets/resources/data.png")'.includes(n))).is.true;
    expect(needles.some((n) => 'url("data:image/png;base64,AAAA")'.includes(n))).is.false;
  });

  it('a key that is no icon at all has no needle', () => {
    expect(iconNeedlesFor('no-such-icon')).is.undefined;
  });
});
