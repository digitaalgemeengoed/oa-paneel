import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Paragraph, PrimaryActionButton, SecondaryActionButton, StatusBadge, SubtleButton } from "@utrecht/component-library-react";
import {
  PII_CATEGORIE,
  PII_SOORT,
  type PiiCategorie,
  type PiiOnthuld,
  type PiiRegister,
  type PiiSoort,
  type Plek,
  type Ppl,
  type Treffer,
} from "@digitaalgemeengoed/oa-contract";
import { anonimiseren, type Bevestigd, type Gevonden } from "@digitaalgemeengoed/oa-kern";

/** Hoe de soorten in het paneel heten. */
export const SOORTNAAM: Record<PiiSoort, string> = {
  naam: "Namen",
  adres: "Adressen",
  plaats: "Plaatsen",
  organisatie: "Organisaties",
  datum: "Data",
  geboortedatum: "Geboortedata",
  bsn: "BSN",
  iban: "IBAN",
  bedrag: "Bedragen",
  telefoon: "Telefoonnummers",
  "e-mail": "E-mailadressen",
  kenteken: "Kentekens",
  zaaknummer: "Zaaknummers",
  identiteitsbewijs: "Documentnummers",
  rijbewijs: "Rijbewijsnummers",
  "kvk-nummer": "KvK-nummers",
  "btw-nummer": "Btw-nummers",
  "ip-adres": "IP-adressen",
  gezondheid: "Gezondheid",
  religie: "Religie of levensovertuiging",
  etniciteit: "Ras of etnische afkomst",
  biometrie: "Biometrische gegevens",
  strafrechtelijk: "Strafrechtelijke gegevens",
  overig: "Overig",
};
const VOLGORDE = Object.keys(SOORTNAAM) as PiiSoort[];
const CATEGORIEEN = Object.keys(PII_CATEGORIE) as PiiCategorie[];
const catVan = (s: PiiSoort) => PII_SOORT[s].categorie;
const artikel = (c: PiiCategorie) => `art. ${PII_CATEGORIE[c].artikel}`;

export interface AnonimiserenProps {
  /** Treffers zoeken in het geopende stuk. */
  zoek: () => Promise<Gevonden>;
  /** Bevestigen: registreren, in het document vervangen, nieuwe versie. */
  bevestig: (gekozen: Treffer[]) => Promise<Bevestigd>;
  /** Kan er nu worden bevestigd? Anders de reden. */
  nietBevestigen: string | null;
  /** Het register van dit stuk; null als het stuk nog niet is vastgelegd. */
  register: () => Promise<PiiRegister | null>;
  onthul: (plaatshouders: string[]) => Promise<PiiOnthuld[]>;
  /** Alleen voor beheerders: de sleutel van een categorie vernietigen. */
  vernietig?: (categorie: PiiCategorie, reden: string) => Promise<PiiRegister>;
  /** De selectie in het document zelf lezen, als de werkomgeving dat kan. */
  leesSelectie?: () => Promise<string>;
  /** Het PPL-niveau van de medewerker. */
  niveau: Ppl;
  /** Verandert als er een nieuwe versie is; dan het register opnieuw lezen. */
  versie: number | null;
  toon?: (plek: Plek) => void;
  bezig: string | null;
  setBezig: (b: string | null) => void;
  meld: (m: { soort: "ok" | "info" | "warning" | "error"; tekst: string } | null) => void;
  uit: boolean;
}

/**
 * De module Anonimiseren, bij de bron (zoals de MIRA-demo). Alles wat de
 * assistent vindt, is een voorbeeld tot de medewerker bevestigt: onterechte
 * treffers zet je terug (klik), en gemiste voeg je toe (selecteer tekst in
 * het voorbeeld of in het document). Bevestigen versleutelt de gegevens in
 * het register, vervangt ze in het document door een plaatshouder en legt
 * een nieuwe versie vast.
 */
