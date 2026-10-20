# SPEC.md: Howl (a dating app for dogs)

> Working name: **Howl**. The name lives in `src/config/app.config.js`, so it can be changed in one place.
> The name is short like the original and is what dogs do when they want attention. It is a parody remix of the Hinge-style dating app format. It must NOT use Hinge's actual name, logo, colours, fonts or copied assets.

This file is the single source of truth for Copilot. Read it fully before generating code. When a request conflicts with this file, follow this file and say so.

---

## 0. Hard constraints (never violate)

1. **No backend, no paid APIs, no paid services.** Everything runs in the browser. Persistence is `localStorage` only.
2. **No AI/LLM calls at runtime.** Chat and likes are scripted and rule-based.
3. **No webcam or in-app profile photo uploads.** The user picks photos from the bundled gallery; developers can add dog photos to `src/data/dogPhotos/<breed-id>/<dog-id>/`.
4. **All content is data-driven.** Dogs, prompts, chat lines and config live in JSON/JS data files, never hard-coded inside components. Adding a dog must require editing data only, with zero component changes.
5. **Deterministic behaviour.** Randomness uses a seeded RNG, so the same inputs give the same outputs after a refresh.
6. **Everything used must be listed in `CREDITS.md`.** Update it whenever an asset, library or dataset is added.
7. **Public, open-source libraries only.**

## 1. Tech stack

- Vite + React 18 + JavaScript (ES modules). Swap to TypeScript only if asked.
- Routing: `react-router-dom` with `BrowserRouter` (clean URLs). Deep links work on Vercel because of the rewrite rule in `vercel.json` (see section 14).
- State: React Context + `useReducer`, with a persistence layer to `localStorage`.
- Styling: plain CSS with design tokens as CSS variables (`src/styles/tokens.css`). No UI framework.
- Swipe gestures: `framer-motion` (MIT) or plain pointer events. Keep it optional.
- Hosting: **Vercel** (static deployment of the Vite build). No serverless functions, no database, no environment variables, no Vercel paid features. The free Hobby plan must be enough.

## 2. Folder structure

```
src/
  config/
    app.config.js          # app name, tagline, limits (bones per session, etc.)
    traits.config.js       # trait names, ranges, weights used by matching
    voices.config.js       # list of chat voices and their typing speeds
  data/
    dogs/                  # ONE FILE PER DOG: biscuit.json, mochi.json ...
      index.js             # auto-collects all dog files (import.meta.glob)
    dogPhotos/             # optional photos grouped by breed ID, then dog ID
    prompts.json           # pool of prompt questions for profiles
    breeds.json            # breed list + gallery image paths
    chat/
      voices/              # one file per voice: enthusiastic.json, chill.json ...
      keywords.json        # keyword → topic mapping (ball, walk, treat, cat ...)
      barkdict.json        # words → bark syllables for "bark translation"
    likeTemplates.json     # like-comment templates per voice
  engine/
    rng.js                 # seeded random (mulberry32) + hash(string) helper
    matching.js            # compatibility(), likeBack()
    likes.js               # inbound like scheduler, like comment generator
    chat.js                # reply selection, typing delay, bark translation
    time.js                # injectable clock (for delayed events and tests)
  state/
    store.js               # reducer, actions, selectors
    persistence.js         # load/save/migrate (versioned) localStorage
  components/              # reusable UI only (see section 5)
  screens/                 # route-level screens (see section 4)
  styles/
    tokens.css
    base.css
public/assets/
  dogs/                    # bundled photos: <breed>_<n>.jpg
  icons/
vercel.json                # SPA rewrite rule (section 14)
index.html                # title, meta, favicon, OG tags
CREDITS.md
SPEC.md
README.md
```

**Rule:** `engine/` is pure JavaScript with no React imports and no DOM access. Components call the engine through the store. This keeps logic testable and easy to extend.

## 3. Data models

All IDs are lowercase slugs. All files are validated at load time by `validateDog()` / `validateProfile()` (throw a clear console error naming the file and field).

### 3.1 Dog (one JSON file per dog, in `src/data/dogs/`)

