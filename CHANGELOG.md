# Wijzigingen

## 0.8.0 — 2026-11-09

**Anonimiseren in het document**, zoals de MIRA-demo, in werkomgevingen die het kunnen (nu de demo; Word en LibreOffice volgen):

- De plaatshouders staan in het document zelf, gekleurd per niveau en gestippeld zolang het een voorvertoning is. Klik je erop, dan opent het paneel de kaart.
- Per gegeven een kaart: plaatshouder, PPL, AVG-artikel, algoritme, sleutel en het origineel (als je niveau het toelaat). Laat staan (alle plekken of alleen hier), toch anonimiseren, de-anonimiseren.
- Anonimiseer selectie: knop in het paneel, in de werkbalk en (in de demo) in het rechtermuismenu. De soort wordt geraden.
- Bevestigen legt een nieuwe versie vast; het origineel blijft bewaard.
- Overzicht toont de versies (geanonimiseerd uit, teruggezet uit, bevat persoonsgegevens, alleen informatiebeheer) en kan een versie terugzetten.
- Beheer: sleutel van een categorie vernietigen, met de keuze de originelen te beperken tot informatiebeheer.

Waar de werkomgeving het nog niet kan, werkt anonimiseren zoals in 0.7.0 (voorbeeld in het paneel).

## 0.7.0 — 2026-11-09

Module Anonimiseren werkt nu bij de bron, zoals de MIRA-demo:

- Alle soorten, met hun AVG-artikel (6, 9 of 10). In Resultaat staan de plaatshouders zoals het register ze geeft (`[PERSOON 1]`).
- "Selectie uit het document toevoegen": selecteer tekst in het document zelf en voeg die toe, ook als het voorbeeld die tekst niet toont (bijvoorbeeld een kop- of voettekst).
- "Bevestigen: versleutelen en vervangen" registreert, vervangt in het document en legt een nieuwe versie vast.
- Het register van het stuk: plaatshouder, soort, versleuteling en sleutel. "Toon origineel" als je niveau (PPL) hoog genoeg is; inzien komt in de geschiedenis.
- Beheerders kunnen de sleutel van een categorie vernietigen.
- Je eigen niveau staat bovenaan.

## 0.6.0 — 2026-11-09

Module **Anonimiseren**: persoonsgegevens zoeken, een voorbeeld met de treffers gemarkeerd, per soort aan of uit (standaard: namen, adressen, BSN, IBAN, telefoon, e-mail, kenteken, zaaknummer), een treffer terugzetten met een klik, gemiste gegevens toevoegen door tekst te selecteren (desgewenst overal waar die tekst staat), schakelen tussen controleren en resultaat, en bevestigen: dan legt het platform de geanonimiseerde weergave vast bij de laatste versie. Het document zelf verandert niet. Overzicht laat zien of de versie is geanonimiseerd.

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
