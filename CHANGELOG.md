# Wijzigingen

## 0.5.0 — 2026-11-09

Het paneel heeft **modules**, zoals de demo (MIRA): Overzicht, Onderdelen, Metadateren, Toegankelijkheid, Anonimiseren, Classificeren, Waarmerken, Workflow en Help, met knoppen aan de zijkant (`knoppen: "rechts"`, standaard) of bovenaan (`"boven"`, voor de zijbalk van LibreOffice). Wat het prototype nog niet heeft, staat erin met "volgt". Tellers op de knoppen; pijltoetsen in de rij.

- Opdrachten van buiten: `stuurOpdracht("meta" | … | "beoordelen")` of de DOM-gebeurtenis `oa-assistent` op `window`; optie `module` om met een module te openen. `MODULES` en `icoonSvg` voor werkbalken buiten het paneel.
- **Zakelijk of persoonlijk** in Metadateren: verplicht voordat je vastlegt, met "Voorstel: zakelijk". Persoonlijk: geen metadatavelden, "Persoonlijk vastleggen". Een persoonlijk stuk kan later zakelijk worden.
- Overzicht: soort, aandachtspunten met een link naar de module, en een melding als het stuk afwijkt van de laatste versie, met "Als nieuw stuk vastleggen" voor een kopie.
- Het paneel vult de plek die de werkomgeving geeft en scrolt zelf.

## 0.4.1 — 2026-11-08

Na een herstelling worden de antwoorden in de vraagvelden leeggemaakt: de bevindingen zijn dan opnieuw genummerd en een oud antwoord kwam bij een andere bevinding terecht.

## 0.4.0 — 2026-11-08

"Dit stuk" toont wat er van de versie is bewaard: formaat, grootte en weergaven.

## 0.3.0 — 2026-11-08

Optie `sessie`: de sessie als Authorization-kop, voor werkomgevingen waar het cookie niet aankomt (de Word-invoegtoepassing in Word voor het web).

## 0.2.0 — 2026-11-07

Het paneel toont of de inhoud versleuteld of onleesbaar gemaakt is; vastleggen van nieuwe versies is dan uit.

## 0.1.0 — 2026-11-07

Fase 1 van het werkende prototype: contract, minimaal platform, integratielaag met twee ingangen, assistentkern, paneel en een demo-werkomgeving met de modules metadateren en toegankelijkheid.