```json
{
  "id": "biscuit",
  "name": "Biscuit",
  "ageDogYears": 4,
  "heightPaws": 6,
  "breed": "golden-retriever",
  "sizeLabel": "Large",
  "location": "Koramangala Dog Park",
  "photos": ["/assets/dogs/golden-retriever_1.jpg", "/assets/dogs/golden-retriever_2.jpg"],
  "prompts": [
    { "promptId": "irrational-fear", "answer": "The mailman. He comes every day. Why." },
    { "promptId": "win-me-over", "answer": "A tennis ball. Any tennis ball." }
  ],
  "traits": { "energy": 9, "sociability": 10, "pickiness": 2, "playfulness": 9 },
  "likes": ["fetch", "tennis-ball", "swimming"],
  "dislikes": ["vacuum", "cats", "baths"],
  "lookingFor": "fetch-partner",
  "voice": "enthusiastic",
  "behavior": {
    "likesYouFirst": false,
    "sendsBone": false,
    "replySpeed": "fast"
  },
  "verified": true
}
```

- `traits` keys must exist in `traits.config.js`. Values are integers 1-10.
- `likes` / `dislikes` come from a shared vocabulary in `src/data/interests.json`. Using an unknown tag logs a warning.
- `behavior` lets a dog be a special case (e.g. `likesYouFirst: true` puts it in Likes You at the start).
- `voice` must match a file in `data/chat/voices/`.

### 3.2 User profile (stored in `localStorage`)

```json
{
  "id": "me",
  "name": "Mochi",
  "ageDogYears": 3,
  "heightPaws": 4,
  "breed": "shiba-inu",
  "photos": ["/assets/dogs/shiba-inu_1.jpg", "/assets/dogs/shiba-inu_4.jpg"],
  "prompts": [{ "promptId": "irrational-fear", "answer": "The vacuum." }],
  "traits": { "energy": 7, "sociability": 6, "pickiness": 4, "playfulness": 8 },
  "likes": ["naps", "fetch"],
  "dislikes": ["vacuum"],
  "lookingFor": "long-walks"
}
```

Same shape as a Dog, minus `voice` and `behavior`. The user has no uploads: photos are chosen from the bundled gallery.

### 3.3 App state (persisted, versioned)

```json
{
  "version": 1,
  "profile": null,
  "swipes": { "biscuit": { "action": "like", "bone": false, "at": 1760000000000 } },
  "matches": { "biscuit": { "matchedAt": 1760000100000, "source": "swipe" } },
  "inboundLikes": { "mochi-2": { "status": "pending", "comment": "...", "targetRef": "photo:0", "bone": true, "arrivesAt": 1760000000000 } },
  "chats": { "biscuit": [ { "id": "m1", "from": "dog", "text": "...", "bark": "...", "at": 1760000200000 } ] },
  "bones": { "remaining": 1, "resetAt": 0 },
  "seenIds": ["biscuit"],
  "settings": { "barkTranslateDefault": false }
}
```

`persistence.js` must support migrations: if `version` is lower than current, run a `migrate()` function instead of wiping data.

## 4. Screens and routes

Mobile-first (design width 390px), centred on desktop with a phone-sized frame (max-width 430px).

| Route | Screen | Purpose |
|---|---|---|
| `/welcome` | Welcome | Logo, tagline, "Get started" button. |
| `/onboarding` | Onboarding (multi-step) | Build the profile (see 4.1). Only shown if no profile exists. |
| `/discover` | Discover | Card stack of dogs to like or pass. Default tab. |
| `/standouts` | Standouts | Full-screen swipeable featured dog profiles, ranked by sniff compatibility; send a Bone to show interest. |
| `/likes` | Likes You | Dogs that already liked you, with Bones highlighted at the top. |
| `/matches` | Matches | Matched dogs list + chat previews. |
| `/chat/:dogId` | Chat | Conversation with a matched dog. |
| `/dog/:dogId` | Dog Profile | Full read-only profile view (reusable from every screen). |
| `/me` | My Profile | View/edit the user's own profile. |

Bottom tab bar (persistent, 5 tabs): **Discover, Standouts, Likes You (badge count), Matches (badge for unread), Me**.

### 4.1 Onboarding steps (each step is a small component, driven by an array so steps can be added or reordered)

