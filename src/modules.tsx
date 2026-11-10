/**
 * De modules van de assistent, in de volgorde van de demo (MIRA). Elke
 * module heeft een eigen weergave in het paneel; de knoppen staan in een
 * rij aan de zijkant of bovenaan. Modules die het prototype nog niet heeft,
 * staan er wel in, met "volgt": zo is de hele opzet te zien.
 */
export type ModuleId = "ovz" | "ond" | "meta" | "toeg" | "anon" | "clas" | "waar" | "flow" | "help";

export interface ModuleInfo {
  id: ModuleId;
  naam: string;
  onder: string;
  /** Nog niet gebouwd: de weergave zegt wat er komt. */
  volgt?: string;
}

export const MODULES: ModuleInfo[] = [
  { id: "ovz", naam: "Overzicht", onder: "Status, versie en wat er nog open staat" },
  {
    id: "ond",
    naam: "Onderdelen",
    onder: "Wat van elders komt",
    volgt:
      "Een stuk kan onderdelen hebben die elders vandaan komen: een bijlage, een tabel uit een rekenblad, een kaart. Samen vormen ze een samengesteld object. Hier zie je straks welke onderdelen er zijn, waar ze vandaan komen en of ze nog actueel zijn.",
  },
  { id: "meta", naam: "Metadateren", onder: "Kenmerken, en wie dat zegt" },
  { id: "toeg", naam: "Toegankelijkheid", onder: "Structuur en alternatieve tekst" },
  { id: "anon", naam: "Anonimiseren", onder: "Persoonsgegevens vinden en afschermen" },
  {
    id: "clas",
    naam: "Classificeren",
    onder: "Selectielijst, bewaartermijn en eigen kenmerken",
  },
  {
    id: "waar",
    naam: "Waarmerken",
    onder: "Authenticiteit en integriteit van een versie",
    volgt: "Een waarmerk legt vast dat een versie echt is en sindsdien niet is gewijzigd. Dat kan op elk moment in de levensloop en voor elke volgende versie, namens jezelf of namens de organisatie.",
  },
  { id: "flow", naam: "Workflow", onder: "Stappen van de procedure", volgt: "Toont per stuk welke stappen zijn gezet en welke nog volgen, en wat er van jou wordt gevraagd." },
  { id: "help", naam: "Help", onder: "Wat je waar vindt" },
];

export const isModule = (x: unknown): x is ModuleId => MODULES.some((m) => m.id === x);

const PADEN: Record<ModuleId, string> = {
  ovz: "M2.5 7.5L8 3l5.5 4.5V13h-4V9.5h-3V13h-4z",
  ond: "M8 2.5l5.5 3-5.5 3-5.5-3zM2.5 8.5l5.5 3 5.5-3M2.5 11l5.5 3 5.5-3",
  meta: "M2.5 2.5h5l6 6-5 5-6-6zM5.4 5.4h.1",
  toeg: "M8 4.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM3 6h10M8 6v3.5M8 9.5l-2.5 4M8 9.5l2.5 4",
  anon: "M2.5 4h11M2.5 8h4M9 6.5h4.5v3H9zM2.5 12h8",
  clas: "M4 13.5v-11M4 3h8l-2 2.5 2 2.5H4",
  waar: "M8 9.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM6 9l-1 4.5 3-1.5 3 1.5-1-4.5",
  flow: "M2.5 2.5h4v3h-4zM9.5 10.5h4v3h-4zM4.5 5.5v6.5h5",
  help: "M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM6.4 6.6a1.6 1.6 0 1 1 2.4 1.4c-.5.3-.8.7-.8 1.2M8 11.2h.1",
};

export function Icoon({ id, grootte = 18 }: { id: ModuleId; grootte?: number }) {
  return (
    <svg width={grootte} height={grootte} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PADEN[id]} />
    </svg>
  );
}

/** Dezelfde pictogrammen als svg-tekst, voor werkbalken buiten het paneel (Collabora, LibreOffice). */
export function icoonSvg(id: ModuleId, kleur = "#1d1d1b", grootte = 24): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${grootte}" height="${grootte}" viewBox="0 0 16 16" fill="none" stroke="${kleur}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="${PADEN[id]}"/></svg>`;
}

/**
 * Een opdracht van buiten het paneel: een knop in de werkbalk van de
 * werkomgeving. De host stuurt een DOM-gebeurtenis "oa-assistent" op
 * window, met als detail een module, "beoordelen" of "anon-selectie"
 * (de selectie in het document anonimiseren).
 */
export type Opdracht = ModuleId | "beoordelen" | "anon-selectie";
export const GEBEURTENIS = "oa-assistent";
export function stuurOpdracht(o: Opdracht): void {
  window.dispatchEvent(new CustomEvent(GEBEURTENIS, { detail: o }));
}
