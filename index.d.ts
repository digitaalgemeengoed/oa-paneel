import type { Adapter } from "@digitaalgemeengoed/oa-contract";
import type { JSX } from "react";

/** De modules van de assistent, in de volgorde van de demo (MIRA). */
export type ModuleId = "ovz" | "ond" | "meta" | "toeg" | "anon" | "clas" | "waar" | "flow" | "help";

export interface ModuleInfo {
  id: ModuleId;
  naam: string;
  onder: string;
  /** Gezet als het prototype deze module nog niet heeft: wat er komt. */
  volgt?: string;
}

/** Een opdracht van een knop in de werkbalk van de werkomgeving. */
export type Opdracht = ModuleId | "beoordelen" | "anon-selectie";

/** Publieke API van het paneel. */
export interface PaneelProps {
  adapter: Adapter;
  /** Basisadres van de integratielaag; leeg = hetzelfde adres als de pagina. */
  basis?: string;
  /** Sessiesleutel als Authorization-kop, voor werkomgevingen waar het cookie niet werkt (Office-invoegtoepassing). */
  sessie?: string;
  /** Knoppen van de modules rechts (standaard, zoals in de demo) of bovenaan (zijbalk van LibreOffice). */
  knoppen?: "rechts" | "boven";
  /** Met welke module het paneel opent (standaard Overzicht); "beoordelen" opent Toegankelijkheid en beoordeelt meteen. */
  module?: Opdracht;
}

export declare function Paneel(props: PaneelProps): JSX.Element;

/** Plaatst het paneel in een element van de werkomgeving; geeft een functie terug die het weer weghaalt. */
export declare function plaatsPaneel(
  element: HTMLElement,
  adapter: Adapter,
  opties?: { basis?: string; sessie?: string; knoppen?: "rechts" | "boven"; module?: Opdracht },
): () => void;

export declare const MODULES: ModuleInfo[];
/** Naam van de DOM-gebeurtenis op window waarmee een host een opdracht stuurt. */
export declare const GEBEURTENIS: "oa-assistent";
/** Stuurt een opdracht naar het paneel op deze pagina: een module tonen, of beoordelen. */
export declare function stuurOpdracht(o: Opdracht): void;
/** Het pictogram van een module als svg-tekst, voor werkbalken buiten het paneel. */
export declare function icoonSvg(id: ModuleId, kleur?: string, grootte?: number): string;
export declare function isModule(x: unknown): x is ModuleId;