1. **Name**: "What's your good boy/girl name?"
2. **Age**: in dog years (slider or stepper).
3. **Breed**: grid of breeds from `breeds.json`.
4. **Photos**: gallery of images for the chosen breed. Pick 3-6. Show a counter. First pick is the main photo.
5. **Vibe**: sliders for each trait in `traits.config.js`.
6. **Interests**: multi-select chips from `interests.json` for likes; second set for dealbreakers.
7. **Looking for**: single select (playdates / long walks / fetch partner / treat-sharing).
8. **Prompts**: choose 3 from `prompts.json` and answer each (max 120 chars).
9. **Preview**: shows the finished profile card, then "Start sniffing" button.

Progress bar at the top. Back button on every step. Validate each step before allowing Next. Layout per 6.1: one large serif question per screen, one input, and a circular arrow button at the bottom-right to continue (disabled until valid).

### 4.2 Discover

- One dog profile at a time, as a **single vertical scrolling feed** (see 6.1): large photo with name overlaid, then prompt cards and further photos interleaved, then a "vitals" row (age, height in paws, breed, looking for).
- Every photo and prompt block has a round **heart button** in its bottom-right corner. Tapping it opens a bottom sheet with a comment field, a **Send like** button, and a **Send a Bone instead** button (shows remaining count).
- A floating round **Pass (X)** button sits at the bottom-left of the screen and stays visible while scrolling. Passing animates to the next dog.
- There is no swipe gesture and no bottom Like button. The feed is the interaction.
- Dogs already swiped are never shown again (`seenIds`).
- Empty state: "You've sniffed everyone nearby. Check back later."
- Order: by `compatibility()` descending with a small seeded shuffle. Placed in `engine/matching.js` as `rankForDiscover()`.

### 4.3 Match moment

Full-screen overlay: both photos, "It's a Match!" text, and two buttons: **Send a message** and **Keep sniffing**. Triggered from any source (swipe, liking back from Likes You).

### 4.4 Likes You

- Section 1 "Bones": dogs who sent a Bone, gold border.
- Section 2 "Likes": the rest. Each row shows photo, name, and the **comment** they left on your photo or prompt.
- Tapping opens the dog profile with **Like back** and **Pass** actions. Like back creates a match immediately.

### 4.5 Matches

List of matches sorted by latest message. Each row: avatar, name, last message preview (translated or barked depending on the setting), unread dot. Top row of "New matches" as horizontal avatars (no messages yet).

### 4.6 Chat

- Header: avatar, name, back button, profile link.
- Messages in bubbles. Dog messages show **bark text by default**, with a **Translate** button on each bubble (and a global toggle in settings) that reveals the real text.
- Typing indicator ("Biscuit is typing...") before each dog message.
- Input bar with send button. A row of 3 quick-reply chips generated from the last topic.
- Dog sends the first message after a match (once, delayed).

### 4.7 My Profile

Shows the user's profile as other dogs see it. Edit button reuses the onboarding steps in edit mode. Settings section: bark-translate default, "Reset app data" (confirm dialog).

## 5. Reusable components (build once, reuse everywhere)

`ProfileFeed`, `PhotoBlock`, `PromptBlock`, `VitalsRow`, `HeartButton`, `PassButton`, `LikeSheet`, `BoneButton`, `TabBar`, `MatchOverlay`, `Chip`, `ChipGroup`, `Slider`, `TraitMeter`, `ChatBubble`, `TypingIndicator`, `Avatar`, `Badge`, `EmptyState`, `Sheet` (bottom sheet), `ProgressBar`, `StepShell`.

Each component takes plain props, has no direct `localStorage` access, and reads global state only via hooks in `state/store.js`.

## 6. Design tokens (`tokens.css`)

Use these variables everywhere. No hard-coded colours or font sizes in components.

```
--color-bg: #FFFFFF;
--color-surface: #F5F3EF;      /* prompt cards, input fields */
--color-ink: #111111;
--color-muted: #6B6B6B;
--color-line: #E6E2DB;
--color-primary: #111111;      /* black primary buttons */
--color-on-primary: #FFFFFF;
--color-bone: #4B2A8A;         /* deep violet for Bones */
--color-bone-soft: #EFE9FA;
--color-match: #4B2A8A;
--radius-card: 16px;
--radius-button: 999px;
--shadow-float: 0 4px 16px rgba(0,0,0,0.18);   /* floating X / heart buttons */
--font-display: "Newsreader", Georgia, serif;
--font-body: "DM Sans", system-ui, sans-serif;
```

