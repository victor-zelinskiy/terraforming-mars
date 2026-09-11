import {SpaceBonus} from '@/common/boards/SpaceBonus';

/**
 * Shared art vocabulary of the REAL board miniature (PremiumMapFingerprint):
 * one color + one glyph per printed placement bonus. Kept apart from the
 * component so the campaign overview, the create-game decks and any future
 * board surface speak the same visual language.
 *
 * Glyph shapes follow the established fingerprint style: single-color
 * stroke-only SVG paths (24×24 viewBox, stroke ~2), colored per bonus.
 */

export const SPACE_BONUS_RGB: Record<SpaceBonus, string> = {
  [SpaceBonus.TITANIUM]: '170,182,210',
  [SpaceBonus.STEEL]: '214,150,86',
  [SpaceBonus.PLANT]: '120,214,120',
  [SpaceBonus.DRAW_CARD]: '230,210,150',
  [SpaceBonus.HEAT]: '248,138,92',
  [SpaceBonus.OCEAN]: '96,168,238',
  [SpaceBonus.MEGACREDITS]: '244,206,96',
  [SpaceBonus.ANIMAL]: '214,164,112',
  [SpaceBonus.MICROBE]: '136,216,166',
  [SpaceBonus.ENERGY]: '244,214,96',
  [SpaceBonus.DATA]: '150,196,240',
  [SpaceBonus.SCIENCE]: '190,190,210',
  [SpaceBonus.ENERGY_PRODUCTION]: '244,214,96',
  [SpaceBonus.TEMPERATURE]: '244,128,128',
  [SpaceBonus._RESTRICTED]: '110,110,110',
  [SpaceBonus.ASTEROID]: '196,150,110',
  [SpaceBonus.DELEGATE]: '208,160,220',
  [SpaceBonus.COLONY]: '198,140,236',
  [SpaceBonus.TEMPERATURE_4MC]: '244,128,128',
};

const stroke = (d: string, w = 2) =>
  `<path d="${d}" stroke="currentColor" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

export const SPACE_BONUS_GLYPHS: Record<SpaceBonus, string> = {
  [SpaceBonus.PLANT]: stroke('M12 21 C12 13 7 9 4 8 C5 14 8 18 12 19 M12 21 C12 13 17 9 20 8 C19 14 16 18 12 19', 2.2),
  [SpaceBonus.STEEL]: '<rect x="4.5" y="9" width="15" height="6" rx="1.4" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  [SpaceBonus.TITANIUM]: stroke('M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z', 2.2),
  [SpaceBonus.DRAW_CARD]: '<rect x="6" y="4.5" width="12" height="15" rx="1.8" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M9 9 H15 M9 12 H15" stroke="currentColor" stroke-width="1.8"/>',
  [SpaceBonus.HEAT]: stroke('M13 2.5 C9.5 7 14.5 8.5 12.5 13 C16.5 11.5 16.5 6 13 2.5 M12 21.5 C8 21.5 5.5 18.5 5.5 15 C5.5 12 8.5 11 8.5 13 C8.5 15 11 14 11 11.5 C13 14 18.5 14 18.5 17.5 C18.5 19.8 15.5 21.5 12 21.5 Z', 1.8),
  [SpaceBonus.OCEAN]: stroke('M12 3 C8 9.5 5.5 13 5.5 16.5 A6.5 6.5 0 0 0 18.5 16.5 C18.5 13 16 9.5 12 3 Z'),
  [SpaceBonus.MEGACREDITS]: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8.5 15.5 V8.5 L12 12.5 L15.5 8.5 V15.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
  [SpaceBonus.ENERGY]: stroke('M13.5 2.5 L5.5 13.5 H11 L10 21.5 L18.5 9.5 H13 Z'),
  [SpaceBonus.MICROBE]: '<circle cx="9" cy="10" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="15.5" cy="13.5" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/>',
  [SpaceBonus.ANIMAL]: '<ellipse cx="12" cy="15" rx="5.5" ry="4.5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="16.5" cy="7.5" r="2" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  [SpaceBonus.DATA]: '<circle cx="6.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="17.5" cy="12" r="1.6" fill="currentColor"/><rect x="3" y="6.5" width="18" height="11" rx="2.4" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  [SpaceBonus.SCIENCE]: stroke('M9.5 3.5 H14.5 M10.5 3.5 V9 L5 18 A1.8 1.8 0 0 0 6.6 20.5 H17.4 A1.8 1.8 0 0 0 19 18 L13.5 9 V3.5'),
  [SpaceBonus.ENERGY_PRODUCTION]: '<rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/>' + stroke('M13 6.5 L8 13 H11.5 L11 17.5 L16 11 H12.5 Z', 1.7),
  [SpaceBonus.TEMPERATURE]: stroke('M12 4 V15 M12 4 A2.2 2.2 0 0 1 14.2 6.2 V14 A4 4 0 1 1 9.8 14 V6.2 A2.2 2.2 0 0 1 12 4 Z', 1.8),
  [SpaceBonus._RESTRICTED]: stroke('M5 5 L19 19 M19 5 L5 19'),
  [SpaceBonus.ASTEROID]: stroke('M8 4 L16 5 L20 11 L17 19 L9 20 L4 13 Z'),
  [SpaceBonus.DELEGATE]: '<circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5.5 20 C6.5 15.5 9 13.5 12 13.5 C15 13.5 17.5 15.5 18.5 20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  [SpaceBonus.COLONY]: '<circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/>',
  [SpaceBonus.TEMPERATURE_4MC]: stroke('M12 4 V15 M12 4 A2.2 2.2 0 0 1 14.2 6.2 V14 A4 4 0 1 1 9.8 14 V6.2 A2.2 2.2 0 0 1 12 4 Z', 1.8),
};

/**
 * The bonuses whose PRESENCE distinguishes a map — drawn as glyphs on the
 * compact 'card' tier (the base five read as color regions there; drawing
 * all ~30 printed bonuses at card size is noise, not information).
 */
export const SIGNATURE_BONUSES: ReadonlySet<SpaceBonus> = new Set([
  SpaceBonus.OCEAN,
  SpaceBonus.MEGACREDITS,
  SpaceBonus.ANIMAL,
  SpaceBonus.MICROBE,
  SpaceBonus.ENERGY,
  SpaceBonus.DATA,
  SpaceBonus.SCIENCE,
  SpaceBonus.ENERGY_PRODUCTION,
  SpaceBonus.TEMPERATURE,
  SpaceBonus.ASTEROID,
  SpaceBonus.DELEGATE,
  SpaceBonus.COLONY,
  SpaceBonus.TEMPERATURE_4MC,
]);

export function spaceBonusGlyphSvg(bonus: SpaceBonus): string {
  return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${SPACE_BONUS_GLYPHS[bonus] ?? ''}</svg>`;
}
