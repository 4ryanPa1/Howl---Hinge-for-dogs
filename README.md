# Howl

**For dogs tired of talking to their humans.** Howl is a browser-only dating-app parody for dogs,
built as a solo hackathon project. It uses original illustrated dog artwork and
dog-specific features: deterministic matching, Bones, a Sniff Test score,
swipeable Standouts profiles, a scripted bark-translation chat, and a date planner.

## Remix choices

The app keeps a profile-first, prompt-led way to meet people, but makes every
interaction dog-specific: dog-year ages, sniff compatibility,
height in paws, Bones, featured Standouts profiles, scripted bark translation,
and park-date planning. The artwork, prompt answers, and chat dialogue are original project material.
Discover cycles through the bundled dog profiles after each has been seen.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Create a production build with `npm run build`; preview it locally with
`npm run preview`. No environment variables, backend, account, or external API
are needed. All profile and app state stays in this browser's `localStorage`.
Use **Me → Reset app data** to start over.

## Project structure

- `src/config/` — app settings, matching traits, and supported chat voices.
- `src/data/` — dog profiles, breeds, prompts, interests, and scripted chat data.
- `src/engine/` — pure deterministic matching, likes, chat, and RNG logic.
- `src/state/` — reducer-based app state and versioned `localStorage` persistence.
- `src/components/` — reusable interface elements; `src/App.jsx` contains routes
  and screen composition.
- `public/assets/` — original bundled SVG illustrations, favicon, and share card.

Dog profiles are one JSON file each in `src/data/dogs/`; adding a compatible dog
does not require changing a screen. Credits and licences are tracked in
[CREDITS.md](./CREDITS.md).

Add six dog photos to `src/data/dogPhotos/<breed-id>/<dog-id>/` for each
generated profile. Howl deterministically randomizes each dog's photo order and
prompt suggestions, so assignments stay stable across reloads. See
[the photo library guide](./src/data/dogPhotos/README.md) for supported formats
and folder naming.

## Deployment

The Vite app is configured for static deployment on Vercel. The SPA rewrite is
in `vercel.json`, so nested routes can be refreshed. The production app is
available at [howl-dog-dating.vercel.app](https://howl-dog-dating.vercel.app).
