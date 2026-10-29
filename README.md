# Fra foss til framtid

Et quiz-brettspill om Ulefoss. Den offentlige nettsiden publiseres fra `site/` med GitHub Pages.

## Publisering

GitHub Actions-workflowen i `.github/workflows/pages.yml` publiserer `site/` til GitHub Pages ved push til `main`. I repoet velger du **Settings → Pages → Build and deployment → GitHub Actions**. Etter første vellykkede workflow blir nettstedet tilgjengelig på `https://jpn1981.github.io/ulefoss-spillet/`.

## Spillstatus

Den publiserte utgaven er statisk. Nettrom er en prøveversjon: opptil seks deltakere kan møtes ved å dele en romkode. Deltakerne får automatiske navn, og verten må holde siden åpen. Alle som har koden kan bli med. Rommet bruker PeerJS' offentlige signaliseringstjeneste og direkte WebRTC-forbindelser, som kan eksponere deltakernes IP-adresser for hverandre. Forbindelsen kan feile på enkelte nettverk uten en TURN-tjeneste.

Spillbrett, turer og poeng synkroniseres ikke mellom deltakerne. Video er ikke tilgjengelig. Rommet fungerer ikke uten Internett eller hvis PeerJS-tjenesten ikke er tilgjengelig.

## Lokal forhåndsvisning

Kjør en enkel HTTP-server fra repo-roten:

```powershell
python -m http.server 8000 --directory site
```

Åpne <http://localhost:8000>.
