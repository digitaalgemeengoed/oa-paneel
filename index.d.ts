import type { Adapter } from "@oa/contract";
import type { JSX } from "react";

/** Publieke API van het paneel. */
export interface PaneelProps {
  adapter: Adapter;
  /** Basisadres van de integratielaag; leeg = hetzelfde adres als de pagina. */
  basis?: string;
}

export declare function Paneel(props: PaneelProps): JSX.Element;

/** Plaatst het paneel in een element van de werkomgeving; geeft een functie terug die het weer weghaalt. */
export declare function plaatsPaneel(element: HTMLElement, adapter: Adapter, opties?: { basis?: string }): () => void;
