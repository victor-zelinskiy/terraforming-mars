import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {CARD_REQUIREMENT_ICON, countedCardCoverUrl, mechItemIcon} from '@/client/components/premiumCard/premiumCardIcons';
import {normalizeRequirement} from '@/client/components/premiumCard/premiumCardViewModel';
import {unplayableReasonEmblem} from '@/client/components/handCards/unplayableReasonFormat';
import {AltSecondaryTag} from '@/common/cards/render/AltSecondaryTag';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {ICardRenderItem} from '@/common/cards/render/Types';
import {UnplayableReason} from '@/common/cards/UnplayableReason';

/**
 * «A CARD WITH A REQUIREMENT» IS ONE MARK (PL-1691, the owner 2026-11-04: «MIN выглядит странно и непремиум (тем
 * более на анг в рус версии) — заменить и унифицировать»). Three drawings stood for one idea — a copper bar over the
 * card on the face, a bare plate with the English word «MIN» (the quest footnote, the draw search's rule) and a flat
 * cream clip-art card (the TR68 requirement chip, the hand's reason). Now every surface reads ONE asset: the face's
 * card cover carrying the face's own requirements banner, empty as the printed symbol is — no word in any language.
 */
function item(type: CardRenderItemType, secondaryTag?: AltSecondaryTag): ICardRenderItem {
  return {is: 'item', type, amount: 1, ...(secondaryTag === undefined ? {} : {secondaryTag})} as ICardRenderItem;
}

describe('the «card with a requirement» mark (PL-1691)', () => {
  it('is ONE asset, and it exists', () => {
    expect(CARD_REQUIREMENT_ICON).eq('assets/misc/card-requirement.webp');
    expect(fs.existsSync(path.resolve(CARD_REQUIREMENT_ICON)), 'built by scripts/make-card-requirement-icon.mjs').is.true;
    expect(fs.existsSync(path.resolve('assets/misc/card-requirement.svg')), 'the old clip-art is gone').is.false;
  });

  it('the face, the quest footnote, the TR68 chip and the hand\'s reason all print it', () => {
    expect(mechItemIcon(item(CardRenderItemType.CARDS, AltSecondaryTag.REQ)), 'the face: cards(n, {secondaryTag: REQ})').deep.eq({kind: 'img', url: CARD_REQUIREMENT_ICON});
    expect(mechItemIcon(item(CardRenderItemType.REQUIREMENT_PLATE)), 'the quest footnote (RX36)').deep.eq({kind: 'img', url: CARD_REQUIREMENT_ICON});
    expect(normalizeRequirement({cardsWithRequirements: 5}).iconUrl, 'the TR68 requirement chip').eq(CARD_REQUIREMENT_ICON);
    const reason: UnplayableReason = {type: 'count', message: 'Requires ${0} played cards with requirements', params: ['5'], current: 4, requirement: true};
    expect(unplayableReasonEmblem(reason), 'the hand\'s reason badge').eq(CARD_REQUIREMENT_ICON);
  });

  it('a plain card keeps the bare cover — the mark is the requirement, never a second cover', () => {
    expect(mechItemIcon(item(CardRenderItemType.CARDS))).deep.eq({kind: 'img', url: countedCardCoverUrl()});
  });

  it('no client source prints the «MIN» word or the bare plate for the concept', () => {
    const offenders: Array<string> = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(full);
        } else if (/\.(vue|ts|less)$/.test(e.name)) {
          const text = fs.readFileSync(full, 'utf8');
          if (/>\s*MIN\s*</.test(text) || /pprq__min|pprq--bare|:bare=|\sbare\s*\/>/.test(text)) {
            offenders.push(full);
          }
        }
      }
    };
    walk(path.resolve('src/client'));
    walk(path.resolve('src/styles'));
    expect(offenders).deep.eq([]);
  });
});
