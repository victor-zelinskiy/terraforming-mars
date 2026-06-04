/**
 * Maps an icon-key (as supplied by the server in OptionMetadata / SelectAmount)
 * to the CSS class family that renders it. Shared by the modern input modals
 * (ModernOptionPicker, ModernAmountSelector, …) so every surface resolves an
 * icon the same way:
 *
 *   - standard resources (megacredits / steel / titanium / plants / energy /
 *     heat)        → `resource_icon resource_icon--<key>`
 *   - global parameters (temperature / venus / oxygen / ocean)
 *                  → `wgt-icon wgt-icon--<key>`
 *   - everything else (card resources: microbe / animal / science / floater /…)
 *                  → `card-resource card-resource-<key>`
 *
 * `modal_inputs.less` normalises the size of all three families via the shared
 * `.modal-input__option-icon` class, so the caller only needs the family class.
 */

const STANDARD_RESOURCE_ICONS: ReadonlySet<string> = new Set(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);
const GLOBAL_PARAMETER_ICONS: ReadonlySet<string> = new Set(['temperature', 'venus', 'oxygen', 'ocean']);

export function iconClassFor(icon: string | undefined): string {
  if (icon === undefined || icon === '') {
    return '';
  }
  if (STANDARD_RESOURCE_ICONS.has(icon)) {
    return 'resource_icon resource_icon--' + icon;
  }
  if (GLOBAL_PARAMETER_ICONS.has(icon)) {
    return 'wgt-icon wgt-icon--' + icon;
  }
  return 'card-resource card-resource-' + icon;
}
