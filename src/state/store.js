import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import appConfig from '../config/app.config.js';
import dogs from '../data/dogs/index.js';
import { initialInbound, scheduleInbound } from '../engine/likes.js';
import { loadState, saveState, validateProfile } from './persistence.js';

const StoreContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'SAVE_PROFILE': {
      const profile = validateProfile(action.profile);
      const inboundLikes = state.profile ? state.inboundLikes : initialInbound(profile, dogs, action.at);
      return { ...state, profile, inboundLikes, nextInboundAt: state.nextInboundAt || action.at + 90000 };
    }
    case 'SWIPE': {
      const bone = Boolean(action.bone && state.bones.remaining > 0);
      const swipes = { ...state.swipes, [action.dogId]: { action: action.action, bone, at: action.at, matchAt: action.matchAt || 0, comment: action.comment || '', targetRef: action.targetRef || '' } };
      const matches = action.matchAt && action.matchAt <= action.at
        ? { ...state.matches, [action.dogId]: { matchedAt: action.at, source: 'swipe' } }
        : state.matches;
      return { ...state, swipes, matches, seenIds: [...new Set([...state.seenIds, action.dogId])], lastDiscoverId: action.dogId, bones: bone ? { remaining: 0, resetAt: action.at + appConfig.periodHours * 3600000 } : state.bones, newMatch: matches[action.dogId] && !state.matches[action.dogId] ? action.dogId : state.newMatch };
    }
    case 'MATCH': {
      if (state.matches[action.dogId]) return state;
      return { ...state, matches: { ...state.matches, [action.dogId]: { matchedAt: action.at, source: action.source || 'swipe' } }, newMatch: action.show ? action.dogId : state.newMatch };
    }
    case 'DISMISS_MATCH':
      return { ...state, newMatch: null };
    case 'LIKE_BACK': {
      const matches = { ...state.matches, [action.dogId]: { matchedAt: action.at, source: 'like-back' } };
      const inboundLikes = { ...state.inboundLikes };
      if (inboundLikes[action.dogId]) inboundLikes[action.dogId] = { ...inboundLikes[action.dogId], status: 'matched' };
      return { ...state, matches, inboundLikes, newMatch: action.dogId, seenIds: [...new Set([...state.seenIds, action.dogId])] };
    }
    case 'PASS_INBOUND': {
      const inboundLikes = { ...state.inboundLikes };
      if (inboundLikes[action.dogId]) inboundLikes[action.dogId] = { ...inboundLikes[action.dogId], status: 'passed' };
      return { ...state, inboundLikes, seenIds: [...new Set([...state.seenIds, action.dogId])] };
    }
    case 'ADD_INBOUND':
      return { ...state, inboundLikes: { ...state.inboundLikes, [action.dogId]: action.like }, nextInboundAt: action.nextInboundAt };
    case 'APP_ARRIVAL': {
      const due = Object.entries(state.inboundLikes).filter(([, like]) => like.status === 'pending' && like.arrivesAt <= action.at);
      if (!due.length) return state;
      const inboundLikes = { ...state.inboundLikes };
      for (const [id, like] of due) inboundLikes[id] = { ...like, status: 'arrived' };
      return { ...state, inboundLikes };
    }
    case 'APPEND_CHAT': {
      const chat = [...(state.chats[action.dogId] || []), action.message];
      return { ...state, chats: { ...state.chats, [action.dogId]: chat } };
    }
    case 'MARK_READ': {
      const chat = (state.chats[action.dogId] || []).map((message) => message.from === 'dog' ? { ...message, read: true } : message);
      return { ...state, chats: { ...state.chats, [action.dogId]: chat } };
    }
    case 'SAVE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'RESET_BONE':
      return { ...state, bones: { remaining: appConfig.bonesPerPeriod, resetAt: 0 } };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, dogs.map((dog) => dog.id), loadState);
  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => {
    const tick = () => {
      const at = Date.now();
      dispatch({ type: 'APP_ARRIVAL', at });
      if (state.bones.remaining === 0 && state.bones.resetAt && state.bones.resetAt <= at) dispatch({ type: 'RESET_BONE' });
      for (const [dogId, swipe] of Object.entries(state.swipes)) {
        if (swipe.action === 'like' && swipe.matchAt && swipe.matchAt <= at && !state.matches[dogId]) {
          dispatch({ type: 'MATCH', dogId, at, source: 'swipe', show: true });
        }
      }
      const events = scheduleInbound({ ...state, dogs }, at);
      for (const event of events) dispatch({ type: 'ADD_INBOUND', ...event });
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state]);
  const value = useMemo(() => ({ state: { ...state, dogs }, dispatch }), [state]);
  return React.createElement(StoreContext.Provider, { value }, children);
}

export function useAppStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useAppStore must be used inside AppProvider.');
  return context;
}
