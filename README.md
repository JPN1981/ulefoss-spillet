# Fra foss til framtid

Et quiz-brettspill om Ulefoss. Den offentlige nettsiden publiseres fra `site/` med GitHub Pages.

## Publisering

GitHub Actions-workflowen i `.github/workflows/pages.yml` publiserer `site/` til GitHub Pages ved push til `main`. I repoet velger du **Settings → Pages → Build and deployment → GitHub Actions**. Etter første vellykkede workflow blir nettstedet tilgjengelig på `https://jpn1981.github.io/ulefoss-spillet/`.

## Spillstatus

Den publiserte utgaven er statisk og kan spilles lokalt i én nettleser. Nettrom, synkronisert flerspiller og video er foreløpig deaktivert. Den tidligere nettutgaven brukte en serverfunksjon som ikke finnes her; GitHub Pages kjører ikke serverkode. En ny backend må velges og bygges før disse funksjonene kobles på igjen.

## Lokal forhåndsvisning

Kjør en enkel HTTP-server fra repo-roten:

```powershell
python -m http.server 8000 --directory site
```

Åpne <http://localhost:8000>.
