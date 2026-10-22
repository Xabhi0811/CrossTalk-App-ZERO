# CrossTalk — different words, same argument

> **ZERO Build Challenge Submission**  
> *"Two people who don't share a single language need to have an argument. A real one: interrupting each other, getting heated, changing their minds. Build the thing that lets them. Work alone. Use whatever tools you like."*

---

## 1. Project Overview & Product Objective

Most translation tools are built for polite transactions: ordering food, booking trains, or asking for directions. But real relationships and disagreements are messy: people talk over one another, cut each other off, escalate their tone, and sometimes back down and change their minds.

**CrossTalk** is a real-time, peer-to-peer web application designed specifically for disagreements across languages. Rather than treating speech like a static translation form, CrossTalk makes the *rhythm* of an argument visible and functional:

- **Turn-taking & Interruptions:** When a participant cuts in, ongoing translated speech playback cuts off immediately, and an interruption event is stamped into the timeline.
- **Changing Your Mind:** A dedicated concession workflow allows participants to specify what statement they are reconsidering, compose a revised position, and broadcast it to their partner with context in both languages.
- **Argument Heat Meter:** A dynamic argument-heat tracker moves up during sharp or heated exchanges and interruptions, and cools down when concessions are made.
- **Dual receipts:** Both participants always see the original statement and the translated equivalent side-by-side, preserving the unvarnished words if translation fails.

---

## 2. Features Implemented

1. **Modular Architecture & Reliable Build System:** Clean separation of concerns with React components (`PersonPanel`, `SharedComponents`), service abstractions (`translation.js`, `peer.js`, `speech.js`), and centralized constants.
2. **WebRTC P2P Data Channels (PeerJS):** Direct peer-to-peer data channel between participants with multi-STUN server failover (Google & Cloudflare STUN) and exponential-backoff automatic reconnection.
3. **Turn-Based Speech & Audio Synthesis:**
   - Speech Recognition via Web Speech API with interim and final transcript streaming.
   - Text-to-Speech synthesis that matches the target participant's language and dynamically speeds up during heated moments.
   - Global sound mute toggle (`Voice on` / `Voice off`).
4. **Active Interruption Engine:**
   - Pressing **Interrupt** instantly cancels ongoing speech synthesis, halts active microphone listening, pulses the argument heat, logs a timeline event, and auto-focuses the input for immediate rebuttal.
5. **Full "I Changed My Mind" Concession Workflow:**
   - Opens a dedicated compose drawer referencing the earlier contested statement.
   - Translates and sends the revised position to the partner.
   - Renders a prominent concession card with original & translated revisions, referencing the earlier statement in each participant's native tongue.
   - Cools argument heat by -24%.
6. **Translation Layer & Error Resilience:**
   - MyMemory public translation API with built-in client-side rate limiting (1100ms throttle).
   - Direct translation delivery across P2P data channels to prevent redundant API quota consumption.
   - Full HTML entity decoder (`&#039;`, `&quot;`, `&amp;`, `&lt;`, `&gt;`, `&apos;`).
   - Graceful fallback: original message is never lost, labeled `ORIGINAL PRESERVED` with a 1-click **Retry** button.
7. **Interactive Demo Mode:**
   - Pre-scripted bilingual argument (Alex in English vs. Lucía in Spanish).
   - Replays escalation, an interruption, concessions, and resolution.
   - Includes **Play / Replay Argument**, **Reset**, and **Speak As A / B** toggles with clean timer teardown.
8. **Automated Unit Tests:**
   - Native `node:test` suite verifying constants, translation sanitization, speech fallbacks, and peer interfaces.

---

## 3. Technology Stack

- **Framework:** React 18
- **Build Tool:** Vite 6
- **Language:** Modern JavaScript (ES Modules, JSX)
- **Networking:** PeerJS 1.5 (WebRTC data channel with STUN failover)
- **Icons:** Lucide React (`lucide-react`)
- **Speech:** Web Speech API (`SpeechRecognition` & `SpeechSynthesisUtterance`)
- **Translation:** MyMemory Public API with rate limiting and entity decoding
- **Styling:** Vanilla CSS with dark editorial theme, custom typography, CSS grid/flexbox, and micro-animations
- **Test Runner:** Node.js native test runner (`node:test`, `node:assert/strict`)

---

## 4. Prerequisites

- **Node.js:** v18.0.0 or later (v20+ recommended)
- **npm:** v9.0.0 or later
- **Browser:** Google Chrome, Microsoft Edge, or Chromium-based browser (recommended for full Web Speech recognition support)

---

## 5. Installation Instructions

```bash
# Navigate to project directory
cd crosstalk-zero

# Install dependencies
npm install
```

---

## 6. Development & Production Commands

```bash
# Start local development server (with HMR)
npm run dev

# Run automated test suite
npm test

# Build for production (outputs to ./dist)
npm run build

# Preview production build locally
npm run preview
```

---

## 7. Translation Service Details

