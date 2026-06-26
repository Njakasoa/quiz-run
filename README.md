# quiz-run

**Quiz Run** — un jeu de course multijoueur où chaque joueur avance sur un
parcours en répondant à des questions. Réponds vite + réponds juste = avance.
Pour **quiz.njakasoa.xyz**, dans la constellation `*.njakasoa.xyz`.

Premier thème : **Classique — famille, amis & école** (dès 7 ans, questions
simples, fun, safe).

## État (MVP — scaffold + lobby + boucle quiz)

- **Menu** : pseudo, créer une partie, rejoindre avec un code, thème.
- **Salon** : code partageable, liste des joueurs, l'hôte lance.
- **Partie** : questions QCM, timer, feedback bonne/mauvaise réponse + explication,
  parcours (cases) qui avance, classement de fin.
- **Multijoueur server-authoritatif** : toute la logique (choix des questions,
  validation, score) vit dans **core-api** (`/quiz/rt`). La bonne réponse n'est
  jamais envoyée au navigateur avant le *reveal* — pas de triche par inspection JS.

Prochain jalon : parcours animé PixiJS (plateformes, sauts, confettis), mode
coop/école, pack de 100 questions, rematch en room.

## Stack

Vite + TypeScript, UI DOM/CSS (pas de moteur lourd pour le MVP). Le client ne
contient **aucune** réponse — il reçoit les questions et envoie les choix.

## Développer

```bash
bun install        # ou npm install
bun run dev        # http://localhost:5173
bun run build      # type-check + bundle → dist/
```

Pour pointer vers un core-api local : `VITE_API_BASE=http://localhost:3000 bun run dev`.

## Déploiement (Cloudflare Pages)

Connecter le repo une fois dans le dashboard, puis chaque push sur `main` redéploie :

- **Framework preset** : Vite
- **Build command** : `bun run build` (ou `npm run build`)
- **Build output** : `dist`
- **Domaine custom** : `quiz.njakasoa.xyz`

`public/_headers` porte la CSP (autorise `https://api.njakasoa.xyz` +
`wss://api.njakasoa.xyz`).

> Backend : le gateway quiz vit dans **core-api** (`src/games/quiz/`). L'origine
> `https://quiz.njakasoa.xyz` doit figurer dans `CORS_ORIGINS` du `.env` du VPS
> (le fetch `POST /v1/auth/guest` est cross-origin).
