import React from 'react';
import { Globe2, ChevronDown, ShieldCheck } from 'lucide-react';
import { getLang } from '../constants.js';

/** Person panel showing participant identity, language, and status. */
export function PersonPanel({
  person,
  isLocal,
  isDemo,
  active,
  language,
  onLangChange,
  languages,
  name,
  onNameChange,
  connectionStatus,
}) {
  const displayName = isDemo ? person.name : isLocal ? name : person.name;
  const langObj = getLang(language || person.lang);

  return (
    <article
      className={`person-panel ${isLocal ? 'is-local' : 'is-remote'} ${
        active ? 'person-active' : ''
      }`}
    >
      <div className="person-head">
        <div className={`avatar ${isLocal ? 'avatar-a' : 'avatar-b'}`}>
          {(displayName || (isLocal ? 'A' : 'B')).charAt(0).toUpperCase()}
          <span
            className="avatar-status"
            title={
              isLocal
                ? 'You'
                : connectionStatus === 'connected'
                ? 'Connected'
                : 'Waiting'
            }
          />
        </div>
        <div className="person-name-block">
          {isLocal && !isDemo ? (
            <input
              aria-label="Your display name"
              className="name-edit"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              maxLength={28}
            />
          ) : (
            <b>{displayName}</b>
          )}
          <span>
            {isLocal ? 'YOUR SIDE' : 'THE OTHER SIDE'}{' '}
            <span className="panel-side-dot">·</span>{' '}
            {isLocal ? 'A' : 'B'}
          </span>
        </div>
        <div className="language-selector">
          <Globe2 size={13} />
          <select
            aria-label={`${isLocal ? 'Your' : "Partner's"} language`}
            value={language || person.lang}
            onChange={(e) => onLangChange(e.target.value)}
            disabled={!isLocal || isDemo}
          >
            {languages.map((l) => (
              <option value={l.code} key={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </div>
      </div>

      <div className="person-languages">
        <span className="language-code">{langObj.short}</span>
        <span className="language-wave">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
        <span className="language-caption">{langObj.label}</span>
        {active && (
          <span className="talking-pill">
            <span /> {isLocal && active ? 'SPEAKING' : 'INTERRUPTED'}
          </span>
        )}
      </div>

      <div className="person-foot">
        <span>
          {isDemo
            ? isLocal
              ? 'This side speaks first'
              : 'Translation appears here'
            : isLocal
            ? 'Microphone stays on your device'
            : `${person.name || 'Partner'} · across the room`}
        </span>
        <span className="encrypted-label">
          <ShieldCheck size={12} /> P2P
        </span>
      </div>
    </article>
  );
}
