import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {choiceSourceView, productionLossSourceView, promptSourceCard, promptSourceView} from '@/client/console/promptSource';

/*
 * The ONE normalizer behind «почему этот промт пришёл ко мне?».
 *
 * The server names an origin through four unrelated shapes. What matters is
 * that ALL of them arrive at the same dock: a card face when there is a card,
 * a named plate when there isn't, and — never — silence. A marker the
 * normalizer forgets is a prompt the player cannot explain, so the cases below
 * are the contract, not decoration.
 */
describe('promptSource (who asked for this decision?)', () => {
  describe('choiceSourceView', () => {
    it('a CARD source renders the card face and can be inspected', () => {
      const v = choiceSourceView({kind: 'card', card: CardName.MARS_UNIVERSITY});
      expect(v?.card).to.eq(CardName.MARS_UNIVERSITY);
      expect(v?.kindKey).to.eq('Card');
      expect(v?.inspectable).to.be.true;
    });

    it('a CORPORATION reads as a corporation, not a generic card', () => {
      expect(choiceSourceView({kind: 'corporation', card: CardName.PHILARES})?.kindKey).to.eq('Corporation');
    });

    it('a COLONY source has no card — it names the colony instead', () => {
      const v = choiceSourceView({kind: 'colony', name: 'Ganymede'});
      expect(v?.card).is.undefined;
      expect(v?.kindKey).to.eq('Colony');
      expect(v?.name).to.eq('Ganymede');
      // Nothing to open fullscreen: the dock must not advertise a verb.
      expect(v?.inspectable).to.be.false;
    });

    it('a STANDARD PROJECT and a SYSTEM rule each name themselves', () => {
      expect(choiceSourceView({kind: 'standardProject'})?.kindKey).to.eq('Standard project');
      expect(choiceSourceView({kind: 'system'})?.kindKey).to.eq('Game rule');
    });

    it('a card-kind source with NO card name says so honestly (never a blank frame)', () => {
      const v = choiceSourceView({kind: 'card'});
      expect(v?.card).is.undefined;
      expect(v?.kindKey).to.eq('Card');
      expect(v?.inspectable).to.be.false;
    });

    it('no source at all → no dock', () => {
      expect(choiceSourceView(undefined)).is.undefined;
    });
  });

  describe('productionLossSourceView', () => {
    it('a card attack renders the card', () => {
      const v = productionLossSourceView({type: 'card', card: CardName.CAESAR});
      expect(v?.card).to.eq(CardName.CAESAR);
      expect(v?.inspectable).to.be.true;
    });

    it('an Ares hazard names the rule AND carries the hazard tone', () => {
      const v = productionLossSourceView({type: 'hazard'});
      expect(v?.kindKey).to.eq('Hazard zone');
      expect(v?.tone).to.eq('hazard');
      expect(v?.ruleKey).to.not.be.undefined;
      expect(v?.inspectable).to.be.false;
    });

    it("'other' is honest silence — never a misleading source", () => {
      expect(productionLossSourceView({type: 'other'})).is.undefined;
      expect(productionLossSourceView(undefined)).is.undefined;
    });
  });

  describe('promptSourceView reads EVERY marker the server may have used', () => {
    const wf = (partial: Record<string, unknown>): PlayerInputModel =>
      ({title: '', buttonLabel: '', ...partial} as unknown as PlayerInputModel);

    it('choiceContext (Philares’ resource distribution)', () => {
      const v = promptSourceView(wf({
        type: 'resources', count: 2,
        choiceContext: {source: {kind: 'corporation', card: 'Philares'}, mode: 'reward'},
      }));
      expect(v?.card).to.eq('Philares');
    });

    it('placementContext (which card is placing this tile)', () => {
      expect(promptSourceCard(wf({
        type: 'space', spaces: [],
        placementContext: {cancellable: true, source: {kind: 'card', card: 'Lunar Beam'}},
      }))).to.eq('Lunar Beam');
    });

    it('discardPrompt (who demands the discard)', () => {
      expect(promptSourceCard(wf({
        type: 'card', cards: [], min: 1, max: 1,
        discardPrompt: {min: 1, max: 1, source: {kind: 'card', card: 'Mars University'}},
      }))).to.eq('Mars University');
    });

    it('productionToLose uses its OWN typed field — richer than a generic context', () => {
      const v = promptSourceView(wf({
        type: 'productionToLose', payProduction: {cost: 1, units: {}}, source: {type: 'hazard'},
      }));
      // A generic ChoiceContextSource has no vocabulary for "a hazard zone".
      expect(v?.kindKey).to.eq('Hazard zone');
    });

    it('an unmarked prompt has no source (backward-compatible, no empty dock)', () => {
      expect(promptSourceView(wf({type: 'resources', count: 1}))).is.undefined;
      expect(promptSourceView(undefined)).is.undefined;
    });
  });
});
