import { createRoot } from "react-dom/client";
import { createElement } from "react";
import type { Adapter } from "@digitaalgemeengoed/oa-contract";
import { Paneel, type PaneelProps } from "./Paneel";

import "@utrecht/component-library-css/dist/index.css";
import "@nl-design-system-unstable/haarlem-design-tokens/dist/index.css";
import "@nl-design-system-unstable/voorbeeld-design-tokens/dist/theme.css";
import "./paneel.css";

export { Paneel, type PaneelProps };

/**
 * Plaatst het paneel in een element van de werkomgeving. Zo kan elke host
 * (een Office-invoegtoepassing, een Nextcloud-zijbalk, een webmail) het
 * paneel inbedden met zijn eigen adapter.
 */
export function plaatsPaneel(element: HTMLElement, adapter: Adapter, opties: { basis?: string; sessie?: string } = {}): () => void {
  const wortel = createRoot(element);
  wortel.render(createElement(Paneel, { adapter, basis: opties.basis, sessie: opties.sessie }));
  return () => wortel.unmount();
}
