import {expect} from 'chai';
import {
  BAND_PHRASE_LABEL, bandStatements, chipIsCost, clusterSides, notificationGlyph, transferTaker,
} from '@/client/components/notifications/notificationBandView';
import {NotificationVariant} from '@/client/components/notifications/notificationTypes';
import {mergeChips} from '@/client/components/notifications/notificationModel';
import {causeLinesOf} from '@/client/components/notifications/notificationCauseView';
import {ViewerImpactCause, ViewerImpactMeta} from '@/client/components/notifications/notificationSemantics';
import {CardName} from '@/common/cards/CardName';

/**
 * THE CARD'S STATEMENTS (P53 · ledger FK — «ЛЕНТА: ЧИСЛО НЕ РЕЖЕТСЯ · ОДНА СТРОКА ПРИЧИНЫ · ЦЕНА И ПРИХОД ПОРОЗНЬ ·
 * ИСТОЧНИК ОДИН РАЗ»). Pure readings of the console notification card, pinned here so a frame is never the only
 * witness.
 */
describe('notificationBandView (FK)', () => {
  it('a word outcome is a SENTENCE, never a pill — the numbers stay in the band, the phrase goes apart', () => {
    const says = bandStatements({
      losses: [{icon: 'hydro-blockade', text: ''}, {icon: 'plants', text: '−3'}],
      gains: [{icon: 'heat', text: '+2'}],
    });
    expect(says.losses).deep.eq([{icon: 'plants', text: '−3'}]);
    expect(says.gains).deep.eq([{icon: 'heat', text: '+2'}]);
    expect(says.phrases).deep.eq([BAND_PHRASE_LABEL['hydro-blockade']]);
  });

  it('the transfer arrow names WHO took it only when that is not the actor the head named («→ ●» is gone)', () => {
    expect(transferTaker({transfer: true, attacker: 'red'}, 'red'), 'the head already named the actor').undefined;
    expect(transferTaker({transfer: true, attacker: 'red'}, 'blue')).eq('red');
    expect(transferTaker({transfer: false, attacker: 'red'}, 'blue'), 'no transfer, no arrow').undefined;
  });

  it('an actor’s line is two labelled groups — what they GOT, what they PAID (PL-087: «● +1 −25»)', () => {
    const {got, paid} = clusterSides([
      {icon: 'megacredits', text: '+1', production: true},
      {icon: 'megacredits', text: '−25'},
    ]);
    expect(got).deep.eq([{icon: 'megacredits', text: '+1', production: true}]);
    expect(paid).deep.eq([{icon: 'megacredits', text: '−25'}]);
    expect(chipIsCost({icon: 'megacredits', text: '-3'}), 'an ASCII minus is a cost too').eq(true);
    expect(chipIsCost({icon: 'megacredits', text: '−3', saved: true}), 'a discount is no price').eq(false);
  });

  it('a price and an income of one resource stay TWO chips (PL-065 «+1 / −2 → −1», PL-087 «−2 and +14 → +12»)', () => {
    expect(mergeChips([{icon: 'plants', text: '+1'}, {icon: 'plants', text: '−2'}])).deep.eq([
      {icon: 'plants', text: '+1'}, {icon: 'plants', text: '−2'},
    ]);
    expect(mergeChips([{icon: 'megacredits', text: '−2'}, {icon: 'megacredits', text: '+14'}])).deep.eq([
      {icon: 'megacredits', text: '−2'}, {icon: 'megacredits', text: '+14'},
    ]);
    // …and same-sign deltas still sum.
    expect(mergeChips([{icon: 'heat', text: '+1'}, {icon: 'heat', text: '+2'}])).deep.eq([{icon: 'heat', text: '+3'}]);
  });

  it('the head glyph is a TEXT glyph for every variant — never an emoji (🏆 🏅 ⚖ ⚠ ✖ rendered as pictures)', () => {
    const variants: Array<NotificationVariant> = [
      'chairman', 'milestone', 'award', 'warning', 'bot-turn', 'generation', 'pass', 'standard-project', 'colony',
      'hydronetwork', 'planetary-event', 'blue-action', 'passive-effect', 'destroy', 'steal', 'production-reduction',
      'production-transfer', 'vp-loss', 'threat', 'reveal-deck', 'reveal-hand', 'play-card', 'event',
    ] as Array<NotificationVariant>;
    for (const v of variants) {
      const g = notificationGlyph(v);
      expect(/\p{Extended_Pictographic}/u.test(g), `${v} → ${g}`).eq(false);
    }
  });

  describe('the source is named ONCE (PL-548)', () => {
    const gains = [{icon: 'megacredits', text: '+2'}];
    function meta(causes: ReadonlyArray<ViewerImpactCause>): ViewerImpactMeta {
      return {sign: 'negative', gains: [], losses: gains, causes};
    }
    const attack: ViewerImpactCause = {
      origin: {kind: 'card', card: CardName.MODULAR_FLOODGATES, owner: 'red'},
      gains: [], losses: gains,
    } as ViewerImpactCause;

    it('a «Source» line naming the card the kicker names drops its label and name', () => {
      const plain = causeLinesOf(meta([attack]));
      expect(plain[0].labelKey, 'precondition: the line is a foreign source').eq('Source');
      const once = causeLinesOf(meta([attack]), {namedCard: CardName.MODULAR_FLOODGATES});
      // Nothing else to say — the whole line goes (the kicker carries the name).
      if (once.length > 0) {
        expect(once[0].sourceNamed).eq(true);
      }
      expect(once.every((l) => l.sourceNamed === true || l.nameKey !== CardName.MODULAR_FLOODGATES)).eq(true);
    });

    it('a line naming ANOTHER card keeps its name', () => {
      const lines = causeLinesOf(meta([attack]), {namedCard: CardName.PREDATORS});
      expect(lines[0].sourceNamed).undefined;
      expect(lines[0].nameKey).eq(CardName.MODULAR_FLOODGATES);
    });
  });
});
