import keywords from '../data/chat/keywords.json';
import barkDict from '../data/chat/barkdict.json';
import quickReplies from '../data/chat/quickReplies.json';
import { seeded, pick } from './rng.js';

const voiceModules = import.meta.glob('../data/chat/voices/*.json', { eager: true, import: 'default' });
const voiceData = Object.fromEntries(Object.values(voiceModules).map((voice) => [voice.id, voice]));

function findTopic(text) {
  const lowerText = text.toLowerCase();
  return Object.entries(keywords).find(([, terms]) => terms.some((term) => new RegExp(`(^|\\W)${term}($|\\W)`).test(lowerText)))?.[0];
}

export function openingMessage(dog, profile) {
  const voice = voiceData[dog.voice];
  return pick(seeded(`${dog.id}:${profile.id}:opener`), voice.openers);
}

export function selectReply(dog, profile, userText, history = []) {
  const voice = voiceData[dog.voice];
  const lowerText = userText.toLowerCase();
  const topic = findTopic(lowerText);
  const historyIndex = history.length;
  const random = seeded(`${dog.id}:${profile.id}:reply:${historyIndex}:${lowerText}`);
  const topicTags = {
    ball: ['fetch', 'tennis-ball'], walk: ['long-walks'], treat: ['treats'], park: ['park', 'swimming'],
    cat: ['cats'], bath: ['baths'], nap: ['naps'], love: ['cuddles'],
  };
  let responses = topic ? voice.responses[topic] : null;
  if (topic && (dog.likes || []).some((tag) => (topicTags[topic] || []).includes(tag))) {
    responses = voice.reactions.like.map((line) => line.replace('{topic}', topic));
  } else if (topic && (dog.dislikes || []).some((tag) => (topicTags[topic] || []).includes(tag))) {
    responses = voice.reactions.dislike.map((line) => line.replace('{topic}', topic));
  }
  const previousDogReply = history.filter((message) => message.from === 'dog').at(-1)?.text;
  const candidates = responses?.filter((line) => previousDogReply !== line);
  const fallbackLines = voice.fallbacks.filter((line) => line !== previousDogReply);
  const text = pick(random, candidates?.length ? candidates : fallbackLines.length ? fallbackLines : voice.fallbacks);
  return { text, topic: topic || 'general' };
}

export function typingDelayMs(dog, text) {
  const speed = voiceData[dog.voice]?.typingSpeed || 1;
  return Math.min(3000, Math.max(1000, Math.round((700 + text.length * 24) * speed)));
}

export function toBark(text, dictionary = barkDict, rng = seeded(text)) {
  const words = text.toLowerCase().match(/[a-z']+|[!?.,]/g) || [];
  const translated = words.map((word) => {
    if (/^[!?.,]$/.test(word)) return word;
    return dictionary[word] || (rng() > 0.5 ? 'woof' : 'arf');
  });
  return translated.join(' ').replace(/\s+([!?.,])/g, '$1');
}

export function suggestReplies(history, dog) {
  const latest = history.at(-1)?.text?.toLowerCase() || '';
  const topic = findTopic(latest);
  const options = quickReplies[topic] || quickReplies.general;
  return options.map((reply) => reply.replace('{name}', dog.name));
}
