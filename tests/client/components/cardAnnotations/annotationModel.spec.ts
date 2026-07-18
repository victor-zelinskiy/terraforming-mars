import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {ClientCard} from '@/common/cards/ClientCard';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {getCardOrThrow, getCards} from '@/client/cards/ClientCardManifest';
import {buildCardAnnotations, stripKindPrefix, segmentAnyPlayer} from '@/client/components/cardAnnotations/annotationModel';
import {buildPremiumCardViewModel} from '@/client/components/premiumCard/premiumCardViewModel';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';
import {playZoneStart} from '@/client/components/premiumCard/mechanicsModel';

/**
 * A minimal synthetic in-scope card: one graphic row carrying the styled «*»
 * footnote (row 0) and one plain row (row 1), each explained by an
 * information block linked via the SHARED graphic-id derivation
 * (`g:<content signature>`).
 */
function syntheticCard(): ClientCard {
  return {
    name: CardName.ASTEROID,
    module: 'base',
    tags: [],
    type: CardType.AUTOMATED,
    compatibility: [],
    hasAction: false,
    metadata: {
      cardNumber: 'X01',
      renderData: {
        is: 'root',
        rows: [
          [
            {is: 'item', type: CardRenderItemType.TEMPERATURE, amount: 1, anyPlayer: false, isPlayed: false},
            {is: 'symbol', type: CardRenderSymbolType.ASTERIX, isIcon: false},
          ],
          [
            {is: 'item', type: CardRenderItemType.CARDS, amount: 1, anyPlayer: false, isPlayed: false},
          ],
        ],
      },
      information: {
        groups: [{
          kind: 'immediate',
          id: 'immediate',
          blocks: [
            {id: 'mech:temp', kind: 'immediate', text: 'Raise temperature 1 step (special).', graphicId: 'g:temperature'},
            {id: 'mech:draw', kind: 'immediate', text: 'Draw a card.', graphicId: 'g:cards'},
            {id: 'note:x', kind: 'note', text: 'Some irreducible fine print.'},
          ],
        }],
      },
    },
  } as unknown as ClientCard;
}

/** A synthetic ACTIVE card with TWO separate effect frames — each must
 *  yield its OWN annotation block (own frame → own tether). */
function twoEffectsCard(): ClientCard {
  return {
    name: CardName.HERBIVORES,
    module: 'base',
    tags: [],
    type: CardType.ACTIVE,
    compatibility: [],
    hasAction: false,
    metadata: {
      cardNumber: 'X02',
      renderData: {is: 'root', rows: []},
      information: {
        groups: [
          {kind: 'effect', id: 'g:e1', blocks: [{id: 'effect:e1', kind: 'effect', text: 'Effect: First ongoing rule.', graphicId: 'g:e1'}]},
          {kind: 'effect', id: 'g:e2', blocks: [{id: 'effect:e2', kind: 'effect', text: 'Effect: Second ongoing rule.', graphicId: 'g:e2'}]},
        ],
      },
    },
  } as unknown as ClientCard;
}

