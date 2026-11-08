import type { Adapter } from "@digitaalgemeengoed/oa-contract";
import type { JSX } from "react";

/** Publieke API van het paneel. */
export interface PaneelProps {
  adapter: Adapter;
  /** Basisadres van de integratielaag; leeg = hetzelfde adres als de pagina. */
  basis?: string;
  /** Sessiesleutel als Authorization-kop, voor werkomgevingen waar het cookie niet werkt (Office-invoegtoepassing). */
  sessie?: string;
}

export declare function Paneel(props: PaneelProps): JSX.Element;

/** Plaatst het paneel in een element van de werkomgeving; geeft een functie terug die het weer weghaalt. */
export declare function plaatsPaneel(element: HTMLElement, adapter: Adapter, opties?: { basis?: string; sessie?: string }): () => void;
