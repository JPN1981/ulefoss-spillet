# Fra foss til framtid

Et quiz-brettspill om Ulefoss. Den offentlige nettsiden publiseres fra `site/` med GitHub Pages.

## Publisering

GitHub Actions-workflowen i `.github/workflows/pages.yml` publiserer `site/` til GitHub Pages ved push til `main`. I repoet velger du **Settings → Pages → Build and deployment → GitHub Actions**. Etter første vellykkede workflow blir nettstedet tilgjengelig på `https://jpn1981.github.io/ulefoss-spillet/`.

## Spillstatus

Den publiserte utgaven er statisk. Nettrom og felles spill er en prøveversjon: to til seks deltakere kan møtes ved å dele en romkode. Verten starter spillet når alle er med, og hver deltaker kaster og svarer på sin egen tur. Deltakerne får automatiske navn. Nye deltakere må bli med før spillet starter; dersom noen forlater rommet, avsluttes spillet og verten kan starte på nytt.

Vertens nettleser styrer spillet og må holdes åpen. Alle som har koden kan bli med. Rommet bruker PeerJS' offentlige signaliseringstjeneste og direkte WebRTC-forbindelser, som kan eksponere deltakernes IP-adresser for hverandre. Forbindelsen kan feile på enkelte nettverk uten en TURN-tjeneste. Spillet er ikke sikret mot juks. Video er ikke tilgjengelig, og rommet fungerer ikke uten Internett eller hvis PeerJS-tjenesten ikke er tilgjengelig.

## Lokal forhåndsvisning

Kjør en enkel HTTP-server fra repo-roten:

```powershell
python -m http.server 8000 --directory site
```

Åpne <http://localhost:8000>.
