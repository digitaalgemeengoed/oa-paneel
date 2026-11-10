import { useEffect, useMemo, useState } from "react";
import { Alert, FormField, Paragraph, PrimaryActionButton, Select, SelectOption, StatusBadge, SubtleButton, Textbox, Heading3 } from "@utrecht/component-library-react";
import { bepaalBewaren, duurInWoorden, rolWaarden, type Adapter, type Objecttype, type WieBenIk } from "@digitaalgemeengoed/oa-contract";
import { classificeren, type ClassificatieAntwoord, type Klasse, type Klassevoorstel, type Stand, type Verbinding } from "@digitaalgemeengoed/oa-kern";

/** "vernietigen na 10 jaar" of "blijvend bewaren". */
export function termijnTekst(r: Klasse): string {
  if (r.waardering === "blijvend-bewaren") return "blijvend bewaren";
  if (r.bewaartermijn) return `vernietigen na ${duurInWoorden(r.bewaartermijn)}`;
  return `vernietigen: ${r.bewaartermijnTekst ?? "zie de toelichting"}`;
}

function platteTekst(html: string): string {
  try {
    return new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
  } catch {
    return html.replace(/<[^>]+>/g, " ");
  }
}

interface Props {
  adapter: Adapter;
  verbinding: Verbinding;
  stand: Stand;
  setStand: (s: Stand) => void;
  type: Objecttype | null;
  wie: WieBenIk;
  klassen: ClassificatieAntwoord | null;
  uit: boolean;
  melding: (m: { soort: "ok" | "info" | "error" | "warning"; tekst: string }) => void;
  fout: (e: unknown) => void;
}

/**
 * Classificeren: een klasse uit de selectielijst kiezen (met voorstellen van
 * de assistent), eigen attributen invullen, en zien wat dat betekent voor
 * het bewaren.
 */