export function Anonimiseren(p: AnonimiserenProps) {
  const { zoek, bevestig, nietBevestigen, niveau, bezig, setBezig, meld, uit } = p;
  const [gevonden, setGevonden] = useState<Gevonden | null>(null);
  const [aan, setAan] = useState<Set<PiiSoort>>(new Set());
  const [terug, setTerug] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<Treffer[]>([]);
  const [resultaat, setResultaat] = useState(false);
  const [selectie, setSelectie] = useState<{ begin: number; eind: number; tekst: string; uitDocument?: boolean } | null>(null);
  const [nieuweSoort, setNieuweSoort] = useState<PiiSoort>("naam");
  const [overalToevoegen, setOveralToevoegen] = useState(true);
  const [register, setRegister] = useState<PiiRegister | null>(null);
  const [onthuld, setOnthuld] = useState<Map<string, string>>(new Map());
  const [vernietigCat, setVernietigCat] = useState<PiiCategorie | null>(null);
  const [reden, setReden] = useState("");
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

  const laadRegister = useCallback(async () => {
    try {
      setRegister(await p.register());
    } catch {
      setRegister(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.register]);

  useEffect(() => {
    laadRegister();
  }, [laadRegister, p.versie]);

  const doeZoeken = () =>
    doe("anon-zoeken", async () => {
      const g = await zoek();
      setGevonden(g);
      setAan(new Set(g.standaard));
      setTerug(new Set());
      setExtra([]);
      setResultaat(false);
      setSelectie(null);
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

  /**
   * De plaatshouders zoals het register ze zal geven: per soort doorgenummerd
   * na wat er al staat. Staat een waarde al in het register, dan krijgt die
   * zijn bestaande plaatshouder; dat kan het paneel niet zien (de waarden zijn
   * versleuteld), dus de nummers zijn een voorbeeld.
   */
  const plaatshouderVan = useMemo(() => {
    const al = new Map<string, number>();
    for (const r of register?.registraties ?? []) {
      const m = /^\[(.+) (\d+)\]$/.exec(r.plaatshouder);
      if (m) al.set(m[1]!, Math.max(al.get(m[1]!) ?? 0, Number(m[2])));
    }
    const per = new Map<string, string>();
    for (const t of gekozen) {
      const k = `${t.soort}\0${t.tekst.replace(/\s+/g, " ").trim()}`;
      if (per.has(k)) continue;
      const ph = PII_SOORT[t.soort].plaatshouder;
      const n = (al.get(ph) ?? 0) + 1;
      al.set(ph, n);
      per.set(k, `[${ph} ${n}]`);
    }
    return (t: Treffer) => per.get(`${t.soort}\0${t.tekst.replace(/\s+/g, " ").trim()}`) ?? `[${PII_SOORT[t.soort].plaatshouder}]`;
  }, [gekozen, register]);

  const wissel = (t: Treffer) => {
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

  const wisselSoort = (s: PiiSoort) =>
    setAan((a) => {
      const n = new Set(a);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });

  /** Een selectie in het voorbeeld omrekenen naar posities in de tekst. */
  function leesVoorbeeldSelectie() {
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
    while (a < b && /\s/.test(gevonden.tekst[a]!)) a++;
    while (b > a && /\s/.test(gevonden.tekst[b - 1]!)) b--;
    const tekst = gevonden.tekst.slice(a, b);
    if (tekst.length < 2 || tekst.includes("\n\n") || alle.some((t) => a! < t.eind && t.begin < b!)) return setSelectie(null);
    setSelectie({ begin: a, eind: b, tekst });
  }

  /** De selectie in het document zelf (Word, LibreOffice, de demo …). */
  const doeDocumentSelectie = () =>
    doe("anon-selectie", async () => {
      const tekst = (await p.leesSelectie!()).trim();
      if (tekst.length < 2) {
        meld({ soort: "info", tekst: "Selecteer eerst in het document de tekst die je wilt anonimiseren, en kies dan opnieuw deze knop." });
        return;
      }
      const i = gevonden!.tekst.indexOf(tekst);
      if (i >= 0 && alle.some((t) => t.tekst === tekst)) {
        meld({ soort: "info", tekst: `"${tekst}" staat al in de lijst.` });
        return;
      }
      setSelectie(i >= 0 ? { begin: i, eind: i + tekst.length, tekst, uitDocument: true } : { begin: -1, eind: -1, tekst, uitDocument: true });
    });

  function voegToe() {
    if (!selectie || !gevonden) return;
    let nieuw: Treffer[];
    if (selectie.begin < 0) {
      // Niet in de tekst van het voorbeeld (bv. in een kop- of voettekst): toch registreren en vervangen.
      nieuw = [{ id: `mw-los-${Date.now()}`, soort: nieuweSoort, tekst: selectie.tekst, begin: -1, eind: -1, score: 1, bron: "medewerker" }];
    } else if (overalToevoegen) {
      nieuw = anonimiseren.overal({ tekst: gevonden.tekst, treffers: alle }, selectie.tekst, nieuweSoort);
    } else {
      nieuw = [{ id: `mw-${selectie.begin}-${selectie.eind}`, soort: nieuweSoort, tekst: selectie.tekst, begin: selectie.begin, eind: selectie.eind, score: 1, bron: "medewerker" }];
    }
    setExtra((e) => [...e, ...nieuw]);
    setSelectie(null);
    window.getSelection()?.removeAllRanges();
  }

  const doeBevestigen = () =>
    doe("anon-bevestigen", async () => {
      const r = await bevestig(gekozen);
      const nieuw = r.registraties.filter((x) => x.nieuw).length;
      const versie = r.stand.object?.versies.at(-1)?.nummer;
      meld({
        soort: r.resterend ? "warning" : "ok",
        tekst:
          `${r.registraties.length === 1 ? "1 persoonsgegeven" : `${r.registraties.length} persoonsgegevens`} versleuteld in het register` +
          `${nieuw < r.registraties.length ? ` (${nieuw} nieuw)` : ""}, ${r.vervangen} keer vervangen in het document` +
          `${versie ? `, vastgelegd als versie ${versie}` : ""}.` +
          (r.resterend ? ` Let op: ${r.resterend} keer staat een gegeven er nog (bijvoorbeeld over opmaak heen). Zoek opnieuw en vervang het.` : ""),
      });
      setGevonden(null);
      setExtra([]);
      setOnthuld(new Map());
      await laadRegister();
    });

  const doeOnthullen = (plaatshouders: string[]) =>
    doe("anon-onthul", async () => {
      const w = await p.onthul(plaatshouders);
      setOnthuld((m) => new Map([...m, ...w.map((x) => [x.plaatshouder, x.waarde] as const)]));
    });

  const doeVernietigen = () =>
    doe("anon-vernietig", async () => {
      const r = await p.vernietig!(vernietigCat!, reden.trim());
      setRegister(r);
      setOnthuld(new Map());
      meld({ soort: "ok", tekst: `De sleutel voor ${PII_CATEGORIE[vernietigCat!].omschrijving} van dit stuk is vernietigd. Die gegevens zijn niet meer te lezen.` });
      setVernietigCat(null);
      setReden("");
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
            <span key={t.id} className={`oa-pii-label oa-pii-${catVan(t.soort)}`}>{plaatshouderVan(t)}</span>
          ) : (
            <span key={t.id} data-b={t.begin}>{t.tekst}</span>
          )
        ) : (
          <button
            key={t.id}
            type="button"
            className={`oa-pii oa-pii-${catVan(t.soort)}${af ? "" : " oa-pii-terug"}${t.bron === "medewerker" ? " oa-pii-mw" : ""}`}
            aria-pressed={af}
            title={`${SOORTNAAM[t.soort]} (${artikel(catVan(t.soort))})${t.bron === "medewerker" ? ", door jou toegevoegd" : `, zekerheid ${Math.round(t.score * 100)}%`}. ${af ? "Klik om terug te zetten." : "Klik om te anonimiseren."}`}
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

  const los = alle.filter((t) => t.begin < 0);
  const regs = register?.registraties ?? [];
  const catsInRegister = CATEGORIEEN.filter((c) => regs.some((r) => r.categorie === c && !r.vernietigd));

  return (
    <section className="oa-sectie" aria-label="Anonimiseren">
      <Paragraph small>
        De assistent zoekt persoonsgegevens en laat zien wat hij zou vervangen. Klik op een gemarkeerd gegeven om het terug te zetten; selecteer tekst om iets toe te voegen.
        Als je bevestigt, versleutelt het platform elk gegeven in het register (een sleutel per document per AVG-categorie) en vervangt de assistent het in het document
        door een plaatshouder, zoals [PERSOON 1].
      </Paragraph>
      <p className="oa-klein">
        Jouw niveau: PPL {niveau}
        {niveau < 3 ? ` (je kunt ${CATEGORIEEN.filter((c) => PII_CATEGORIE[c].ppl <= niveau).map(artikel).join(" en ") || "geen gegevens"} inzien)` : " (alle categorieën)"}
      </p>
      <SecondaryActionButton onClick={doeZoeken} disabled={uit || bezig !== null} busy={bezig === "anon-zoeken"}>
        {gevonden ? "Opnieuw zoeken" : "Persoonsgegevens zoeken"}
      </SecondaryActionButton>

      {gevonden && (
        <>
          <div className="oa-anon-status">
            <StatusBadge status="warning">voorbeeld, nog niet bevestigd</StatusBadge>
          </div>

          {perSoort.length > 0 ? (
            <fieldset className="oa-soorten">
              <legend>Anonimiseren</legend>
              {perSoort.map(({ soort, totaal, gekozen: g }) => (
                <label key={soort}>
                  <input type="checkbox" checked={aan.has(soort)} onChange={() => wisselSoort(soort)} />
                  <span>
                    {SOORTNAAM[soort]} <span className={`oa-cat oa-cat-${catVan(soort)}`}>{artikel(catVan(soort))}</span>
                  </span>
                  <span className="oa-klein">
                    {g} van {totaal}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <Paragraph>De assistent vond geen persoonsgegevens. Selecteer tekst om zelf iets te anonimiseren.</Paragraph>
          )}

          <div className="oa-anon-weergave" role="group" aria-label="Weergave">
            <button type="button" aria-pressed={!resultaat} onClick={() => setResultaat(false)}>
              Controleren
            </button>
            <button type="button" aria-pressed={resultaat} onClick={() => setResultaat(true)}>
              Resultaat
            </button>
          </div>

          <div
            ref={voorbeeld}
            className="oa-anon-voorbeeld"
            onMouseUp={resultaat ? undefined : leesVoorbeeldSelectie}
            onKeyUp={resultaat ? undefined : leesVoorbeeldSelectie}
            tabIndex={0}
            aria-label="Voorbeeld van het stuk"
          >
            {gevonden.blokken.map((b) => (
              <p key={b.begin} className="oa-anon-blok">
                {blok(b.begin, b.eind)}
                {p.toon && !resultaat && alle.some((t) => t.begin >= b.begin && t.begin < b.eind) && (
                  <SubtleButton className="oa-anon-toon" onClick={() => p.toon!(b.plek)} aria-label={`Toon ${b.plek.beschrijving} in het document`}>
                    Toon
                  </SubtleButton>
                )}
              </p>
            ))}
          </div>
          {resultaat && <p className="oa-klein">De nummers zijn een voorbeeld: staat een gegeven al in het register, dan houdt het zijn plaatshouder.</p>}

          {los.length > 0 && (
            <div className="oa-anon-los">
              <span className="oa-klein">Ook uit het document:</span>
              {los.map((t) => (
                <button key={t.id} type="button" className={`oa-pii oa-pii-mw oa-pii-${catVan(t.soort)}`} title="Klik om weg te halen" onClick={() => wissel(t)}>
                  {resultaat ? plaatshouderVan(t) : t.tekst}
                </button>
              ))}
            </div>
          )}

          {p.leesSelectie && !resultaat && (
            <SubtleButton onClick={doeDocumentSelectie} disabled={uit || bezig !== null}>
              Selectie uit het document toevoegen
            </SubtleButton>
          )}

          {selectie && !resultaat && (
            <div className="oa-kader oa-anon-toevoegen">
              <Paragraph small>
                {selectie.uitDocument ? "Geselecteerd in het document" : "Geselecteerd"}: <q>{selectie.tekst.length > 60 ? `${selectie.tekst.slice(0, 59)}…` : selectie.tekst}</q>
              </Paragraph>
              <label className="oa-klein">
                Soort{" "}
                <select value={nieuweSoort} onChange={(e) => setNieuweSoort(e.target.value as PiiSoort)}>
                  {VOLGORDE.map((s) => (
                    <option key={s} value={s}>
                      {SOORTNAAM[s]} ({artikel(catVan(s))})
                    </option>
                  ))}
                </select>
              </label>
              {selectie.begin >= 0 && (
                <label className="oa-klein">
                  <input type="checkbox" checked={overalToevoegen} onChange={(e) => setOveralToevoegen(e.target.checked)} /> Overal waar het staat
                </label>
              )}
              <div className="oa-rij">
                <SecondaryActionButton onClick={voegToe}>Anonimiseren</SecondaryActionButton>
                <SubtleButton onClick={() => setSelectie(null)}>Annuleren</SubtleButton>
              </div>
            </div>
          )}

          <Paragraph small>
            {gekozen.length === 1 ? "1 gegeven wordt" : `${gekozen.length} gegevens worden`} vervangen. Herkenning: {gevonden.motor}.
          </Paragraph>
          <PrimaryActionButton onClick={doeBevestigen} disabled={uit || bezig !== null || !!nietBevestigen || gekozen.length === 0} busy={bezig === "anon-bevestigen"}>
            Bevestigen: versleutelen en vervangen
          </PrimaryActionButton>
          {nietBevestigen && <Paragraph small>{nietBevestigen}</Paragraph>}
        </>
      )}

      {register && (
        <section className="oa-register" aria-label="Register van persoonsgegevens">
          <h3>Register van dit stuk</h3>
          {regs.length === 0 ? (
            <Paragraph small>Nog geen persoonsgegevens geregistreerd.</Paragraph>
          ) : (
            <>
              <ul className="oa-registerlijst">
                {regs.map((r) => {
                  const mag = niveau >= PII_CATEGORIE[r.categorie].ppl;
                  const w = onthuld.get(r.plaatshouder);
                  return (
                    <li key={r.plaatshouder}>
                      <div>
                        <code>{r.plaatshouder}</code> <span className="oa-klein">{SOORTNAAM[r.soort] ?? r.soort}</span>
                      </div>
                      <div className="oa-klein">
                        <span className={`oa-cat oa-cat-${r.categorie}`}>{artikel(r.categorie)}</span> {r.algoritme} · <span title="Sleutel per document per categorie">{r.sleutel}</span> · versie {r.versie}
                      </div>
                      <div className="oa-registerwaarde">
                        {r.vernietigd ? (
                          <span className="oa-klein">sleutel vernietigd: onleesbaar</span>
                        ) : w !== undefined ? (
                          <>
                            <span className="oa-onthuld">{w}</span>
                            <SubtleButton
                              onClick={() =>
                                setOnthuld((m) => {
                                  const n = new Map(m);
                                  n.delete(r.plaatshouder);
                                  return n;
                                })
                              }
                            >
                              Verberg
                            </SubtleButton>
                          </>
                        ) : mag ? (
                          <SubtleButton onClick={() => doeOnthullen([r.plaatshouder])} disabled={uit || bezig !== null} aria-label={`Toon origineel van ${r.plaatshouder}`}>
                            Toon origineel
                          </SubtleButton>
                        ) : (
                          <span className="oa-klein">inzien vraagt PPL {PII_CATEGORIE[r.categorie].ppl}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="oa-klein">Inzien wordt vastgelegd in de geschiedenis van het stuk.</p>
            </>
          )}
          {register.metGegevensTot ? (
            <Paragraph small>
              {register.metGegevensTot === 1 ? "Versie 1 bevat" : `Versies 1 tot en met ${register.metGegevensTot} bevatten`} de gegevens nog leesbaar; alleen PPL 3 mag die openen.
            </Paragraph>
          ) : null}

          {p.vernietig && catsInRegister.length > 0 && (
            <details className="oa-vernietig">
              <summary>Sleutel vernietigen (beheer)</summary>
              <Paragraph small>
                Na vernietigen zijn de gegevens van die categorie in dit stuk voorgoed onleesbaar, ook voor beheerders. Dit kan niet ongedaan worden gemaakt.
              </Paragraph>
              <label className="oa-klein">
                Categorie{" "}
                <select value={vernietigCat ?? ""} onChange={(e) => setVernietigCat((e.target.value || null) as PiiCategorie | null)}>
                  <option value="">Kies…</option>
                  {catsInRegister.map((c) => (
                    <option key={c} value={c}>
                      {PII_CATEGORIE[c].omschrijving} ({artikel(c)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="oa-klein oa-blok">
                Reden (minstens 10 tekens)
                <textarea rows={2} value={reden} onChange={(e) => setReden(e.target.value)} />
              </label>
              <SecondaryActionButton
                onClick={doeVernietigen}
                disabled={uit || bezig !== null || !vernietigCat || reden.trim().length < 10}
                busy={bezig === "anon-vernietig"}
              >
                Sleutel vernietigen
              </SecondaryActionButton>
            </details>
          )}
        </section>
      )}
    </section>
  );
}
