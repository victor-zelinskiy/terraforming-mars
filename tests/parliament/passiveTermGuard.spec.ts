import {expect} from 'chai';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {Tag} from '../../src/common/cards/Tag';
import {Resource} from '../../src/common/Resource';
import {passiveCardDiscount, passiveTagBonus, passiveValueBonus} from '../../src/common/parliament/passiveTerm';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {IPlayer} from '../../src/server/IPlayer';

/**
 * THE PASSIVE'S TERM IS ITS NUMBER (P77 · DH, `passiveTerm.ts`). A passive whose effect is a number for a seat — a card
 * discount, a resource's extra value, tags lent per influence — declares that number as data, and its hook answers FROM
 * it: the vote panel reads the seat's own number off the same declaration the engine charges by. The guard walks the
 * whole catalog: a numeric hook without its term (or with a term of another kind) fails with the law's name, and every
 * hook is asked against its term for every tag / resource / influence it could meet.
 */
describe('passive term guard — a numeric passive declares its number', () => {
  const player = {} as IPlayer;
  const card = (tags: ReadonlyArray<Tag>) => ({tags: [...tags]} as unknown as IProjectCard);
  const ALL_TAGS = Object.values(Tag) as ReadonlyArray<Tag>;

  for (const definition of REDUX_RESOLUTION_CATALOG.all()) {
    const passive = definition.passive;
    const term = definition.passiveTerm;
    const numeric = passive?.cardDiscount !== undefined || passive?.resourceValueBonus !== undefined || passive?.tagBonus !== undefined;
    if (!numeric && term === undefined) {
      continue;
    }
    it(`${definition.code ?? definition.id}: the term is declared and the hook answers from it`, () => {
      expect(term, `${definition.id} has a numeric passive hook but no \`passiveTerm\``).not.to.eq(undefined);
      if (term === undefined) {
        return;
      }
      if (passive?.cardDiscount !== undefined) {
        expect(term.kind).to.eq('cardDiscount');
        for (const tag of ALL_TAGS) {
          expect(passive.cardDiscount(player, card([tag])), `${definition.id} · ${tag}`).to.eq(passiveCardDiscount(term, [tag]));
        }
        expect(passive.cardDiscount(player, card([])), `${definition.id} · no tag`).to.eq(0);
      }
      if (passive?.resourceValueBonus !== undefined) {
        expect(term.kind).to.eq('resourceValue');
        for (const resource of Object.values(Resource)) {
          expect(passive.resourceValueBonus(player, resource), `${definition.id} · ${resource}`).to.eq(passiveValueBonus(term, resource));
        }
      }
      if (passive?.tagBonus !== undefined) {
        expect(term.kind).to.eq('tagsPerInfluence');
        for (const tag of ALL_TAGS) {
          for (const influence of [0, 1, 2, 5]) {
            expect(passive.tagBonus(player, tag, influence), `${definition.id} · ${tag} @ ${influence}`).to.eq(passiveTagBonus(term, tag, influence));
          }
        }
      }
      // A declared term with no hook of its kind would promise a number the engine never charges.
      const hookOfKind = {cardDiscount: passive?.cardDiscount, resourceValue: passive?.resourceValueBonus, tagsPerInfluence: passive?.tagBonus}[term.kind];
      expect(hookOfKind, `${definition.id} declares a ${term.kind} term with no hook to answer it`).not.to.eq(undefined);
    });
  }

  it('the four numeric passives of the catalog are covered (Heat Capture, Metal Research, Water Export, R&D Funding)', () => {
    const termed = REDUX_RESOLUTION_CATALOG.all().filter((d) => d.passiveTerm !== undefined).map((d) => d.code);
    expect(termed).to.include.members(['RX14', 'RX19', 'RX26', 'RX33']);
  });
});
