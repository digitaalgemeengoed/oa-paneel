# oa-paneel

Het **paneel** van de Office Assistent, in React met NL Design System. Hetzelfde paneel in elke werkomgeving; elke host plaatst het met zijn eigen adapter.

> Onderdeel van het werkende prototype van de Office Assistent. Een prototype, geen product.

## Gebruik

```js
import { plaatsPaneel } from "@digitaalgemeengoed/oa-paneel";
import "@digitaalgemeengoed/oa-paneel/style.css";

const weghalen = plaatsPaneel(document.getElementById("paneel"), mijnAdapter);
```

Het paneel praat via de kern alleen met de integratielaag, standaard op hetzelfde adres als de pagina.

## Opties en opdrachten

```js
plaatsPaneel(element, adapter, {
  knoppen: "boven", // knoppen van de modules bovenaan; standaard "rechts", zoals de demo
  module: "meta",   // met welke module het paneel opent; "beoordelen" opent Toegankelijkheid en beoordeelt
});

// Een knop in de werkbalk van de werkomgeving:
import { stuurOpdracht } from "@digitaalgemeengoed/oa-paneel";
stuurOpdracht("toeg"); // of window.dispatchEvent(new CustomEvent("oa-assistent", { detail: "toeg" }))
```

`MODULES` en `icoonSvg(id)` geven de namen en pictogrammen, voor werkbalken buiten het paneel.

## Modules

Dezelfde modules en volgorde als de demo (MIRA). Wat het prototype nog niet heeft, staat erin met "volgt in het prototype".

| Module | Wat het doet |
|---|---|
| Overzicht | Soort (zakelijk of persoonlijk), identificatie, versie, volledigheid; versie vastleggen; aandachtspunten. Wijkt het stuk af van de laatste versie (gewijzigd, of een kopie via Opslaan als), dan zegt het paneel dat en biedt "Als nieuw stuk vastleggen". |
| Onderdelen | volgt |
| Metadateren | Zakelijk of persoonlijk (verplicht); voor zakelijk de velden uit het objecttype met voorstellen; registreren of vastleggen. Persoonlijk: geen metadata, eigen opslag, alleen voor jou; later zakelijk maken kan altijd. |
| Toegankelijkheid | Beoordelen, per bevinding de plek tonen en herstellen. |
| Anonimiseren | Persoonsgegevens zoeken (OpenAnonymiser), een voorbeeld met de treffers, terugzetten en toevoegen, en na bevestiging de geanonimiseerde weergave vastleggen bij de versie. Het document zelf verandert niet. |
| Classificeren, Waarmerken, Workflow | volgt |
| Help | Wat waar staat, en onder de motorkap: de vermogens van de werkomgeving, de laatste aanroepen en de gebeurtenissen van het stuk. |

Valt het platform weg, dan stopt het paneel met aanbieden wat het niet kan waarmaken en zegt dat; het werk in de werkomgeving gaat door.

## Thema

Kleuren en lettertype komen uit het NL Design System-thema van de gemeente van de ingelogde medewerker (Haarlem: `haarlem-theme`; anders het voorbeeldthema). De maten zijn compacter gezet voor een zijpaneel.

## Bouwen

```
npm run build     # typecheck en dist/oa-paneel.js + dist/oa-paneel.css
```

## Licentie

© 2026 Gemeente Haarlem. EUPL 1.2, zie `LICENSE`.

Gemaakt door Erik Hoekstra, programma-architect en senior consultant, afdeling i-Ontwikkeling, Gemeente Haarlem, met assistentie van Claude (Anthropic).
