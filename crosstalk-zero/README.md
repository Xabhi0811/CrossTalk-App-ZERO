# CrossTalk — different words, same argument

A small experiment for two people who speak different languages to have a real disagreement: translated messages, interruption signals, voice playback, and explicit moments where someone changes their mind.

## Features
- English, Hindi, Spanish, French, German, Portuguese, Japanese, Arabic, and Mandarin UI language options.
- Type messages or use browser speech recognition (Chrome/Edge recommended).
- MyMemory translation API for text translation; browser speech synthesis reads the translation aloud.
- Peer-to-peer room mode using PeerJS data connections. One person creates a room; the other joins with the room code.
- Interrupt and “I changed my mind” actions, plus a live argument-heat meter.
- Demo mode with an example English/Spanish disagreement that interrupts, escalates, and cools down.
- Responsive layout and a visible caution about translation quality.

## Run locally

```bash
npm install
npm run dev
```

## Build for deployment

```bash
npm run build
```

Deploy the repository as a Vite project on Vercel or Netlify. No build command overrides are needed: Vercel should detect Vite automatically, with `npm run build` and `dist` as the output directory.

## Try it with two people
1. Open the deployed URL in two separate browsers/devices.
2. On the first device, enter a name and language, choose **Create a room**, and click **Create room**.
3. Share the room code with the second person.
4. On the second device, choose **Join a room**, enter the same room code, select the other person's language, and join.
5. Use the mic button for speech recognition or type a message. Try **Interrupt** and **I changed my mind**.

## Notes and limitations
- This is a text-first prototype. It sends text over a PeerJS/WebRTC data channel, not raw microphone audio; each browser captures its own speech and translates the resulting text.
- Translation uses the public MyMemory service and has no guarantee of availability, accuracy, or uptime. An unsuccessful translation is shown as unavailable rather than silently treated as accurate.
- PeerJS Cloud availability and browser network restrictions may affect room connections. For production, configure your own signaling service, a translation provider with an API key and rate limits, authentication, privacy/retention rules, and robust reconnect handling.
- Web Speech API support varies by browser/OS and may use remote processing provided by the browser vendor. Text and translations cross a third-party API; don't use for sensitive conversations.

## Product framing
CrossTalk is designed to show the *rhythm* of disagreement instead of treating conversation like a static translation form. The prototype makes interruption visible, maintains both the original and translated line, and gives a concession a first-class event in the transcript.