export function Classificeren({ adapter, verbinding, stand, setStand, type, wie, klassen, uit, melding, fout }: Props) {
  const object = stand.object!;
  const huidig = object.classificatie ?? null;
  const [keuze, setKeuze] = useState<string>(huidig?.resultaat ?? "");
  const [attributen, setAttributen] = useState<Record<string, string | boolean>>(huidig?.attributen ?? {});
  const [einddatum, setEinddatum] = useState(huidig?.einddatumProcesobject ?? "");
  const [vraag, setVraag] = useState("");
  const [voorstellen, setVoorstellen] = useState<Klassevoorstel[] | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fouten, setFouten] = useState<Record<string, string>>({});

  const lijst = klassen?.selectielijst;
  const model = klassen?.model;
  const alleenLezen = !!object.vergrendeld && !wie.rollen.includes("vrijgever");

  // De assistent leest het stuk en stelt drie klassen voor.
  useEffect(() => {
    if (!lijst) return;
    let weg = false;
    adapter
      .leverInhoud()
      .then((inhoud) => {
        if (weg) return;
        const titel = type ? (rolWaarden(type.schema, object.metadata).titel ?? "") : "";
        setVoorstellen(classificeren.suggesties(inhoud.formaat === "html" ? platteTekst(inhoud.data) : inhoud.data, titel, lijst.resultaten, lijst.procestypen));
      })
      .catch(() => setVoorstellen([]));
    return () => {
      weg = true;
    };
  }, [adapter, lijst, type, object.metadata]);

  const procestype = useMemo(() => new Map((lijst?.procestypen ?? []).map((p) => [p.nummer, p])), [lijst]);
  const gekozen = lijst?.resultaten.find((r) => r.id === keuze);
  const gevonden = useMemo(() => (lijst ? classificeren.zoek(lijst.resultaten, lijst.procestypen, vraag) : []), [lijst, vraag]);

  if (!klassen) return <Paragraph small>Het classificatiemodel wordt geladen…</Paragraph>;
  if (!model || !lijst) {
    return (
      <Alert type="info">
        <Paragraph>Deze gemeente heeft nog geen classificatiemodel. Een beheerder stelt het in het beheerportaal in (Classificatie).</Paragraph>
      </Alert>
    );
  }

  // Wat de keuze betekent: de resultaten van het platform hebben de afwijkingen van de gemeente al verwerkt.
  const bewaren = gekozen
    ? bepaalBewaren({ ...model.config, afwijkingen: [] }, { ...lijst, bron: "", resultaten: lijst.resultaten }, { resultaat: gekozen.id, ...(einddatum ? { einddatumProcesobject: einddatum } : {}) }, object.statusdata ?? {})
    : null;
  const gewijzigd =
    keuze !== (huidig?.resultaat ?? "") ||
    JSON.stringify(attributen) !== JSON.stringify(huidig?.attributen ?? {}) ||
    einddatum !== (huidig?.einddatumProcesobject ?? "");

  const kies = (id: string) => {
    setKeuze(id);
    setVraag("");
    setFouten({});
  };

  const legVast = async () => {
    setBezig(true);
    setFouten({});
    try {
      const s = await classificeren.legVast(verbinding, stand, {
        resultaat: keuze,
        ...(Object.keys(attributen).length ? { attributen: Object.fromEntries(Object.entries(attributen).filter(([, w]) => w !== "")) } : {}),
        ...(einddatum ? { einddatumProcesobject: einddatum } : {}),
      });
      setStand(s);
      melding({ soort: "ok", tekst: `De classificatie is vastgelegd: ${keuze}. ${s.object!.bewaren?.uitleg ?? ""}` });
    } catch (e) {
      const d = (e as { details?: { veld: string; melding: string }[] }).details;
      if (Array.isArray(d)) setFouten(Object.fromEntries(d.map((x) => [x.veld, x.melding])));
      fout(e);
    } finally {
      setBezig(false);
    }
  };

  const regel = (r: Klasse, knop?: string) => (
    <li key={r.id} className={`oa-klasse${r.id === keuze ? " gekozen" : ""}`}>
      <button type="button" onClick={() => kies(r.id)} disabled={alleenLezen} aria-pressed={r.id === keuze}>
        <span className="oa-klasse-kop">
          <b>{r.id}</b> {r.naam}
          {r.omschrijving && <> · {r.omschrijving}</>}
        </span>
        <span className="oa-klein">
          {procestype.get(r.procestype)?.naam} · {termijnTekst(r)}
          {r.afwijking && " (eigen termijn)"}
        </span>
        {knop && <span className="oa-klein oa-waarom">{knop}</span>}
      </button>
    </li>
  );

  return (
    <section className="oa-sectie" aria-label="Classificeren">
      {alleenLezen && (
        <Alert type="info">
          <Paragraph>Dit stuk is {object.vergrendeld!.status} en vergrendeld. Alleen een vrijgever kan de classificatie nog wijzigen.</Paragraph>
        </Alert>
      )}
      {huidig && (
        <div className="oa-kader oa-kader-rustig">
          <Paragraph small>
            Nu: <b>{huidig.resultaat}</b> {lijst.resultaten.find((r) => r.id === huidig.resultaat)?.naam}
            {object.bewaren && <> · {object.bewaren.uitleg}</>}
          </Paragraph>
        </div>
      )}

      {!alleenLezen && (
        <>
          <Heading3>Voorstel van de assistent</Heading3>
          {voorstellen === null ? (
            <Paragraph small>De assistent leest het stuk…</Paragraph>
          ) : voorstellen.length === 0 ? (
            <Paragraph small>Geen voorstel: de assistent vond geen woorden die bij een klasse passen. Zoek hieronder.</Paragraph>
          ) : (
            <ul className="oa-klassen">{voorstellen.map((v) => regel(v.resultaat, `Op grond van: ${v.woorden.join(", ")}`))}</ul>
          )}
          <FormField
            label={<label htmlFor="oa-klasse-zoek">Zoek in de selectielijst</label>}
            description="Op nummer (12.2) of op woorden (vergunning kappen)."
            input={<Textbox id="oa-klasse-zoek" value={vraag} onChange={(e) => setVraag(e.target.value)} autoComplete="off" />}
          />
          {vraag && (gevonden.length ? <ul className="oa-klassen">{gevonden.map((r) => regel(r))}</ul> : <Paragraph small>Niets gevonden.</Paragraph>)}
        </>
      )}

      {gekozen && (
        <div className="oa-gekozen">
          <Heading3>
            {gekozen.id} {gekozen.naam}
          </Heading3>
          <Paragraph small>
            {procestype.get(gekozen.procestype)?.nummer}. {procestype.get(gekozen.procestype)?.naam}
            {gekozen.omschrijving && <> · {gekozen.omschrijving}</>}
          </Paragraph>
          <Paragraph small>
            <StatusBadge status={gekozen.waardering === "blijvend-bewaren" ? "safe" : "neutral"}>{termijnTekst(gekozen)}</StatusBadge>
            {gekozen.afwijking && <span className="oa-klein"> · afwijking van de selectielijst: {gekozen.afwijking.reden}</span>}
          </Paragraph>
          {(gekozen.toelichting || gekozen.procestermijnTekst) && (
            <details className="oa-klein">
              <summary>Toelichting uit de selectielijst</summary>
              {gekozen.toelichting && <p>{gekozen.toelichting}</p>}
              {gekozen.procestermijnTekst && <p>Procestermijn: {gekozen.procestermijnTekst}</p>}
              {gekozen.herkomst && <p>Herkomst: {gekozen.herkomst}</p>}
            </details>
          )}
          {gekozen.waardering === "vernietigen" && gekozen.procestermijn !== "nihil" && (
            <FormField
              label={<label htmlFor="oa-einddatum">{gekozen.procestermijn === "vervaldatum" ? "Vervaldatum" : "Einddatum van het procesobject"}</label>}
              description={`De bewaartermijn gaat pas in als ${procestype.get(gekozen.procestype)?.procesobject?.toLowerCase() || "het procesobject"} vervalt. Leeg laten als dat nog niet bekend is.`}
              input={<Textbox id="oa-einddatum" type="date" value={einddatum} disabled={alleenLezen} onChange={(e) => setEinddatum(e.target.value)} />}
            />
          )}
          {model.config.attributen.map((a) => (
            <FormField
              key={a.sleutel}
              label={<label htmlFor={`oa-attr-${a.sleutel}`}>{a.label}{a.verplicht ? " (verplicht)" : ""}</label>}
              description={a.beschrijving}
              invalid={!!fouten[a.sleutel]}
              errorMessage={fouten[a.sleutel]}
              input={
                a.type === "keuze" ? (
                  <Select id={`oa-attr-${a.sleutel}`} value={String(attributen[a.sleutel] ?? "")} disabled={alleenLezen} onChange={(e) => setAttributen((x) => ({ ...x, [a.sleutel]: e.target.value }))}>
                    <SelectOption value="">Kies…</SelectOption>
                    {(a.opties ?? []).map((o) => (
                      <SelectOption key={o} value={o}>
                        {o}
                      </SelectOption>
                    ))}
                  </Select>
                ) : a.type === "ja-nee" ? (
                  <Select
                    id={`oa-attr-${a.sleutel}`}
                    value={attributen[a.sleutel] === true ? "ja" : attributen[a.sleutel] === false ? "nee" : ""}
                    disabled={alleenLezen}
                    onChange={(e) => setAttributen((x) => ({ ...x, [a.sleutel]: e.target.value === "" ? "" : e.target.value === "ja" }))}
                  >
                    <SelectOption value="">Kies…</SelectOption>
                    <SelectOption value="ja">ja</SelectOption>
                    <SelectOption value="nee">nee</SelectOption>
                  </Select>
                ) : (
                  <Textbox id={`oa-attr-${a.sleutel}`} value={String(attributen[a.sleutel] ?? "")} maxLength={500} disabled={alleenLezen} onChange={(e) => setAttributen((x) => ({ ...x, [a.sleutel]: e.target.value }))} />
                )
              }
            />
          ))}
          {bewaren && (
            <Paragraph small className="oa-bewaren">
              {bewaren.uitleg}
            </Paragraph>
          )}
          {!alleenLezen && (
            <div className="oa-acties">
              <PrimaryActionButton onClick={legVast} disabled={uit || bezig || !gewijzigd} busy={bezig}>
                Classificatie vastleggen
              </PrimaryActionButton>
              {gewijzigd && huidig && (
                <SubtleButton
                  onClick={() => {
                    setKeuze(huidig.resultaat);
                    setAttributen(huidig.attributen ?? {});
                    setEinddatum(huidig.einddatumProcesobject ?? "");
                  }}
                >
                  Terug naar de vastgelegde
                </SubtleButton>
              )}
            </div>
          )}
        </div>
      )}
      <Paragraph small>
        De assistent stelt voor op grond van de woorden in het stuk; jij kiest. De bewaartermijn komt uit de {lijst.naam}
        {model.config.afwijkingen?.length ? ", met de afwijkingen van je gemeente" : ""}. {lijst.toelichting}
      </Paragraph>
    </section>
  );
}
