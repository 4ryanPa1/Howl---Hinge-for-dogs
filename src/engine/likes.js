import appConfig from '../config/app.config.js';
import likeTemplates from '../data/likeTemplates.json';
import { seeded, pick } from './rng.js';
import { compatibility } from './matching.js';
import { now as currentTime } from './time.js';

export function generateLikeComment(dog, profile, index = 0) {
  const random = seeded(`${profile.id}:${dog.id}:comment:${index}`);
  const templates = likeTemplates[dog.voice] || likeTemplates.chill;
  const text = pick(random, templates).replace('{item}', pick(random, profile.likes.length ? profile.likes : ['your profile']));
  const targets = [
    ...(profile.photos || []).map((_, photoIndex) => `photo:${photoIndex}`),
    ...(profile.prompts || []).map((prompt) => `prompt:${prompt.promptId}`),
  ];
  return { text, targetRef: pick(random, targets) || 'photo:0' };
}

export function initialInbound(profile, dogs, timestamp = currentTime()) {
  const preferred = dogs.filter((dog) => dog.behavior.likesYouFirst);
  const ranked = dogs
    .filter((dog) => !preferred.some((candidate) => candidate.id === dog.id))
    .sort((a, b) => compatibility(profile, b).score - compatibility(profile, a).score);
  const selected = [...preferred, ...ranked].slice(0, appConfig.initialInboundCount);
  const inboundLikes = {};
  selected.forEach((dog) => {
    const comment = generateLikeComment(dog, profile);
    inboundLikes[dog.id] = {
      status: 'pending',
      comment: comment.text,
      targetRef: comment.targetRef,
      bone: Boolean(dog.behavior.sendsBone && Object.keys(inboundLikes).filter((id) => inboundLikes[id].bone).length < 2),
      arrivesAt: timestamp,
    };
  });
  return inboundLikes;
}

export function scheduleInbound(state, timestamp) {
  let activeCount = Object.values(state.inboundLikes).filter((like) => !['passed', 'matched'].includes(like.status)).length;
  let nextInboundAt = state.nextInboundAt;
  const reserved = new Set(Object.keys(state.inboundLikes));
  const events = [];
  while (state.profile && nextInboundAt && nextInboundAt <= timestamp && activeCount < appConfig.inboundCap) {
    const available = state.dogs.filter((dog) => !reserved.has(dog.id) && !state.swipes[dog.id]);
    if (!available.length) break;
    const scheduledAt = nextInboundAt;
    const random = seeded(`${state.profile.id}:inbound:${scheduledAt}`);
    const dog = pick(random, available);
    const comment = generateLikeComment(dog, state.profile, scheduledAt);
    nextInboundAt = scheduledAt + Math.floor(60000 + random() * 60001);
    events.push({
      dogId: dog.id,
      like: { status: 'pending', comment: comment.text, targetRef: comment.targetRef, bone: false, arrivesAt: scheduledAt },
      nextInboundAt,
    });
    reserved.add(dog.id);
    activeCount += 1;
  }
  return events;
}
