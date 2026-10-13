# KanaPet — Memory Dump / Resume Playbook (WEB DEPLOY repo)
> Written 2026-10-13. Read this FIRST to resume work on the deployed web app.
> The main project resume file is `~/Downloads/kana/project details/SESSION_MEMORY.md`
> (currently STALE — stops at v1.14; this file is more up to date for v1.15+).

---

## 1. Identity
- **Project:** KanaPet — kana (hiragana/katakana) learning app.
  Vanilla HTML/CSS/JS. Native build = Capacitor 6 for Android (`com.kanapet.app`).
  This folder = the **web deploy**.
- **User:** Nahid. Prompts in English (simple), replies in English.

## 2. What is LIVE right now
- **Live URL:** https://nahid77777771-maker.github.io/kana-pet/  (HTTP 200, live)
- **Live version shown:** KanaPet **v1.15** (footer, from i18n.js)
- **Host:** GitHub Pages (`.nojekyll` present).

## 3. This git repo
- Remote: `https://github.com/nahid77777771-maker/kana-pet.git` (origin)
- Branch: `main`, clean, up to date with origin/main
- Last commit: `879754e` "KanaPet web version — initial deploy" (2026-10-13 19:50)
- Deploy method: GitHub Pages serves `main` branch root.

## 4. Folder layout (whole project)
```
~/Downloads/kana/                      (NOT a git repo itself)
├── policy.txt                         PROJECT RULES (read first)
├── project details/
│   ├── CHANGE_HISTORY.md              prompts VERBATIM + changes (up to v1.14 only)
│   └── SESSION_MEMORY.md              resume playbook (STALE at v1.14)
├── project files/
│   ├── apk/                           KanaPet-v1.7.apk ... v1.17.apk
│   └── kanapet/                       app source (@WORKING dir)
│       ├── VERSION                    = 1.18
│       ├── env.sh  build-apk.sh  BUILD.md
│       ├── www/                       the web/app source (edit here)
│       └── android/                   Capacitor android project
└── web-deploy/                        ***THIS GIT REPO — deployed & live***
    ├── index.html                     == kanapet/www/web-version.html  (web page)
    ├── app-shell.html                 == kanapet/www/index.html        (Capacitor shell copy)
    ├── css/  js/                      identical to kanapet/www
    ├── .nojekyll
    ├── DEPLOY_INFO.txt                deploy facts snapshot
    └── MEMORY_DUMP.md                 THIS FILE
```

## 5. How `web-deploy` relates to source (IMPORTANT)
`web-deploy` is a **byte-identical copy** of `project files/kanapet/www`, with the
two HTML wrappers renamed:
| web-deploy file | source file |
|---|---|
| `index.html`     | `project files/kanapet/www/web-version.html` |
| `app-shell.html` | `project files/kanapet/www/index.html` |
`css/` and `js/` are the same files.

**To redeploy the web after editing source:**
```bash
cd ~/Downloads/kana
cp "project files/kanapet/www/web-version.html" web-deploy/index.html
cp "project files/kanapet/www/index.html"        web-deploy/app-shell.html
cp -r "project files/kanapet/www/css/." web-deploy/css/
cp -r "project files/kanapet/www/js/."  web-deploy/js/
cd web-deploy
git add -A && git commit -m "Web deploy vX.Y" && git push origin main
# GitHub Pages updates automatically (may take ~1 min).
```

## 6. Version state (UPDATED with v1.18 deploy — all in sync)
| Where | Version |
|---|---|
| Source `project files/kanapet/VERSION` | **1.19** (next APK build) |
| APKs shipped (`project files/apk/`) | up to **v1.18** |
| Live web page (i18n.js) | **v1.18** (footer, en+bn) |
| Capacitor shell footer | v1.18 (now from i18n.js, same as web) |
- **v1.18 = mic/voice-recognition REMOVED + sound on every letter added.**
  APK `index.html` and web `web-version.html` are now identical except title+viewport.
- Web version string is in `www/js/i18n.js` `kanaPetVersion` (en + bn).

## 7. App architecture (what lives where) — source in `project files/kanapet/www`
- `index.html` / `web-version.html` — 4 tabs: Learn / Review / Progress / Profile.
  Script load order (web-version.html): `n5words.js` → `data.js` → `pet.js` →
  `translations_bn.js` → `app.js` (n5words MUST be before data.js).
- `js/n5words.js` — `window.N5READ_WORDS`, 743 rows `[kana, romaji, meaning]`
  (arrays A/B/C). Loads BEFORE data.js.
