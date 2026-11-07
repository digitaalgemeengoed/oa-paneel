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

## Wat het paneel laat zien (fase 1)

- **Dit stuk**: geregistreerd of niet, identificatie, versie, volledigheid van de metadata; versie vastleggen.
- **Metadata**: invoervelden uit het objecttype, voorstellen uit de inhoud, registreren of vastleggen.
- **Toegankelijkheid**: beoordelen, per bevinding de plek tonen en herstellen.
- **Onder de motorkap**: de vermogens van de werkomgeving, de laatste aanroepen en de gebeurtenissen van het stuk.

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
