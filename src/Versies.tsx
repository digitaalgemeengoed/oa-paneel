import { useState } from "react";
import { Paragraph, SecondaryActionButton, StatusBadge, SubtleButton } from "@utrecht/component-library-react";
import type { Ppl, Versie } from "@digitaalgemeengoed/oa-contract";

export interface VersiesProps {
  versies: Versie[];
  niveau: Ppl;
  beheerder: boolean;
  /** Terugzetten als nieuwe versie; ontbreekt als de werkomgeving het document niet kan vervangen. */
  zetTerug?: (nummer: number, reden: string) => Promise<void>;
  bezig: string | null;
  uit: boolean;
}

function label(v: Versie): string {
  if (v.soort === "anonimisering") return `geanonimiseerd uit versie ${v.bronversie}`;
  if (v.soort === "terugzetting") return `teruggezet uit versie ${v.bronversie}`;
  return "";
}

/**
 * De versies van het stuk, nieuwste eerst, met hoe ze ontstonden en wie ze
 * mag lezen. Een eerdere versie terugzetten maakt een nieuwe versie; een
 * versie met persoonsgegevens vraagt het niveau daarvan en een reden.
 */
export function Versies({ versies, niveau, beheerder, zetTerug, bezig, uit }: VersiesProps) {
  const [kies, setKies] = useState<number | null>(null);
  const [reden, setReden] = useState("");
  const laatste = versies.at(-1)?.nummer;
  return (
    <ol className="oa-versies" reversed>
      {[...versies].reverse().map((v) => {
        const ppl = v.ppl ?? 0;
        const magLezen = niveau >= ppl && (!v.beperkt || beheerder);
        return (
          <li key={v.nummer}>
            <div className="oa-versie-kop">
              <b>Versie {v.nummer}</b>
              <span className="oa-klein">
                {new Date(v.vastgelegd).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                {label(v) ? ` · ${label(v)}` : ""}
              </span>
            </div>
            <div className="oa-rij">
              {v.beperkt ? (
                <StatusBadge status="danger">alleen informatiebeheer</StatusBadge>
              ) : ppl > 0 ? (
                <StatusBadge status="warning">bevat persoonsgegevens · PPL {ppl}</StatusBadge>
              ) : v.soort === "anonimisering" ? (
                <StatusBadge status="safe">geanonimiseerd</StatusBadge>
              ) : null}
              {zetTerug && v.nummer !== laatste && magLezen && kies !== v.nummer && (
                <SubtleButton onClick={() => (setKies(v.nummer), setReden(""))} disabled={uit || bezig !== null}>
                  Terugzetten…
                </SubtleButton>
              )}
            </div>
            {kies === v.nummer && (
              <div className="oa-kader">
                <Paragraph small>
                  Versie {v.nummer} wordt de inhoud van het document en een nieuwe versie.
                  {ppl > 0 ? ` Ze bevat persoonsgegevens: die staan daarna weer leesbaar in het document, en de nieuwe versie vraagt PPL ${ppl}.` : ""}
                </Paragraph>
                <label className="oa-klein oa-blok">
                  Reden (minstens 10 tekens)
                  <textarea rows={2} value={reden} onChange={(e) => setReden(e.target.value)} />
                </label>
                <div className="oa-rij">
                  <SecondaryActionButton
                    onClick={async () => {
                      await zetTerug!(v.nummer, reden.trim());
                      setKies(null);
                    }}
                    disabled={uit || bezig !== null || reden.trim().length < 10}
                    busy={bezig === "terugzetten"}
                  >
                    Versie {v.nummer} terugzetten
                  </SecondaryActionButton>
                  <SubtleButton onClick={() => setKies(null)}>Annuleer</SubtleButton>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
