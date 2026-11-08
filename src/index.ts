import { createRoot } from "react-dom/client";
import { createElement } from "react";
import type { Adapter } from "@digitaalgemeengoed/oa-contract";
import { Paneel, type PaneelProps } from "./Paneel";
import type { Opdracht } from "./modules";

import "@utrecht/component-library-css/dist/index.css";
import "@nl-design-system-unstable/haarlem-design-tokens/dist/index.css";
import "@nl-design-system-unstable/voorbeeld-design-tokens/dist/theme.css";
import "./paneel.css";

export { Paneel, type PaneelProps };
export { MODULES, GEBEURTENIS, stuurOpdracht, icoonSvg, isModule, type ModuleId, type ModuleInfo, type Opdracht } from "./modules";

/**
 * Plaatst het paneel in een element van de werkomgeving. Zo kan elke host
 * (een Office-invoegtoepassing, een Nextcloud-zijbalk, een webmail) het
 * paneel inbedden met zijn eigen adapter.
 */
export function plaatsPaneel(
  element: HTMLElement,
  adapter: Adapter,
  opties: { basis?: string; sessie?: string; knoppen?: "rechts" | "boven"; module?: Opdracht } = {},
): () => void {
  const wortel = createRoot(element);
  wortel.render(createElement(Paneel, { adapter, basis: opties.basis, sessie: opties.sessie, knoppen: opties.knoppen, module: opties.module }));
  return () => wortel.unmount();
}
