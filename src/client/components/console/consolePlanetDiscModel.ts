/**
 * The planet disc's art key (`ConsolePlanetDisc.vue`).
 *
 * The manifest's `.<Name>-background` rule supplies the IMAGE (colonies.less);
 * the component supplies the geometry and the light. Multi-word names
 * («Leavitt II») follow the same `replace(' ', '-')` idiom every consumer used.
 */
export function planetArtClass(colonyName: string): string {
  return colonyName.replace(' ', '-') + '-background';
}
