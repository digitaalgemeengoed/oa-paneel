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
import { heeftVermogen, type Adapter, type Bevinding, type Gebeurtenis, type Objecttype, type WieBenIk } from "@digitaalgemeengoed/oa-contract";
import { metadateren, toegankelijkheid, bepaalStand, legMetadataVast, legVersieVast, registreer, Verbinding, VerbindingsFout, type Stand, type Veld } from "@digitaalgemeengoed/oa-kern";
import { Motorkap, type Aanroep } from "./Motorkap";

const THEMA: Record<string, string> = { haarlem: "haarlem-theme" };
const OBJECTTYPE = "document";

export interface PaneelProps {
  adapter: Adapter;
  /** Basisadres van de integratielaag; leeg = hetzelfde adres als de pagina. */
  basis?: string;
}

type Melding = { soort: "info" | "warning" | "error" | "ok"; tekst: string } | null;

/**
 * Het paneel van de assistent. Hetzelfde in elke werkomgeving; wat een
 * omgeving niet kan, doet de assistent op een andere manier en zegt dat.
 */
export function Paneel({ adapter, basis = "" }: PaneelProps) {
  const [aanroepen, setAanroepen] = useState<Aanroep[]>([]);
  const verbinding = useMemo(
    () =>
      new Verbinding(basis, async (invoer, init) => {
        const r = await fetch(invoer, init);
        const pad = String(invoer).replace(basis, "");
        setAanroepen((a) => [{ methode: init?.method ?? "GET", pad, status: r.status, tijd: new Date() }, ...a].slice(0, 12));
        return r;
      }),
    [basis],
  );

  const omgeving = adapter.werkomgeving();
  const [wie, setWie] = useState<WieBenIk | null>(null);
  const [type, setType] = useState<Objecttype | null>(null);
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
      if (e.code === "niet-ingelogd") {
        setMelding({ soort: "warning", tekst: "Je bent niet (meer) ingelogd. Log opnieuw in om de assistent te gebruiken." });
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
        const [w, t, s, inhoud] = await Promise.all([verbinding.wieBenIk(), verbinding.objecttype(OBJECTTYPE), bepaalStand(adapter, verbinding), adapter.leverInhoud()]);
        if (weg) return;
        setOnbereikbaar(false);
        setWie(w);
        setType(t);
        setStand(s);
        const huidig = (s.object?.metadata ?? {}) as Record<string, string>;
        setMetadata(huidig);
        setVoorstellen(metadateren.suggesties(inhoud, huidig));
        if (s.terugval) setMelding({ soort: "info", tekst: s.terugval });
        await laadGeschiedenis(s);
      } catch (e) {
        if (!weg) fout(e);
      }
    })();
    return () => {
      weg = true;
    };
  }, [adapter, verbinding, fout, laadGeschiedenis]);

  const velden: Veld[] = useMemo(() => (type ? metadateren.velden(type) : []), [type]);
  const ontbreekt = type ? metadateren.bevindingen(type, metadata) : [];

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
      const s = await registreer(adapter, verbinding, OBJECTTYPE, metadata);
      setStand(s);
      setMetadata(s.object!.metadata as Record<string, string>);
      setMelding(s.terugval ? { soort: "info", tekst: s.terugval } : { soort: "ok", tekst: "Het stuk is geregistreerd. Het platform heeft het een eigen identificatie gegeven." });
      adapter.toon({ soort: "succes", tekst: "Geregistreerd" });
      await laadGeschiedenis(s);
    });

  const doeMetadata = () =>
    voerUit("metadata", async () => {
      setFouten({});
      const s = await legMetadataVast(verbinding, stand!, metadata);
      setStand(s);
      setMelding({ soort: "ok", tekst: "De metadata is vastgelegd." });
      await laadGeschiedenis(s);
    });

  const doeVersie = () =>
    voerUit("versie", async () => {
      const voor = stand!.object!.versies.length;
      const s = await legVersieVast(adapter, verbinding, stand!);
      setStand(s);
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
    });

  const kanTonen = heeftVermogen(omgeving, "plek-tonen") && !!adapter.toonPlek;
  const geregistreerd = !!stand?.object;
  const uit = onbereikbaar || !wie;

  return (
    <div className={`oa-paneel ${wie ? (THEMA[wie.gemeente] ?? "voorbeeld-theme") : "voorbeeld-theme"}`}>
      <header className="oa-kop">
        <Heading2>Assistent</Heading2>
        {wie && (
          <Paragraph small>
            {wie.naam} · {wie.gemeente} · in {omgeving.naam}
          </Paragraph>
        )}
      </header>

      {melding && (
        <Alert type={melding.soort} role={melding.soort === "error" ? "alert" : "status"}>
          <Paragraph>{melding.tekst}</Paragraph>
        </Alert>
      )}

      <section className="oa-sectie" aria-labelledby="oa-stuk">
        <Heading3 id="oa-stuk">Dit stuk</Heading3>
        {geregistreerd ? (
          <>
            <DataList>
              <DataListItem>
                <DataListKey>Identificatie</DataListKey>
                <DataListValue>
                  <code title={stand!.object!.identificatie}>{stand!.object!.identificatie.slice(0, 8)}…</code>
                </DataListValue>
              </DataListItem>
              <DataListItem>
                <DataListKey>Versie</DataListKey>
                <DataListValue>{stand!.object!.versies.at(-1)?.nummer ?? "geen"}</DataListValue>
              </DataListItem>
              <DataListItem>
                <DataListKey>Metadata</DataListKey>
                <DataListValue>
                  <StatusBadge status={stand!.object!.volledigheid.volledig ? "safe" : "warning"}>
                    {stand!.object!.volledigheid.volledig ? "volledig" : `${stand!.object!.volledigheid.ontbreekt.length} verplicht veld(en) open`}
                  </StatusBadge>
                </DataListValue>
              </DataListItem>
            </DataList>
            <SecondaryActionButton onClick={doeVersie} disabled={uit || bezig !== null} busy={bezig === "versie"}>
              Versie vastleggen
            </SecondaryActionButton>
          </>
        ) : (
          <Paragraph>Dit stuk is nog niet geregistreerd. Vul de metadata in en registreer het; het platform geeft het dan een eigen identificatie.</Paragraph>
        )}
      </section>

      <section className="oa-sectie" aria-labelledby="oa-md">
        <Heading3 id="oa-md">Metadata</Heading3>
        {velden.map((v) => (
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
        {geregistreerd ? (
          <PrimaryActionButton onClick={doeMetadata} disabled={uit || bezig !== null} busy={bezig === "metadata"}>
            Metadata vastleggen
          </PrimaryActionButton>
        ) : (
          <PrimaryActionButton onClick={doeRegistreren} disabled={uit || bezig !== null} busy={bezig === "registreren"}>
            Registreren
          </PrimaryActionButton>
        )}
        {ontbreekt.length > 0 && <Paragraph small>Nog open: {ontbreekt.map((b) => b.melding.replace(" is nog niet ingevuld.", "")).join(", ")}. Registreren kan al; het stuk heet dan onvolledig.</Paragraph>}
      </section>

      <section className="oa-sectie" aria-labelledby="oa-tg">
        <Heading3 id="oa-tg">Toegankelijkheid</Heading3>
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
                </Paragraph>
                {b.voorstel?.beschrijving && <Paragraph small>{b.voorstel.beschrijving}</Paragraph>}
                <div className="oa-acties">
                  {b.plek && kanTonen && <SubtleButton onClick={() => adapter.toonPlek!(b.plek!)}>Toon</SubtleButton>}
                  {b.voorstel?.vraag && (
                    <Textbox
                      aria-label={b.voorstel.vraag.label}
                      placeholder={b.voorstel.vraag.label}
                      value={antwoorden[b.id] ?? ""}
                      onChange={(e) => setAntwoorden((a) => ({ ...a, [b.id]: e.target.value }))}
                    />
                  )}
                  {(b.voorstel?.vervanging || b.voorstel?.vraag) && b.plek && (
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

      <Motorkap aanroepen={aanroepen} geschiedenis={geschiedenis} omgeving={omgeving} />
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
  return <Textbox id={id} value={waarde} invalid={ongeldig} maxLength={v.maxLengte} onChange={(e) => zet(e.target.value)} />;
}
