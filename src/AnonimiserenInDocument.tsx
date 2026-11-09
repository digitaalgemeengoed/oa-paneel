import { useEffect, useRef, useState } from "react";
import { Paragraph, PrimaryActionButton, SecondaryActionButton, StatusBadge, SubtleButton } from "@utrecht/component-library-react";
import { PII_CATEGORIE, PII_SOORT, grondslagLabel, type Adapter, type PiiCategorie, type PiiSoort, type Ppl } from "@digitaalgemeengoed/oa-contract";
import { anonimiseren, type PiiKaart, type Sessie, type Stand, type Verbinding } from "@digitaalgemeengoed/oa-kern";
import { SOORTNAAM } from "./Anonimiseren";

const SOORTEN = Object.keys(SOORTNAAM) as PiiSoort[];
const CATEGORIEEN = Object.keys(PII_CATEGORIE) as PiiCategorie[];
const artikel = (c: PiiCategorie) => `${PII_CATEGORIE[c].omschrijving} (art. ${PII_CATEGORIE[c].artikel})`;

export interface AnonimiserenInDocumentProps {
  adapter: Adapter;
  verbinding: Verbinding;
  stand: Stand;
  zetStand: (s: Stand) => void;
  niveau: Ppl;
  beheerder: boolean;
  /** Een klik op een plaatshouder in het document (telt op bij elke klik). */
  klik: { plek: string; n: number } | null;
  /** "Anonimiseer selectie" uit de werkbalk van de werkomgeving (telt op). */
  selectieVerzoek: number;
  nietBeginnen: string | null;
  bezig: string | null;
  setBezig: (b: string | null) => void;
  meld: (m: { soort: "ok" | "info" | "warning" | "error"; tekst: string } | null) => void;
  naWijziging: (s: Stand) => Promise<void>;
  uit: boolean;
}

/**
 * Anonimiseren in het document, zoals de MIRA-demo. De plaatshouders staan in
 * het document zelf (gestippeld zolang het een voorvertoning is); hier staat
 * per gegeven een kaart, met het origineel als je niveau het toelaat. Het
 * origineel komt nooit terug in het document, behalve als je het laat staan.
 */
