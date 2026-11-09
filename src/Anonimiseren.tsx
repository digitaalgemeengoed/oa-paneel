import { useMemo, useRef, useState, type ReactElement } from "react";
import { Paragraph, PrimaryActionButton, SecondaryActionButton, StatusBadge, SubtleButton } from "@utrecht/component-library-react";
import type { PiiSoort, Plek, Treffer } from "@digitaalgemeengoed/oa-contract";
import { anonimiseren, type Gevonden } from "@digitaalgemeengoed/oa-kern";

/** Hoe de soorten in het paneel heten. */
export const SOORTNAAM: Record<PiiSoort, string> = {
  naam: "Namen",
  adres: "Adressen",
  plaats: "Plaatsen",
  organisatie: "Organisaties",
  datum: "Data",
  bsn: "BSN",
  iban: "IBAN",
  telefoon: "Telefoonnummers",
  "e-mail": "E-mailadressen",
  kenteken: "Kentekens",
  zaaknummer: "Zaaknummers",
  identiteitsbewijs: "Documentnummers",
  rijbewijs: "Rijbewijsnummers",
  "kvk-nummer": "KvK-nummers",
  "btw-nummer": "Btw-nummers",
  "ip-adres": "IP-adressen",
};
const VOLGORDE = Object.keys(SOORTNAAM) as PiiSoort[];
/** Wat er in de geanonimiseerde weergave staat (zelfde als de dienst). */
const ENKELVOUD: Record<PiiSoort, string> = {
  naam: "naam",
  adres: "adres",
  plaats: "plaats",
  organisatie: "organisatie",
  datum: "datum",
  bsn: "BSN",
  iban: "IBAN",
  telefoon: "telefoonnummer",
  "e-mail": "e-mailadres",
  kenteken: "kenteken",
  zaaknummer: "zaaknummer",
  identiteitsbewijs: "documentnummer",
  rijbewijs: "rijbewijsnummer",
  "kvk-nummer": "KvK-nummer",
  "btw-nummer": "btw-nummer",
  "ip-adres": "IP-adres",
};
const LABEL = (s: PiiSoort) => `[${ENKELVOUD[s]}]`;

export interface AnonimiserenProps {
  /** Treffers zoeken in het geopende stuk. */
  zoek: () => Promise<Gevonden>;
  /** Bevestigen: afschermen en vastleggen; geeft de aantallen per soort terug. */
  bevestig: (gevonden: Gevonden, gekozen: Treffer[]) => Promise<Partial<Record<PiiSoort, number>>>;
  /** Kan er nu worden bevestigd? Anders de reden. */
  nietBevestigen: string | null;
  /** Is de laatste versie al eens geanonimiseerd (volgnummer)? */
  alGeanonimiseerd: number | null;
  toon?: (plek: Plek) => void;
  bezig: string | null;
  setBezig: (b: string | null) => void;
  meld: (m: { soort: "ok" | "info" | "warning" | "error"; tekst: string } | null) => void;
  uit: boolean;
}

/**
 * De module Anonimiseren. Alles wat de assistent vindt, is een voorbeeld
 * tot de medewerker bevestigt: onterechte treffers zet je terug (klik), en
 * gemiste voeg je toe (selecteer de tekst). Bevestigen legt de
 * geanonimiseerde weergave vast; het document zelf blijft zoals het is.
 */
