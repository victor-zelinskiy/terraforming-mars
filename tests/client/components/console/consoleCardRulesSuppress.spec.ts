import {expect} from 'chai';
import {cardHasRules, visibleAnnotations} from '@/client/components/console/consoleCardRules';
import {buildCardAnnotations} from '@/client/components/cardAnnotations/annotationModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CardName} from '@/common/cards/CardName';

/**
 * The fullscreen prints a requirement ONCE. The availability panel states it
 * WITH the current value, so the rules panel hides that one block — addressed
 * by the shared `req:<type>` id the server sends (`requirementKey`), never by
 * comparing rendered text. Everything else the card says stays.
 *
 * (Pure functions, no mount: `ConsoleCardRulesPanel` measures graphic anchors
 * through rAF, which this environment deliberately does not provide.)
 */
function annotationsOf(card: CardName) {
  return buildCardAnnotations(getCard(card)!);
}

function kindsOf(card: CardName, suppress: ReadonlyArray<string> = []): Array<string> {
  return visibleAnnotations(annotationsOf(card), suppress).map((a) => a.kind);
}

describe('rules de-duplication — visibleAnnotations', () => {
  it('the baseline: Livestock states a requirement, an action, an on-play and a VP rule', () => {
    const kinds = kindsOf(CardName.LIVESTOCK);
    expect(kinds).to.include('requirement');
    expect(kinds).to.include('immediate');
    expect(kinds).to.include('action');
    expect(kinds).to.include('victory-points');
  });

  it('hides ONLY the addressed requirement — every effect block stays', () => {
    const kinds = kindsOf(CardName.LIVESTOCK, ['req:O2']);
    expect(kinds, 'the duplicated requirement is gone').to.not.include('requirement');
    expect(kinds, 'the on-play effect is untouched').to.include('immediate');
    expect(kinds, 'the action is untouched').to.include('action');
    expect(kinds, 'the VP rule is untouched').to.include('victory-points');
  });

  it('leaves NO empty group behind — the group disappears with its last row', () => {
    const before = visibleAnnotations(annotationsOf(CardName.LIVESTOCK), []);
    const after = visibleAnnotations(annotationsOf(CardName.LIVESTOCK), ['req:O2']);
    expect(after.length, 'one whole group fewer, not an emptied one').to.eq(before.length - 1);
    expect(after.every((a) => a.rows.length > 0), 'no group survives without rows').to.eq(true);
  });

  it('a card with several requirements loses only the addressed one', () => {
    // Two structurally different requirement blocks on one card.
    const card = annotationsOf(CardName.LAKE_MARINERIS);
    const reqRows = card.filter((a) => a.kind === 'requirement').flatMap((a) => a.rows);
    expect(reqRows.length, 'Lake Marineris prints one requirement').to.be.greaterThan(0);
    const kept = visibleAnnotations(card, ['req:O2']); // a FOREIGN address
    const keptRows = kept.filter((a) => a.kind === 'requirement').flatMap((a) => a.rows);
    expect(keptRows).to.have.length(reqRows.length);
  });

  it('an unrelated address suppresses nothing (a foreign key can never blank a card)', () => {
    expect(kindsOf(CardName.LIVESTOCK, ['req:C', 'req:tag:science'])).to.include('requirement');
  });

  it('cardHasRules answers WITH the suppression — an emptied panel never mounts', () => {
    expect(cardHasRules(CardName.LAKE_MARINERIS), 'baseline').to.eq(true);
    expect(cardHasRules(CardName.LAKE_MARINERIS, ['req:C']), 'still has its on-play rule').to.eq(true);
    // Suppress EVERY block the card owns → nothing left, so no panel mounts.
    const everyId = annotationsOf(CardName.LAKE_MARINERIS).flatMap((a) => a.rows.map((r) => r.id));
    expect(cardHasRules(CardName.LAKE_MARINERIS, everyId)).to.eq(false);
  });
});
