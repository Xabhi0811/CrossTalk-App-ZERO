import React from 'react';
import { ShieldCheck, Check, X, RotateCcw, Swords } from 'lucide-react';

/** Brand logo component. */
export function Brand() {
  return (
    <div className="brand">
      <div className="brand-symbol">
        <span />
        <span />
        <span />
      </div>
      <span>
        CROSS<span className="brand-slash">/</span>TALK
      </span>
      <span className="brand-zero">AN EXPERIMENT BY ZERO</span>
    </div>
  );
}

/** Help / How-it-works modal. */
export function HelpModal({ onClose }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="help-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="eyebrow lime-text">A SMALL NOTE BEFORE YOU START</div>
        <h2>
          Translation is the bridge.
          <br />
          <em>Not the point.</em>
        </h2>
        <div className="help-list">
          <div>
            <span>01</span>
            <p>
              <b>Pick your language.</b> Each person speaks or types in their own
              language. Voice input needs Chrome or Edge and microphone permission.
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              <b>Send it across.</b> Text is translated using MyMemory before being
              shown to the other person. Accuracy depends on the translation service.
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              <b>Let the conversation be real.</b> Interrupt to cut off playback, or
              use &ldquo;I changed my mind&rdquo; to make a concession visible. This
              prototype sends text, not raw microphone audio.
            </p>
          </div>
        </div>
        <div className="help-warning">
          <ShieldCheck size={17} />
          <span>
            Do not use CrossTalk for urgent, legal, or medical conversations.
            Translation can be wrong.
          </span>
        </div>
        <button className="primary-btn full" onClick={onClose}>
          Got it <Check size={17} />
        </button>
      </section>
    </div>
  );
}

/** Toast notification. */
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="toast" role="alert">
      <Check size={16} />
      {message}
    </div>
  );
}

/** Single transcript message. */
export function TranscriptMessage({ message, localSide, onRetry }) {
  if (message.kind === 'system') {
    return (
      <div className="system-line">
        <span className="system-dot" />
        {message.text}
        <time>{message.time}</time>
      </div>
    );
  }

  if (message.kind === 'event') {
    return (
      <div
        className={`event-line ${
          message.side === localSide ? 'event-local' : 'event-remote'
        }`}
      >
        <span className="event-icon">
          {message.text.toLowerCase().includes('mind') ? (
            <RotateCcw size={13} />
          ) : (
            <Swords size={13} />
          )}
        </span>
        <span>{message.text}</span>
      </div>
    );
  }

  if (message.kind === 'change-mind-statement') {
    const local = message.side === localSide;
    const replyText =
      typeof message.replyTo === 'object' && message.replyTo !== null
        ? local
          ? message.replyTo.sourceText
          : message.replyTo.translatedText || message.replyTo.sourceText
        : message.replyTo;

    return (
      <article
        className={`message-row ${local ? 'message-local' : 'message-remote'} tone-soft change-mind-msg`}
      >
        <div className={`message-avatar ${local ? 'avatar-a' : 'avatar-b'}`}>
          {(message.name || (local ? 'A' : 'B')).charAt(0).toUpperCase()}
        </div>
        <div className="message-body">
          <div className="message-meta">
            <b>{message.name || (local ? 'You' : 'Partner')}</b>
            <span className="concession-chip">
              <RotateCcw size={11} /> CHANGED THEIR MIND
            </span>
            <time>{message.time}</time>
          </div>
          {replyText && (
            <div className="change-mind-context">
              <span className="change-context-label">Reconsidering:</span>
              <span className="change-context-text">&ldquo;{replyText}&rdquo;</span>
            </div>
          )}
          <div className="message-bubble change-mind-bubble">
            <p>{message.sourceText}</p>
          </div>
          <div className="translation-line">
            <span className="translation-icon">
              <span className="change-mind-arrow">↻</span>
            </span>
            <span>
              {message.translating ? (
                <span className="translating-indicator">
                  <span className="mini-spinner" /> Translating…
                </span>
              ) : (
                message.translatedText
              )}
            </span>
            {!message.translating && (
              <span className="translated-label">
                {message.translationFailed ? 'ORIGINAL PRESERVED' : 'REVISED · TRANSLATED'}
              </span>
            )}
            {message.translationFailed && (message.onRetry || onRetry) && (
              <button
                className="retry-btn"
                onClick={() => (message.onRetry || onRetry)(message.id)}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  // Regular speech message
  const local = message.side === localSide;
  return (
    <article
      className={`message-row ${local ? 'message-local' : 'message-remote'} tone-${
        message.tone || 'normal'
      }`}
    >
      <div className={`message-avatar ${local ? 'avatar-a' : 'avatar-b'}`}>
        {(message.name || (local ? 'A' : 'B')).charAt(0).toUpperCase()}
      </div>
      <div className="message-body">
        <div className="message-meta">
          <b>{message.name || (local ? 'You' : 'Partner')}</b>
          <span>{message.sourceLang ? message.sourceLangLabel || '' : ''}</span>
          {message.changeMind && (
            <span className="concession-chip">
              <RotateCcw size={11} /> CHANGED THEIR MIND
            </span>
          )}
          <time>{message.time}</time>
        </div>
        <div className="message-bubble">
          <p>{message.sourceText || message.text}</p>
        </div>
        <div className="translation-line">
          <span className="translation-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
          </span>
          <span>
            {message.translating ? (
              <span className="translating-indicator">
                <span className="mini-spinner" /> Translating…
              </span>
            ) : (
              message.translatedText
            )}
          </span>
          {!message.translating && (
            <span className="translated-label">
              {message.translationFailed ? 'ORIGINAL PRESERVED' : 'TRANSLATED'}
            </span>
          )}
          {message.translationFailed && (message.onRetry || onRetry) && (
            <button
              className="retry-btn"
              onClick={() => (message.onRetry || onRetry)(message.id)}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
