/**
 * Application constants and language configuration.
 */

export const LANGUAGES = [
  { label: 'English', code: 'en-US', short: 'EN', api: 'en' },
  { label: 'Hindi', code: 'hi-IN', short: 'HI', api: 'hi' },
  { label: 'Spanish', code: 'es-ES', short: 'ES', api: 'es' },
  { label: 'French', code: 'fr-FR', short: 'FR', api: 'fr' },
  { label: 'German', code: 'de-DE', short: 'DE', api: 'de' },
  { label: 'Portuguese', code: 'pt-BR', short: 'PT', api: 'pt' },
  { label: 'Japanese', code: 'ja-JP', short: 'JA', api: 'ja' },
  { label: 'Arabic', code: 'ar-SA', short: 'AR', api: 'ar' },
  { label: 'Mandarin Chinese', code: 'zh-CN', short: 'ZH', api: 'zh-CN' },
];

/** Get language object by BCP 47 code. */
export function getLang(code) {
  return LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
}

/** Get MyMemory API language code from BCP 47 code. */
export function apiLang(code) {
  return getLang(code).api;
}

/** Generate a short uppercase room code. */
export function makeRoomCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

/** Extract and sanitize a room code from raw input, URL, or query string. */
export function extractRoomCode(input) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim();

  // Try extracting from query parameter 'room'
  const match = str.match(/[?&]room=([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    str = match[1];
  } else if (/^https?:\/\//i.test(str)) {
    try {
      const url = new URL(str);
      const r = url.searchParams.get('room');
      str = r || '';
    } catch {
      str = '';
    }
  } else if (str.toLowerCase().startsWith('http')) {
    str = '';
  }

  // Clean to uppercase alphanumeric up to 8 characters
  return str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}

/** Format current time as HH:MM. */
export function timeNow() {
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

/** Generate a unique message ID. */
export function makeMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The demo argument script — Alex (English) vs Lucía (Spanish).
 * Shows disagreement, interruption, escalation, concession, and resolution.
 */
export const DEMO_LINES = [
  {
    from: 'a',
    original: 'You said you would be here at seven. It is almost eight.',
    translated: 'Dijiste que estarías aquí a las siete. Casi son las ocho.',
    tone: 'sharp',
  },
  {
    from: 'b',
    original: 'I told you the train was delayed. You never listen to me.',
    translated: 'Te dije que el tren se retrasó. Nunca me escuchas.',
    tone: 'sharp',
    interrupt: true,
  },
  {
    from: 'a',
    original: 'I am listening now. You could have sent one message.',
    translated: 'Te estoy escuchando ahora. Podrías haber enviado un mensaje.',
    tone: 'heated',
  },
  {
    from: 'b',
    original: 'You are right about the message. I should have sent it.',
    translated: 'Tienes razón con lo del mensaje. Debería haberlo enviado.',
    tone: 'soft',
    change: true,
    changeText: 'I was wrong to not text you. I should have sent a message as soon as the train was delayed.',
    changeTranslated: 'Me equivoqué al no escribirte. Debería haber enviado un mensaje en cuanto se retrasó el tren.',
  },
  {
    from: 'a',
    original: 'Fine. I was angry, but I should not have assumed you did not care.',
    translated: 'Está bien. Estaba enfadado, pero no debería haber supuesto que no te importaba.',
    tone: 'soft',
    change: true,
    changeText: 'I jumped to conclusions. You do care, and I should have trusted that instead of getting angry.',
    changeTranslated: 'Salté a conclusiones. Te importa, y debería haber confiado en eso en lugar de enfadarme.',
  },
  {
    from: 'b',
    original: 'Next time I will text you. Can we still get dinner?',
    translated: 'La próxima vez te escribiré. ¿Todavía podemos ir a cenar?',
    tone: 'warm',
  },
];

/** Maximum messages to keep in the conversation history. */
export const MAX_MESSAGES = 200;

/** Connection status labels. */
export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
};
