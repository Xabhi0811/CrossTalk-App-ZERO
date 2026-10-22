/**
 * Speech recognition and synthesis service.
 * Wraps browser Web Speech API with proper error handling.
 */

/**
 * Check if speech recognition is supported.
 */
export function isSpeechRecognitionSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Check if speech synthesis is supported.
 */
export function isSpeechSynthesisSupported() {
  return 'speechSynthesis' in window;
}

/**
 * Create a speech recognition session.
 * @param {Object} options
 * @param {string} options.lang - BCP 47 language code
 * @param {Function} options.onInterim - Called with interim text
 * @param {Function} options.onFinal - Called with final text
 * @param {Function} options.onStart - Called when recognition starts
 * @param {Function} options.onEnd - Called when recognition ends
 * @param {Function} options.onError - Called with error message
 * @returns {Object} - { start(), stop() }
 */
export function createRecognition(options) {
  const { lang, onInterim, onFinal, onStart, onEnd, onError } = options;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return {
      start: () => onError('Speech recognition is not supported in this browser. Use Chrome or Edge.'),
      stop: () => {},
    };
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => onStart?.();
  recognition.onend = () => onEnd?.();

  recognition.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') {
      onEnd?.();
      return;
    }
    if (event.error === 'not-allowed') {
      onError('Microphone permission denied. Allow microphone access in your browser settings.');
    } else if (event.error === 'network') {
      onError('Network error during speech recognition. Check your connection.');
    } else {
      onError(`Mic error: ${event.error}. Check browser microphone permission.`);
    }
    onEnd?.();
  };

  recognition.onresult = (event) => {
    let interim = '';
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += transcript;
      else interim += transcript;
    }
    if (interim) onInterim?.(interim);
    if (finalText.trim()) onFinal?.(finalText.trim());
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        onError('Microphone is already active or unavailable.');
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch { /* already stopped */ }
    },
    instance: recognition,
  };
}

/**
 * Speak text using browser speech synthesis.
 * @param {string} text - Text to speak
 * @param {string} lang - BCP 47 language code for the voice
 * @param {Object} options
 * @param {number} options.rate - Speech rate (0.5 to 2.0)
 * @returns {SpeechSynthesisUtterance|null}
 */
export function speakText(text, lang, options = {}) {
  if (!isSpeechSynthesisSupported() || !text) return null;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = options.rate || 1.02;

  // Try to find a suitable voice for the language
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = lang.split('-')[0];
  const matchingVoice = voices.find(v => v.lang === lang) ||
                        voices.find(v => v.lang.startsWith(langPrefix));
  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
}

/**
 * Cancel all ongoing speech synthesis.
 */
export function cancelSpeech() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
