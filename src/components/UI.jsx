import React from 'react';
import { NavLink } from 'react-router-dom';

const paths = {
  discover: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  standouts: <><path d="m12 3 2.2 5.1 5.5.5-4.2 3.6 1.3 5.4-4.8-2.9-4.8 2.9 1.3-5.4-4.2-3.6 5.5-.5L12 3Z" /><path d="m19 16 .8 1.8 1.7.2-1.3 1.1.4 1.7-1.6-.9-1.5.9.4-1.7-1.3-1.1 1.7-.2L19 16Z" /></>,
  likes: <path d="M20.8 8.6c0 5.1-8.8 10.4-8.8 10.4S3.2 13.7 3.2 8.6A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.5Z" />,
  matches: <><path d="M8 12h8M12 8v8" /><circle cx="12" cy="12" r="9" /></>,
  me: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  bone: <><path d="M7 9a2.5 2.5 0 1 1-3.5-3.5A2.5 2.5 0 1 1 7 2h10a2.5 2.5 0 1 1 3.5 3.5A2.5 2.5 0 1 1 17 9H7Z" transform="rotate(-35 12 12)" /><path d="m8 10 8 4" transform="rotate(-35 12 12)" /></>,
  verified: <><path d="m12 2 2.2 2 3-.1.9 2.9 2.5 1.7-.8 2.9.8 2.9-2.5 1.7-.9 2.9-3-.1-2.2 2-2.2-2-3 .1-.9-2.9-2.5-1.7.8-2.9-.8-2.9 2.5-1.7.9-2.9 3 .1Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  send: <><path d="m21 3-7.5 18-3.8-7.7L2 9.5 21 3Z" /><path d="M9.7 13.3 21 3" /></>,
};

export function Icon({ name, size = 22, fill = 'none' }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.me}</svg>;
}

export function Avatar({ dog, size = 'medium' }) {
  return <img className={`avatar avatar--${size}`} src={dog.photos[0]} alt={`${dog.name}, ${dog.breed.replaceAll('-', ' ')}`} />;
}

export function Badge({ children, tone = 'default' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function EmptyState({ title, body, action }) {
  return <section className="empty-state"><div className="empty-state__icon" aria-hidden="true">⌁</div><h2>{title}</h2>{body && <p>{body}</p>}{action}</section>;
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`button button--${variant} ${className}`} {...props}>{children}</button>;
}

export function TabBar({ state }) {
  const unread = Object.values(state.chats).flat().filter((message) => message.from === 'dog' && !message.read).length;
  const likes = Object.values(state.inboundLikes).filter((like) => !['passed', 'matched'].includes(like.status)).length;
  const tabs = [
    { to: '/discover', key: 'discover', label: 'Discover', icon: 'discover' },
    { to: '/standouts', key: 'standouts', label: 'Standouts', icon: 'standouts' },
    { to: '/likes', key: 'likes', label: 'Likes You', icon: 'likes', badge: likes },
    { to: '/matches', key: 'matches', label: 'Matches', icon: 'matches', badge: unread },
    { to: '/me', key: 'me', label: 'Me', icon: 'me' },
  ];
  return <nav className="tab-bar" aria-label="Main navigation">
    {tabs.map((tab) => <NavLink key={tab.key} to={tab.to} className={({ isActive }) => `tab-bar__item ${isActive ? 'is-active' : ''}`} aria-label={tab.label}>
      <span className="tab-bar__icon"><Icon name={tab.icon} fill={tab.key === 'likes' ? 'currentColor' : 'none'} />{tab.badge > 0 && <span className="tab-bar__badge">{tab.badge > 9 ? '9+' : tab.badge}</span>}</span>
      <span className="tab-bar__label">{tab.label}</span>
    </NavLink>)}
  </nav>;
}

export function HeartButton({ onClick, label = 'Like this photo or prompt' }) {
  return <button className="round-action heart-action" aria-label={label} onClick={onClick}><Icon name="likes" fill="currentColor" /></button>;
}

export function PassButton({ onClick }) {
  return <button className="round-action pass-action" aria-label="Pass on this dog" onClick={onClick}><Icon name="close" /></button>;
}

export function BoneButton({ children, disabled, className = '', ...props }) {
  return <button className={`bone-button ${className}`} disabled={disabled} {...props}><Icon name="bone" />{children}</button>;
}

export function Chip({ selected, children, ...props }) {
  return <button type="button" className={`chip ${selected ? 'is-selected' : ''}`} aria-pressed={selected} {...props}>{children}</button>;
}

export function ProgressBar({ value, max }) {
  return <div className="progress" role="progressbar" aria-valuemin="0" aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${(value / max) * 100}%` }} /></div>;
}

export function Sheet({ title, onClose, children }) {
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="sheet__handle" />
      <button className="icon-button sheet__close" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
      <h2 id="sheet-title">{title}</h2>{children}
    </section>
  </div>;
}
