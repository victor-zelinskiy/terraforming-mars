import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {GameModule} from '@/common/cards/GameModule';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {PREMIUM_EXPANSIONS} from '@/client/components/create/premium/createGameMeta';
import type {GuaranteedCardPicks} from '@/client/components/create/premium/createGameState';
import {
  GUARANTEED_MODULES,
  clearGuaranteedCards,
  guaranteedChosenEntries,
  guaranteedCount,
  guaranteedListOf,
  guaranteedModuleCounts,
  guaranteedNames,
  guaranteedPickRows,
  guaranteedTypeLabelKey,
  pruneGuaranteedCards,
  removeGuaranteedCard,
  toggleGuaranteedCard,
} from '@/client/components/create/premium/devGuaranteedCards';

function picks(): GuaranteedCardPicks {
  return {corporations: [], preludes: [], projects: []};
}

describe('devGuaranteedCards', () => {
  describe('module scope', () => {
    it('is the base game plus exactly the create screen\'s expansion scope', () => {
      expect(GUARANTEED_MODULES[0].id).to.eq('base');
      expect(GUARANTEED_MODULES.slice(1).map((m) => m.id))
        .to.deep.eq(PREMIUM_EXPANSIONS.map((e) => e.id));
    });
  });

  describe('routing a card type to its server list', () => {
    it('maps the three guaranteed lists and nothing else', () => {
      expect(guaranteedListOf(CardType.CORPORATION)).to.eq('corporations');
      expect(guaranteedListOf(CardType.PRELUDE)).to.eq('preludes');
      expect(guaranteedListOf(CardType.AUTOMATED)).to.eq('projects');
      expect(guaranteedListOf(CardType.ACTIVE)).to.eq('projects');
      expect(guaranteedListOf(CardType.EVENT)).to.eq('projects');
      // No server list guarantees these, so they are not offered at all.
      expect(guaranteedListOf(CardType.CEO)).to.eq(undefined);
      expect(guaranteedListOf(CardType.STANDARD_PROJECT)).to.eq(undefined);
    });
  });

  describe('toggling', () => {
    it('routes each pick into the list its type is guaranteed by', () => {
      const p = picks();
      toggleGuaranteedCard(p, CardName.ECOLINE);
      toggleGuaranteedCard(p, CardName.DONATION);
      toggleGuaranteedCard(p, CardName.ALGAE);
      expect(p.corporations).to.deep.eq([CardName.ECOLINE]);
      expect(p.preludes).to.deep.eq([CardName.DONATION]);
      expect(p.projects).to.deep.eq([CardName.ALGAE]);
      expect(guaranteedCount(p)).to.eq(3);
    });

    it('is a toggle — a second press takes the card back out', () => {
      const p = picks();
      toggleGuaranteedCard(p, CardName.ALGAE);
      toggleGuaranteedCard(p, CardName.ALGAE);
      expect(p.projects).to.be.empty;
      expect(guaranteedCount(p)).to.eq(0);
    });

    it('removes and clears across every list', () => {
      const p = picks();
      toggleGuaranteedCard(p, CardName.ECOLINE);
      toggleGuaranteedCard(p, CardName.ALGAE);
      removeGuaranteedCard(p, CardName.ECOLINE);
      expect(guaranteedCount(p)).to.eq(1);
      clearGuaranteedCards(p);
      expect(guaranteedCount(p)).to.eq(0);
    });

    it('ignores a type with no guarantee list', () => {
      const p = picks();
      // Sell patents is a standard project — it can never be "dealt".
      toggleGuaranteedCard(p, CardName.SELL_PATENTS_STANDARD_PROJECT);
      expect(guaranteedCount(p)).to.eq(0);
    });

    it('refuses the cards the server cannot guarantee', () => {
      const p = picks();
      // Game.newInstance THROWS on Delta Project in customPreludes...
      toggleGuaranteedCard(p, CardName.DELTA_PROJECT);
      // ...and GameCards strips the beginner corporation from the deck.
      toggleGuaranteedCard(p, CardName.BEGINNER_CORPORATION);
      expect(guaranteedCount(p)).to.eq(0);
    });
  });

  describe('the picker list', () => {
    it('groups a module by type and sorts each group by the displayed title', () => {
      const rows = guaranteedPickRows('base', new Set());
      expect(rows.length).to.be.greaterThan(0);

      // Every row under a heading belongs to that heading's type, and the
      // titles inside a group are ordered the way the player reads them.
      let type: CardType | undefined;
      let previousTitle = '';
      for (const row of rows) {
        if (row.kind === 'header') {
          type = row.type;
          previousTitle = '';
          continue;
        }
        expect(row.entry.type).to.eq(type);
        expect(previousTitle.localeCompare(row.entry.title)).to.be.at.most(0);
        previousTitle = row.entry.title;
      }
    });

    it('only offers cards of the module, and only guaranteeable types', () => {
      for (const row of guaranteedPickRows('base', new Set())) {
        if (row.kind !== 'card') {
          continue;
        }
        expect(getCardOrThrow(row.entry.name).module).to.eq('base');
        expect(guaranteedListOf(row.entry.type)).to.not.eq(undefined);
      }
    });

    it('never lists a card the server would reject or ignore', () => {
      const named = (module: GameModule) => guaranteedPickRows(module, new Set())
        .flatMap((row) => row.kind === 'card' ? [row.entry.name] : []);
      expect(named('base')).to.not.include(CardName.BEGINNER_CORPORATION);
      expect(named('deltaProject')).to.not.include(CardName.DELTA_PROJECT);
    });

    it('marks the already-picked cards and counts them per module', () => {
      const p = picks();
      toggleGuaranteedCard(p, CardName.ALGAE);
      const chosen = guaranteedNames(p);
      const rows = guaranteedPickRows('base', chosen);
      const algae = rows.find((row) => row.kind === 'card' && row.entry.name === CardName.ALGAE);
      expect(algae !== undefined && algae.kind === 'card' && algae.entry.chosen).to.be.true;

      const counts = guaranteedModuleCounts('base', chosen);
      expect(counts.chosen).to.eq(1);
      expect(counts.total).to.be.greaterThan(1);
      expect(guaranteedModuleCounts('venus', chosen).chosen).to.eq(0);
    });

    it('labels every offered type from an existing plural key', () => {
      expect(guaranteedTypeLabelKey(CardType.CORPORATION)).to.eq('Corporations');
      expect(guaranteedTypeLabelKey(CardType.PRELUDE)).to.eq('Preludes');
      expect(guaranteedTypeLabelKey(CardType.EVENT)).to.eq('Events');
    });
  });

  describe('the picked list', () => {
    it('orders by type first, then by title, whatever order picks arrived in', () => {
      const p = picks();
      toggleGuaranteedCard(p, CardName.BUSHES);
      toggleGuaranteedCard(p, CardName.ALGAE);
      toggleGuaranteedCard(p, CardName.ECOLINE);
      const entries = guaranteedChosenEntries(p);
      expect(entries.map((e) => e.name)[0]).to.eq(CardName.ECOLINE); // corporation first
      const projects = entries.filter((e) => e.type !== CardType.CORPORATION);
      expect(projects.map((e) => e.title)).to.deep.eq([...projects.map((e) => e.title)].sort((a, b) => a.localeCompare(b)));
    });
  });

  describe('pruning a restored setup', () => {
    it('drops names this build no longer knows, keeping the rest', () => {
      const p: GuaranteedCardPicks = {
        corporations: [CardName.ECOLINE, 'A Card That No Longer Exists' as CardName],
        preludes: [],
        // A card sitting in the WRONG list (hand-edited / stale blob) goes too —
        // the server would deal it from a deck it does not belong to.
        projects: [CardName.ALGAE, CardName.ECOLINE],
      };
      expect(pruneGuaranteedCards(p)).to.eq(2);
      expect(p.corporations).to.deep.eq([CardName.ECOLINE]);
      expect(p.projects).to.deep.eq([CardName.ALGAE]);
    });

    it('leaves a clean setup untouched', () => {
      const p = picks();
      toggleGuaranteedCard(p, CardName.ECOLINE);
      toggleGuaranteedCard(p, CardName.ALGAE);
      expect(pruneGuaranteedCards(p)).to.eq(0);
      expect(guaranteedCount(p)).to.eq(2);
    });
  });
});
