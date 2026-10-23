import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, AudioLines, Check, CircleHelp,
  Copy, Globe2, Languages, Mic, MicOff, MessageSquareText,
  RotateCcw, ShieldCheck, Swords, Volume2, VolumeX, Zap, X,
} from 'lucide-react';

import { LANGUAGES, getLang, apiLang, makeRoomCode, timeNow, makeMessageId, DEMO_LINES, MAX_MESSAGES, CONNECTION_STATUS } from './constants.js';
import { translateText, retryTranslation } from './services/translation.js';
import { createPeerConnection } from './services/peer.js';
import { createRecognition, speakText, cancelSpeech, isSpeechRecognitionSupported, isSpeechSynthesisSupported } from './services/speech.js';
import { Brand, HelpModal, Toast, TranscriptMessage } from './components/SharedComponents.jsx';
import { PersonPanel } from './components/PersonPanel.jsx';

export default function App() {
  // ── Mode & Room ──
  const [mode, setMode] = useState('setup'); // 'setup' | 'demo' | 'live'
  const [roomCode, setRoomCode] = useState('');
  const [myRole, setMyRole] = useState('a');

  // ── Identity ──
  const [myName, setMyName] = useState('');
  const [myLang, setMyLang] = useState('en-US');
  const [partnerName, setPartnerName] = useState('');
  const [partnerLang, setPartnerLang] = useState('es-ES');

  // ── Connection ──
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [connectionText, setConnectionText] = useState('');

  // ── Conversation ──
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  const [heat, setHeat] = useState(24);
  const [isInterrupting, setIsInterrupting] = useState(false);
  const [interruptedSide, setInterruptedSide] = useState(null);
  const [translationBusy, setTranslationBusy] = useState(false);

  // ── Change-mind mode ──
  const [changeMindMode, setChangeMindMode] = useState(false);
  const [changeMindDraft, setChangeMindDraft] = useState('');
  const [changeMindTarget, setChangeMindTarget] = useState(null); // message to revise

  // ── UI ──
  const [toast, setToast] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [typingSide, setTypingSide] = useState('a');

  // ── Refs ──
  const peerManagerRef = useRef(null);
  const recognitionRef = useRef(null);
  const demoTimerRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const inputRef = useRef(null);
  const changeMindInputRef = useRef(null);
  const messagesRef = useRef([]);
  const remoteInfoRef = useRef({ name: '', lang: '' });
  const myInfoRef = useRef({ role: 'a', name: '', lang: 'en-US' });
  const speakingRef = useRef(true);

  // ── Keep refs in sync ──
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { myInfoRef.current = { role: myRole, name: myName, lang: myLang }; }, [myRole, myName, myLang]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);

  // ── Cleanup on unmount ──
  useEffect(() => () => {
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    recognitionRef.current?.stop?.();
    peerManagerRef.current?.destroy?.();
    cancelSpeech();
  }, []);

  // ── Auto-scroll transcript ──
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // ── Notify ──
  const notify = useCallback((text) => {
    setToast(text);
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, []);

  // ── Add message ──
  const addMessage = useCallback((message) => {
    setMessages((prev) => [
      ...prev,
      { id: makeMessageId(), time: timeNow(), ...message },
    ].slice(-MAX_MESSAGES));
  }, []);

  // ── Speak translated text ──
  const speak = useCallback((text, voiceLang) => {
    if (!speakingRef.current || !isSpeechSynthesisSupported() || !text) return;
    const rate = heat > 70 ? 1.16 : 1.02;
    speakText(text, voiceLang || myInfoRef.current.lang, { rate });
  }, [heat]);

  // ── Receive data from peer ──
  const receiveData = useCallback((data) => {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'hello': {
        remoteInfoRef.current = { name: data.name || 'Guest', lang: data.lang || 'en-US' };
        setPartnerName(data.name || 'Guest');
        setPartnerLang(data.lang || 'en-US');
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);
        setConnectionText('Peer-to-peer connected');
        addMessage({
          kind: 'system',
          text: `${data.name || 'Your partner'} joined in ${getLang(data.lang).label}.`,
        });
        break;
      }

      case 'lang-change': {
        remoteInfoRef.current.lang = data.lang;
        setPartnerLang(data.lang);
        addMessage({
          kind: 'system',
          text: `${data.name || 'Partner'} switched to ${getLang(data.lang).label}.`,
        });
        break;
      }

      case 'message': {
        const myLangNow = myInfoRef.current.lang;
        setHeat((h) =>
          Math.min(100, Math.max(0, h + (data.tone === 'heated' ? 18 : data.tone === 'sharp' ? 10 : data.changeMind ? -18 : -2)))
        );

        const msgId = makeMessageId();
        const hasDirectTranslation = Boolean(data.translatedText);

        const initialMsg = {
          id: msgId,
          kind: 'speech',
          side: data.side,
          name: data.name,
          sourceLang: data.sourceLang,
          sourceLangLabel: getLang(data.sourceLang).label,
          sourceText: data.text,
          translatedText: data.translatedText || '',
          translating: !hasDirectTranslation,
          tone: data.tone || 'normal',
          changeMind: !!data.changeMind,
          time: data.time || timeNow(),
        };

        setMessages((prev) => [...prev, initialMsg].slice(-MAX_MESSAGES));

        if (hasDirectTranslation) {
          if (speakingRef.current) {
            speak(data.translatedText, myLangNow);
          }
        } else {
          // Translate into our language if sender didn't provide one
          translateText(data.text, data.sourceLang, myLangNow, apiLang).then((result) => {
            const translated = result.success
              ? result.translatedText
              : `⚠ Translation unavailable — original: "${data.text}"`;
            const failed = !result.success;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, translatedText: translated, translating: false, translationFailed: failed }
                  : m
              )
            );

            if (speakingRef.current && !failed) {
              speak(translated, myLangNow);
            }
          });
        }

        if (data.interrupt) {
          cancelSpeech();
          addMessage({ kind: 'event', side: data.side, text: `${data.name} interrupted.` });
        }
        break;
      }

      case 'interrupt': {
        cancelSpeech();
        recognitionRef.current?.stop?.();
        setListening(false);
        setHeat((h) => Math.min(100, h + 16));
        setIsInterrupting(true);
        setInterruptedSide(myInfoRef.current.role);
        addMessage({ kind: 'event', side: data.side, text: `${data.name} cut in.` });
        setTimeout(() => {
          setIsInterrupting(false);
          setInterruptedSide(null);
        }, 1500);
        break;
      }

      case 'change-mind': {
        setHeat((h) => Math.max(0, h - 24));
        addMessage({ kind: 'event', side: data.side, text: `${data.name} changed their mind.` });

        if (data.revisedText) {
          const myLangNow = myInfoRef.current.lang;
          const msgId = makeMessageId();
          const hasDirectTranslation = Boolean(data.translatedText);

          const initial = {
            id: msgId,
            kind: 'change-mind-statement',
            side: data.side,
            name: data.name,
            sourceLang: data.sourceLang,
            sourceText: data.revisedText,
            translatedText: data.translatedText || '',
            translating: !hasDirectTranslation,
            replyTo: data.replyTo || null,
            time: data.time || timeNow(),
          };

          setMessages((prev) => [...prev, initial].slice(-MAX_MESSAGES));

          if (hasDirectTranslation) {
            if (speakingRef.current) {
              speak(data.translatedText, myLangNow);
            }
          } else {
            translateText(data.revisedText, data.sourceLang, myLangNow, apiLang).then((result) => {
              const translated = result.success
                ? result.translatedText
                : `⚠ Translation unavailable — original: "${data.revisedText}"`;

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId
                    ? { ...m, translatedText: translated, translating: false, translationFailed: !result.success }
                    : m
                )
              );

              if (speakingRef.current && result.success) {
                speak(translated, myLangNow);
              }
            });
          }
        }
        break;
      }

      case 'heat':
        setHeat(data.value);
        break;

      case 'goodbye':
        setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
        setConnectionText('Partner disconnected');
        addMessage({ kind: 'system', text: 'Your partner left the room.' });
        break;

      default:
        break;
    }
  }, [addMessage, speak]);

  // ── Start a room ──
  const startRoom = useCallback((role) => {
    if (!myName.trim()) { notify('Add your name first.'); return; }
    if (role === 'b' && !roomCode.trim()) { notify('Enter the room code your partner shared.'); return; }
    if (!window.RTCPeerConnection) { notify('This browser does not support peer-to-peer connections.'); return; }

    const room = (roomCode || makeRoomCode()).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setRoomCode(room);
    setMyRole(role);
    setMode('live');
    setConnectionStatus(CONNECTION_STATUS.CONNECTING);
    setConnectionText(role === 'a' ? 'Opening room…' : 'Joining room…');
    setMessages([]);

    const manager = createPeerConnection({
      roomCode: room,
      role,
      onOpen: () => {
        if (role === 'a') {
          setConnectionText('Room ready · waiting for partner');
          addMessage({ kind: 'system', text: `Room ${room} is open. Share the code with your partner.` });
        }
      },
      onConnect: (conn) => {
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);
        setConnectionText('Peer-to-peer connected');
        const me = myInfoRef.current;
        conn.send({ type: 'hello', name: me.name, lang: me.lang, side: me.role });
        addMessage({ kind: 'system', text: 'Secure peer-to-peer data channel opened.' });
      },
      onData: receiveData,
      onDisconnect: () => {
        setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
        setConnectionText('Partner disconnected');
      },
      onError: (msg) => {
        setConnectionStatus(CONNECTION_STATUS.ERROR);
        setConnectionText('Connection issue');
        notify(msg);
      },
      onReconnecting: (attempt, max) => {
        setConnectionStatus(CONNECTION_STATUS.RECONNECTING);
        setConnectionText(`Reconnecting… (${attempt}/${max})`);
      },
    });

    peerManagerRef.current = manager;
  }, [addMessage, notify, roomCode, receiveData, myName]);

  // ── Notify partner of language change ──
  useEffect(() => {
    if (mode === 'live' && peerManagerRef.current?.isConnected()) {
      peerManagerRef.current.send({
        type: 'lang-change',
        lang: myLang,
        name: myName,
      });
    }
  }, [myLang, mode, myName]);

  // ── Enter demo mode ──
  const enterDemo = useCallback(() => {
    cancelSpeech();
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    peerManagerRef.current?.destroy?.();
    peerManagerRef.current = null;

    setMode('demo');
    setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
    setConnectionText('Demo room');
    setMessages([]);
    setHeat(24);
    setDemoPlaying(false);
    setIsInterrupting(false);
    setMyRole('a');
    setMyName('Alex');
    setMyLang('en-US');
    setPartnerName('Lucía');
    setPartnerLang('es-ES');
    setChangeMindMode(false);
    setChangeMindDraft('');
  }, []);

  // ── Play demo argument ──
  const playDemo = useCallback(() => {
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    setMessages([]);
    setHeat(24);
    setDemoPlaying(true);
    let index = 0;

    const pushNext = () => {
      if (index >= DEMO_LINES.length) {
        clearInterval(demoTimerRef.current);
        demoTimerRef.current = null;
        setDemoPlaying(false);
        return;
      }
      const line = DEMO_LINES[index++];
      const isA = line.from === 'a';

      addMessage({
        kind: 'speech',
        side: line.from,
        name: isA ? 'Alex · English' : 'Lucía · Spanish',
        sourceLang: isA ? 'en-US' : 'es-ES',
        sourceLangLabel: isA ? 'English' : 'Spanish',
        sourceText: isA ? line.original : line.translated,
        translatedText: isA ? line.translated : line.original,
        tone: line.tone,
        changeMind: !!line.change,
        time: timeNow(),
      });

      if (line.interrupt) {
        addMessage({
          kind: 'event',
          side: 'b',
          text: 'Lucía interrupts before Alex finishes.',
        });
      }

      if (line.change) {
        addMessage({
          kind: 'event',
          side: line.from,
          text: `${isA ? 'Alex' : 'Lucía'} changes their mind.`,
        });

        // Show a change-of-mind statement in the demo
        if (line.changeText) {
          addMessage({
            kind: 'change-mind-statement',
            side: line.from,
            name: isA ? 'Alex · English' : 'Lucía · Spanish',
            sourceLang: isA ? 'en-US' : 'es-ES',
            sourceText: isA ? line.changeText : line.changeTranslated,
            translatedText: isA ? line.changeTranslated : line.changeText,
            replyTo: isA ? line.original : line.translated,
            time: timeNow(),
          });
        }
      }

      setHeat((h) =>
        Math.min(
          100,
          Math.max(8, h + (line.tone === 'heated' ? 18 : line.tone === 'sharp' ? 11 : line.change ? -18 : -3))
        )
      );

      if (speakingRef.current) {
        speak(isA ? line.translated : line.original, isA ? 'es-ES' : 'en-US');
      }
    };

    pushNext();
    demoTimerRef.current = setInterval(pushNext, 2800);
  }, [addMessage, speak]);

  // ── Translate and send message ──
  const translateAndSend = useCallback(async (text, options = {}) => {
    if (!text.trim()) return;

    const isDemo = mode === 'demo';
    const side = isDemo ? typingSide : myRole;
    const name = isDemo ? (side === 'a' ? 'Alex' : 'Lucía') : myName;
    const fromLang = isDemo ? (side === 'a' ? myLang : partnerLang) : myLang;
    const toLang = isDemo
      ? (side === 'a' ? partnerLang : myLang)
      : (remoteInfoRef.current.lang || partnerLang);
    const tone = options.tone || (heat > 68 ? 'heated' : heat > 40 ? 'sharp' : 'normal');

    setTranslationBusy(true);

    // Add our own message immediately with translating indicator
    const msgId = makeMessageId();
    const localMsg = {
      id: msgId,
      kind: 'speech',
      side,
      name: isDemo ? `${name} · ${getLang(fromLang).label}` : name,
      sourceLang: fromLang,
      sourceLangLabel: getLang(fromLang).label,
      sourceText: text,
      translatedText: '',
      translating: true,
      tone,
      changeMind: !!options.changeMind,
      time: timeNow(),
    };

    setMessages((prev) => [...prev, localMsg].slice(-MAX_MESSAGES));

    // Translate
    const result = await translateText(text, fromLang, toLang, apiLang);
    const translated = result.success
      ? result.translatedText
      : 'Translation unavailable — original preserved.';
    const failed = !result.success;

    // Update message with translation
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, translatedText: translated, translating: false, translationFailed: failed }
          : m
      )
    );

    // Send to peer
    if (!isDemo && peerManagerRef.current?.isConnected()) {
      peerManagerRef.current.send({
        type: 'message',
        side,
        name,
        sourceLang: fromLang,
        text,
        translatedText: result.success ? result.translatedText : null,
        tone,
        time: timeNow(),
        interrupt: !!options.interrupt,
        changeMind: !!options.changeMind,
      });
    } else if (!isDemo && !peerManagerRef.current?.isConnected()) {
      notify('Message saved locally — partner is not connected yet.');
    }

    // Handle interrupt event
    if (options.interrupt && !isDemo) {
      cancelSpeech();
      peerManagerRef.current?.send({ type: 'interrupt', side, name });
      addMessage({ kind: 'event', side, text: `${name} interrupts. The floor changes sides.` });
      setIsInterrupting(true);
      setHeat((h) => Math.min(100, h + 16));
      setTimeout(() => setIsInterrupting(false), 1300);
    }

    // Speak the translation
    if (speakingRef.current && result.success) {
      speak(result.translatedText, toLang);
    }

    setDraft('');
    setTranslationBusy(false);

    // Update heat
    if (!options.changeMind && tone !== 'normal') {
      setHeat((h) => Math.min(100, h + (tone === 'heated' ? 18 : 10)));
    } else if (options.changeMind) {
      setHeat((h) => Math.max(0, h - 22));
    }
  }, [mode, typingSide, myRole, myName, myLang, partnerLang, heat, addMessage, notify, speak]);

  // ── Send interrupt event ──
  const handleInterrupt = useCallback(() => {
    const role = mode === 'demo' ? typingSide : myRole;
    const name = mode === 'demo' ? (role === 'a' ? 'Alex' : 'Lucía') : myName;

    cancelSpeech();
    recognitionRef.current?.stop?.();
    setListening(false);
    setIsInterrupting(true);
    setInterruptedSide(role === 'a' ? 'b' : 'a');
    setHeat((h) => Math.min(100, h + 16));
    addMessage({ kind: 'event', side: role, text: `${name} interrupts. The floor changes sides.` });
    
    // Auto-focus input so user can type immediately
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    setTimeout(() => {
      setIsInterrupting(false);
      setInterruptedSide(null);
    }, 1500);

    if (mode !== 'demo' && peerManagerRef.current?.isConnected()) {
      peerManagerRef.current.send({ type: 'interrupt', side: role, name });
    }
  }, [mode, typingSide, myRole, myName, addMessage]);

  // ── Change mind: open compose mode ──
  const handleChangeMindStart = useCallback(() => {
    // Find the last message from this participant to suggest as context
    const role = mode === 'demo' ? typingSide : myRole;
    const lastMsg = [...messagesRef.current].reverse().find(
      (m) => m.kind === 'speech' && m.side === role
    );
    setChangeMindTarget(lastMsg || null);
    setChangeMindMode(true);
    setChangeMindDraft('');
    setTimeout(() => changeMindInputRef.current?.focus(), 50);
  }, [mode, typingSide, myRole]);

  // ── Change mind: send revised statement ──
  const handleChangeMindSend = useCallback(async () => {
    if (!changeMindDraft.trim()) {
      notify('Write what you changed your mind about.');
      return;
    }

    const isDemo = mode === 'demo';
    const side = isDemo ? typingSide : myRole;
    const name = isDemo ? (side === 'a' ? 'Alex' : 'Lucía') : myName;
    const fromLang = isDemo ? (side === 'a' ? myLang : partnerLang) : myLang;
    const toLang = isDemo
      ? (side === 'a' ? partnerLang : myLang)
      : (remoteInfoRef.current.lang || partnerLang);

    setTranslationBusy(true);

    // Add event line
    addMessage({
      kind: 'event',
      side,
      text: `${isDemo ? name : myName} changes their mind.`,
    });

    // Translate the revised statement
    const result = await translateText(changeMindDraft, fromLang, toLang, apiLang);
    const translated = result.success
      ? result.translatedText
      : 'Translation unavailable — original preserved.';

    const replyContext = changeMindTarget
      ? {
          sourceText: changeMindTarget.sourceText,
          translatedText: changeMindTarget.translatedText,
        }
      : null;

    // Add change-of-mind statement
    const msgId = makeMessageId();
    addMessage({
      id: msgId,
      kind: 'change-mind-statement',
      side,
      name: isDemo ? `${name} · ${getLang(fromLang).label}` : name,
      sourceLang: fromLang,
      sourceText: changeMindDraft,
      translatedText: translated,
      translating: false,
      translationFailed: !result.success,
      replyTo: replyContext,
      time: timeNow(),
    });

    // Send to peer
    if (!isDemo && peerManagerRef.current?.isConnected()) {
      peerManagerRef.current.send({
        type: 'change-mind',
        side,
        name,
        sourceLang: fromLang,
        revisedText: changeMindDraft,
        translatedText: result.success ? result.translatedText : null,
        replyTo: replyContext,
        time: timeNow(),
      });
    }

    // Speak it
    if (speakingRef.current && result.success) {
      speak(result.translatedText, toLang);
    }

    // Reduce heat
    setHeat((h) => Math.max(0, h - 24));
    setChangeMindMode(false);
    setChangeMindDraft('');
    setChangeMindTarget(null);
    setTranslationBusy(false);
  }, [changeMindDraft, changeMindTarget, mode, typingSide, myRole, myName, myLang, partnerLang, addMessage, notify, speak]);

  // ── Speech recognition ──
  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      notify('Voice input works best in Chrome or Edge. You can type instead.');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }

    const lang = mode === 'demo' ? (typingSide === 'a' ? myLang : partnerLang) : myLang;

    const recognition = createRecognition({
      lang,
      onInterim: (text) => setDraft(text),
      onFinal: (text) => {
        setDraft(text);
        setTimeout(() => translateAndSend(text), 150);
      },
      onStart: () => setListening(true),
      onEnd: () => setListening(false),
      onError: (msg) => {
        notify(msg);
        setListening(false);
      },
    });

    recognitionRef.current = recognition;
    recognition.start();
  }, [listening, mode, typingSide, myLang, notify, translateAndSend]);

  // ── Retry translation ──
  const handleRetryTranslation = useCallback(async (msgId) => {
    const msg = messagesRef.current.find((m) => m.id === msgId);
    if (!msg || !msg.sourceText) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, translating: true, translationFailed: false } : m
      )
    );

    const isDemo = mode === 'demo';
    const toLang = isDemo
      ? (msg.side === 'a' ? partnerLang : myLang)
      : (msg.side === myRole ? (remoteInfoRef.current.lang || partnerLang) : myLang);

    const result = await retryTranslation(msg.sourceText, msg.sourceLang, toLang, apiLang);
    const translated = result.success
      ? result.translatedText
      : `⚠ Translation retry failed — original: "${msg.sourceText}"`;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              translatedText: translated,
              translating: false,
              translationFailed: !result.success,
            }
          : m
      )
    );

    if (speakingRef.current && result.success) {
      speak(result.translatedText, toLang);
    }
  }, [mode, myRole, partnerLang, myLang, speak]);

  // ── Reset demo ──
  const resetDemo = useCallback(() => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    cancelSpeech();
    setDemoPlaying(false);
    setMessages([]);
    setHeat(24);
    setIsInterrupting(false);
    setInterruptedSide(null);
  }, []);

  // ── Exit demo ──
  const exitDemo = useCallback(() => {
    resetDemo();
    setMode('setup');
  }, [resetDemo]);

  // ── Copy room code ──
  const copyRoom = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      notify('Room code copied. Send it to your partner.');
    } catch {
      notify(`Share this room code: ${roomCode}`);
    }
  }, [roomCode, notify]);

  // ── Leave room ──
  const leaveRoom = useCallback(() => {
    try {
      peerManagerRef.current?.send({ type: 'goodbye' });
    } catch { /* ignore */ }
    peerManagerRef.current?.destroy?.();
    peerManagerRef.current = null;
    cancelSpeech();
    recognitionRef.current?.stop?.();
    setListening(false);
    setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
    setMode('setup');
    setMessages([]);
    setConnectionText('Room closed');
    setChangeMindMode(false);
  }, []);

  // ── Handle partner language change ──
  const handlePartnerLangChange = useCallback((newLang) => {
    setPartnerLang(newLang);
    remoteInfoRef.current.lang = newLang;
  }, []);

  // ── Derived values ──
  const connected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const connecting = connectionStatus === CONNECTION_STATUS.CONNECTING;
  const reconnecting = connectionStatus === CONNECTION_STATUS.RECONNECTING;

  const partner = mode === 'demo'
    ? { name: 'Lucía', lang: partnerLang, side: 'b' }
    : { name: partnerName || (myRole === 'a' ? 'Partner B' : 'Partner A'), lang: partnerLang, side: myRole === 'a' ? 'b' : 'a' };

  const local = mode === 'demo'
    ? { name: 'Alex', lang: myLang, side: 'a' }
    : { name: myName, lang: myLang, side: myRole };

  const heatLabel = heat < 35 ? 'Contained' : heat < 67 ? 'Getting tense' : 'Running hot';

  const connectionDotClass = connected
    ? 'on'
    : reconnecting
    ? 'reconnecting'
    : 'off';

  const connectionDisplayText = mode === 'demo'
    ? 'Demo room'
    : connectionText || (connected ? 'Connected' : connecting ? 'Connecting…' : 'Disconnected');

  // ══════════════════════════════════════════════
  // SETUP SCREEN
  // ══════════════════════════════════════════════
  if (mode === 'setup') {
    return (
      <main className="setup-shell">
        <header className="topbar">
          <Brand />
          <div className="top-right">
            <span className="eyebrow">A WORKING EXPERIMENT</span>
            <span className="live-dot" />
          </div>
        </header>

        <section className="setup-hero">
          <div className="eyebrow lime-text">
            <span className="eyebrow-mark">✳</span> WHAT IF YOU COULD ARGUE?
          </div>
          <h1>
            Different words.
            <br />
            <em>Same argument.</em>
          </h1>
          <p className="hero-copy">
            CrossTalk lets two people disagree in their own languages. Translation
            keeps up. Feelings don&apos;t wait.
          </p>
        </section>

        <section className="setup-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">START A CONVERSATION</span>
              <h2>Get in the room.</h2>
            </div>
            <div className="globe-mark">
              <Globe2 size={24} />
            </div>
          </div>

          <div className="field-grid">
            <label>
              Your name
              <input
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="What should we call you?"
                maxLength={28}
              />
            </label>
            <label>
              Your language
              <select value={myLang} onChange={(e) => setMyLang(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mode-select">
            <button
              className={`mode-card ${myRole === 'a' ? 'selected' : ''}`}
              type="button"
              onClick={() => setMyRole('a')}
            >
              <span className="mode-num">A</span>
              <span>
                <b>Create a room</b>
                <small>Start it and invite one person</small>
              </span>
              {myRole === 'a' && <Check size={17} />}
            </button>
            <button
              className={`mode-card ${myRole === 'b' ? 'selected' : ''}`}
              type="button"
              onClick={() => setMyRole('b')}
            >
              <span className="mode-num secondary">B</span>
              <span>
                <b>Join a room</b>
                <small>Enter a code someone shared</small>
              </span>
              {myRole === 'b' && <Check size={17} />}
            </button>
          </div>

          {myRole === 'b' && (
            <label className="room-field">
              Room code
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7KQ2M"
                maxLength={8}
              />
            </label>
          )}

          <button
            className="primary-btn full"
            onClick={() => startRoom(myRole)}
            disabled={connecting}
          >
            {connecting
              ? 'Connecting…'
              : myRole === 'a'
              ? 'Create room'
              : 'Join conversation'}
            <ArrowUpRight size={18} />
          </button>

          <div className="divider-label">
            <span>OR</span>
          </div>

          <button className="demo-btn" onClick={enterDemo}>
            <AudioLines size={16} /> Explore with a sample argument{' '}
            <span className="demo-tag">NO SETUP</span>
          </button>

          <p className="privacy-note">
            <ShieldCheck size={14} /> Text is translated through a third-party
            service. Voice is processed by your browser.
          </p>
        </section>

        <footer className="setup-footer">
          <span>BUILT FOR THE MESSY MIDDLE OF A CONVERSATION.</span>
          <button onClick={() => setShowHelp(true)}>
            How it works <CircleHelp size={14} />
          </button>
        </footer>

        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </main>
    );
  }

  // ══════════════════════════════════════════════
  // CONVERSATION SCREEN (Demo + Live)
  // ══════════════════════════════════════════════
  return (
    <main className="app-shell">
      {/* ── Top bar ── */}
      <header className="topbar app-topbar">
        <Brand />
        <div className="room-top">
          <span className={`connection-dot ${connectionDotClass}`} />
          {connectionDisplayText}
          <span className="top-divider" />
          {mode === 'demo' ? (
            <span className="demo-pill">DEMO MODE</span>
          ) : (
            <>
              <span className="room-id">ROOM {roomCode}</span>
              <button className="icon-btn copy-btn" onClick={copyRoom} title="Copy room code">
                <Copy size={14} />
              </button>
            </>
          )}
        </div>
        <div className="top-actions">
          <button
            className="icon-btn"
            onClick={() => setShowHelp(true)}
            title="Help"
          >
            <CircleHelp size={17} />
          </button>
          <button
            className="text-btn"
            onClick={mode === 'demo' ? exitDemo : leaveRoom}
          >
            {mode === 'demo' ? 'Join someone' : 'Leave room'}{' '}
            <ArrowUpRight size={15} />
          </button>
        </div>
      </header>

      {/* ── Intro + Heat ── */}
      <section className="conversation-intro">
        <div>
          <div className="eyebrow lime-text">
            <span className="live-pulse" /> LIVE TRANSLATION ROOM
          </div>
          <h1>
            Say what you <em>mean.</em>
          </h1>
          <p>Talk over each other. Back down. Get understood.</p>
        </div>
        <div className="heat-card">
          <div className="heat-top">
            <span className="eyebrow">
              <Zap size={12} /> ARGUMENT HEAT
            </span>
            <span className={heat > 66 ? 'heat-status hot' : 'heat-status'}>
              {heatLabel}
            </span>
          </div>
          <div className="heat-track">
            <div
              className={`heat-fill ${heat > 66 ? 'hot' : ''}`}
              style={{ width: `${heat}%` }}
            />
          </div>
          <div className="heat-bottom">
            <span>CALM</span>
            <span>{heat}%</span>
            <span>HEATED</span>
          </div>
        </div>
      </section>

      {/* ── Demo banner ── */}
      {mode === 'demo' && (
        <div className="demo-banner">
          <div className="demo-banner-icon">
            <AudioLines size={18} />
          </div>
          <div>
            <b>Watch a disagreement unfold</b>
            <p>
              Alex speaks English. Lucía speaks Spanish. See an interruption, a
              concession, and a shift in tone.
            </p>
          </div>
          <div className="demo-actions">
            <button className="demo-play" onClick={playDemo} disabled={demoPlaying}>
              {demoPlaying ? (
                <>
                  <span className="mini-spinner" /> Playing
                </>
              ) : (
                <>
                  <Zap size={15} />{' '}
                  {messages.length ? 'Replay argument' : 'Play argument'}
                </>
              )}
            </button>
            {messages.length > 0 && (
              <button
                className="demo-reset"
                onClick={resetDemo}
                title="Reset demo"
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Reconnecting banner ── */}
      {reconnecting && (
        <div className="reconnect-banner">
          <span className="mini-spinner" />
          <span>{connectionText}</span>
        </div>
      )}

      {/* ── People Grid ── */}
      <section className="people-grid">
        <PersonPanel
          person={local}
          isLocal
          isDemo={mode === 'demo'}
          statusLabel={
            listening
              ? 'LISTENING'
              : interruptedSide === local.side
              ? 'INTERRUPTED'
              : translationBusy
              ? 'TRANSLATING'
              : null
          }
          active={listening || isInterrupting}
          onLangChange={setMyLang}
          language={myLang}
          languages={LANGUAGES}
          name={mode === 'demo' ? 'Alex' : myName}
          onNameChange={setMyName}
          connectionStatus={connectionStatus}
        />
        <div className="bridge">
          <div className={`bridge-orbit ${heat > 67 ? 'warm' : ''}`}>
            <Languages size={23} />
          </div>
          <div className="bridge-line" />
          <div className="bridge-label">THE BRIDGE</div>
          <span className="bridge-status">
            {connected
              ? 'Connected'
              : mode === 'demo'
              ? 'Sample conversation'
              : reconnecting
              ? 'Reconnecting…'
              : 'Waiting for partner'}
          </span>
          <div className="bridge-translate">
            <ArrowDownLeft size={14} />
            <span>Translate</span>
            <ArrowUpRight size={14} />
          </div>
        </div>
        <PersonPanel
          person={partner}
          isLocal={false}
          isDemo={mode === 'demo'}
          statusLabel={
            interruptedSide === partner.side
              ? 'INTERRUPTED'
              : null
          }
          active={isInterrupting && interruptedSide === partner.side}
          onLangChange={handlePartnerLangChange}
          language={partnerLang}
          languages={LANGUAGES}
          name={mode === 'demo' ? 'Lucía' : partnerName}
          onNameChange={setPartnerName}
          connectionStatus={connectionStatus}
        />
      </section>

      {/* ── Transcript ── */}
      <section className="transcript-section">
        <div className="transcript-header">
          <div>
            <span className="eyebrow">THE RECEIPT</span>
            <h2>What was actually said.</h2>
          </div>
          <div className="transcript-tools">
            <span className="transcript-count">
              {messages.filter((m) => m.kind === 'speech' || m.kind === 'change-mind-statement').length} LINES
            </span>
            <button
              className={`sound-toggle ${speaking ? 'enabled' : ''}`}
              onClick={() => {
                setSpeaking((v) => !v);
                if (speaking) cancelSpeech();
              }}
            >
              <span className="sound-icon">
                {speaking ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </span>
              {speaking ? 'Voice on' : 'Voice off'}
            </button>
          </div>
        </div>

        <div className="transcript-list" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-transcript">
              <MessageSquareText size={22} />
              <b>The first word is the hardest.</b>
              <span>Say it, type it, or watch the sample argument.</span>
            </div>
          ) : (
            messages.map((message) => (
              <TranscriptMessage
                key={message.id}
                message={message}
                localSide={mode === 'demo' ? typingSide : local.side}
                onRetry={handleRetryTranslation}
              />
            ))
          )}
          <div ref={transcriptEndRef} id="transcript-end" />
        </div>
      </section>

      {/* ── Composer ── */}
      <section className={`composer ${isInterrupting ? 'interrupted' : ''}`}>
        {/* Demo side toggle */}
        {mode === 'demo' && (
          <div className="side-toggle">
            <span className="eyebrow">SPEAK AS</span>
            <button
              className={typingSide === 'a' ? 'active' : ''}
              onClick={() => setTypingSide('a')}
            >
              A · Alex / {getLang(myLang).short}
            </button>
            <button
              className={typingSide === 'b' ? 'active' : ''}
              onClick={() => setTypingSide('b')}
            >
              B · Lucía / {getLang(partnerLang).short}
            </button>
          </div>
        )}

        {/* Change-mind compose mode */}
        {changeMindMode ? (
          <div className="change-mind-compose">
            <div className="change-mind-header">
              <RotateCcw size={15} />
              <span>What did you change your mind about?</span>
              <button
                className="change-mind-close"
                onClick={() => { setChangeMindMode(false); setChangeMindDraft(''); }}
              >
                <X size={15} />
              </button>
            </div>
            {changeMindTarget && (
              <div className="change-mind-ref">
                <span className="change-ref-label">Your earlier statement:</span>
                <span className="change-ref-text">&ldquo;{changeMindTarget.sourceText}&rdquo;</span>
              </div>
            )}
            <form
              className="composer-row"
              onSubmit={(e) => { e.preventDefault(); handleChangeMindSend(); }}
            >
              <input
                ref={changeMindInputRef}
                value={changeMindDraft}
                onChange={(e) => setChangeMindDraft(e.target.value)}
                placeholder="Write your revised position…"
                maxLength={480}
                autoFocus
              />
              <button
                className="send-btn change-send"
                type="submit"
                disabled={!changeMindDraft.trim() || translationBusy}
              >
                {translationBusy ? (
                  <span className="mini-spinner dark" />
                ) : (
                  <>
                    <span>Send revision</span>
                    <RotateCcw size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Normal compose mode */
          <>
            <form
              className="composer-row"
              onSubmit={(e) => {
                e.preventDefault();
                translateAndSend(draft);
              }}
            >
              <button
                type="button"
                onClick={startListening}
                className={`mic-btn ${listening ? 'listening' : ''}`}
                title={listening ? 'Stop listening' : 'Speak'}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  listening
                    ? 'Listening…'
                    : `Type in ${
                        getLang(
                          mode === 'demo'
                            ? typingSide === 'a'
                              ? myLang
                              : partnerLang
                            : myLang
                        ).label
                      }…`
                }
                maxLength={480}
              />
              <button
                className="send-btn"
                type="submit"
                disabled={!draft.trim() || translationBusy}
              >
                {translationBusy ? (
                  <span className="mini-spinner dark" />
                ) : (
                  <>
                    <span>Send</span>
                    <ArrowUpRight size={16} />
                  </>
                )}
              </button>
            </form>
            <div className="composer-bottom">
              <span>
                <span className="kbd">Enter</span> to send{' '}
                <span className="bottom-dot">·</span> Messages are translated
                before they cross
              </span>
              <div className="action-buttons">
                <button className="interrupt-btn" onClick={handleInterrupt}>
                  <Swords size={15} /> Interrupt
                </button>
                <button className="change-btn" onClick={handleChangeMindStart}>
                  <RotateCcw size={15} /> I changed my mind
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <span>
          CrossTalk <span className="footer-cross">×</span> a prototype for
          getting through to each other
        </span>
        <span>
          <span className="privacy-dot" /> Text translation by MyMemory · Voice
          via your browser
        </span>
      </footer>

      <Toast message={toast} />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </main>
  );
}
