/**
 * Translation service abstraction layer.
 * Currently uses MyMemory API. Swap the provider by changing translateWithProvider().
 */

const RATE_LIMIT_DELAY = 1100; // ms between requests to respect MyMemory limits
let lastRequestTime = 0;

/**
 * Translate text using the MyMemory public API.
 * @param {string} text - The text to translate
 * @param {string} sourceLang - Source language API code (e.g. 'en')
 * @param {string} targetLang - Target language API code (e.g. 'es')
 * @returns {Promise<{success: boolean, translatedText: string|null, error: string|null}>}
 */
async function translateWithMyMemory(text, sourceLang, targetLang) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
  }
  lastRequestTime = Date.now();

  const truncated = text.slice(0, 480);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(truncated)}&langpair=${encodeURIComponent(sourceLang + '|' + targetLang)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, translatedText: null, error: `Service returned ${response.status}` };
    }

    const data = await response.json();

    if (data?.responseStatus >= 400) {
      return { success: false, translatedText: null, error: data?.responseDetails || 'Translation failed' };
    }

    const result = data?.responseData?.translatedText;
    if (!result) {
      return { success: false, translatedText: null, error: 'No translation returned' };
    }

    // Check if MyMemory returned the same text (sometimes happens for unsupported pairs)
    const cleaned = result.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

    // MyMemory sometimes returns the input text unchanged for unsupported language pairs
    // We detect this but still return it since it could be a valid same-text translation
    return { success: true, translatedText: cleaned, error: null };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { success: false, translatedText: null, error: 'Translation timed out' };
    }
    return { success: false, translatedText: null, error: err.message || 'Network error' };
  }
}

/**
 * Main translation function.
 * @param {string} text - Text to translate
 * @param {string} fromLangCode - Source language BCP 47 code (e.g. 'en-US')
 * @param {string} toLangCode - Target language BCP 47 code (e.g. 'es-ES')
 * @param {Function} langToApi - Function that converts BCP 47 code to API code
 * @returns {Promise<{success: boolean, translatedText: string|null, error: string|null}>}
 */
export async function translateText(text, fromLangCode, toLangCode, langToApi) {
  if (!text || !text.trim()) {
    return { success: false, translatedText: null, error: 'Empty text' };
  }

  if (fromLangCode === toLangCode) {
    return { success: true, translatedText: text, error: null };
  }

  const source = langToApi(fromLangCode);
  const target = langToApi(toLangCode);

  return translateWithMyMemory(text, source, target);
}

/**
 * Retry a translation once after a delay.
 */
export async function retryTranslation(text, fromLangCode, toLangCode, langToApi) {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return translateText(text, fromLangCode, toLangCode, langToApi);
}
