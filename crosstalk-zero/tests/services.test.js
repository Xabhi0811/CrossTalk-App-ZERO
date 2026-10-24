import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGES,
  getLang,
  apiLang,
  makeRoomCode,
  extractRoomCode,
  makeMessageId,
  timeNow,
  DEMO_LINES,
} from '../src/constants.js';
import { translateText } from '../src/services/translation.js';
import { isSpeechRecognitionSupported, isSpeechSynthesisSupported, cancelSpeech } from '../src/services/speech.js';
import { createPeerConnection } from '../src/services/peer.js';

describe('Constants & Language Configuration', () => {
  test('defines required languages', () => {
    assert.ok(Array.isArray(LANGUAGES));
    assert.strictEqual(LANGUAGES.length >= 9, true);
    const codes = LANGUAGES.map((l) => l.code);
    assert.ok(codes.includes('en-US'));
    assert.ok(codes.includes('es-ES'));
    assert.ok(codes.includes('hi-IN'));
    assert.ok(codes.includes('fr-FR'));
    assert.ok(codes.includes('de-DE'));
  });

  test('getLang returns matching language or fallback', () => {
    const en = getLang('en-US');
    assert.strictEqual(en.label, 'English');
    assert.strictEqual(en.api, 'en');

    const fallback = getLang('unknown-code');
    assert.strictEqual(fallback.code, 'en-US');
  });

  test('apiLang converts BCP 47 code to API code', () => {
    assert.strictEqual(apiLang('es-ES'), 'es');
    assert.strictEqual(apiLang('hi-IN'), 'hi');
    assert.strictEqual(apiLang('zh-CN'), 'zh-CN');
  });

  test('makeRoomCode generates 5-char alphanumeric uppercase room codes', () => {
    const code1 = makeRoomCode();
    const code2 = makeRoomCode();
    assert.strictEqual(typeof code1, 'string');
    assert.strictEqual(code1.length, 5);
    assert.strictEqual(code1, code1.toUpperCase());
    assert.match(code1, /^[A-Z0-9]{5}$/);
  });

  test('extractRoomCode cleanly extracts codes from plain text, urls, and params', () => {
    assert.strictEqual(extractRoomCode('UZHJR'), 'UZHJR');
    assert.strictEqual(extractRoomCode('uzhjr'), 'UZHJR');
    assert.strictEqual(extractRoomCode('http://localhost:5173/?room=UZHJR'), 'UZHJR');
    assert.strictEqual(extractRoomCode('http://192.168.1.5:5173/?room=7KQ2M'), '7KQ2M');
    assert.strictEqual(extractRoomCode('https://example.com/crosstalk?lang=es&room=ABC12#top'), 'ABC12');
    assert.strictEqual(extractRoomCode('?room=TEST8'), 'TEST8');
    assert.strictEqual(extractRoomCode('  abc-456  '), 'ABC456');
    assert.strictEqual(extractRoomCode('http://'), '');
    assert.strictEqual(extractRoomCode(''), '');
    assert.strictEqual(extractRoomCode(null), '');
  });

  test('makeMessageId returns unique IDs', () => {
    const id1 = makeMessageId();
    const id2 = makeMessageId();
    assert.notStrictEqual(id1, id2);
  });

  test('timeNow returns formatted time string', () => {
    const time = timeNow();
    assert.strictEqual(typeof time, 'string');
    assert.match(time, /\d{1,2}:\d{2}/);
  });

  test('DEMO_LINES has valid dispute structure with interruption and concession', () => {
    assert.ok(DEMO_LINES.length >= 5);
    const hasInterrupt = DEMO_LINES.some((line) => line.interrupt);
    const hasChange = DEMO_LINES.some((line) => line.change);
    assert.ok(hasInterrupt, 'Demo should include an interruption');
    assert.ok(hasChange, 'Demo should include a changed mind concession');

    DEMO_LINES.forEach((line) => {
      assert.ok(line.from === 'a' || line.from === 'b');
      assert.ok(typeof line.original === 'string' && line.original.length > 0);
      assert.ok(typeof line.translated === 'string' && line.translated.length > 0);
    });
  });
});

describe('Translation Service', () => {
  test('returns empty error when text is empty or whitespace', async () => {
    const res1 = await translateText('', 'en-US', 'es-ES', apiLang);
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.error, 'Empty text');

    const res2 = await translateText('   ', 'en-US', 'es-ES', apiLang);
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.error, 'Empty text');
  });

  test('returns identical text immediately when source and target languages match', async () => {
    const res = await translateText('Hello friend', 'en-US', 'en-US', apiLang);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.translatedText, 'Hello friend');
    assert.strictEqual(res.error, null);
  });
});

describe('Speech Service Safe Fallbacks', () => {
  test('feature detection functions return booleans without crashing', () => {
    // In Node (no window), these return false safely
    assert.strictEqual(typeof isSpeechRecognitionSupported(), 'boolean');
    assert.strictEqual(typeof isSpeechSynthesisSupported(), 'boolean');
  });

  test('cancelSpeech does not throw when speechSynthesis is absent', () => {
    assert.doesNotThrow(() => {
      cancelSpeech();
    });
  });
});

describe('Peer Service Interface', () => {
  test('createPeerConnection is an exported function', () => {
    assert.strictEqual(typeof createPeerConnection, 'function');
  });
});