- `js/data.js` — builds `window.KANA.ALL` = 208 basic + 41 N5 + 30 N4 + 743 n5read
  = **1022 cards**. `buildReading(rows, group)`.
- `js/app.js` — sessions, 3-tier voice, `fitKana()/fitRomaji()` auto-size, swipe/flip,
  XP/levels, localStorage `kanapet_v1`. Registers i18n/onboard/charts.
- `js/pet.js` + `css/style.css` — pet "Mochi" (Learn-tab only) + `Pet.react()` 10
  tap reactions + particle FX + speech bubble.
- **NEW since v1.14 (not yet in CHANGE_HISTORY):**
  - `js/i18n.js` — full i18n system (English + Bangla), key→string table.
  - `js/translations_bn.js` — `window.MEANINGS_BN` Bangla word meanings map.
  - `js/onboard.js` — first-run language-select modal (`#onboard-modal`),
    stores `kanapet_onboarded` + `kanapet_lang` in localStorage.
  - `js/charts.js` + `css/charts.css` — "All Kana Charts" screen (Profile tab),
    with filter chips (All/Hiragana/Katakana/Monographs/Ten-ten/Handakuten/Yōon)
    and a search box + clear.
- `patches/SpeechRecognition.java` — re-applied by build-apk.sh (offline recognizer).

## 8. Build workflows
### Android APK (offline-capable native build)
```bash
cd ~/Downloads/kana/"project files"/kanapet
source env.sh          # ANDROID_HOME=~/Android/Sdk, JAVA_HOME=/usr/lib/jvm/java-17-openjdk
./build-apk.sh         # reads VERSION, cap sync, gradlew assembleDebug,
                       # copies APK to ../apk/KanaPet-v<ver>.apk, bumps VERSION
```
- JDK 17 required (system JDK is 26 → Gradle 8 fails). Incremental ~5–18 s.
- `./build-apk.sh 2.0` builds explicit version. NEVER raw gradle.
### Web deploy
- See step 5 above. There is **no** web-deploy script in build-apk.sh — do it manually.

## 9. Version history (deliverables)
| Ver | What |
|---|---|
| v1.7 | Stop-session button + confirm modal |
| v1.8/v1.9 | Voice-recognition overhaul (3-tier) + OFFLINE mode |
| v1.10 | N5 reading test, 70 words |
| v1.11 | Full N5 reading "book" — 743 kana-only words |
| v1.12 | Learn-tab card auto-fit + 2-row button layout |
| v1.13 | Ten-ten & maru split into 4 per-script sets |
| v1.14 | Tap-pet reactions (10) + pet on Learn tab only |
| v1.15 | i18n (en/bn) + onboarding + kana charts + web deploy |
| v1.16–v1.17 | incremental fixes |
| v1.18 | **REMOVED mic/voice recognition; sound on every letter; HTML resynced** |
| v1.19 | (next / pending) |

## 10. Gotchas
- `git clone github.com` and `git ls-remote` HANG on this machine. `git push`
  may also be slow — allow a long timeout / retry.
- Quote paths with spaces: `"project files"`.
- `data.js` assert: `ALL.length === 279 + N5READ_TOTAL` — update if N5 data changes.
- Keep prompts verbatim in CHANGE_HISTORY (policy Rule 1).
- Syntax check before build:
  `node --check www/js/app.js` etc. Data check:
  `node -e "global.window={};require('./js/n5words.js');require('./js/data.js');console.log(window.KANA.ALL.length)"`
- Social preview / version string: update BOTH en+bn `kanaPetVersion` in i18n.js.

## 11. Open items / typical next moves
- [x] **Redeploy web so live page reflects current source** (DONE v1.18 — live = source).
- [x] Bump `kanaPetVersion` (en+bn) in i18n.js (v1.18).
- [x] Backfill `CHANGE_HISTORY.md` + refresh `project details/SESSION_MEMORY.md`
      (were stale at v1.14).
- [x] Remove mic/voice-recognition; add sound-on-every-letter (tap-to-hear TTS).
- [ ] (optional) Strip unused speech-recognition Capacitor plugin + patch file.
- [ ] Candidate features: more reading lists (N4 vocab → kana), per-set mastery
      stars, ios home-screen PWA support (apple-touch-icon + manifest), tablet layout.

## 12. Resume in one line
Read this file + `project details/SESSION_MEMORY.md`; source lives in
`project files/kanapet/www`; deploy by copying into this repo and pushing to
`origin main`; live at https://nahid77777771-maker.github.io/kana-pet/.