Fonts must be open licence (Google Fonts / OFL) and credited. Support `prefers-color-scheme: dark` by redefining the tokens. Minimum tap target 44px. All images need `alt` text.

### 6.1 Visual language: a Hinge-style UX, built from original assets

The goal is that someone who knows Hinge recognises the **layout and interaction patterns** immediately. Build these patterns:

- **Overall feel:** minimal, lots of white space, almost no colour except one accent. Black pill buttons, soft off-white cards, thin dividers.
- **Typography:** large serif headings for questions and prompt answers, small grey sans-serif for labels. Prompt cards show the question as a small muted label and the answer in large serif text.
- **Profile feed:** full-width photos with rounded corners, prompt cards between photos, content scrolls vertically in one column. Name and age overlay the first photo at the bottom-left.
- **Heart button:** a white circle with a dark heart icon, bottom-right of each photo and prompt, with a soft shadow.
- **Pass button:** a white circle with an X, floating at the bottom-left.
- **Like sheet:** slides up from the bottom, shows the item being liked, a comment input, and one primary black "Send like" button.
- **Bone (the Rose equivalent):** violet circular button with the bone icon, with a small count badge. Sent Bones glow with `--color-bone-soft` in Likes You.
- **Tab bar:** icon-only tabs with a small dot or number badge, thin top border, active icon filled and inactive icons outlined.
- **Onboarding:** one large serif question per screen, one input, progress bar at the top, circular black arrow button bottom-right.
- **Likes You:** a grid or list of cards with the dog photo, first name and the comment they sent.
- **Chat:** simple bubbles, user in black with white text, dog in `--color-surface`, rounded corners, timestamp on tap.
- **Match screen:** both photos large and slightly overlapping, big serif "It's a match" text, and two buttons.

### 6.2 What must stay original (non-negotiable)

Matching how it looks and behaves is fine for a parody. These must **not** be copied:

- The Hinge name, logo, wordmark, icons and app-store imagery.
- Hinge's licensed typefaces. Use the open-licence fonts listed above.
- Any screenshot, image or asset from the Hinge app or website. Draw icons yourself or use an open-licence set (e.g. Lucide, ISC) and credit it.
- Hinge's exact brand colour values. Use the tokens above.

This is also what keeps the project a *remix* under the hackathon rules. The dog-specific features in section 9 (bark translation, Sniff Test, Bones, Date Planner) are what make it more than a reskin, so they must be built, not skipped.

## 7. Engines (pure logic, in `src/engine/`)

### 7.1 `rng.js`

- `hash(str) → uint32`
- `seeded(seedString) → () => float [0,1)` (mulberry32)
- `pick(rng, array)`, `chance(rng, p)`

### 7.2 `matching.js`

```
compatibility(profile, dog) → { score: 0..100, breakdown: {...}, sharedLikes: [...], clashes: [...] }
likeBack(profile, dog, { bone }) → { willMatch: boolean, delayMs: number, probability: number }
rankForDiscover(profile, dogs, seenIds) → Dog[]
sniffScore(profile, dog) → integer for UI display ("92% sniff match")
```

Rules (all weights come from `traits.config.js`, so they can be tuned without code changes):

- Base 50.
- +10 per shared like. −25 per clash (user's like is in the dog's dislikes, or the reverse).
- Trait distance penalty: weight × |difference|, per trait.
- Pickiness penalty on the dog's side.
- `lookingFor` match: +8.
- Probability = clamp(score / 100 + (bone ? 0.25 : 0), 0.05, 0.95).
- Outcome uses `seeded(profile.id + dog.id + "match")`, so the same pair always gives the same result.
- `delayMs`: 0 for instant match when probability > 0.8, otherwise seeded between 5,000 and 30,000. `behavior.replySpeed` scales it.

### 7.3 `likes.js`

```
initialInbound(profile, dogs) → inboundLikes   // dogs with likesYouFirst + top-N by compatibility
scheduleInbound(state, now) → events[]         // new inbound likes arriving over time
generateLikeComment(dog, profile) → { text, targetRef }
```

