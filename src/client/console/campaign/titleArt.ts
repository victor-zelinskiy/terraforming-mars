// Campaign «Титулы» — emblem asset resolution (the maArt.ts pattern).
//
// assets/titles/*.png are COMPLETE material renders (gold / silver / bronze
// with 3/2/1 chevrons). NEVER tint them — the console paint baseline strips
// `filter` anyway, and a tint would destroy the metals. Player linkage is
// composition (a player-color plate/cube BESIDE the emblem), never recolor.

import {TitleName} from '@/common/campaign/CampaignTypes';

export function titleArtUrl(title: TitleName): string {
  return `assets/titles/${title}.png`;
}

/** English i18n source keys per title (grep-checked unique). */
export const TITLE_LABEL: Record<TitleName, string> = {
  governor: 'Governor',
  administrator: 'Administrator',
  prefect: 'Prefect',
};
