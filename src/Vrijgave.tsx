import { useCallback, useEffect, useState } from "react";
import { Heading3, Paragraph, PrimaryActionButton, SecondaryActionButton, StatusBadge, SubtleButton, Textarea } from "@utrecht/component-library-react";
import type { Adapter, Wijzigingsvoorstel, WieBenIk } from "@digitaalgemeengoed/oa-contract";
import { dienVoorstelIn, type Stand, type Verbinding } from "@digitaalgemeengoed/oa-kern";

type Melding = (m: { soort: "ok" | "info" | "error" | "warning"; tekst: string }) => void;

const datum = (iso: string) => new Date(iso).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });

/** De tekstblokken van een html-document, één per alinea, kop, lijstitem of cel. */
function blokken(html: string): string[] {
  try {
    const d = new DOMParser().parseFromString(html, "text/html");
    const uit = [...d.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,td,th,caption,figcaption")]
      .filter((e) => !e.querySelector("p,li,td,th"))
      .map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return uit.length ? uit : (d.body.textContent ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  } catch {
    return [html];
  }
}

type Regel = { soort: "gelijk" | "weg" | "erbij"; tekst: string };

/** Een eenvoudige vergelijking per tekstblok (langste gemeenschappelijke reeks). */
export function vergelijk(oud: string[], nieuw: string[]): Regel[] {
  const a = oud.slice(0, 600);
  const b = nieuw.slice(0, 600);
  const t: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
  const uit: Regel[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      uit.push({ soort: "gelijk", tekst: a[i]! });
      i++;
      j++;
    } else if (t[i + 1]![j]! >= t[i]![j + 1]!) uit.push({ soort: "weg", tekst: a[i++]! });
    else uit.push({ soort: "erbij", tekst: b[j++]! });
  }
  while (i < a.length) uit.push({ soort: "weg", tekst: a[i++]! });
  while (j < b.length) uit.push({ soort: "erbij", tekst: b[j++]! });
  return uit;
}

/** Alleen wat verandert, met één blok ervoor en erna. */
function Verschil({ regels }: { regels: Regel[] }) {
  const toon = new Set<number>();
  regels.forEach((r, i) => {
    if (r.soort !== "gelijk") for (const k of [i - 1, i, i + 1]) if (k >= 0 && k < regels.length) toon.add(k);
  });
  if (!toon.size) return <Paragraph small>De tekst is gelijk; alleen de opmaak of het bestand verschilt.</Paragraph>;
  let vorige = -1;
  return (
    <ol className="oa-verschil" aria-label="Wat er verandert">
      {[...toon].sort((x, y) => x - y).map((i) => {
        const r = regels[i]!;
        const gat = vorige >= 0 && i > vorige + 1;
        vorige = i;
        return (
          <li key={i} className={`oa-v-${r.soort}${gat ? " oa-v-gat" : ""}`}>
            <span className="oa-v-teken" aria-hidden="true">{r.soort === "weg" ? "−" : r.soort === "erbij" ? "+" : " "}</span>
            <span className="oa-sr">{r.soort === "weg" ? "Weg: " : r.soort === "erbij" ? "Erbij: " : ""}</span>
            {r.tekst}
          </li>
        );
      })}
    </ol>
  );
}

/** Eén voorstel beoordelen: de wijziging zien, goedkeuren of afwijzen met een toelichting. */
function Beoordelen({ verbinding, voorstel, klaar, fout }: { verbinding: Verbinding; voorstel: Wijzigingsvoorstel; klaar: (v: Wijzigingsvoorstel) => void; fout: (e: unknown) => void }) {
  const [regels, setRegels] = useState<Regel[] | null>(null);
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState<string | null>(null);

  const bekijk = async () => {
    setBezig("bekijk");
    try {
      const o = await verbinding.object(voorstel.object);
      const bron = o.versies.find((v) => v.nummer === voorstel.bronversie);
      const [oud, nieuw] = await Promise.all([bron ? verbinding.versieHtml(voorstel.object, bron) : Promise.resolve(""), verbinding.voorstelWeergave(voorstel.id)]);
      setRegels(vergelijk(blokken(oud), blokken(nieuw.data)));
    } catch (e) {
      fout(e);
    } finally {
      setBezig(null);
    }
  };
  const besluit = async (b: "goedkeuren" | "afwijzen") => {
    setBezig(b);
    try {
      klaar(await verbinding.beoordeel(voorstel.id, b, toelichting.trim() || undefined));
    } catch (e) {
      fout(e);
    } finally {
      setBezig(null);
    }
  };
  return (
    <div className="oa-beoordelen">
      {regels ? <Verschil regels={regels} /> : <SubtleButton onClick={bekijk} disabled={bezig !== null}>{bezig === "bekijk" ? "Bezig…" : "Bekijk de wijziging"}</SubtleButton>}
      <label className="oa-klein" htmlFor={`oa-toel-${voorstel.id}`}>
        Toelichting (gaat mee in de geschiedenis)
      </label>
      <Textarea id={`oa-toel-${voorstel.id}`} rows={2} maxLength={1000} value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
      <div className="oa-acties">
        <PrimaryActionButton onClick={() => besluit("goedkeuren")} disabled={bezig !== null} busy={bezig === "goedkeuren"}>
          Goedkeuren: nieuwe versie
        </PrimaryActionButton>
        <SecondaryActionButton onClick={() => besluit("afwijzen")} disabled={bezig !== null} busy={bezig === "afwijzen"}>
          Afwijzen
        </SecondaryActionButton>
      </div>
    </div>
  );
}

function VoorstelRegel({ v, wie, verbinding, klaar, fout, metTitel }: { v: Wijzigingsvoorstel; wie: WieBenIk; verbinding: Verbinding; klaar: (v: Wijzigingsvoorstel) => void; fout: (e: unknown) => void; metTitel?: boolean }) {
  const magBeoordelen = v.status === "open" && wie.rollen.includes("vrijgever") && v.door.sub !== wie.sub;
  return (
    <li className="oa-voorstel-regel">
      <Paragraph small>
        <StatusBadge status={v.status === "open" ? "warning" : v.status === "goedgekeurd" ? "safe" : "neutral"}>{v.status}</StatusBadge>{" "}
        {metTitel && <b>{v.titel ?? "Zonder titel"} · </b>}
        {v.reden} <span className="oa-klein">· {v.door.naam ?? v.door.sub}, {datum(v.ingediend)}</span>
      </Paragraph>
      {v.beoordeling && (
        <Paragraph small>
          {v.status === "goedgekeurd" ? `Goedgekeurd als versie ${v.beoordeling.versie}` : "Afgewezen"} door {v.beoordeling.door.naam ?? v.beoordeling.door.sub}
          {v.beoordeling.toelichting ? `: ${v.beoordeling.toelichting}` : ""}
        </Paragraph>
      )}
      {v.status === "open" && v.door.sub === wie.sub && wie.rollen.includes("vrijgever") && <Paragraph small>Een andere vrijgever beoordeelt je eigen voorstel.</Paragraph>}
      {magBeoordelen && (
        <details className="oa-details">
          <summary>Beoordelen</summary>
          <Beoordelen verbinding={verbinding} voorstel={v} klaar={klaar} fout={fout} />
        </details>
      )}
    </li>
  );
}

interface Props {
  adapter: Adapter;
  verbinding: Verbinding;
  stand: Stand;
  setStand: (s: Stand) => void;
  wie: WieBenIk;
  afwijkend: boolean;
  uit: boolean;
  melding: Melding;
  fout: (e: unknown) => void;
  naWijziging: (s: Stand) => Promise<void>;
}

/** Bij een vergrendeld stuk: een wijzigingsvoorstel indienen, en de voorstellen bij dit stuk. */
export function Vergrendeld({ adapter, verbinding, stand, setStand, wie, afwijkend, uit, melding, fout, naWijziging }: Props) {
  const object = stand.object!;
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);
  const [lijst, setLijst] = useState<Wijzigingsvoorstel[] | null>(null);
  const laad = useCallback(() => {
    verbinding.voorstellen(object.identificatie).then(setLijst, () => setLijst([]));
  }, [verbinding, object.identificatie]);
  useEffect(() => {
    if (object.vergrendeld || (object.voorstellen ?? 0) > 0) laad();
  }, [laad, object.vergrendeld, object.voorstellen]);

  const dienIn = async () => {
    setBezig(true);
    try {
      await dienVoorstelIn(adapter, verbinding, stand, reden.trim());
      setReden("");
      melding({ soort: "ok", tekst: "Je wijzigingsvoorstel is ingediend. Een vrijgever beoordeelt het; tot dan blijft de vastgestelde versie gelden." });
      const s = { ...stand, object: await verbinding.object(object.identificatie) };
      setStand(s);
      await naWijziging(s);
      laad();
    } catch (e) {
      fout(e);
    } finally {
      setBezig(false);
    }
  };
  const klaar = async (v: Wijzigingsvoorstel) => {
    melding({ soort: "ok", tekst: v.status === "goedgekeurd" ? `Goedgekeurd: het voorstel is versie ${v.beoordeling?.versie}.` : "Het voorstel is afgewezen." });
    const s = { ...stand, object: await verbinding.object(object.identificatie) };
    setStand(s);
    await naWijziging(s);
    laad();
  };

  return (
    <>
      {object.vergrendeld && (
        <div className="oa-kader oa-slot" role="note">
          <Paragraph small>
            <b>Vergrendeld</b>: dit stuk is {object.vergrendeld.status}. Een nieuwe versie kan niet meer; een wijziging leg je vast als <b>voorstel</b>, naast het stuk. Een vrijgever beoordeelt
            het; na goedkeuring wordt het de volgende versie.
          </Paragraph>
          {wie.rollen.includes("vrijgever") && <Paragraph small>Je bent vrijgever: je geeft het stuk vrij door bij Metadateren de status te wijzigen.</Paragraph>}
          {afwijkend ? (
            <>
              <label className="oa-klein" htmlFor="oa-voorstel-reden">
                Wat verander je, en waarom? (verplicht)
              </label>
              <Textarea id="oa-voorstel-reden" rows={2} maxLength={1000} value={reden} onChange={(e) => setReden(e.target.value)} />
              <SecondaryActionButton onClick={dienIn} disabled={uit || bezig || reden.trim().length < 5} busy={bezig}>
                Wijzigingsvoorstel indienen
              </SecondaryActionButton>
            </>
          ) : (
            <Paragraph small>Het document is gelijk aan de vastgestelde versie.</Paragraph>
          )}
        </div>
      )}
      {lijst && lijst.length > 0 && (
        <section className="oa-sectie" aria-labelledby="oa-voorstellen">
          <Heading3 id="oa-voorstellen">Wijzigingsvoorstellen</Heading3>
          <ul className="oa-voorstellen">
            {lijst.map((v) => (
              <VoorstelRegel key={v.id} v={v} wie={wie} verbinding={verbinding} klaar={klaar} fout={fout} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Voor een vrijgever: alle open voorstellen van de gemeente. */
export function TeBeoordelen({ verbinding, wie, huidig, melding, fout, naBesluit }: { verbinding: Verbinding; wie: WieBenIk; huidig?: string; melding: Melding; fout: (e: unknown) => void; naBesluit: (object: string) => void }) {
  const [lijst, setLijst] = useState<Wijzigingsvoorstel[] | null>(null);
  const laad = useCallback(() => {
    verbinding.voorstellen().then(setLijst, () => setLijst([]));
  }, [verbinding]);
  useEffect(laad, [laad]);
  const anderen = (lijst ?? []).filter((v) => v.object !== huidig);
  if (!anderen.length) return null;
  return (
    <section className="oa-sectie" aria-labelledby="oa-te-beoordelen">
      <Heading3 id="oa-te-beoordelen">Te beoordelen ({anderen.filter((v) => v.door.sub !== wie.sub).length})</Heading3>
      <Paragraph small>Wijzigingsvoorstellen bij vergrendelde stukken van je gemeente. Je beoordeelt geen eigen voorstel.</Paragraph>
      <ul className="oa-voorstellen">
        {anderen.map((v) => (
          <VoorstelRegel
            key={v.id}
            v={v}
            wie={wie}
            verbinding={verbinding}
            metTitel
            fout={fout}
            klaar={(b) => {
              melding({ soort: "ok", tekst: b.status === "goedgekeurd" ? `Goedgekeurd: "${v.titel ?? "het stuk"}" heeft nu versie ${b.beoordeling?.versie}.` : `Het voorstel bij "${v.titel ?? "het stuk"}" is afgewezen.` });
              naBesluit(v.object);
              laad();
            }}
          />
        ))}
      </ul>
    </section>
  );
}