describe('annotationModel', () => {
  it('groups by semantic type: ONE «On play» block with rows (Asteroid)', () => {
    const annotations = buildCardAnnotations(getCardOrThrow(CardName.ASTEROID));
    const immediate = annotations.filter((a) => a.kind === 'immediate');
    expect(immediate).to.have.length(1);
    expect(immediate[0].rows.length).to.be.gte(2); // temp + remove plants + titanium
    expect(immediate[0].labelKey).to.eq('On play');
    // block ids stay unique
    const ids = annotations.map((a) => a.id);
    expect(new Set(ids).size).to.eq(ids.length);
  });

  it('EXCEPTION: every effect / action is its OWN block (never merged)', () => {
    const annotations = buildCardAnnotations(twoEffectsCard());
    const effects = annotations.filter((a) => a.kind === 'effect');
    expect(effects).to.have.length(2);
    expect(effects[0].id).to.not.eq(effects[1].id);
    expect(effects[0].graphicId).to.eq('g:e1'); // each tethers to ITS frame
    expect(effects[1].graphicId).to.eq('g:e2');
    expect(effects[0].rows).to.have.length(1);
  });

  it('is silent for cards without the information model', () => {
    // Out-of-scope types (CEO / standard projects) carry no information model.
    const noInfo = getCards((c) => c.metadata.information === undefined)[0];
    expect(noInfo, 'expected an out-of-scope info-less card').to.not.eq(undefined);
    expect(buildCardAnnotations(noInfo)).to.deep.eq([]);
  });

  it('Herbivores: grouped blocks in card order, play rows keep EXACT anchors', () => {
    const annotations = buildCardAnnotations(getCardOrThrow(CardName.HERBIVORES));
    const byKind = new Map(annotations.map((a) => [a.kind, a]));
    expect(byKind.get('requirement')?.rows).to.have.length(1);
    expect(byKind.get('effect')?.rows).to.have.length(1);
    expect(byKind.get('victory-points')?.rows).to.have.length(1);
    const play = byKind.get('immediate');
    expect(play?.rows).to.have.length(2);
    // the two play rows share ONE graphic row but tether to DIFFERENT nodes
    const [first, second] = play!.rows;
    expect(first.graphicId).to.eq(second.graphicId);
    expect(first.graphicNode).to.not.eq(second.graphicNode);
    expect(first.graphicNode).to.be.a('string');
    // reading order mirrors the card top-down: req → effect → play → vp
    const order = annotations.map((a) => a.kind);
    expect(order.indexOf('requirement')).to.be.lessThan(order.indexOf('effect'));
    expect(order.indexOf('effect')).to.be.lessThan(order.indexOf('immediate'));
    expect(order.indexOf('immediate')).to.be.lessThan(order.indexOf('victory-points'));
  });

  it('detects the styled «*» per ROW; the group inherits it for the head', () => {
    const annotations = buildCardAnnotations(syntheticCard());
    const play = annotations.find((a) => a.kind === 'immediate');
    expect(play?.special).to.eq(true); // any special row → head spark
    const byId = new Map(play!.rows.map((r) => [r.id, r]));
    expect(byId.get('mech:temp')?.special).to.eq(true); // row carries the *
    expect(byId.get('mech:draw')?.special).to.eq(false); // sibling row does not
  });

  it('a note is its own «Special rule» group, untethered', () => {
    const annotations = buildCardAnnotations(syntheticCard());
    const note = annotations.find((a) => a.kind === 'note');
    expect(note?.special).to.eq(true);
    expect(note?.labelKey).to.eq('Special rule');
    expect(note?.graphicId).to.eq(undefined); // floats, no line, no noise
  });

  it('marks the vp group special for asterisked / vermin dynamic VP', () => {
    const vermin = buildCardAnnotations(getCardOrThrow(CardName.VERMIN));
    const vp = vermin.find((a) => a.kind === 'victory-points');
    if (vp !== undefined) {
      expect(vp.special).to.eq(true);
    }
  });

  it('catalog guard: one block per type, clean texts, special notes — EVERY in-scope card', () => {
    const covered = getCards((c) => c.metadata.information !== undefined);
    expect(covered.length).to.be.greaterThan(300); // the model ships broadly
    for (const card of covered) {
      const annotations = buildCardAnnotations(card);
      expect(new Set(annotations.map((a) => a.id)).size, card.name).to.eq(annotations.length);
      // ONE block per GROUPED type; effects/actions may legitimately repeat
      // (each is its own block by design).
      const kinds = annotations.map((a) => a.kind);
      for (const grouped of ['requirement', 'immediate', 'victory-points', 'note'] as const) {
        expect(kinds.filter((k) => k === grouped).length, `${card.name} ${grouped}`).to.be.lte(1);
      }
      for (const a of annotations) {
        expect(a.labelKey, `${card.name} → ${a.kind}`).to.be.a('string').and.not.empty;
        expect(a.rows.length, `${card.name} → ${a.kind}`).to.be.gte(1);
        for (const r of a.rows) {
          // The layer renders the translated text VERBATIM — a template
          // placeholder leaking into an information block would show raw.
          expect(r.text, `${card.name} → ${r.id}`).to.not.include('${');
        }
        if (a.kind === 'note') {
          expect(a.special, `${card.name} note`).to.eq(true);
        }
      }
    }
  }).timeout(15000); // O(cards): builds annotations for every in-scope card (incl. corps)

  it('PLAY-ZONE INVARIANT: on-play graphics live in the trailing play zone (the rail opens it)', () => {
    // The «При розыгрыше» block tethers to the card-native play-rail, which the
    // face draws before the TRAILING run of plain/production groups. Since
    // buildMechanics now reorders every card so the on-play run is always
    // trailing, this guards that an on-play graphic is never misclassified as an
    // effect/action frame (which would place it ABOVE the play zone).
    const offenders: Array<string> = [];
    // Corporations are EXEMPT here only to avoid re-deriving corp-frame graphic
    // ids in the test; their on-play run is reordered to the bottom the same way.
    for (const card of getCards((c) => isPremiumFaceType(c.type) && c.type !== CardType.CORPORATION && c.metadata.information !== undefined)) {
      const playIds = new Set<string>();
      for (const g of card.metadata.information!.groups) {
        if (g.kind === 'immediate') {
          for (const b of g.blocks) {
            if (b.graphicId !== undefined && !b.graphicId.startsWith('req:')) {
              playIds.add(b.graphicId);
            }
          }
        }
      }
      if (playIds.size === 0) {
        continue;
      }
      const groups = buildPremiumCardViewModel(card).mechanics.groups;
      const zone = playZoneStart(groups);
      groups.forEach((g, i) => {
        if (g.graphicId !== undefined && playIds.has(g.graphicId) && i < zone) {
          offenders.push(`${card.name} (${g.graphicId} at ${i}, zone starts ${zone})`);
        }
      });
    }
    expect(offenders, offenders.join('\n')).to.deep.eq([]);
  });

  it('stripKindPrefix drops the baked Effect/Action prefix (en + ru), keeps the rest', () => {
    expect(stripKindPrefix('Effect: Draw a card.')).to.eq('Draw a card.');
    expect(stripKindPrefix('Action: Spend 1 titanium.')).to.eq('Spend 1 titanium.');
    expect(stripKindPrefix('Эффект: Возьмите карту.')).to.eq('Возьмите карту.');
    expect(stripKindPrefix('Действие: Потратьте 1 титан.')).to.eq('Потратьте 1 титан.');
    expect(stripKindPrefix('Raise the temperature.')).to.eq('Raise the temperature.');
  });

  it('flags a block whose graphic carries an {all} bezel (Vermin effect city)', () => {
    // Vermin's effect draws `eb.city({all})` → the effect row is anyPlayer.
    const anns = buildCardAnnotations(getCardOrThrow(CardName.VERMIN));
    const effect = anns.find((a) => a.kind === 'effect');
    expect(effect?.anyPlayer, 'effect anyPlayer').to.eq(true);
    // the plain animal action row carries no bezel
    const actions = anns.filter((a) => a.kind === 'action');
    expect(actions.some((a) => a.anyPlayer), 'no plain action is anyPlayer').to.eq(false);
  });

  it('segmentAnyPlayer accents the «any player» words, else returns one plain segment', () => {
    const ru = segmentAnyPlayer('Удалите до 2 растений у любого игрока.');
    expect(ru.filter((s) => s.any).map((s) => s.text)).to.deep.eq(['у любого игрока']);
    expect(ru.map((s) => s.text).join('')).to.eq('Удалите до 2 растений у любого игрока.');

    const en = segmentAnyPlayer('Remove up to 2 plants from any player.');
    expect(en.filter((s) => s.any).map((s) => s.text)).to.deep.eq(['any player']);

    // «любую карту» (any card) is NOT a player phrase — never accented.
    const card = segmentAnyPlayer('Добавьте 1 микроб на любую карту.');
    expect(card.some((s) => s.any)).to.eq(false);
    expect(card).to.have.length(1);

    // the requirement wordings the generator + ru locale produce.
    const reqPlural = segmentAnyPlayer('Требуется не менее 2 тайлов города (у любых игроков).');
    expect(reqPlural.filter((s) => s.any).map((s) => s.text)).to.deep.eq(['у любых игроков']);
    const reqSingle = segmentAnyPlayer('Требуется тайл города (любого игрока) рядом с океаном.');
    expect(reqSingle.filter((s) => s.any).map((s) => s.text)).to.deep.eq(['любого игрока']);
    const every = segmentAnyPlayer('Каждый раз, когда любой игрок размещает город.');
    expect(every.filter((s) => s.any).map((s) => s.text)).to.deep.eq(['любой игрок']);
  });
});