export function Anonimiseren({ zoek, bevestig, nietBevestigen, alGeanonimiseerd, toon, bezig, setBezig, meld, uit }: AnonimiserenProps) {
  const [gevonden, setGevonden] = useState<Gevonden | null>(null);
  const [aan, setAan] = useState<Set<PiiSoort>>(new Set());
  const [terug, setTerug] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<Treffer[]>([]);
  const [resultaat, setResultaat] = useState(false);
  const [selectie, setSelectie] = useState<{ begin: number; eind: number; tekst: string } | null>(null);
  const [nieuweSoort, setNieuweSoort] = useState<PiiSoort>("naam");
  const [overalToevoegen, setOveralToevoegen] = useState(true);
  const [bevestigd, setBevestigd] = useState<Partial<Record<PiiSoort, number>> | null>(null);
  const voorbeeld = useRef<HTMLDivElement>(null);

  async function doe(naam: string, werk: () => Promise<void>) {
    setBezig(naam);
    meld(null);
    try {
      await werk();
    } catch (e) {
      meld({ soort: "error", tekst: (e as Error).message });
    } finally {
      setBezig(null);
    }
  }

  const doeZoeken = () =>
    doe("anon-zoeken", async () => {
      const g = await zoek();
      setGevonden(g);
      setAan(new Set(g.standaard));
      setTerug(new Set());
      setExtra([]);
      setResultaat(false);
      setSelectie(null);
      setBevestigd(null);
    });

  const alle = useMemo(() => (gevonden ? [...gevonden.treffers, ...extra].sort((a, b) => a.begin - b.begin) : []), [gevonden, extra]);
  const geldt = (t: Treffer) => !terug.has(t.id) && (t.bron === "medewerker" || aan.has(t.soort));
  const gekozen = alle.filter(geldt);
  const perSoort = useMemo(() => {
    const m = new Map<PiiSoort, { totaal: number; gekozen: number }>();
    for (const t of alle) {
      const x = m.get(t.soort) ?? { totaal: 0, gekozen: 0 };
      x.totaal++;
      if (geldt(t)) x.gekozen++;
      m.set(t.soort, x);
    }
    return VOLGORDE.filter((s) => m.has(s)).map((s) => ({ soort: s, ...m.get(s)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alle, aan, terug]);

  const wissel = (t: Treffer) => {
    setBevestigd(null);
    if (t.bron === "medewerker") {
      setExtra((e) => e.filter((x) => x.id !== t.id));
      return;
    }
    // Staat de soort uit, dan zet een klik deze treffer juist aan: als toevoeging.
    if (!aan.has(t.soort)) {
      setExtra((e) => [...e, { ...t, id: `mw-${t.begin}-${t.eind}`, bron: "medewerker", score: 1 }]);
      return;
    }
    setTerug((s) => {
      const n = new Set(s);
      if (n.has(t.id)) n.delete(t.id);
      else n.add(t.id);
      return n;
    });
  };

  const wisselSoort = (s: PiiSoort) => {
    setBevestigd(null);
    setAan((a) => {
      const n = new Set(a);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  };

  /** Een selectie in het voorbeeld omrekenen naar posities in de tekst. */
  function leesSelectie() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !voorbeeld.current || !gevonden) return setSelectie(null);
    const pos = (knoop: Node | null, offset: number): number | null => {
      const el = (knoop?.nodeType === Node.TEXT_NODE ? knoop.parentElement : (knoop as Element | null))?.closest<HTMLElement>("[data-b]");
      if (!el || !voorbeeld.current!.contains(el)) return null;
      return Number(el.dataset.b) + (knoop?.nodeType === Node.TEXT_NODE ? offset : 0);
    };
    let a = pos(sel.anchorNode, sel.anchorOffset);
    let b = pos(sel.focusNode, sel.focusOffset);
    if (a === null || b === null) return setSelectie(null);
    if (a > b) [a, b] = [b, a];
    while (a < b && /\s/.test(gevonden.tekst[a])) a++;
    while (b > a && /\s/.test(gevonden.tekst[b - 1])) b--;
    const tekst = gevonden.tekst.slice(a, b);
    if (tekst.length < 2 || tekst.includes("\n\n") || alle.some((t) => a! < t.eind && t.begin < b!)) return setSelectie(null);
    setSelectie({ begin: a, eind: b, tekst });
  }

  function voegToe() {
    if (!selectie || !gevonden) return;
    const nieuw: Treffer[] = overalToevoegen
      ? anonimiseren.overal({ tekst: gevonden.tekst, treffers: alle }, selectie.tekst, nieuweSoort)
      : [{ id: `mw-${selectie.begin}-${selectie.eind}`, soort: nieuweSoort, tekst: selectie.tekst, begin: selectie.begin, eind: selectie.eind, score: 1, bron: "medewerker" }];
    setExtra((e) => [...e, ...nieuw]);
    setSelectie(null);
    setBevestigd(null);
    window.getSelection()?.removeAllRanges();
  }

  const doeBevestigen = () =>
    doe("anon-bevestigen", async () => {
      const overzicht = await bevestig(gevonden!, gekozen);
      setBevestigd(overzicht);
      setResultaat(true);
      const lijst = Object.entries(overzicht)
        .map(([s, n]) => {
          const naam = SOORTNAAM[s as PiiSoort];
          return `${/^[A-Z][A-Z]/.test(naam) ? naam : naam.toLowerCase()} ${n}`;
        })
        .join(", ");
      meld({ soort: "ok", tekst: `De geanonimiseerde weergave is vastgelegd${lijst ? ` (${lijst})` : ""}. Het document zelf is niet gewijzigd.` });
    });

  /** Het voorbeeld: de tekst per blok, treffers als knop. */
  function blok(begin: number, eind: number) {
    const delen: ReactElement[] = [];
    let i = begin;
    for (const t of alle) {
      if (t.eind <= begin || t.begin >= eind) continue;
      if (t.begin > i) delen.push(<span key={`t${i}`} data-b={i}>{gevonden!.tekst.slice(i, t.begin)}</span>);
      const af = geldt(t);
      delen.push(
        resultaat ? (
          af ? (
            <span key={t.id} className="oa-pii-label">{LABEL(t.soort)}</span>
          ) : (
            <span key={t.id} data-b={t.begin}>{t.tekst}</span>
          )
        ) : (
          <button
            key={t.id}
            type="button"
            className={`oa-pii${af ? "" : " oa-pii-terug"}${t.bron === "medewerker" ? " oa-pii-mw" : ""}`}
            aria-pressed={af}
            title={`${SOORTNAAM[t.soort]}${t.bron === "medewerker" ? ", door jou toegevoegd" : `, zekerheid ${Math.round(t.score * 100)}%`}. ${af ? "Klik om terug te zetten." : "Klik om af te schermen."}`}
            onClick={() => wissel(t)}
          >
            {t.tekst}
          </button>
        ),
      );
      i = t.eind;
    }
    if (i < eind) delen.push(<span key={`t${i}`} data-b={i}>{gevonden!.tekst.slice(i, eind)}</span>);
    return delen;
  }

  return (
    <section className="oa-sectie" aria-label="Anonimiseren">
      {alGeanonimiseerd !== null && !gevonden && (
        <Paragraph small>
          De laatste versie heeft al een geanonimiseerde weergave{alGeanonimiseerd > 1 ? ` (${alGeanonimiseerd}e correctie)` : ""}. Opnieuw bevestigen legt een correctie vast.
        </Paragraph>
      )}
      <Paragraph small>
        De assistent zoekt persoonsgegevens en laat zien wat hij zou afschermen. Klik op een gemarkeerd gegeven om het terug te zetten; selecteer tekst om iets toe te
        voegen. Pas als je bevestigt, wordt de geanonimiseerde weergave vastgelegd. Het document zelf blijft zoals het is.
      </Paragraph>
      <SecondaryActionButton onClick={doeZoeken} disabled={uit || bezig !== null} busy={bezig === "anon-zoeken"}>
        {gevonden ? "Opnieuw zoeken" : "Persoonsgegevens zoeken"}
      </SecondaryActionButton>

      {gevonden && (
        <>
          <div className="oa-anon-status">
            {bevestigd ? <StatusBadge status="safe">bevestigd en vastgelegd</StatusBadge> : <StatusBadge status="warning">voorbeeld, nog niet bevestigd</StatusBadge>}
          </div>

          {perSoort.length > 0 ? (
            <fieldset className="oa-soorten">
              <legend>Afschermen</legend>
              {perSoort.map(({ soort, totaal, gekozen: g }) => (
                <label key={soort}>
                  <input type="checkbox" checked={aan.has(soort)} onChange={() => wisselSoort(soort)} />
                  <span>{SOORTNAAM[soort]}</span>
                  <span className="oa-klein">
                    {g} van {totaal}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <Paragraph>De assistent vond geen persoonsgegevens. Selecteer tekst in het voorbeeld om zelf iets af te schermen.</Paragraph>
          )}

          <div className="oa-anon-weergave" role="group" aria-label="Weergave">
            <button type="button" aria-pressed={!resultaat} onClick={() => setResultaat(false)}>
              Controleren
            </button>
            <button type="button" aria-pressed={resultaat} onClick={() => setResultaat(true)}>
              Resultaat
            </button>
          </div>

          <div ref={voorbeeld} className="oa-anon-voorbeeld" onMouseUp={resultaat ? undefined : leesSelectie} onKeyUp={resultaat ? undefined : leesSelectie} tabIndex={0} aria-label="Voorbeeld van het stuk">
            {gevonden.blokken.map((b) => (
              <p key={b.begin} className="oa-anon-blok">
                {blok(b.begin, b.eind)}
                {toon && !resultaat && alle.some((t) => t.begin >= b.begin && t.begin < b.eind) && (
                  <SubtleButton className="oa-anon-toon" onClick={() => toon(b.plek)} aria-label={`Toon ${b.plek.beschrijving} in het document`}>
                    Toon
                  </SubtleButton>
                )}
              </p>
            ))}
          </div>

          {selectie && !resultaat && (
            <div className="oa-kader oa-anon-toevoegen">
              <Paragraph small>
                Geselecteerd: <q>{selectie.tekst.length > 60 ? `${selectie.tekst.slice(0, 59)}…` : selectie.tekst}</q>
              </Paragraph>
              <label className="oa-klein">
                Soort{" "}
                <select value={nieuweSoort} onChange={(e) => setNieuweSoort(e.target.value as PiiSoort)}>
                  {VOLGORDE.map((s) => (
                    <option key={s} value={s}>
                      {SOORTNAAM[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="oa-klein">
                <input type="checkbox" checked={overalToevoegen} onChange={(e) => setOveralToevoegen(e.target.checked)} /> Overal waar het staat
              </label>
              <SecondaryActionButton onClick={voegToe}>Afschermen</SecondaryActionButton>
            </div>
          )}

          <Paragraph small>
            {gekozen.length === 1 ? "1 gegeven wordt" : `${gekozen.length} gegevens worden`} afgeschermd. Herkenning: {gevonden.motor}.
          </Paragraph>
          <PrimaryActionButton onClick={doeBevestigen} disabled={uit || bezig !== null || !!nietBevestigen} busy={bezig === "anon-bevestigen"}>
            Bevestigen en vastleggen
          </PrimaryActionButton>
          {nietBevestigen && <Paragraph small>{nietBevestigen}</Paragraph>}
        </>
      )}
    </section>
  );
}