- At first launch, seed 5-6 inbound likes (2 of them with Bones).
- While the app is open, one new inbound like arrives every 60-120 seconds (seeded), up to a cap from `app.config.js`.
- A dog's like comment targets one of the user's photos or prompts, filled from `likeTemplates.json` by the dog's `voice`.
- Inbound likes that arrive while the app is closed are computed from timestamps on next open (`arrivesAt <= now`), so no timers need to survive a refresh.

### 7.4 `chat.js`

```
openingMessage(dog, profile) → string
selectReply(dog, profile, userText, history) → { text, topic }
typingDelayMs(dog, text) → number                 // 1000-3000, scaled by voice
toBark(text, barkDict, rng) → string              // "Woof woof arf!!"
suggestReplies(history, dog) → string[3]
```

Reply selection order:
1. Detect topic via `keywords.json` (ball, walk, treat, park, cat, name, vet, bath, food, love...).
2. Look in the dog's voice file `responses[topic]` and pick one using the seeded RNG (seed includes message index).
3. If the topic matches one of the dog's `dislikes`, use `reactions.dislike`; if it matches one of `likes`, use `reactions.like`.
4. Fallback to the voice's `fallbacks[]` (e.g. "Sorry, I got distracted by a squirrel.").
5. Never repeat the same line twice in a row.

### 7.5 Voice file format (`data/chat/voices/<voice>.json`)

```json
{
  "id": "enthusiastic",
  "typingSpeed": 1.2,
  "openers": ["HI HI HI you're the best thing I've seen all day!!"],
  "responses": {
    "ball": ["BALL?? Where?? Is there a ball??"],
    "walk": ["Did you say WALK"]
  },
  "reactions": { "like": ["Oh I LOVE {topic}!!"], "dislike": ["Ugh, {topic}. Let's not."] },
  "fallbacks": ["Sorry, I got distracted by a squirrel."],
  "likeComments": ["I ALSO love {item}!!! can we go right now"]
}
```

Adding a new voice means adding one file and nothing else.

## 8. Bones (the Rose equivalent)

- The user gets 1 Bone per session period (`app.config.js: bonesPerPeriod`, `periodHours`).
- Sending a Bone: gold animation, and the dog's like-back probability gets +0.25.
- Dogs can send Bones too (see 7.3), and they appear first in Likes You.
- If 0 Bones remain, the Bone button is disabled with a "Next Bone in Xh" tooltip.

## 9. Dog-specific twists (these are what make it a remix, not a reskin)

Implement in this order; each is a self-contained feature:

1. **Bark translation** in chat (section 4.6, 7.4).
2. **Sniff Test score** on every card, from `sniffScore()`.
3. **Dealbreaker tags** shown in red on profiles (cats, vacuum, baths).
4. **Date Planner** after a match: choose park / beach / vet waiting room, and the dog replies in its voice.
5. **Height in paws** and **age in dog years** everywhere.

## 10. Accessibility and quality bar

- Keyboard-operable: all actions reachable without a pointer. Swipe is optional.
- Visible focus states. Semantic HTML. Alt text on all photos.
- No console errors. Data validation messages must name the file.
- Works at 360px width and on desktop. Tested in a fresh browser profile (empty `localStorage`).

## 11. How to extend (prompts to give Copilot)

Use these exact patterns. Each one should touch only the listed files.

**Add dogs**
> "Read SPEC.md section 3.1. Create 10 new dog files in `src/data/dogs/` with varied breeds, voices, traits and funny prompt answers. Use only interests from `interests.json` and photos from `public/assets/dogs/`. Do not modify any component."

**Add a chat voice**
> "Read SPEC.md section 7.5. Add a new voice file `grumpy.json` in `src/data/chat/voices/` with openers, responses for every topic in `keywords.json`, reactions and fallbacks. Do not change `chat.js`."

**Implement matching**
> "Implement `src/engine/matching.js` exactly as in SPEC.md 7.2, using weights from `traits.config.js` and the seeded RNG. Add unit tests for same-pair determinism, bone boost and clamp limits."

**Implement inbound likes**
> "Implement `src/engine/likes.js` per SPEC.md 7.3 and wire it into the store so Likes You updates over time and on app open."

**Implement chat**
> "Implement `src/engine/chat.js` per SPEC.md 7.4 and build the Chat screen per 4.6, including typing indicator and per-bubble bark translation."

