import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PreludeOutlook} from '@/common/cards/PreludeOutlook';
import {
  isPreludeEnabler, preludeBadge, preludeEnablerBadge, preludeRisk,
  PRELUDE_RISK_HOLD_LABEL, PRELUDE_RISK_PRESS_LABEL,
} from '@/client/console/startPreludeRisk';

/**
 * THE ONE PRESENTATION of the server's order-aware verdict.
 *
 * The defect: the deployment printed «Сначала разыграйте другой пролог» over a
 * command bar reading «A — Подтвердить». Both sentences were true; together
 * they could only be read as «press A to go to the other prelude», and A burned
 * the card. These assertions exist to keep the warning and the VERB derived
 * from the same value, and to keep a promise out of the `possible` case.
 */

const NAMED = (n: CardName) => `«${n}»`;

function deferred(
  certainty: 'guaranteed' | 'possible',
  enablers: ReadonlyArray<CardName>,
  need: 'playedPrelude' | 'playableCard'): PreludeOutlook {
  return {state: 'deferred', certainty, enablers, need};
}

describe('startPreludeRisk (the order-aware verdict as words)', () => {
  it('a playable prelude has no risk to describe and no gate to arm', () => {
    expect(preludeRisk({state: 'playable'}, NAMED)).to.be.undefined;
    expect(preludeRisk(undefined, NAMED), 'an older server sends nothing').to.be.undefined;
    expect(preludeBadge({state: 'playable'})).to.be.undefined;
  });

  /** SCENARIO 1 — the copy prelude. The order fix is real, so SAY it. */
  it('a guaranteed order fix names the one enabling prelude', () => {
    const risk = preludeRisk(deferred('guaranteed', [CardName.ECOLOGY_EXPERTS], 'playedPrelude'), NAMED);
    expect(risk?.tone).to.eq('guaranteed');
    expect(risk?.badge, 'the badge is the situation, never a flat «СГОРИТ»').to.eq('Another prelude first');
    expect(risk?.title).to.eq('Nothing to repeat yet');
    expect(risk?.body).to.contain('${0}');
    expect(risk?.bodyParams).to.deep.eq(['«Ecology Experts»']);
  });

  it('…and stays general when SEVERAL preludes would do — the UI never picks for the player', () => {
    const risk = preludeRisk(
      deferred('guaranteed', [CardName.ECOLOGY_EXPERTS, CardName.BIOLAB], 'playedPrelude'), NAMED);
    expect(risk?.bodyParams, 'no arbitrary favourite').to.deep.eq([]);
    expect(risk?.body).to.not.contain('${0}');
    expect(risk?.enablers, 'but every candidate is still carried, for the tie').to.deep.eq(
      [CardName.ECOLOGY_EXPERTS, CardName.BIOLAB]);
  });

  /** SCENARIO 2 — the target-in-hand prelude. A draw MAY help. Never «will». */
  it('a POSSIBLE fix is worded as a possibility, never as a promise', () => {
    const one = preludeRisk(deferred('possible', [CardName.BIOLAB], 'playableCard'), NAMED);
    expect(one?.tone).to.eq('possible');
    expect(one?.badge).to.eq('No target yet');
    expect(one?.title).to.eq('No available project right now');
    expect(one?.body, 'the modal verb is doing real work').to.contain('may');
    expect(one?.body).to.not.contain('will add');

    const many = preludeRisk(
      deferred('possible', [CardName.BIOLAB, CardName.MARTIAN_SURVEY], 'playableCard'), NAMED);
    expect(many?.body).to.contain('may open');
    expect(many?.bodyParams).to.deep.eq([]);
  });

  it('a FINAL verdict says the effect is lost and offers no hope', () => {
    const risk = preludeRisk({state: 'noEffect', need: 'playableCard'}, NAMED);
    expect(risk?.tone).to.eq('final');
    expect(risk?.badge).to.eq('Effect will not happen');
    expect(risk?.body).to.contain('lose its effect');
    expect(risk?.body, 'nothing may suggest waiting when nothing can change').to.not.contain('may');
    expect(risk?.enablers).to.deep.eq([]);
  });

  it('a final verdict about a copy effect still names what is missing', () => {
    expect(preludeRisk({state: 'noEffect', need: 'playedPrelude'}, NAMED)?.title).to.eq('Nothing to repeat yet');
  });

  /**
   * …and a final verdict from a card that declared NO `preludeNeeds` must not
   * borrow either named heading. Boom Town wants a board cell with a
   * steel/titanium bonus and Strategic Base Planning wants 3 M€ — «нет
   * доступного проекта» would send the player to look at their hand, which is
   * not where either blocker is.
   */
  it('a final verdict with no declared need stays general — it never claims the hand is the blocker', () => {
    const risk = preludeRisk({state: 'noEffect'}, NAMED);
    expect(risk?.tone).to.eq('final');
    expect(risk?.title).to.eq('Nothing can meet its condition');
    expect(risk?.title, 'the hand is not the blocker here').to.not.eq('No available project right now');
    expect(risk?.body).to.contain('lose its effect');
  });

  /**
   * THE CORE INVARIANT: the verb of the committing press comes out of the same
   * call as the warning, and it always names the loss.
   */
  it('every risk carries a commit verb that names the LOSS, never a generic confirm', () => {
    const shapes: ReadonlyArray<PreludeOutlook> = [
      deferred('guaranteed', [CardName.BIOLAB], 'playedPrelude'),
      deferred('possible', [CardName.BIOLAB], 'playableCard'),
      {state: 'noEffect', need: 'playableCard'},
      {state: 'noEffect'},
    ];
    for (const outlook of shapes) {
      const held = preludeRisk(outlook, NAMED, {hold: true});
      expect(held?.commitLabel, JSON.stringify(outlook)).to.eq(PRELUDE_RISK_HOLD_LABEL);
      const tapped = preludeRisk(outlook, NAMED, {hold: false});
      expect(tapped?.commitLabel).to.eq(PRELUDE_RISK_PRESS_LABEL);
      for (const label of [held, tapped]) {
        expect(['Confirm', 'Press again to confirm', 'Play now', 'Play'],
          'a generic verb is exactly the contradiction this replaces')
          .to.not.include(label?.commitLabel);
      }
    }
  });

  it('the badge and the risk stage always describe the SAME situation', () => {
    const outlook = deferred('possible', [CardName.BIOLAB], 'playableCard');
    expect(preludeBadge(outlook)).to.eq(preludeRisk(outlook, NAMED)?.badge);
  });

  describe('isPreludeEnabler', () => {
    it('marks every enabler equally and nothing else', () => {
      const outlook = deferred('guaranteed', [CardName.BIOLAB, CardName.MARTIAN_SURVEY], 'playedPrelude');
      expect(isPreludeEnabler(outlook, CardName.BIOLAB)).to.be.true;
      expect(isPreludeEnabler(outlook, CardName.MARTIAN_SURVEY)).to.be.true;
      expect(isPreludeEnabler(outlook, CardName.ECOLOGY_EXPERTS)).to.be.false;
    });

    it('a final verdict ties to nothing — there is nothing to point at', () => {
      expect(isPreludeEnabler({state: 'noEffect'}, CardName.BIOLAB)).to.be.false;
      expect(isPreludeEnabler(undefined, CardName.BIOLAB)).to.be.false;
    });

    /**
     * The tie must not over-promise either: «сначала этот» is a statement about
     * a card that WILL create the condition, and it would be a lie on a card
     * that merely might draw something useful.
     */
    it('the tie says «first» only when the fix is guaranteed', () => {
      expect(preludeEnablerBadge(deferred('guaranteed', [CardName.BIOLAB], 'playedPrelude')))
        .to.eq('Play this one first');
      expect(preludeEnablerBadge(deferred('possible', [CardName.BIOLAB], 'playableCard')))
        .to.eq('Enables the waiting prelude');
      expect(preludeEnablerBadge({state: 'noEffect'})).to.be.undefined;
      expect(preludeEnablerBadge({state: 'playable'})).to.be.undefined;
    });
  });
});