- **Provider:** MyMemory API (`https://api.mymemory.translated.net/get`)
- **Supported Languages:** English (en-US), Spanish (es-ES), Hindi (hi-IN), French (fr-FR), German (de-DE), Portuguese (pt-BR), Japanese (ja-JP), Arabic (ar-SA), Mandarin Chinese (zh-CN).
- **Rate Limit Handling:** The client enforces a 1100ms throttle between consecutive translation requests to avoid HTTP 429 rate limits.
- **P2P Direct Translation:** When Participant A sends a translated message, the translation is transmitted alongside the source text over the WebRTC channel. Participant B renders the pre-translated text instantly, cutting latency and eliminating redundant API requests.
- **Fallback & Retry:** If the translation service times out or fails, the original text is preserved and displayed with an `ORIGINAL PRESERVED` label and an active **Retry** button.

---

## 8. Room Creation and Joining Instructions

1. **Host (Participant A):**
   - Open CrossTalk.
   - Enter your name and select your language.
   - Select **Create a room (A)** and click **Create room**.
   - Copy the 5-character room code (e.g., `7KQ2M`) using the copy button in the top bar.
   - Share the code with your partner.
2. **Guest (Participant B):**
   - Open CrossTalk on another device or private browser window.
   - Enter your name and choose your preferred language.
   - Select **Join a room (B)**, enter the room code shared by Participant A, and click **Join conversation**.
3. **P2P Connected:**
   - Once connected, both sides see a green connection indicator.
   - Any message typed or spoken is translated into the partner's language in real time.

---

## 9. Browser and Microphone Requirements

- **Speech Recognition (`webkitSpeechRecognition`):** Requires Google Chrome, Microsoft Edge, or a supported Chromium browser. Safari and Firefox have limited or no native Web Speech recognition support; in unsupported browsers, the app gracefully disables mic input while keeping text messaging and speech synthesis fully functional.
- **Microphone Permissions:** Microphone access must be allowed in the browser prompt when clicking the mic icon. If microphone access is blocked or denied, a clear notification is shown and text messaging continues without interruption.
- **Speech Synthesis (`speechSynthesis`):** Supported across all major modern desktop and mobile browsers.

---

## 10. Deployment Instructions (Vercel & Netlify)

### Deploying to Vercel

1. Push your repository to GitHub or GitLab.
2. In the Vercel dashboard, click **Add New Project** and import the repository.
3. Configure the project settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. The included `vercel.json` ensures that single-page application routes redirect properly to `index.html`.
5. Deploy. The application will be live immediately without requiring private API keys or environment secrets.

---

## 11. Known Limitations

- **Text & Turn-Based Audio vs. Raw Audio Streaming:** CrossTalk is a text and turn-based voice prototype. Audio is recognized locally in the speaker's browser, converted to text, translated, sent across WebRTC, and synthesized on the receiver's device. It does not stream raw microphone audio over RTP.
- **Public Signaling Server:** CrossTalk uses PeerJS's public signaling infrastructure (`0.peerjs.com`). On strict corporate networks or symmetric NATs without TURN servers, initial peer handshake may require a few seconds or a retry.
- **Translation Quotas:** Free MyMemory API has daily IP-based usage quotas. In production, configure an enterprise translation provider (e.g. DeepL, Google Cloud Translation, or OpenAI).

---

## 12. Manual Testing Checklist

| # | Test Case | Steps to Verify | Expected Result |
|---|---|---|---|
| 1 | Production Build | Run `npm run build` | Compiles without errors; outputs to `dist/` |
| 2 | Unit Tests | Run `npm test` | All 12 unit tests pass |
| 3 | Demo Walkthrough | Click **Explore with a sample argument** → Click **Play argument** | 6-line argument plays with interruption, concession, speech synthesis, and heat meter shifts |
| 4 | Demo Reset | Click **Reset** during or after demo | Clears transcript, resets heat to 24%, stops ongoing speech, and halts replay timer |
| 5 | Speak As Toggle | In Demo, toggle between **A (Alex)** and **B (Lucía)** | Input placeholder and side indicator switch; typed message appears on selected side |
| 6 | Room Creation | In Setup, enter name, select language, click **Create room** | Enters live room; shows 5-letter room code and "waiting for partner" status |
| 7 | Room Joining | In second window, enter name, select different language, enter room code, click **Join conversation** | Both peers connect; green dot shows "Connected"; welcome system message appears |
| 8 | Interruption | While speech is playing or mic is active, click **Interrupt** | Speech immediately halts, interrupt event is logged on both screens, input is auto-focused, heat increases |
| 9 | Changed Mind | Click **I changed my mind**, enter revised statement, click **Send revision** | Concession event is posted, revised statement is translated and displayed referencing original statement, heat decreases |
| 10 | Language Switch | Change language dropdown on local panel during a live room | Partner receives system update: "Partner switched to [Language]"; future messages translate to new language |
| 11 | Sound Toggle | Click **Voice on / Voice off** in transcript header | Audio synthesis is disabled when set to "Voice off" |
| 12 | Translation Retry | Disconnect internet briefly or simulate translation failure | Message displays original text with `ORIGINAL PRESERVED` label and clickable **Retry** button |