**Add an interest or trait**
> "Add the trait `<name>` to `traits.config.js` with a weight. Update the onboarding Vibe step to render it automatically. Do not hard-code it anywhere else."

## 12. Build order (do one phase per Copilot session, commit after each)

1. **Scaffold**: Vite + React + router, tokens, tab bar, empty screens, `CREDITS.md`, `vercel.json`. **Deploy to Vercel now** (section 14) and keep every later phase deployable.
2. **Data layer**: `rng.js`, `persistence.js`, `store.js`, dog loader and validators, 8 sample dogs.
3. **Onboarding + My Profile**: full flow with gallery photo picker.
4. **Discover**: card stack, action bar, seen tracking.
5. **Matching engine + match overlay + Matches list**.
6. **Likes You + inbound like scheduler + Bones**.
7. **Chat**: voices, keyword replies, typing delay, bark translation.
8. **Twists**: sniff score, date planner, dealbreaker tags.
9. **Polish**: dark mode, empty states, a11y pass, add more dogs (target 25-30).
10. **Ship**: README (original linked, what changed, why), `CREDITS.md`, final Vercel production deploy, run the section 14 checklist in incognito.

## 13. Definition of done

- [ ] A new user can complete onboarding and reach Discover with no uploads.
- [ ] Liking a dog can produce an instant match, a delayed match, or no match, deterministically.
- [ ] Likes You shows dogs with comments and Bones, and liking back creates a match.
- [ ] Chat works with every voice, includes typing indicator and bark translation.
- [ ] Refreshing keeps all state. "Reset app data" clears it.
- [ ] Adding a dog or voice needs only a data file.
- [ ] No Hinge branding anywhere. All credits are listed.
- [ ] Deployed on Vercel (production URL), loads in a fresh incognito window, and deep links like `/matches` and `/chat/biscuit` work on refresh.

## 14. Deployment (Vercel)

The app is a static single-page app. Vercel builds it with Vite and serves the `dist/` folder.

### 14.1 Project settings

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Environment variables | None. Do not add any. |
| Node version | 20.x or newer |

### 14.2 `vercel.json` (required so refreshing `/matches` or `/chat/biscuit` does not 404)

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Vercel serves real files in `public/` (images, icons) before applying the rewrite, so `/assets/dogs/...` paths keep working.

### 14.3 Rules for Copilot

- Use **absolute paths from the site root** for bundled images (`/assets/dogs/golden-retriever_1.jpg`). Never use `localhost` URLs or paths with `public/` in them.
- Keep `vite.config.js` with the default `base: "/"`. Do not set a sub-path base.
- Do not add `/api` routes, serverless functions, Edge config or any Vercel add-on.
- Keep total bundled images small: compress to roughly 100-200 KB each, max width 800px, so the app loads fast on mobile data. Prefer `.webp` or optimised `.jpg`.
- `index.html` must include: `<title>`, meta description, `theme-color` (matching `--color-bg`), viewport meta, a favicon, and Open Graph tags (`og:title`, `og:description`, `og:image`) so the shared link shows a preview.
- Add a 404 fallback route in the router that shows a friendly "This dog ran off" screen with a link back to Discover.
- The production build must have no console errors and no missing-asset 404s (check the browser Network tab).

### 14.4 Deploy workflow

1. Push the repo to GitHub (public, so judges can view the code).
2. In Vercel: **Add New > Project**, import the repo, accept the Vite preset, and deploy.
3. Every push to `main` redeploys automatically. Pushes to other branches create preview URLs, which are useful for testing a risky change without breaking production.
4. If a deploy breaks, use **Deployments > Promote / Instant Rollback** on the last good deployment.
5. Do the first deploy in phase 1 with the empty scaffold. Deployment problems are much easier to fix at hour 1 than at hour 16.

### 14.5 Pre-submission checklist (run on the production URL)

- [ ] Open in an incognito window: onboarding works from a clean state.
- [ ] Refresh on `/discover`, `/matches`, `/likes`, `/me` and `/chat/<any matched dog>`: no 404.
- [ ] Test on a real phone (or the browser's mobile emulator at 360px and 390px).
- [ ] Network tab shows no failed requests.
- [ ] Share the link and check the Open Graph preview.
- [ ] The README contains the live Vercel URL and the repo URL.
- [ ] Deploy is complete before the submission deadline, with a buffer for a rollback.