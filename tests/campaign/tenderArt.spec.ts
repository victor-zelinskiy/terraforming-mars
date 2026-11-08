import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {TENDER_IDS} from '../../src/common/campaign/tenders';
import {TENDER_ART_DIR, tenderArtUrl} from '../../src/client/console/campaign/tenderArt';

/**
 * THE TENDER ART REGISTRY GUARD (docs/claude/campaign/tender-face.md §4–5) — a kind is registered in `TENDER_ART`
 * only once its file exists (else the table paints a 404 where the engraved glyph stood), and a file imported into
 * the art directory is registered (else it ships unseen).
 */
describe('the tender art registry', () => {
  const root = path.join(__dirname, '../..');

  it('every registered kind has its file', () => {
    const missing = TENDER_IDS.filter((id) => {
      const url = tenderArtUrl(id);
      return url !== undefined && !fs.existsSync(path.join(root, url));
    });
    expect(missing, 'registered without a file').is.empty;
  });

  it('every imported file is registered', () => {
    const dir = path.join(root, TENDER_ART_DIR);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.webp')) : [];
    const unregistered = files.filter((f) => !TENDER_IDS.some((id) => tenderArtUrl(id) === `${TENDER_ART_DIR}/${f}`));
    expect(unregistered, 'imported but not in TENDER_ART').is.empty;
  });
});
