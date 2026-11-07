import { Paragraph } from "@utrecht/component-library-react";
import { OPTIONELE_VERMOGENS, type Gebeurtenis, type Werkomgeving } from "@oa/contract";

export interface Aanroep {
  methode: string;
  pad: string;
  status: number;
  tijd: Date;
}

const UUR = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * Onder de motorkap: welke aanroep bij elke handeling hoort, welke
 * gebeurtenissen het platform vastlegde en wat de werkomgeving kan.
 * Voor wie wil zien hoe de architectuur werkt.
 */
export function Motorkap({ aanroepen, geschiedenis, omgeving }: { aanroepen: Aanroep[]; geschiedenis: Gebeurtenis[]; omgeving: Werkomgeving }) {
  return (
    <details className="oa-motorkap">
      <summary>Onder de motorkap</summary>
      <Paragraph small>
        <strong>Vermogens van {omgeving.naam}:</strong>{" "}
        {OPTIONELE_VERMOGENS.map((v) => `${omgeving.vermogens.includes(v) ? "✓" : "✗"} ${v}`).join(" · ")}
      </Paragraph>
      <Paragraph small>
        <strong>Laatste aanroepen</strong> (lezend of vastleggend, altijd via de integratielaag)
      </Paragraph>
      <ul>
        {aanroepen.map((a, i) => (
          <li key={i}>
            <code>
              {UUR.format(a.tijd)} {a.methode} {a.pad} → {a.status}
            </code>
          </li>
        ))}
      </ul>
      {geschiedenis.length > 0 && (
        <>
          <Paragraph small>
            <strong>Gebeurtenissen van dit stuk</strong> (alleen toegevoegd, nooit gewijzigd)
          </Paragraph>
          <ol>
            {geschiedenis.map((g) => (
              <li key={g.id}>
                <code>
                  #{g.volgnummer} {g.type}
                </code>{" "}
                door {g.actor.naam ?? g.actor.sub}, {new Date(g.tijdstip).toLocaleString("nl-NL")}
              </li>
            ))}
          </ol>
        </>
      )}
    </details>
  );
}