export function AnonimiserenInDocument(p: AnonimiserenInDocumentProps) {
  const { adapter, verbinding, stand, niveau, bezig, setBezig, meld, uit } = p;
  const [sessie, setSessie] = useState<Sessie | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [gekozenPlek, setGekozenPlek] = useState<string | null>(null);
  const [pick, setPick] = useState<{ tekst: string; soort: PiiSoort; categorie?: PiiCategorie } | null>(null);
  const [vernietigCat, setVernietigCat] = useState<PiiCategorie | "">("");
  const [originelen, setOriginelen] = useState<"laten" | "beperken">("beperken");
  const [reden, setReden] = useState("");
  const lijst = useRef<HTMLDivElement>(null);
  const id = stand.object?.identificatie ?? "";

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

  // Een sessie die nog loopt (voorvertoningen in het document) weer oppakken.
  useEffect(() => {
    let weg = false;
    anonimiseren
      .hervat(adapter, verbinding, stand)
      .then((s) => !weg && s && setSessie(s))
      .catch(() => undefined);
    return () => {
      weg = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, verbinding, id]);

  // Klik op een plaatshouder in het document: de kaart openen.
  useEffect(() => {
    if (!p.klik || !sessie) return;
    const k = sessie.kaarten.find((x) => x.plekken.includes(p.klik!.plek));
    if (!k) return;
    setOpen(k.sleutel);
    setGekozenPlek(p.klik.plek);
    requestAnimationFrame(() => lijst.current?.querySelector(`[data-kaart="${CSS.escape(k.sleutel)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.klik?.n]);

  const leesSelectie = () =>
    doe("anon-selectie", async () => {
      if (!adapter.leesSelectie) return;
      const tekst = (await adapter.leesSelectie()).trim();
      if (tekst.length < 2) {
        meld({ soort: "info", tekst: "Selecteer in het document de tekst die je wilt anonimiseren, en kies dan Anonimiseer selectie." });
        return;
      }
      setPick({ tekst, soort: anonimiseren.raadSoort(tekst) });
    });

  useEffect(() => {
    if (p.selectieVerzoek) leesSelectie();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.selectieVerzoek]);

  const zoek = () =>
    doe("anon-zoeken", async () => {
      const r = await anonimiseren.vindEnMarkeer(adapter, verbinding, stand, sessie);
      p.zetStand(r.stand);
      setSessie(r.sessie);
      await p.naWijziging(r.stand);
      const n = r.sessie.kaarten.filter((k) => k.status === "voorvertoning").length;
      meld({
        soort: "info",
        tekst: `${n === 1 ? "1 persoonsgegeven is" : `${n} persoonsgegevens zijn`} in het document vervangen door een plaatshouder (voorvertoning). Het origineel is versie ${r.sessie.bronversie}.`,
      });
    });

  const voegToe = (waarde: string, soort: PiiSoort, bron?: PiiKaart["bron"], categorie?: PiiCategorie) =>
    doe("anon-toevoegen", async () => {
      const s = await anonimiseren.voegToe(adapter, verbinding, stand, sessie ?? { bronversie: (await anonimiseren.begin(adapter, verbinding, stand)).bronversie, kaarten: [] }, { waarde, soort, bron, categorie });
      setSessie(s);
      setPick(null);
      const k = s.kaarten.find((x) => x.status === "voorvertoning" && x.waarde === waarde.replace(/\s+/g, " ").trim());
      if (k) setOpen(k.sleutel);
    });

  const laatStaan = (k: PiiKaart, plek?: string) =>
    doe("anon-laat-staan", async () => {
      setSessie(await anonimiseren.laatStaan(adapter, verbinding, stand, sessie!, k.sleutel, plek));
      setGekozenPlek(null);
      if (k.status === "bevestigd") {
        meld({ soort: "warning", tekst: `${k.plaatshouder} is teruggezet in het document. Leg een nieuwe versie vast; die vraagt PPL ${k.ppl} om te lezen.` });
        await p.naWijziging(stand);
      }
    });

  const wijzigGrondslag = (k: PiiKaart, categorie: PiiCategorie) =>
    doe("anon-grondslag", async () => {
      setSessie(await anonimiseren.wijzigCategorie(adapter, verbinding, stand, sessie!, k.sleutel, categorie));
      meld({
        soort: "info",
        tekst: `${k.plaatshouder ?? SOORTNAAM[k.soort]}: grondslag is nu ${grondslagLabel(categorie)}. Het origineel vraagt PPL ${PII_CATEGORIE[categorie].ppl}.`,
      });
    });

  const toonOrigineel = (k: PiiKaart) =>
    doe("anon-onthul", async () => {
      const w = (await verbinding.onthulPii(id, [k.plaatshouder!])).waarden[0]?.waarde;
      setSessie((s) => s && { ...s, kaarten: s.kaarten.map((x) => (x.sleutel === k.sleutel ? { ...x, waarde: w } : x)) });
      await p.naWijziging(stand);
    });

  const bevestig = () =>
    doe("anon-bevestigen", async () => {
      const r = await anonimiseren.bevestigInDocument(adapter, verbinding, stand, sessie!);
      p.zetStand(r.stand);
      setSessie(null);
      setOpen(null);
      await p.naWijziging(r.stand);
      const n = r.sessie.kaarten.filter((k) => k.status === "bevestigd").length;
      meld({
        soort: "ok",
        tekst: `Bevestigd: ${n === 1 ? "1 persoonsgegeven" : `${n} persoonsgegevens`} versleuteld in het register. Het geanonimiseerde document is versie ${r.stand.object?.versies.at(-1)?.nummer}; het origineel (versie ${sessie!.bronversie}) kan alleen nog PPL 3 lezen.`,
      });
    });

  const vernietig = () =>
    doe("anon-vernietig", async () => {
      await verbinding.vernietigPii(id, vernietigCat as PiiCategorie, reden.trim(), originelen);
      const object = await verbinding.object(id);
      p.zetStand({ ...stand, object });
      await p.naWijziging({ ...stand, object });
      meld({
        soort: "ok",
        tekst: `De sleutel voor ${PII_CATEGORIE[vernietigCat as PiiCategorie].omschrijving} van dit stuk is vernietigd.${originelen === "beperken" ? " De originele versies zijn alleen nog in te zien voor informatiebeheer." : ""}`,
      });
      setVernietigCat("");
      setReden("");
    });

  const kaarten = sessie?.kaarten ?? [];
  const voorvertoning = kaarten.filter((k) => k.status === "voorvertoning");
  const blijft = kaarten.filter((k) => k.status === "laat-staan");
  const sleutelnaam = (c: PiiCategorie) => `doc-${id.slice(0, 8)}-${c}`;

  function kaart(k: PiiKaart) {
    const isOpen = open === k.sleutel;
    const mag = niveau >= k.ppl;
    return (
      <div key={k.sleutel} data-kaart={k.sleutel} className={`oa-kaart${isOpen ? " open" : ""}${k.status === "laat-staan" ? " klaar" : ""}`}>
        <button type="button" className="oa-kaart-kop" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k.sleutel)}>
          {k.plaatshouder ? (
            <span className={`oa-plh-chip l${k.ppl}${k.status === "voorvertoning" ? " pv" : ""}`}>{k.plaatshouder}</span>
          ) : (
            <span className="oa-plh-chip leeg">{mag && k.waarde ? k.waarde : SOORTNAAM[k.soort]}</span>
          )}
          <span className="oa-pil">PPL {k.ppl}</span>
          <span className="oa-klein">{artikel(k.categorie)}</span>
        </button>
        <div className="oa-klein oa-kaart-regel">
          {SOORTNAAM[k.soort]} · {k.bron === "medewerker" ? "handmatig" : k.score !== undefined ? `zekerheid ${Math.round(k.score * 100)}%` : k.bron}
          {k.status === "laat-staan" ? " · blijft staan" : ` · ${k.plekken.length === 1 ? "1 plek" : `${k.plekken.length} plekken`}`}
          {k.status === "bevestigd" && " · bevestigd"}
        </div>
        {isOpen && (
          <>
            <dl className="oa-kv">
              <dt>Origineel</dt>
              <dd>
                {!mag ? (
                  <span className="oa-klein">vraagt PPL {k.ppl}</span>
                ) : k.waarde !== undefined ? (
                  <span className="oa-onthuld">{k.waarde}</span>
                ) : (
                  <SubtleButton onClick={() => toonOrigineel(k)} disabled={uit || bezig !== null}>
                    Toon origineel
                  </SubtleButton>
                )}
              </dd>
              <dt>Grondslag</dt>
              <dd>
                <Grondslag
                  categorie={k.categorie}
                  standaard={PII_SOORT[k.soort].categorie}
                  soort={SOORTNAAM[k.soort]}
                  wijzig={
                    k.status === "bevestigd"
                      ? { kan: false, reden: "Ligt vast na bevestigen. Wil je een andere grondslag, kies dan De-anonimiseer en anonimiseer opnieuw." }
                      : k.status === "voorvertoning" && niveau < k.ppl
                        ? { kan: false, reden: `Wijzigen vraagt PPL ${k.ppl}: je moet het origineel kunnen lezen.` }
                        : { kan: !uit && bezig === null, bij: (c) => wijzigGrondslag(k, c) }
                  }
                />
              </dd>
              {k.plaatshouder && (
                <>
                  <dt>Algoritme</dt>
                  <dd>{PII_CATEGORIE[k.categorie].algoritme}</dd>
                  <dt>Sleutel</dt>
                  <dd>
                    <code>{sleutelnaam(k.categorie)}</code>
                  </dd>
                </>
              )}
            </dl>
            <div className="oa-rij">
              {k.plekken.length > 0 && adapter.toonPiiPlek && (
                <SubtleButton onClick={() => adapter.toonPiiPlek!(gekozenPlek && k.plekken.includes(gekozenPlek) ? gekozenPlek : k.plekken[0]!)}>Toon in document</SubtleButton>
              )}
              {k.status === "voorvertoning" && (
                <SecondaryActionButton onClick={() => laatStaan(k)} disabled={uit || bezig !== null}>
                  Laat staan
                </SecondaryActionButton>
              )}
              {k.status === "voorvertoning" && gekozenPlek && k.plekken.includes(gekozenPlek) && k.plekken.length > 1 && (
                <SubtleButton onClick={() => laatStaan(k, gekozenPlek)} disabled={uit || bezig !== null}>
                  Alleen hier laten staan
                </SubtleButton>
              )}
              {k.status === "bevestigd" && mag && (
                <SecondaryActionButton onClick={() => laatStaan(k)} disabled={uit || bezig !== null}>
                  De-anonimiseer
                </SecondaryActionButton>
              )}
              {k.status === "laat-staan" && k.waarde && (
                <SecondaryActionButton onClick={() => voegToe(k.waarde!, k.soort, k.bron, k.categorie)} disabled={uit || bezig !== null}>
                  Toch anonimiseren
                </SecondaryActionButton>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="oa-sectie" aria-label="Anonimiseren">
      <Paragraph small>
        De assistent zoekt persoonsgegevens en vervangt ze in het document door een plaatshouder, zoals [PERSOON 1]. Tot je bevestigt is dat een voorvertoning (gestippeld). Klik
        in het document op een plaatshouder om hem hier te zien; selecteer tekst en kies <b>Anonimiseer selectie</b> om iets toe te voegen.
      </Paragraph>
      <p className="oa-klein">
        Jouw niveau: PPL {niveau}
        {niveau < 3 ? ` (originelen van ${CATEGORIEEN.filter((c) => PII_CATEGORIE[c].ppl <= niveau).map((c) => artikel(c)).join(" en ") || "geen enkele categorie"})` : " (alle categorieën)"}
      </p>

      <div className="oa-rij">
        <PrimaryActionButton onClick={zoek} disabled={uit || bezig !== null || !!p.nietBeginnen} busy={bezig === "anon-zoeken"}>
          {sessie ? "Opnieuw zoeken" : "Persoonsgegevens zoeken"}
        </PrimaryActionButton>
        {adapter.leesSelectie ? (
          <SecondaryActionButton onClick={leesSelectie} disabled={uit || bezig !== null || !!p.nietBeginnen}>
            Anonimiseer selectie
          </SecondaryActionButton>
        ) : (
          <SecondaryActionButton onClick={() => setPick({ tekst: "", soort: "naam" })} disabled={uit || bezig !== null || !!p.nietBeginnen}>
            Tekst anonimiseren…
          </SecondaryActionButton>
        )}
      </div>
      {p.nietBeginnen && <Paragraph small>{p.nietBeginnen}</Paragraph>}

      {pick && (
        <div className="oa-kader oa-anon-toevoegen">
          <label className="oa-klein oa-blok">
            {adapter.leesSelectie ? "Selectie" : "Tekst zoals die in het document staat"}
            <input
              type="text"
              value={pick.tekst}
              onChange={(e) => setPick({ ...pick, tekst: e.target.value })}
              onBlur={() => pick.tekst.trim() && pick.soort === "naam" && setPick({ ...pick, soort: anonimiseren.raadSoort(pick.tekst.trim()) })}
            />
          </label>
          <label className="oa-klein">
            Soort{" "}
            <select value={pick.soort} onChange={(e) => setPick({ ...pick, soort: e.target.value as PiiSoort, categorie: undefined })}>
              {SOORTEN.map((s) => (
                <option key={s} value={s}>
                  {SOORTNAAM[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="oa-klein oa-blok">
            Grondslag
            <Grondslag
              categorie={pick.categorie ?? PII_SOORT[pick.soort].categorie}
              standaard={PII_SOORT[pick.soort].categorie}
              soort={SOORTNAAM[pick.soort]}
              wijzig={{ kan: bezig === null, bij: (c) => setPick({ ...pick, categorie: c }) }}
            />
          </div>
          <div className="oa-rij">
            <SecondaryActionButton onClick={() => voegToe(pick.tekst, pick.soort, undefined, pick.categorie)} disabled={bezig !== null || pick.tekst.trim().length < 2}>
              Anonimiseer
            </SecondaryActionButton>
            <SubtleButton onClick={() => setPick(null)}>Annuleer</SubtleButton>
          </div>
        </div>
      )}

      {sessie && (
        <>
          <div className="oa-anon-status">
            {voorvertoning.length ? <StatusBadge status="warning">voorvertoning, nog niet bevestigd</StatusBadge> : <StatusBadge status="neutral">niets in voorvertoning</StatusBadge>}
            <span className="oa-klein">
              {voorvertoning.length} in voorvertoning{blijft.length ? `, ${blijft.length} blijven staan` : ""} · origineel: versie {sessie.bronversie}
              {sessie.motor ? ` · ${sessie.motor}` : ""}
            </span>
          </div>
          <div className="oa-kaarten" ref={lijst}>
            {kaarten.map(kaart)}
          </div>
          {voorvertoning.length > 0 && (
            <>
              <PrimaryActionButton onClick={bevestig} disabled={uit || bezig !== null} busy={bezig === "anon-bevestigen"}>
                Bevestigen: nieuwe versie vastleggen
              </PrimaryActionButton>
              <Paragraph small>
                Bevestigen legt het geanonimiseerde document vast als nieuwe versie. Het origineel (versie {sessie.bronversie}) blijft bewaard; alleen wie PPL 3 heeft, kan het
                lezen. Bij Overzicht kun je een versie terugzetten.
              </Paragraph>
            </>
          )}
        </>
      )}

      {p.beheerder && stand.object && (
        <details className="oa-vernietig">
          <summary>Sleutel van een categorie vernietigen (beheer)</summary>
          <Paragraph small>
            Daarna zijn de geregistreerde gegevens van die categorie in dit stuk voor niemand meer te lezen. De originele versies zijn archiefstukken: die vernietig je via
            het vernietigingsproces. Je kunt de toegang wel beperken tot informatiebeheer.
          </Paragraph>
          <label className="oa-klein">
            Categorie{" "}
            <select value={vernietigCat} onChange={(e) => setVernietigCat(e.target.value as PiiCategorie | "")}>
              <option value="">Kies…</option>
              {CATEGORIEEN.map((c) => (
                <option key={c} value={c}>
                  {PII_CATEGORIE[c].omschrijving} ({artikel(c)})
                </option>
              ))}
            </select>
          </label>
          <fieldset className="oa-keuze">
            <legend className="oa-klein">Originele versies</legend>
            <label className="oa-klein">
              <input type="radio" name="oa-originelen" checked={originelen === "beperken"} onChange={() => setOriginelen("beperken")} /> Alleen nog voor informatiebeheer
            </label>
            <label className="oa-klein">
              <input type="radio" name="oa-originelen" checked={originelen === "laten"} onChange={() => setOriginelen("laten")} /> Laten (PPL 3 kan ze lezen)
            </label>
          </fieldset>
          <label className="oa-klein oa-blok">
            Reden (minstens 10 tekens)
            <textarea rows={2} value={reden} onChange={(e) => setReden(e.target.value)} />
          </label>
          <SecondaryActionButton onClick={vernietig} disabled={uit || bezig !== null || !vernietigCat || reden.trim().length < 10} busy={bezig === "anon-vernietig"}>
            Sleutel vernietigen
          </SecondaryActionButton>
        </details>
      )}
    </section>
  );
}


/**
 * De grondslag van een persoonsgegeven: de AVG-categorie in gewone taal, met
 * uitleg, en (als het mag) een keuze voor een andere.
 */
function Grondslag(p: {
  categorie: PiiCategorie;
  standaard: PiiCategorie;
  soort: string;
  wijzig: { kan: boolean; bij?: (c: PiiCategorie) => void; reden?: string };
}) {
  const info = PII_CATEGORIE[p.categorie];
  const afwijkend = p.categorie !== p.standaard;
  const lager = PII_CATEGORIE[p.categorie].ppl < PII_CATEGORIE[p.standaard].ppl;
  return (
    <div className="oa-grondslag">
      {p.wijzig.bij ? (
        <select aria-label="Grondslag" value={p.categorie} disabled={!p.wijzig.kan} onChange={(e) => p.wijzig.bij!(e.target.value as PiiCategorie)}>
          {CATEGORIEEN.map((c) => (
            <option key={c} value={c}>
              {grondslagLabel(c)}
              {c === p.standaard ? " (standaard)" : ""}
            </option>
          ))}
        </select>
      ) : (
        <b>{grondslagLabel(p.categorie)}</b>
      )}
      <span className="oa-klein oa-blok">{info.uitleg}</span>
      {afwijkend && (
        <span className={`oa-klein oa-blok${lager ? " oa-let-op" : ""}`}>
          {lager
            ? `Let op: lager dan gebruikelijk voor ${p.soort.toLowerCase()} (${grondslagLabel(p.standaard)}). Meer mensen kunnen het origineel dan lezen.`
            : `Afwijkend van de standaard voor ${p.soort.toLowerCase()} (${grondslagLabel(p.standaard)}).`}
        </span>
      )}
      {p.wijzig.reden && <span className="oa-klein oa-blok">{p.wijzig.reden}</span>}
    </div>
  );
}
