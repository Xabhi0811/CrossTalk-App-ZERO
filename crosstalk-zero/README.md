# CrossTalk — Different Words, Same Argument

> **Real-time, peer-to-peer bilingual dispute and conversation platform.**  
> *"Two people who don't share a single language need to have an argument. A real one: interrupting each other, getting heated, changing their minds. Build the thing that lets them."*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Philosophy & Problem Statement](#2-product-philosophy--problem-statement)
3. [Core Feature Matrix](#3-core-feature-matrix)
4. [Architecture & System Design](#4-architecture--system-design)
5. [P2P Communication Protocol (Payload Schemas)](#5-p2p-communication-protocol-payload-schemas)
6. [Complete Project Structure](#6-complete-project-structure)
7. [Module-by-Module Codebase Walkthrough](#7-module-by-module-codebase-walkthrough)
8. [Speech & Translation Pipeline](#8-speech--translation-pipeline)
9. [Argument Mechanics: Heat, Interruptions & Concessions](#9-argument-mechanics-heat-interruptions--concessions)
10. [Room Discovery, Deep Linking & Input Sanitization](#10-room-discovery-deep-linking--input-sanitization)
11. [Installation & Developer Workflow](#11-installation--developer-workflow)
12. [Automated Testing Suite](#12-automated-testing-suite)
13. [Deployment Guide (Vercel & Static Hosting)](#13-deployment-guide-vercel--static-hosting)
14. [Agent Quick Reference (Conventions & Extension Points)](#14-agent-quick-reference-conventions--extension-points)

---

## 1. Executive Summary

**CrossTalk** is a client-side React 18 single-page application built with Vite that enables two individuals speaking different languages to engage in real-time, high-stakes conversations and disagreements.

Unlike traditional polite translation apps that queue messages as static text cards, CrossTalk models the real, organic dynamics of human conflict:
- **Instant Interruptions:** Cutting off active audio playback across the wire with an interruption signal.
- **Dynamic Argument Heat Meter:** Quantifying conversational tension through speech velocity, tone tags, and interruption events.
- **Visible Concessions:** A dedicated *"I Changed My Mind"* protocol that tracks reconsidered points and visibly cools conversational heat.
- **Direct P2P Data Channels:** Eliminates central message relays by establishing encrypted WebRTC data channels via PeerJS with multi-STUN failover.
- **Dual Receipts:** Both interlocutors always see the verbatim original statement alongside the translation, preserving original phrasing and intent even if translation services degrade.

---

## 2. Product Philosophy & Problem Statement

Conventional translation software (Google Translate, DeepL, travel interpreters) is designed for polite transactional exchanges: ordering a coffee, booking train tickets, or asking for hotel directions. In these tools:
- Speakers take turns politely.
- Latency is accepted as long as accuracy is high.
- Tone, tension, and pace are completely flattened.

In real human conflict, relationships are messy. People talk over each other, cut each other off, escalate their volume, and occasionally back down to concede a point. 

CrossTalk was engineered from the ground up to solve the **messy middle of an argument**:
1. **Low Latency Over Perfect Eloquence:** Translations are pre-computed locally on the sender's device and transmitted across WebRTC directly to the receiver.
2. **Audio Interruptibility:** If Participant B clicks **Interrupt** or starts speaking while Participant A's translated voice is playing, synthesis stops instantly on both ends.
3. **Accountability via Receipts:** Rather than an ephemeral voice stream, every exchange is logged into "The Receipt" timeline with timestamps, language indicators, and tone tags.





---

## 3. Core Feature Matrix

| Feature | Description | Implementation |
|---|---|---|
| **P2P Data Channel** | Direct peer-to-peer connection between two browsers | PeerJS 1.5, Google + Cloudflare STUN servers |
| **Room System** | Short 5-character uppercase codes + direct deep link sharing | `?room=CODE` URL parameters with automatic paste extraction |
| **Speech Recognition** | Real-time speech-to-text with live interim transcripts | Web Speech API (`webkitSpeechRecognition`) |
| **Speech Synthesis** | Text-to-speech in partner's language with dynamic pace | Web Speech API (`SpeechSynthesisUtterance`) |
| **Active Interruption** | Immediately stops partner speech synthesis and halts mic | Signal dispatched over P2P data channel; +18% heat |
| **"I Changed My Mind"** | Concession workflow referencing prior statements | Context-aware drawer, dual-language receipt; -24% heat |
| **Argument Heat Meter** | Visual temperature gauge measuring conversation intensity | Heuristic scoring based on tone, interruptions, and pacing |
| **Dual Receipts** | Side-by-side display of original statement and translation | Persistent transcript with fallback preservation and retry |
| **Interactive Demo** | Scripted 6-turn dispute between Alex (EN) and Lucía (ES) | Built-in replayable demo mode with side toggles |
| **Privacy First** | Zero central server message storage | Voice never leaves the browser; data stays peer-to-peer |

---

## 4. Architecture & System Design

CrossTalk operates entirely client-side. There is no custom backend database or message relay server.

```
┌────────────────────────────────────────────────────────┐
│                   BROWSER CLIENT A                     │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │ Web Speech (STT/TTS)  │   │ MyMemory API Engine  │  │
│  └───────────┬───────────┘   └──────────┬───────────┘  │
│              │                          │              │
│              ▼                          ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │          CrossTalk Orchestrator (App.jsx)        │  │
│  │   - State Machine: setup | demo | live           │  │
│  │   - Heat Calculator & Turn Management            │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│                     ┌───────▼──────┐                   │
│                     │ PeerJS Model │                   │
└─────────────────────┴───────┬──────┴───────────────────┘
                              │
                    WebRTC Encrypted Data Channel
                    (STUN: Google / Cloudflare)
                              │
┌─────────────────────┬───────▼──────┐───────────────────┐
│                     │ PeerJS Model │                   │
│                     └───────▲──────┘                   │
│                             │                          │
│  ┌──────────────────────────┴───────────────────────┐  │
│  │          CrossTalk Orchestrator (App.jsx)        │  │
│  │   - Audio Playback & Interruption Cutoff         │  │
│  │   - Dual-Receipt Transcript Renderer             │  │
│  └───────────▲──────────────────────────▲───────────┘  │
│              │                          │              │
│  ┌───────────┴───────────┐   ┌──────────┴───────────┐  │
│  │ Web Speech (STT/TTS)  │   │ MyMemory API Engine  │  │
│  └───────────────────────┘   └──────────────────────┘  │
│                   BROWSER CLIENT B                     │
└────────────────────────────────────────────────────────┘
```

### Architectural Key Decisions

1. **Pre-translation at Sender:**  
   When Participant A speaks or types in English to Participant B (Spanish), Client A executes the translation before sending the packet. Client A sends `{ sourceText: "...", translatedText: "..." }`. Client B renders the translation and speaks it without needing a secondary translation request. This reduces API consumption by 50% and eliminates double latency.

2. **Deterministic Peer IDs:**  
   Room connections do not require custom signaling infrastructure. Peer IDs are constructed deterministically:
   - Host (Role A): `xtalk-<roomCode>-a`
   - Guest (Role B): `xtalk-<roomCode>-b`
   Both peers register on the PeerJS cloud server (`0.peerjs.com`) and connect directly via STUN.

---

## 5. P2P Communication Protocol (Payload Schemas)

All communication over the WebRTC data channel uses JSON objects with a `type` discriminator:

### 1. `hello` — Initial Handshake
Exchanged as soon as the data channel opens to sync names, languages, and roles:
```json
{
  "type": "hello",
  "name": "Lucía",
  "lang": "es-ES",
  "side": "b"
}
```

### 2. `speech` — Spoken or Typed Message
Broadcast when a participant finishes speaking or submits a text input:
```json
{
  "type": "speech",
  "messageId": "1729800000000-k8f9a2",
  "name": "Alex",
  "sourceText": "You never listen to what I am saying.",
  "translatedText": "Nunca escuchas lo que estoy diciendo.",
  "sourceLang": "en-US",
  "targetLang": "es-ES",
  "tone": "sharp",
  "changeMind": false,
  "side": "a"
}
```

### 3. `interrupt` — Active Interruption
Sent when a participant clicks **Interrupt** while partner speech is playing:
```json
{
  "type": "interrupt",
  "side": "b",
  "name": "Lucía"
}
```

### 4. `change-mind` — Concession Statement
Broadcast when a user submits a revised position on an earlier disputed point:
```json
{
  "type": "change-mind",
  "messageId": "1729800015000-x9q2m1",
  "name": "Alex",
  "sourceText": "I realize you were stuck in traffic, that was unfair of me.",
  "translatedText": "Me doy cuenta de que estabas atrapado en el tráfico, fue injusto de mi parte.",
  "replyTo": {
    "sourceText": "You were late on purpose.",
    "translatedText": "Llegaste tarde a propósito."
  },
  "side": "a"
}
```

### 5. `lang-change` — Live Language Switch
Broadcast when a participant changes their preferred language mid-conversation:
```json
{
  "type": "lang-change",
  "lang": "fr-FR",
  "side": "b"
}
```

### 6. `goodbye` — Graceful Disconnect
Notifies the remote peer of an intentional room departure before closing the channel:
```json
{
  "type": "goodbye"
}
```

---

## 6. Complete Project Structure

```
crosstalk-zero/
├── .gitignore                   # Ignores node_modules, dist, .env, and logs
├── index.html                   # HTML entry point (fonts, viewport, title, meta)
├── package.json                 # Project configuration and dependency manifest
├── package-lock.json            # Exact dependency lockfile
├── vercel.json                  # Single-Page Application (SPA) routing for Vercel
├── vite.config.js               # Vite 6 configuration with React plugin
├── README.md                    # Project documentation (this document)
│
├── tests/
│   └── services.test.js         # Automated test suite using Node.js native test runner
│
└── src/
    ├── main.jsx                 # React root mount
    ├── App.jsx                  # Main application orchestrator and state engine
    ├── constants.js             # Languages, room utilities, demo data, status enums
    ├── styles.css               # Unified design system, dark editorial aesthetic
    │
    ├── components/
    │   ├── PersonPanel.jsx      # Participant card (avatar, language selector, wave animation)
    │   └── SharedComponents.jsx # Brand, HelpModal, Toast, TranscriptMessage components
    │
    └── services/
        ├── peer.js              # WebRTC connection management (PeerJS)
        ├── speech.js            # Web Speech API wrapper (STT Recognition & TTS Synthesis)
        └── translation.js       # MyMemory translation layer, rate limiter, HTML entity cleaner
```

---

## 7. Module-by-Module Codebase Walkthrough

### `src/App.jsx`
The primary state machine and UI orchestrator (1400+ lines).
- **Modes:** 
  - `'setup'`: Initial landing screen to choose name, language, and role (Host A vs Guest B).
  - `'demo'`: Self-contained interactive dispute demonstration between Alex and Lucía.
  - `'live'`: Live WebRTC conversation room.
- **State Responsibilities:**
  - `messages`: Timeline items containing system messages, speech messages, interruptions, and concessions.
  - `heat`: Numerical scale (0 to 100) tracking conversation tension.
  - `voiceEnabled`: Master audio synthesis mute switch (`Voice on` / `Voice off`).
  - `interruptedSide` & `isInterrupting`: Active interruption animation and state locks.
  - `changeMindMode` & `selectedReplyTo`: Context selection for the concession drawer.
  - `roomCode`, `copiedId`, `copiedLink`: Room identity, deep link handling, and clipboard state.

### `src/constants.js`
Configuration data and utility functions:
- `LANGUAGES`: 9 supported languages with BCP 47 codes (`en-US`, `es-ES`, `hi-IN`, `fr-FR`, `de-DE`, `pt-BR`, `ja-JP`, `ar-SA`, `zh-CN`), short codes, and API tags.
- `makeRoomCode()`: Generates random 5-character alphanumeric uppercase codes (e.g. `UZHJR`).
- `extractRoomCode(input)`: Parses plain strings, URLs, and queries (`?room=UZHJR`), extracting a clean uppercase room code.
- `DEMO_LINES`: 6-step pre-scripted dispute featuring accusations, an interruption, concessions, and resolution.
- `CONNECTION_STATUS`: Enum (`disconnected`, `connecting`, `connected`, `error`, `reconnecting`).

### `src/services/peer.js`
Encapsulates WebRTC peer connections using PeerJS:
- Multi-STUN server configuration (Google STUN + Cloudflare STUN).
- Connection establishment with exponential backoff retry (up to 3 attempts with 2s delay increments).
- Error handling for duplicate room codes (`unavailable-id`) and missing hosts (`peer-unavailable`).

### `src/services/speech.js`
Thin, fault-tolerant abstraction over the browser's Web Speech API:
- `isSpeechRecognitionSupported()`: Detects Chromium-based `webkitSpeechRecognition`.
- `createRecognition()`: Configures single-turn recognition with interim streaming and final transcript callbacks.
- `speakText()`: Synthesizes speech using `SpeechSynthesisUtterance`. Dynamically matches voice language and scales playback rate up to `1.2x` when conversational heat exceeds 60%.
- `cancelSpeech()`: Instantly cuts off audio synthesis for immediate interruptions.

### `src/services/translation.js`
Translation abstraction currently powered by the MyMemory public API:
- Rate limiter: Enforces an 1100ms throttle between consecutive requests to prevent HTTP 429 status codes.
- Entity sanitizer: Converts HTML entities (`&#039;`, `&quot;`, `&amp;`, `&lt;`, `&gt;`, `&apos;`) into clean characters.
- Timeout protection: Aborts requests taking longer than 10 seconds.
- Fallback preservation: Returns `{ success: false, translatedText: null, error }` without discarding original text.

### `src/components/PersonPanel.jsx`
Top dashboard panel representing one participant:
- Name input (editable for local side).
- Dynamic role avatar (`A` or `B`) with connection status pip.
- Language selector dropdown.
- CSS animated voice waveform indicator (`talking-pill` / `language-wave`).
- Encryption and privacy badges (`Microphone stays on your device`, `P2P`).

### `src/components/SharedComponents.jsx`
Reusable visual atoms:
- `Brand`: The signature CrossTalk slash typography and badge.
- `HelpModal`: Detailed "How it works" guidance and conversational guidelines.
- `Toast`: Auto-dismissing notification toasts.
- `TranscriptMessage`: Unified renderer handling `system`, `event`, `speech`, and `change-mind-statement` message cards with inline retry controls.

### `src/styles.css`
A bespoke, dark editorial design system:
- CSS custom properties for typography (`Inter` / monospace), spacing, and palette.
- Dynamic color themes for conversational heat (contained green `#1a8a4a`, tense amber `#e8a422`, hot red `#c93b2b`).
- Glassmorphic panels, micro-animations, and full mobile-first responsive breakpoints.

---

## 8. Speech & Translation Pipeline

### Speech-to-Text (STT)
1. User clicks the microphone button in the input bar.
2. `createRecognition()` initializes a `SpeechRecognition` instance matching `myLang`.
3. As the user speaks, interim results stream directly into the text field so they can see their words forming.
4. On pause or speech end, the final transcript is committed and automatically queued for translation.

### Translation & Entity Sanitization
1. The source text is passed to `translateText()`.
2. If `fromLang === toLang`, the service immediately returns the text with zero API latency.
3. Otherwise, requests pass through the client throttle queue (1100ms interval).
4. The response is parsed and stripped of HTML entities.
5. If the request fails, the message is stamped with `translationFailed: true` and the original text is preserved with a **Retry** button.

### Text-to-Speech (TTS)
1. When a remote message is received, Client B checks `voiceEnabled`.
2. If voice is enabled, `speakText(translatedText, myLang, options)` is invoked.
3. The browser finds an installed voice matching the participant's BCP 47 code.
4. Playback rate dynamically modulates based on current conversation heat:
   $$\text{Rate} = \begin{cases} 1.20 & \text{if Heat} > 60 \\ 1.05 & \text{if Heat} \ge 35 \\ 1.00 & \text{otherwise} \end{cases}$$

---

## 9. Argument Mechanics: Heat, Interruptions & Concessions

### Argument Heat Calculation
CrossTalk implements a conversational temperature metric (0–100%) that dynamically reflects the emotional intensity of the dispute:

```
Baseline: 24% (Calm / Contained)
  + Sharp / Heated statement:    +12% to +18%
  + Active Interruption:          +18%
  - Concession ("Changed Mind"): -24%
  - Natural cool-off decay:      -3% per peaceful exchange
```

The heat bar visually shifts across three distinct thresholds:
- **0% – 34%:** `Contained` (Green / Calm)
- **35% – 66%:** `Getting tense` (Amber / Tense)
- **67% – 100%:** `Running hot` (Red / Heated)

### Active Interruption Workflow
In an argument, waiting for a long audio message to complete before speaking is unnatural.
1. When Participant A's translated voice is playing on Participant B's machine, Participant B can click the **Interrupt** button.
2. Clicking **Interrupt** immediately:
   - Calls `cancelSpeech()` to silence audio playback on Participant B's machine.
   - Halts any active microphone recognition.
   - Broadcasts an `{ type: 'interrupt' }` packet to Participant A.
   - Spikes the heat meter by `+18%`.
   - Stamps an interruption badge in "The Receipt" timeline: `[Swords] Lucía interrupted`.
   - Auto-focuses Participant B's input field for an immediate rebuttal.

### "I Changed My Mind" Concession Workflow
Backing down is often harder than escalating. CrossTalk creates explicit space for de-escalation:
1. A participant clicks the **"I changed my mind"** button below the input box.
2. A concession drawer opens displaying recent statements made during the dispute.
3. The user selects which prior statement they are reconsidering.
4. The user types their revised position (e.g. *"I realize you weren't ignoring me on purpose"*).
5. CrossTalk translates the revision and sends a `{ type: 'change-mind' }` payload.
6. A special concession card is rendered in both transcripts, showing:
   - The reconsidered quote in the reader's native tongue.
   - The revised position with a prominent `CHANGED THEIR MIND` chip.
7. The argument heat decreases by `-24%`.

---

## 10. Room Discovery, Deep Linking & Input Sanitization

CrossTalk supports friction-free peer pairing without accounts, logins, or server-side databases:

### Room Creation & Join Lifecycle
1. **Host (Role A):**
   - Types display name, picks language, clicks **Create room**.
   - Receives a generated 5-letter room code (e.g., `UZHJR`).
   - The header displays `ROOM UZHJR` with two distinct copy buttons:
     - **Copy Room ID** (<kbd><Copy size={14} /></kbd>): Copies `UZHJR` directly.
     - **Copy Invite Link** (<kbd><Link size={14} /></kbd>): Copies `https://<origin>/?room=UZHJR`.
2. **Guest (Role B):**
   - **Method 1 (Direct link):** If the guest opens `https://<origin>/?room=UZHJR`, CrossTalk auto-detects the `?room=` parameter, switches the setup mode to Role B ("Join a room"), and pre-fills `UZHJR`.
   - **Method 2 (Manual code entry):** The guest selects "Join a room" and pastes either the raw code (`UZHJR`) or the full URL into the **Room code** field.
   - **Paste Sanitization:** The input uses `extractRoomCode()`, automatically stripping URLs, protocol prefixes, and query parameters to extract the clean 5–8 character room code.

---

## 11. Installation & Developer Workflow

### Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **npm:** v9.0.0 or higher
- **Browser:** Google Chrome, Microsoft Edge, or any modern Chromium-based browser for full Web Speech recognition support.

### Setup Instructions

```bash
# Clone the repository
git clone https://github.com/Xabhi0811/CrossTalk-App-ZERO.git

# Enter project directory
cd CrossTalk-App-ZERO/crosstalk-zero

# Install dependencies
npm install

# Start Vite local development server
npm run dev
```

The development server will launch at `http://localhost:5173`.

### Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Launches the local development server with Hot Module Replacement (HMR) |
| `npm test` | Executes the native Node.js test runner against `tests/*.test.js` |
| `npm run build` | Compiles the production-ready bundle into the `dist/` directory |
| `npm run preview` | Locally serves the production `dist/` build for verification |

---

## 12. Automated Testing Suite

CrossTalk utilizes Node.js's native test runner (`node:test` and `node:assert/strict`) for rapid, zero-dependency unit tests.

To run the test suite:
```bash
npm test
```

### Covered Test Specifications

1. **Constants & Language Configuration:**
   - Verifies all 9 mandatory languages exist with valid BCP 47 codes.
   - Verifies fallback handling in `getLang()`.
   - Validates BCP 47 to API code conversion via `apiLang()`.
   - Verifies `makeRoomCode()` generates 5-character uppercase alphanumeric strings.
   - Validates `makeMessageId()` and `timeNow()` formatting.
   - Verifies the integrity of the `DEMO_LINES` script.
2. **Room Code Extraction & Sanitization:**
   - Validates `extractRoomCode()` across plain text (`UZHJR`), lowercase input (`uzhjr`), complete URLs (`http://localhost:5173/?room=UZHJR`), multi-param URLs, malformed URLs, and empty values.
3. **Translation Service & Sanitization:**
   - Verifies empty and whitespace strings return early with an error.
   - Verifies identical source and target languages return input text immediately without calling external APIs.
4. **Speech Service Fallbacks:**
   - Ensures feature detection helpers (`isSpeechRecognitionSupported`, `isSpeechSynthesisSupported`) execute safely in Node/headless environments without throwing reference errors.
5. **Peer Service Interface:**
   - Asserts that `createPeerConnection` is cleanly exported and instantiable.

---

## 13. Deployment Guide (Vercel & Static Hosting)

CrossTalk is completely static and can be deployed to any modern CDN or static host.

### Deploying to Vercel

The repository includes a dedicated `vercel.json` file configuring single-page application routing:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

1. Push your changes to GitHub or GitLab.
2. Log into [Vercel](https://vercel.com) and click **Add New Project**.
3. Select your repository and configure the build settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `crosstalk-zero` (if in a subdirectory)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Click **Deploy**. No environment variables or API secrets are required.

---

## 14. Agent Quick Reference (Conventions & Extension Points)

This section provides quick context for AI coding agents and automated contributors:

### Architectural Invariants
- **No Backend:** CrossTalk must remain 100% client-side serverless. Do not introduce Express, MongoDB, or external database dependencies for messaging.
- **Deterministic Peer IDs:** Always maintain the `xtalk-<roomCode>-<role>` convention. Changing this will break interoperability with other clients.
- **Pre-translation Pattern:** Always translate at the source before broadcasting over WebRTC. The receiver should never have to call the translation API for incoming speech messages.
- **Audio Clean-up:** Always pair interruption events with `cancelSpeech()` and recognition stops to prevent audio overlap.

### Common Extension Tasks

#### 1. Swapping Translation Providers (e.g., DeepL or OpenAI)
Open [src/services/translation.js](file:///c:/Users/chabh/Downloads/crosstalk-zero/crosstalk-zero/src/services/translation.js):
- Implement your provider function `translateWithCustomProvider(text, sourceLang, targetLang)`.
- Replace `translateWithMyMemory` call inside `translateText()`.
- Maintain the `{ success: boolean, translatedText: string|null, error: string|null }` return contract.

#### 2. Adding a New Language
Open [src/constants.js](file:///c:/Users/chabh/Downloads/crosstalk-zero/crosstalk-zero/src/constants.js):
- Add an entry to the `LANGUAGES` array:
  ```javascript
  { label: 'Italian', code: 'it-IT', short: 'IT', api: 'it' }
  ```
- Both UI selectors and Web Speech synthesis will automatically pick up the new language.

#### 3. Adding New P2P Event Types
1. Define a new message schema with a unique `type` tag.
2. In [src/App.jsx](file:///c:/Users/chabh/Downloads/crosstalk-zero/crosstalk-zero/src/App.jsx), handle the type inside `receiveData(data)` callback.
3. Broadcast the payload using `peerManagerRef.current?.send({ type: 'your-event', ... })`.
