import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  DataList,
  DataListItem,
  DataListKey,
  DataListValue,
  FormField,
  Heading2,
  Heading3,
  Paragraph,
  PrimaryActionButton,
  SecondaryActionButton,
  Select,
  SelectOption,
  StatusBadge,
  SubtleButton,
  Textarea,
  Textbox,
} from "@utrecht/component-library-react";
import { classificatiemodelnaam, heeftVermogen, modelVan, rolWaarden, type Aard, type Adapter, type Bevinding, type Gebeurtenis, type Objecttype, type Versie, type WieBenIk } from "@digitaalgemeengoed/oa-contract";
import {
  metadateren,
  toegankelijkheid,
  bepaalStand,
  legMetadataVast,
  legVersieVast,
  maakZakelijk,
  anonimiseren,
  registreer,
  vergelijkMetLaatsteVersie,
  Verbinding,
  VerbindingsFout,
  type ClassificatieAntwoord,
  type Stand,
  type Veld,
} from "@digitaalgemeengoed/oa-kern";
import { Classificeren } from "./Classificeren";
import { TeBeoordelen, Vergrendeld } from "./Vrijgave";
import { Motorkap, type Aanroep } from "./Motorkap";
import { Anonimiseren } from "./Anonimiseren";
import { AnonimiserenInDocument } from "./AnonimiserenInDocument";
import { Versies } from "./Versies";
import { GEBEURTENIS, Icoon, isModule, MODULES, type ModuleId, type Opdracht } from "./modules";

const THEMA: Record<string, string> = { haarlem: "haarlem-theme" };

/** "docx, 24 kB, met html-weergave": wat er van deze versie is bewaard. */
function bestandsomschrijving(v: Versie): string {
  const kb = Math.max(1, Math.round(v.grootte / 1024));
  const weergaven = (v.weergaven ?? []).map((w) => w.formaat);
  return `${v.formaat}, ${kb} kB${weergaven.length ? `, met ${weergaven.join(" en ")}-weergave` : ""}`;
}
const OBJECTTYPE = "document";

export interface PaneelProps {
  adapter: Adapter;
  /** Basisadres van de integratielaag; leeg = hetzelfde adres als de pagina. */
  basis?: string;
  /**
   * Sessiesleutel voor werkomgevingen waar het cookie niet werkt, zoals een
   * Office-invoegtoepassing in een iframe van office.com. Gaat mee als
   * Authorization-kop; alleen in het geheugen, nooit in opslag.
   */
  sessie?: string;
  /**
   * Waar de knoppen van de modules staan. Rechts zoals in de demo; bovenaan
   * waar de werkomgeving zelf rechts al knoppen heeft (de zijbalk van
   * LibreOffice).
   */
  knoppen?: "rechts" | "boven";
  /** Met welke module het paneel opent; "beoordelen" opent Toegankelijkheid en beoordeelt meteen. */
  module?: Opdracht;
  /**
   * Opnieuw inloggen als de sessie verlopen is (of de server is bijgewerkt).
   * Zonder: met het cookie naar het inloggen en terug naar deze pagina; met
   * een sessiesleutel en zonder dit: geen knop.
   */
  opnieuwInloggen?: () => void;
}

type Melding = { soort: "info" | "warning" | "error" | "ok"; tekst: string; inloggen?: boolean } | null;

/**
 * Het paneel van de assistent. Hetzelfde in elke werkomgeving; wat een
 * omgeving niet kan, doet de assistent op een andere manier en zegt dat.
 */
