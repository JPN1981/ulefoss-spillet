# Fra foss til framtid

Et quiz-brettspill om Ulefoss. Den offentlige nettsiden publiseres fra `site/` med GitHub Pages.

## Publisering

GitHub Actions-workflowen i `.github/workflows/pages.yml` publiserer `site/` til GitHub Pages ved push til `main`. I repoet velger du **Settings → Pages → Build and deployment → GitHub Actions**. Etter første vellykkede workflow blir nettstedet tilgjengelig på `https://jpn1981.github.io/ulefoss-spillet/`.

## Spillstatus

Den publiserte utgaven er statisk. Nettrom og felles spill er en prøveversjon: to til seks deltakere kan møtes ved å dele en romkode. Verten starter spillet når alle er med, og hver deltaker kaster og svarer på sin egen tur. Deltakerne får automatiske navn. Nye deltakere må bli med før spillet starter; dersom noen forlater rommet, avsluttes spillet og verten kan starte på nytt.

Vertens nettleser styrer spillet og må holdes åpen. Alle som har koden kan bli med. Rommet bruker PeerJS' offentlige signaliseringstjeneste og direkte WebRTC-forbindelser, som kan eksponere deltakernes IP-adresser for hverandre. Forbindelsen kan feile på enkelte nettverk uten en TURN-tjeneste. Spillet er ikke sikret mot juks, og rommet fungerer ikke uten Internett eller hvis PeerJS-tjenesten ikke er tilgjengelig.

Lyd og bilde er en prøveversjon. Kamera og mikrofon er av til hver deltaker selv slår dem på og gir nettleseren tillatelse. Trykk **Hør andre** for å aktivere lyd fra de andre; bruk gjerne hodetelefoner for å unngå ekko. Kamera og mikrofon stoppes når rommet forlates. Funksjonen krever HTTPS (eller localhost for lokal testing) og kan feile på enkelte nettverk. Mange samtidige videostrømmer krever god båndbredde; det er ikke garantert at video fungerer med seks deltakere.

Tilkoblingen bekreftes begge veier før deltakeren vises hos verten. Innledende meldinger forsøkes på nytt hvis bekreftelsen uteblir. Ved tidsavbrudd viser siden hvilket trinn den ventet på. Oppdater siden på begge enheter før et nytt rom opprettes; hvis det fortsatt feiler, prøv et annet nettverk.

## Lokal forhåndsvisning

Kjør en enkel HTTP-server fra repo-roten:

```powershell
python -m http.server 8000 --directory site
```

Åpne <http://localhost:8000>.
