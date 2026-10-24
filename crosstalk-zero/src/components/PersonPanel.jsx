import { Globe2, ChevronDown, ShieldCheck } from 'lucide-react';
import { getLang } from '../constants.js';

/** Person panel showing participant identity, language, and status. */
export function PersonPanel({
  person,
  isLocal,
  isDemo,
  active,
  statusLabel,
  language,
  onLangChange,
  languages,
  name,
  onNameChange,
  connectionStatus,
}) {
  const displayName = isLocal ? name : person.name;
  const langObj = getLang(language || person.lang);
  const displayStatus = statusLabel || (active ? (isLocal ? 'SPEAKING' : 'INTERRUPTED') : null);
  const roleLetter = (person.side || (isLocal ? 'a' : 'b')).toUpperCase();

  return (
    <article
      className={`person-panel ${isLocal ? 'is-local' : 'is-remote'} ${
        active || displayStatus ? 'person-active' : ''
      }`}
    >
      <div className="person-head">
        <div className={`avatar ${roleLetter === 'B' ? 'avatar-b' : 'avatar-a'}`}>
          {(displayName || roleLetter).charAt(0).toUpperCase()}
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
          {isLocal ? (
            <input
              aria-label="Your display name"
              className="name-edit"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter your name"
              maxLength={28}
            />
          ) : (
            <b>{displayName || 'Partner'}</b>
          )}
          <span>
            {isLocal ? 'YOUR SIDE' : 'THE OTHER SIDE'}{' '}
            <span className="panel-side-dot">·</span>{' '}
            {roleLetter}
          </span>
        </div>
        <div className="language-selector">
          <Globe2 size={13} className="selector-icon" />
          <select
            className="language-select"
            aria-label={`${isLocal ? 'Your' : "Partner's"} language`}
            value={language || person.lang}
            onChange={(e) => onLangChange(e.target.value)}
          >
            {languages.map((l) => (
              <option value={l.code} key={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="selector-arrow" />
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
        {displayStatus && (
          <span className="talking-pill">
            <span /> {displayStatus}
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