export function Paneel({ adapter, basis = "", sessie, knoppen = "rechts", module = "ovz", opnieuwInloggen }: PaneelProps) {
  const inloggen = useMemo(
    () =>
      opnieuwInloggen ??
      (sessie
        ? undefined
        : () => {
            location.href = `${basis}/api/auth/login?terug=${encodeURIComponent(location.pathname + location.search)}`;
          }),
    [opnieuwInloggen, sessie, basis],
  );
  const [actief, setActief] = useState<ModuleId>(module === "beoordelen" ? "toeg" : module === "anon-selectie" ? "anon" : module);
  const [aanroepen, setAanroepen] = useState<Aanroep[]>([]);
  const verbinding = useMemo(
    () =>
      new Verbinding(basis, async (invoer, init) => {
        const r = await fetch(invoer, sessie ? { ...init, headers: { ...(init?.headers ?? {}), authorization: `Bearer ${sessie}` } } : init);
        const pad = String(invoer).replace(basis, "");
        setAanroepen((a) => [{ methode: init?.method ?? "GET", pad, status: r.status, tijd: new Date() }, ...a].slice(0, 12));
        return r;
      }),
    [basis, sessie],
  );

  const omgeving = adapter.werkomgeving();
  const [wie, setWie] = useState<WieBenIk | null>(null);
  // Het metadatamodel van dit stuk, en het model dat nu voor nieuwe stukken geldt.
  const [type, setType] = useState<Objecttype | null>(null);
  const [actueel, setActueel] = useState<Objecttype | null>(null);
  const [stand, setStand] = useState<Stand | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [voorstellen, setVoorstellen] = useState<Record<string, string>>({});
  const [fouten, setFouten] = useState<Record<string, string>>({});
  const [bevindingen, setBevindingen] = useState<Bevinding[] | null>(null);
  const [antwoorden, setAntwoorden] = useState<Record<string, string>>({});
  const [bezig, setBezig] = useState<string | null>(null);
  const [melding, setMelding] = useState<Melding>(null);
  const [onbereikbaar, setOnbereikbaar] = useState(false);
  const [geschiedenis, setGeschiedenis] = useState<Gebeurtenis[]>([]);
  /** Zakelijk of persoonlijk, voor een stuk dat nog niet is vastgelegd. De medewerker kiest. */
  const [aardKeuze, setAardKeuze] = useState<Aard | null>(null);
  /** Wijkt het stuk af van de laatste vastgelegde versie (gewijzigd, of een kopie)? */
  const [afwijking, setAfwijking] = useState<"gelijk" | "afwijkend" | "onbekend">("onbekend");
  /** Het classificatiemodel: eerst alleen het model, met de selectielijst zodra Classificeren opent. */
  const [klassen, setKlassen] = useState<ClassificatieAntwoord | null>(null);
  /** Opstarten: hoeveel van de vragen aan de server al beantwoord zijn (voor de voortgangsbalk). */
  const [geladen, setGeladen] = useState(0);

  const fout = useCallback((e: unknown) => {
    if (e instanceof VerbindingsFout) {
      if (e.nietBereikbaar) {
        setOnbereikbaar(true);
        setMelding({ soort: "warning", tekst: "De assistent kan de server nu niet bereiken. Je kunt gewoon doorwerken; vastleggen kan weer zodra de verbinding terug is." });
        return;
      }
      if (e.code === "metadata-ongeldig" && Array.isArray(e.details)) {
        setFouten(Object.fromEntries((e.details as { veld: string; melding: string }[]).map((d) => [d.veld, d.melding])));
      }
      if (e.code === "niet-ingelogd" || e.status === 401) {
        setMelding({
          soort: "warning",
          tekst: "Je bent niet meer ingelogd: de sessie is verlopen of de server is bijgewerkt. Log opnieuw in; wat in je document staat, blijft staan.",
          inloggen: true,
        });
        return;
      }
      setMelding({ soort: "error", tekst: e.message });
      return;
    }
    setMelding({ soort: "error", tekst: (e as Error).message });
  }, []);

  const laadGeschiedenis = useCallback(
    async (s: Stand) => {
      if (s.object) setGeschiedenis(await verbinding.gebeurtenissen(s.object.identificatie));
    },
    [verbinding],
  );

  // Opstarten: wie ben ik, welk objecttype, waar staat dit stuk.
  useEffect(() => {
    let weg = false;
    (async () => {
      try {
        const tel = <T,>(p: Promise<T>) => p.then((x) => (weg || setGeladen((n) => n + 1), x));
        const [w, actief, s, inhoud] = await Promise.all([
          tel(verbinding.wieBenIk()),
          tel(verbinding.objecttype(OBJECTTYPE)),
          tel(bepaalStand(adapter, verbinding)),
          tel(adapter.leverInhoud()),
        ]);
        verbinding.classificatie(true).then(
          (k) => weg || setKlassen((oud) => oud?.selectielijst ? oud : k),
          () => weg || setKlassen({ model: null }),
        );
        // Een vastgelegd stuk houdt het metadatamodel waarmee het is vastgelegd.
        const eigen = s.object?.objecttype;
        const t = eigen && (eigen.naam !== actief.naam || eigen.versie !== actief.versie) ? await verbinding.objecttype(eigen.naam, eigen.versie) : actief;
        if (weg) return;
        setOnbereikbaar(false);
        setWie(w);
        setType(t);
        setActueel(actief);
        setStand(s);
        const huidig = (s.object?.metadata ?? {}) as Record<string, string>;
        setMetadata(huidig);
        setVoorstellen(metadateren.suggesties(inhoud, huidig, t));
        if (s.terugval) setMelding({ soort: "info", tekst: s.terugval });
        if (s.object) setAfwijking(await vergelijkMetLaatsteVersie(s, inhoud));
        await laadGeschiedenis(s);
      } catch (e) {
        if (!weg) fout(e);
      }
    })();
    return () => {
      weg = true;
    };
  }, [adapter, verbinding, fout, laadGeschiedenis]);

  useEffect(() => {
    if (actief !== "clas" || klassen?.selectielijst || !wie) return;
    let weg = false;
    verbinding.classificatie().then(
      (k) => weg || setKlassen(k),
      (e) => weg || fout(e),
    );
    return () => {
      weg = true;
    };
  }, [actief, klassen, wie, verbinding, fout]);

  const velden: Veld[] = useMemo(() => (type ? metadateren.velden(type) : []), [type]);
  const aard: Aard | null = stand?.object ? (stand.object.aard ?? "zakelijk") : aardKeuze;
  const persoonlijk = aard === "persoonlijk";
  const ontbreekt = type && !persoonlijk ? metadateren.bevindingen(type, metadata) : [];
  const model = type ? modelVan(type) : null;
  const ouderModel = !!(type && actueel && stand?.object && type.versie !== actueel.versie);
  const status = type && stand?.object ? rolWaarden(type.schema, stand.object.metadata as Record<string, unknown>).status : undefined;
  const vrijgever = !!wie?.rollen.includes("vrijgever");
  const vergrendeld = stand?.object?.vergrendeld ?? null;
  const metadataDicht = !!vergrendeld && !vrijgever;
  const klasModel = klassen?.model ?? null;
  const klasVersie = stand?.object?.classificatie?.modelversie ?? klasModel?.versie;

  async function voerUit(naam: string, werk: () => Promise<void>) {
    setBezig(naam);
    setMelding(null);
    try {
      await werk();
    } catch (e) {
      fout(e);
    } finally {
      setBezig(null);
    }
  }

  const doeRegistreren = () =>
    voerUit("registreren", async () => {
      setFouten({});
      const s = await registreer(adapter, verbinding, OBJECTTYPE, metadata, aardKeuze ?? "zakelijk", type ?? undefined);
      setStand(s);
      setAfwijking("gelijk");
      setMetadata(s.object!.metadata as Record<string, string>);
      const tekst =
        aardKeuze === "persoonlijk"
          ? "Het stuk is persoonlijk vastgelegd: in je persoonlijke opslag, alleen voor jou zichtbaar, buiten het archief."
          : "Het stuk is geregistreerd. Het platform heeft het een eigen identificatie gegeven.";
      setMelding(s.terugval ? { soort: "info", tekst: s.terugval } : { soort: "ok", tekst });
      adapter.toon({ soort: "succes", tekst: aardKeuze === "persoonlijk" ? "Persoonlijk vastgelegd" : "Geregistreerd" });
      await laadGeschiedenis(s);
    });

  const doeZakelijk = () =>
    voerUit("zakelijk", async () => {
      const s = await maakZakelijk(verbinding, stand!);
      setStand(s);
      setMetadata({});
      setMelding({ soort: "ok", tekst: "Het stuk is nu zakelijk en staat in het archief. Vul de metadata in en leg die vast." });
      await laadGeschiedenis(s);
    });

  /** Een kopie (Opslaan als) met de afdruk van het origineel: als nieuw stuk vastleggen. */
  const alsNieuwStuk = () => {
    setStand((s) => (s ? { ...s, object: null, afdruk: null } : s));
    setMetadata({});
    setAardKeuze(null);
    setAfwijking("onbekend");
    setGeschiedenis([]);
    setMelding({ soort: "info", tekst: "Kies zakelijk of persoonlijk en leg het vast als nieuw stuk. De verwijzing in het bestand gaat dan naar het nieuwe stuk." });
    setActief("meta");
  };

  const doeMetadata = () =>
    voerUit("metadata", async () => {
      setFouten({});
      const s = await legMetadataVast(verbinding, stand!, metadata, type ?? undefined, adapter);
      setStand(s);
      setMelding({ soort: "ok", tekst: "De metadata is vastgelegd." });
      await laadGeschiedenis(s);
    });

  const doeVersie = () =>
    voerUit("versie", async () => {
      const voor = stand!.object!.versies.length;
      const s = await legVersieVast(adapter, verbinding, stand!, type ?? undefined).catch(async (e) => {
        // Intussen vergrendeld (een ander zette de status): de stand bijwerken, dan zie je het voorstelvak.
        if (e instanceof VerbindingsFout && e.code === "vergrendeld") setStand({ ...stand!, object: await verbinding.object(stand!.object!.identificatie) });
        throw e;
      });
      setStand(s);
      setAfwijking("gelijk");
      setMelding(
        s.object!.versies.length > voor
          ? { soort: "ok", tekst: `Versie ${s.object!.versies.at(-1)!.nummer} is vastgelegd.` }
          : { soort: "info", tekst: "De inhoud is niet gewijzigd sinds de vorige versie. Er is geen nieuwe versie gemaakt." },
      );
      await laadGeschiedenis(s);
    });

  const doeBeoordelen = () =>
    voerUit("beoordelen", async () => {
      const r = await toegankelijkheid.beoordeel(adapter, verbinding);
      setBevindingen(r.bevindingen);
      setAntwoorden({});
    });

  const doeHerstel = (b: Bevinding) =>
    voerUit(`herstel-${b.id}`, async () => {
      const u = await toegankelijkheid.herstel(adapter, b, antwoorden[b.id]);
      if (u.terugval) setMelding({ soort: "info", tekst: u.terugval });
      const r = await toegankelijkheid.beoordeel(adapter, verbinding);
      setBevindingen(r.bevindingen);
      // Bevindingen zijn opnieuw genummerd: oude antwoorden horen niet meer bij hun plek.
      setAntwoorden({});
    });

  const kanTonen = heeftVermogen(omgeving, "plek-tonen") && !!adapter.toonPlek;
  const objectId = stand?.object?.identificatie ?? null;
  const piiRegister = useCallback(async () => (objectId ? verbinding.piiRegister(objectId) : null), [verbinding, objectId]);
  const geregistreerd = !!stand?.object;
  const uit = onbereikbaar || !wie;
  // Opstarten: nog niets van de server. Dan alleen het laadscherm, geen half overzicht.
  const laden = !wie && !onbereikbaar && !melding;

  // Knoppen in de werkbalk van de werkomgeving sturen een opdracht (zie modules.tsx).
  const [beoordeelVerzoek, setBeoordeelVerzoek] = useState(module === "beoordelen" ? 1 : 0);
  const [selectieVerzoek, setSelectieVerzoek] = useState(module === "anon-selectie" ? 1 : 0);
  const [piiKlik, setPiiKlik] = useState<{ plek: string; n: number } | null>(null);
  useEffect(() => {
    const luister = (e: Event) => {
      const o = (e as CustomEvent<unknown>).detail;
      if (o === "beoordelen") {
        setActief("toeg");
        setBeoordeelVerzoek((n) => n + 1);
      } else if (o === "anon-selectie") {
        setActief("anon");
        setSelectieVerzoek((n) => n + 1);
      } else if (isModule(o)) setActief(o);
    };
    window.addEventListener(GEBEURTENIS, luister);
    return () => window.removeEventListener(GEBEURTENIS, luister);
  }, []);
  // Een klik op een plaatshouder in het document opent Anonimiseren bij die kaart.
  useEffect(() => {
    if (!adapter.bijPiiKlik || !heeftVermogen(adapter.werkomgeving(), "pii-klik")) return;
    return adapter.bijPiiKlik((p) => {
      setActief("anon");
      setPiiKlik((k) => ({ plek: p.plek, n: (k?.n ?? 0) + 1 }));
    });
  }, [adapter]);
  useEffect(() => {
    if (beoordeelVerzoek && wie && !bezig) doeBeoordelen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beoordeelVerzoek, wie]);

  const openBevindingen = bevindingen?.length ?? 0;
  const aandacht: { module: ModuleId; tekst: string }[] = [];
  if (stand && !geregistreerd) aandacht.push({ module: "meta", tekst: aard ? "Nog niet vastgelegd" : "Kies zakelijk of persoonlijk" });
  if (afwijking === "afwijkend") aandacht.push({ module: "ovz", tekst: vergrendeld ? `Gewijzigd sinds versie ${stand?.object?.versies.at(-1)?.nummer}: dien een wijzigingsvoorstel in` : `Gewijzigd sinds versie ${stand?.object?.versies.at(-1)?.nummer}, of een kopie` });
  if (type && ontbreekt.length) aandacht.push({ module: "meta", tekst: `${ontbreekt.length} verplicht metadataveld${ontbreekt.length > 1 ? "en" : ""} open` });
  if (stand?.object && !persoonlijk && klasModel && !stand.object.classificatie) aandacht.push({ module: "clas", tekst: "Nog niet geclassificeerd" });
  if (vergrendeld && (stand?.object?.voorstellen ?? 0) > 0) aandacht.push({ module: "ovz", tekst: `${stand!.object!.voorstellen} wijzigingsvoorstel${stand!.object!.voorstellen! > 1 ? "len" : ""} wacht op beoordeling` });
  if (bevindingen === null) aandacht.push({ module: "toeg", tekst: "Toegankelijkheid nog niet beoordeeld" });
  else if (openBevindingen) aandacht.push({ module: "toeg", tekst: `${openBevindingen} bevinding${openBevindingen > 1 ? "en" : ""} over toegankelijkheid` });
  const teller: Partial<Record<ModuleId, number | string>> = {
    ovz: aandacht.length || undefined,
    meta: ontbreekt.length || undefined,
    toeg: bevindingen === null ? undefined : openBevindingen || undefined,
  };
  const info = MODULES.find((m) => m.id === actief)!;

  function kiesMetPijlen(e: React.KeyboardEvent) {
    const volgende = knoppen === "boven" ? ["ArrowRight", "ArrowLeft"] : ["ArrowDown", "ArrowUp"];
    const i = MODULES.findIndex((m) => m.id === actief);
    let j = -1;
    if (e.key === volgende[0]) j = (i + 1) % MODULES.length;
    else if (e.key === volgende[1]) j = (i - 1 + MODULES.length) % MODULES.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = MODULES.length - 1;
    if (j < 0) return;
    e.preventDefault();
    setActief(MODULES[j].id);
    (e.currentTarget.querySelectorAll("button")[j] as HTMLButtonElement | undefined)?.focus();
  }

  const rij = (
    <nav className="oa-modules" aria-label="Modules">
      <div role="tablist" aria-orientation={knoppen === "boven" ? "horizontal" : "vertical"} onKeyDown={kiesMetPijlen}>
        {MODULES.map((m) => (
          <button
            key={m.id}
            role="tab"
            id={`oa-tab-${m.id}`}
            aria-controls="oa-weergave"
            aria-selected={actief === m.id}
            tabIndex={actief === m.id ? 0 : -1}
            title={m.volgt ? `${m.naam} (volgt)` : m.naam}
            aria-label={m.volgt ? `${m.naam}, volgt` : m.naam}
            className={`oa-module${m.volgt ? " oa-volgt" : ""}${m.id === "help" ? " oa-laatste" : ""}`}
            onClick={() => setActief(m.id)}
          >
            <Icoon id={m.id} />
            {teller[m.id] !== undefined && <small className="oa-teller">{teller[m.id]}</small>}
          </button>
        ))}
      </div>
    </nav>
  );

  return (
    <div className={`oa-paneel oa-knoppen-${knoppen} ${wie ? (THEMA[wie.gemeente] ?? "voorbeeld-theme") : "voorbeeld-theme"}`}>
      {knoppen === "boven" && rij}
      <div className="oa-hoofd" role="tabpanel" id="oa-weergave" aria-labelledby={`oa-tab-${actief}`}>
        <header className="oa-kop">
          <span className="oa-kop-icoon"><Icoon id={actief} grootte={20} /></span>
          <div>
            <Heading2>{info.naam}</Heading2>
            <Paragraph small>{info.onder}</Paragraph>
            {actief === "meta" && model && !persoonlijk && (
              <p className="oa-model" title={ouderModel ? `Dit stuk is vastgelegd met versie ${model.versie}. Voor nieuwe stukken geldt nu versie ${actueel!.versie}.` : "Het metadatamodel van de gemeente, ingesteld in het beheerportaal."}>
                {model.naam} · versie {model.versie}
                {ouderModel && <> · nu geldt versie {actueel!.versie}</>}
              </p>
            )}
            {actief === "clas" && klasModel && !persoonlijk && (
              <p className="oa-model" title="Het classificatiemodel van de gemeente, ingesteld in het beheerportaal.">
                {classificatiemodelnaam(klasModel.config)} · versie {klasVersie}
                {klasVersie !== klasModel.versie && <> · nu geldt versie {klasModel.versie}</>}
              </p>
            )}
          </div>
          <span className={`oa-verbonden${uit ? " oa-niet" : ""}`} title={uit ? "Niet verbonden met het platform" : "Verbonden met het platform"} aria-label={uit ? "Niet verbonden met het platform" : "Verbonden met het platform"} />
        </header>

        {laden && (
          <div className="oa-laden" role="status" aria-live="polite">
            <div className="oa-laden-cirkel" aria-hidden="true" />
            <p className="oa-laden-tekst">De Assistent wordt geladen…</p>
            <div className="oa-laden-balk" role="progressbar" aria-label="Voortgang" aria-valuemin={0} aria-valuemax={100} aria-valuenow={50 + geladen * 12}>
              <span style={{ width: `${50 + geladen * 12}%` }} />
            </div>
            <p className="oa-laden-stap">Stap 2 van 2: verbinden met de server en het document lezen ({geladen} van 4).</p>
          </div>
        )}

        {!laden && (<>
        {melding && (
          <Alert type={melding.soort} role={melding.soort === "error" ? "alert" : "status"}>
            <Paragraph>{melding.tekst}</Paragraph>
            {melding.inloggen && inloggen && (
              <PrimaryActionButton type="button" onClick={inloggen}>
                Opnieuw inloggen
              </PrimaryActionButton>
            )}
          </Alert>
        )}

        {actief === "ovz" && (
          <>
            {wie && (
              <Paragraph small>
                {wie.naam} · {wie.gemeente} · in {omgeving.naam}
              </Paragraph>
            )}
            <section className="oa-sectie" aria-labelledby="oa-stuk">
              <Heading3 id="oa-stuk">Dit stuk</Heading3>
              {geregistreerd ? (
                <>
                  <DataList>
                    <DataListItem>
                      <DataListKey>Soort</DataListKey>
                      <DataListValue>{persoonlijk ? <StatusBadge status="neutral">persoonlijk</StatusBadge> : "zakelijk"}</DataListValue>
                    </DataListItem>
                    <DataListItem>
                      <DataListKey>Identificatie</DataListKey>
                      <DataListValue>
                        <code className="oa-id">{stand!.object!.identificatie}</code>
                      </DataListValue>
                    </DataListItem>
                    <DataListItem>
                      <DataListKey>Versie</DataListKey>
                      <DataListValue>{stand!.object!.versies.at(-1)?.nummer ?? "geen"}</DataListValue>
                    </DataListItem>
                    {status && (
                      <DataListItem>
                        <DataListKey>Status</DataListKey>
                        <DataListValue>{status}</DataListValue>
                      </DataListItem>
                    )}
                    {!persoonlijk && model && (
                      <DataListItem>
                        <DataListKey>Metadatamodel</DataListKey>
                        <DataListValue>
                          {model.naam}, versie {model.versie}
                          {ouderModel && <span className="oa-klein"> (nu geldt versie {actueel!.versie})</span>}
                        </DataListValue>
                      </DataListItem>
                    )}
                    {!persoonlijk && stand!.object!.classificatie && (
                      <DataListItem>
                        <DataListKey>Klasse</DataListKey>
                        <DataListValue>
                          <button type="button" className="oa-link" onClick={() => setActief("clas")}>
                            {stand!.object!.classificatie.resultaat}
                          </button>{" "}
                          <span className="oa-klein">{stand!.object!.bewaren?.klasse ?? "(selectielijst)"}</span>
                        </DataListValue>
                      </DataListItem>
                    )}
                    {!persoonlijk && stand!.object!.bewaren && (
                      <DataListItem>
                        <DataListKey>Bewaren</DataListKey>
                        <DataListValue>
                          {stand!.object!.bewaren.archiefactiedatum ? (
                            <>
                              <b>tot {new Date(stand!.object!.bewaren.archiefactiedatum).toLocaleDateString("nl-NL")}</b>, daarna vernietigen
                              <span className="oa-klein"> · {stand!.object!.bewaren.uitleg.replace(/^Vernietigen na [^:]+: /, "")}</span>
                            </>
                          ) : (
                            stand!.object!.bewaren.uitleg
                          )}
                        </DataListValue>
                      </DataListItem>
                    )}
                    {vergrendeld && (
                      <DataListItem>
                        <DataListKey>Vergrendeld</DataListKey>
                        <DataListValue>
                          <StatusBadge status="warning">ja, {vergrendeld.status}</StatusBadge>
                        </DataListValue>
                      </DataListItem>
                    )}
                    {stand!.object!.versies.at(-1)?.weergaven?.some((w) => w.soort === "geanonimiseerd") && (
                      <DataListItem>
                        <DataListKey>Geanonimiseerd</DataListKey>
                        <DataListValue>
                          <button type="button" className="oa-link" onClick={() => setActief("anon")}>
                            ja, bij deze versie
                          </button>
                        </DataListValue>
                      </DataListItem>
                    )}
                    {stand!.object!.versies.at(-1) && (
                      <DataListItem>
                        <DataListKey>Bestand</DataListKey>
                        <DataListValue>{bestandsomschrijving(stand!.object!.versies.at(-1)!)}</DataListValue>
                      </DataListItem>
                    )}
                    <DataListItem>
                      <DataListKey>Inhoud</DataListKey>
                      <DataListValue>
                        {stand!.object!.onleesbaarGemaakt ? (
                          <StatusBadge status="danger">onleesbaar gemaakt</StatusBadge>
                        ) : stand!.object!.versleuteld ? (
                          <StatusBadge status="safe">versleuteld met eigen sleutel</StatusBadge>
                        ) : (
                          "niet versleuteld"
                        )}
                      </DataListValue>
                    </DataListItem>
                    {!persoonlijk && (
                      <DataListItem>
                        <DataListKey>Metadata</DataListKey>
                        <DataListValue>
                          <StatusBadge status={stand!.object!.volledigheid.volledig ? "safe" : "warning"}>
                            {stand!.object!.volledigheid.volledig ? "volledig" : `${stand!.object!.volledigheid.ontbreekt.length} verplicht veld(en) open`}
                          </StatusBadge>
                        </DataListValue>
                      </DataListItem>
                    )}
                  </DataList>
                  {stand!.object!.versies.length > 1 && (
                    <details className="oa-versies-blok">
                      <summary>Versies ({stand!.object!.versies.length})</summary>
                      <Versies
                        versies={stand!.object!.versies}
                        niveau={wie?.niveau ?? 0}
                        beheerder={!!wie?.rollen.includes("beheerder")}
                        zetTerug={async (nummer, reden) =>
                          voerUit("terugzetten", async () => {
                            const s = await anonimiseren.zetVersieTerug(adapter, verbinding, stand!, nummer, reden);
                            setStand(s);
                            setAfwijking("gelijk");
                            await laadGeschiedenis(s);
                            setMelding({ soort: "warning", tekst: `Versie ${nummer} is teruggezet als versie ${s.object!.versies.at(-1)!.nummer}. Staan er persoonsgegevens in, dan staan die nu weer in het document.` });
                          })
                        }
                        bezig={bezig}
                        uit={uit}
                      />
                    </details>
                  )}
                  {afwijking === "afwijkend" && !vergrendeld && (
                    <div className="oa-kader" role="note">
                      <Paragraph small>
                        Dit stuk wijkt af van versie {stand!.object!.versies.at(-1)?.nummer} in het platform. Heb je het daarna gewijzigd, leg dan een nieuwe versie vast. Is het een
                        kopie (Opslaan als), leg het dan vast als nieuw stuk; anders komt de kopie als versie onder het origineel.
                      </Paragraph>
                      <SubtleButton onClick={alsNieuwStuk}>Als nieuw stuk vastleggen</SubtleButton>
                    </div>
                  )}
                  {stand!.object!.onleesbaarGemaakt && (
                    <Paragraph small>De sleutel van dit stuk is vernietigd. De registratie blijft bestaan; nieuwe versies kunnen niet meer worden vastgelegd.</Paragraph>
                  )}
                  {!vergrendeld && (
                    <SecondaryActionButton onClick={doeVersie} disabled={uit || bezig !== null || !!stand!.object!.onleesbaarGemaakt} busy={bezig === "versie"}>
                      Versie vastleggen
                    </SecondaryActionButton>
                  )}
                  {wie && (
                    <Vergrendeld
                      adapter={adapter}
                      verbinding={verbinding}
                      stand={stand!}
                      setStand={setStand}
                      wie={wie}
                      afwijkend={afwijking === "afwijkend"}
                      uit={uit}
                      melding={(m) => setMelding(m)}
                      fout={fout}
                      naWijziging={async (s) => {
                        setAfwijking(await vergelijkMetLaatsteVersie(s, await adapter.leverInhoud()));
                        await laadGeschiedenis(s);
                      }}
                    />
                  )}
                </>
              ) : (
                <Paragraph>
                  Dit stuk is nog niet vastgelegd. Kies bij Metadateren of het zakelijk of persoonlijk is. Een zakelijk stuk registreer je met metadata; het platform geeft het een
                  eigen identificatie.
                </Paragraph>
              )}
            </section>
            <section className="oa-sectie" aria-labelledby="oa-aandacht">
              <Heading3 id="oa-aandacht">Aandachtspunten</Heading3>
              {aandacht.length ? (
                <ul className="oa-aandacht">
                  {aandacht.map((a) => (
                    <li key={a.tekst}>
                      <button type="button" className="oa-link" onClick={() => setActief(a.module)}>
                        <Icoon id={a.module} grootte={14} /> {a.tekst}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Paragraph small>Niets open.</Paragraph>
              )}
            </section>
            {vrijgever && wie && (
              <TeBeoordelen
                verbinding={verbinding}
                wie={wie}
                huidig={stand?.object?.identificatie}
                melding={(m) => setMelding(m)}
                fout={fout}
                naBesluit={async (id) => {
                  if (stand?.object?.identificatie === id) setStand({ ...stand, object: await verbinding.object(id) });
                }}
              />
            )}
          </>
        )}

        {actief === "meta" && (
          <section className="oa-sectie" aria-label="Metadata">
            <div className="utrecht-form-field">
              <div className="utrecht-form-label" id="oa-aard-label">
                Zakelijk of persoonlijk (verplicht)
              </div>
              <div className="oa-keuze" role="group" aria-labelledby="oa-aard-label">
                {(["zakelijk", "persoonlijk"] as Aard[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={aard === a}
                    disabled={geregistreerd && !(a === "zakelijk" && persoonlijk)}
                    onClick={() => (geregistreerd ? doeZakelijk() : setAardKeuze(a))}
                  >
                    {a === "zakelijk" ? "Zakelijk" : "Persoonlijk"}
                  </button>
                ))}
              </div>
              <div className="utrecht-form-field__description">
                {!aard && "Voorstel: zakelijk, want je werkt aan een stuk voor de gemeente. Jij kiest; jij bent daarvoor verantwoordelijk."}
                {aard === "zakelijk" && !geregistreerd && "Zakelijk: het stuk komt in het archief van de gemeente, met metadata, en valt onder de Woo."}
                {persoonlijk &&
                  "Persoonlijk: het stuk komt in je persoonlijke opslag. Het valt buiten het archief en de Woo, krijgt geen metadata en is alleen voor jou zichtbaar."}
                {geregistreerd && persoonlijk && " Zakelijk maken kan altijd: dan komt het stuk alsnog in het archief."}
                {geregistreerd && !persoonlijk && "Zakelijk. Persoonlijk maken kan in het prototype nog niet; straks binnen de bedenktijd, of op verzoek bij de informatiebeheerder."}
              </div>
            </div>
            {metadataDicht && (
              <Alert type="info">
                <Paragraph>Dit stuk is {vergrendeld!.status} en vergrendeld. De metadata wijzigt alleen een vrijgever; die geeft het stuk zo ook vrij.</Paragraph>
              </Alert>
            )}
            <fieldset className="oa-velden" disabled={metadataDicht}>
            {!persoonlijk && velden.map((v) => (
              <FormField
                key={v.naam}
                label={<label htmlFor={`oa-${v.naam}`}>{v.label}{v.verplicht ? " (verplicht)" : ""}</label>}
                description={
                  <>
                    {v.beschrijving}
                    {voorstellen[v.naam] && !metadata[v.naam] && (
                      <span className="oa-voorstel">
                        Voorstel: <q>{voorstellen[v.naam]}</q>{" "}
                        <SubtleButton onClick={() => setMetadata((m) => ({ ...m, [v.naam]: voorstellen[v.naam] }))}>Overnemen</SubtleButton>
                      </span>
                    )}
                  </>
                }
                invalid={!!fouten[v.naam]}
                errorMessage={fouten[v.naam]}
                input={veldInvoer(v, metadata[v.naam] ?? "", (w) => setMetadata((m) => ({ ...m, [v.naam]: w })), !!fouten[v.naam])}
              />
            ))}
            </fieldset>
            {geregistreerd ? (
              !persoonlijk && (
                <PrimaryActionButton onClick={doeMetadata} disabled={uit || bezig !== null || metadataDicht} busy={bezig === "metadata"}>
                  Metadata vastleggen
                </PrimaryActionButton>
              )
            ) : (
              <PrimaryActionButton onClick={doeRegistreren} disabled={uit || bezig !== null || !aard} busy={bezig === "registreren"}>
                {persoonlijk ? "Persoonlijk vastleggen" : "Registreren"}
              </PrimaryActionButton>
            )}
            {bezig === "zakelijk" && <Paragraph small>Het stuk gaat naar het archief…</Paragraph>}
            {ontbreekt.length > 0 && <Paragraph small>Nog open: {ontbreekt.map((b) => b.melding.replace(" is nog niet ingevuld.", "")).join(", ")}. Registreren kan al; het stuk heet dan onvolledig.</Paragraph>}
          </section>
        )}

        {actief === "toeg" && (
          <section className="oa-sectie" aria-label="Toegankelijkheid">
            <Paragraph small>Beoordelen leest alleen en legt niets vast.</Paragraph>
            <SecondaryActionButton onClick={doeBeoordelen} disabled={uit || bezig !== null} busy={bezig === "beoordelen"}>
              {bevindingen ? "Opnieuw beoordelen" : "Beoordelen"}
            </SecondaryActionButton>
            {bevindingen && bevindingen.length === 0 && <Paragraph>Geen bevindingen. Het stuk voldoet aan de gecontroleerde punten.</Paragraph>}
            {bevindingen && bevindingen.length > 0 && (
              <ul className="oa-bevindingen">
                {bevindingen.map((b) => (
                  <li key={b.id} className={`oa-bevinding oa-${b.ernst}`}>
                    <Paragraph>
                      <StatusBadge status={b.ernst === "fout" ? "danger" : b.ernst === "waarschuwing" ? "warning" : "neutral"}>{b.ernst}</StatusBadge> {b.melding}
                    </Paragraph>
                    <Paragraph small>
                      {b.regel}
                      {b.plek ? ` · ${b.plek.beschrijving}` : ""}
                      {b.bron === "bestand" && <span className="oa-bron" title="Gevonden in het bestand zelf, niet in wat het paneel van de inhoud ziet. Herstel dit in het document."> · uit het bestand</span>}
                    </Paragraph>
                    {b.voorstel?.beschrijving && <Paragraph small>{b.voorstel.beschrijving}</Paragraph>}
                    <div className="oa-acties">
                      {b.plek?.pad && kanTonen && <SubtleButton onClick={() => adapter.toonPlek!(b.plek!)}>Toon</SubtleButton>}
                      {b.voorstel?.vraag && (
                        <Textbox
                          aria-label={b.voorstel.vraag.label}
                          placeholder={b.voorstel.vraag.label}
                          value={antwoorden[b.id] ?? ""}
                          onChange={(e) => setAntwoorden((a) => ({ ...a, [b.id]: e.target.value }))}
                        />
                      )}
                      {(b.voorstel?.vervanging || b.voorstel?.vraag) && b.plek?.pad && (
                        <SecondaryActionButton
                          onClick={() => doeHerstel(b)}
                          disabled={bezig !== null || (!!b.voorstel?.vraag && b.voorstel.vraag.veld !== "alt" && !antwoorden[b.id])}
                          busy={bezig === `herstel-${b.id}`}
                        >
                          {b.voorstel?.vraag ? "Toepassen" : "Herstellen"}
                        </SecondaryActionButton>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!kanTonen && bevindingen && bevindingen.length > 0 && (
              <Paragraph small>Deze werkomgeving kan niet naar een plek in het document springen. De omschrijving zegt waar het is.</Paragraph>
            )}
          </section>
        )}

        {actief === "anon" && stand && anonimiseren.kanInDocument(adapter) && (
          <AnonimiserenInDocument
            adapter={adapter}
            verbinding={verbinding}
            stand={stand}
            zetStand={(s) => {
              setStand(s);
              setAfwijking("gelijk");
            }}
            niveau={wie?.niveau ?? 0}
            beheerder={!!wie?.rollen.includes("beheerder")}
            klik={piiKlik}
            selectieVerzoek={selectieVerzoek}
            nietBeginnen={!geregistreerd ? "Leg het stuk eerst vast (bij Metadateren): anonimiseren maakt een nieuwe versie, en het origineel blijft bewaard." : null}
            naWijziging={laadGeschiedenis}
            bezig={bezig}
            setBezig={setBezig}
            meld={(m) => setMelding(m)}
            uit={uit}
          />
        )}

        {actief === "anon" && !anonimiseren.kanInDocument(adapter) && (
          <Anonimiseren
            zoek={() => anonimiseren.vind(adapter, verbinding)}
            bevestig={async (gekozen) => {
              const r = await anonimiseren.bevestig(adapter, verbinding, stand!, gekozen);
              setStand(r.stand);
              setAfwijking("gelijk");
              await laadGeschiedenis(r.stand);
              return r;
            }}
            nietBevestigen={
              !geregistreerd
                ? "Leg het stuk eerst vast (bij Metadateren): het register van persoonsgegevens hoort bij een geregistreerd stuk."
                : !anonimiseren.kanBijDeBron(adapter)
                  ? `${omgeving.naam} kan tekst in het document niet vervangen; anonimiseren bij de bron kan hier niet.`
                  : null
            }
            register={piiRegister}
            onthul={async (plaatshouders) => {
              const { waarden } = await verbinding.onthulPii(stand!.object!.identificatie, plaatshouders);
              await laadGeschiedenis(stand!);
              return waarden;
            }}
            vernietig={
              wie?.rollen.includes("beheerder")
                ? async (categorie, reden) => {
                    const r = await verbinding.vernietigPii(stand!.object!.identificatie, categorie, reden);
                    await laadGeschiedenis(stand!);
                    return r;
                  }
                : undefined
            }
            leesSelectie={adapter.leesSelectie && heeftVermogen(omgeving, "selectie-lezen") ? () => adapter.leesSelectie!() : undefined}
            niveau={wie?.niveau ?? 0}
            versie={stand?.object?.versies.at(-1)?.nummer ?? null}
            toon={kanTonen ? (plek) => adapter.toonPlek!(plek) : undefined}
            bezig={bezig}
            setBezig={setBezig}
            meld={(m) => setMelding(m)}
            uit={uit}
          />
        )}

        {info.volgt && (
          <section className="oa-sectie oa-volgt-weergave" aria-label={info.naam}>
            <StatusBadge status="neutral">volgt in het prototype</StatusBadge>
            <Paragraph>{info.volgt}</Paragraph>
            <Paragraph small>In de demo (MIRA) is te zien hoe het werkt.</Paragraph>
          </section>
        )}

        {actief === "clas" && wie && (
          stand?.object && !persoonlijk ? (
            <Classificeren
              key={stand.object.identificatie}
              adapter={adapter}
              verbinding={verbinding}
              stand={stand}
              setStand={(s) => {
                setStand(s);
                laadGeschiedenis(s).catch(() => undefined);
              }}
              type={type}
              wie={wie}
              klassen={klassen?.selectielijst ? klassen : null}
              uit={uit}
              melding={(m) => setMelding(m)}
              fout={fout}
            />
          ) : (
            <section className="oa-sectie" aria-label="Classificeren">
              <Paragraph>
                {persoonlijk ? "Een persoonlijk stuk wordt niet geclassificeerd: het valt buiten het archief." : "Leg het stuk eerst vast (bij Metadateren). Daarna kies je hier de klasse uit de selectielijst."}
              </Paragraph>
            </section>
          )
        )}

        {actief === "help" && (
          <>
            <section className="oa-sectie" aria-label="Modules">
              <dl className="oa-hulp">
                {MODULES.filter((m) => m.id !== "help").map((m) => (
                  <div key={m.id}>
                    <dt>
                      <button type="button" className="oa-link" onClick={() => setActief(m.id)}>
                        <Icoon id={m.id} grootte={14} /> {m.naam}
                      </button>
                      {m.volgt && <span className="oa-klein"> · volgt</span>}
                    </dt>
                    <dd>{m.onder}</dd>
                  </div>
                ))}
              </dl>
              <Paragraph small>De assistent stelt voor; jij beslist. Beoordelen en voorstellen leggen niets vast. Wat je vastlegt, gaat naar het informatieplatform van de gemeente, met jouw naam erbij.</Paragraph>
            </section>
            <Motorkap aanroepen={aanroepen} geschiedenis={geschiedenis} omgeving={omgeving} />
          </>
        )}
        </>)}
      </div>
      {knoppen === "rechts" && rij}
    </div>
  );
}

function veldInvoer(v: Veld, waarde: string, zet: (w: string) => void, ongeldig: boolean) {
  const id = `oa-${v.naam}`;
  if (v.soort === "keuze") {
    return (
      <Select id={id} value={waarde} invalid={ongeldig} onChange={(e) => zet(e.target.value)}>
        <SelectOption value="">Kies…</SelectOption>
        {v.opties!.map((o) => (
          <SelectOption key={o} value={o}>
            {o}
          </SelectOption>
        ))}
      </Select>
    );
  }
  if (v.soort === "lange-tekst") {
    return <Textarea id={id} value={waarde} invalid={ongeldig} maxLength={v.maxLengte} rows={3} onChange={(e) => zet(e.target.value)} />;
  }
  if (v.soort === "datum") return <Textbox id={id} type="date" value={waarde} invalid={ongeldig} onChange={(e) => zet(e.target.value)} />;
  if (v.soort === "getal") return <Textbox id={id} inputMode="decimal" value={waarde} invalid={ongeldig} onChange={(e) => zet(e.target.value)} />;
  return <Textbox id={id} value={waarde} invalid={ongeldig} maxLength={v.maxLengte} onChange={(e) => zet(e.target.value)} />;
}
