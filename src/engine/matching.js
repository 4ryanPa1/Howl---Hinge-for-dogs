import traits from '../config/traits.config.js';
import { seeded } from './rng.js';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function compatibility(profile, dog) {
  const sharedLikes = (profile.likes || []).filter((item) => dog.likes.includes(item));
  const clashes = [
    ...(profile.likes || []).filter((item) => dog.dislikes.includes(item)),
    ...(profile.dislikes || []).filter((item) => dog.likes.includes(item)),
  ];
  let score = 50 + sharedLikes.length * 10 - clashes.length * 25;
  const traitBreakdown = {};
  for (const trait of traits) {
    const penalty = trait.weight * Math.abs((profile.traits?.[trait.id] || 5) - (dog.traits?.[trait.id] || 5));
    traitBreakdown[trait.id] = -penalty;
    score -= penalty;
  }
  const pickinessPenalty = (dog.traits?.pickiness || 1) * 1.2;
  score -= pickinessPenalty;
  const lookingForBonus = profile.lookingFor === dog.lookingFor ? 8 : 0;
  score += lookingForBonus;
  return {
    score: Math.round(clamp(score, 0, 100)),
    breakdown: { base: 50, sharedLikes: sharedLikes.length * 10, clashes: -clashes.length * 25, traits: traitBreakdown, pickiness: -pickinessPenalty, lookingFor: lookingForBonus },
    sharedLikes,
    clashes: [...new Set(clashes)],
  };
}

export function likeBack(profile, dog, { bone = false } = {}) {
  const score = compatibility(profile, dog).score;
  const probability = clamp(score / 100 + (bone ? 0.25 : 0), 0.05, 0.95);
  const random = seeded(`${profile.id}${dog.id}match`);
  const willMatch = random() < probability;
  let delayMs = probability > 0.8 ? 0 : Math.floor(5000 + random() * 25001);
  const speed = dog.behavior?.replySpeed || 'normal';
  delayMs = Math.round(delayMs * ({ fast: 0.7, normal: 1, slow: 1.4 }[speed] || 1));
  return { willMatch, delayMs, probability };
}

export function rankForDiscover(profile, dogs, seenIds, lastSeenId = null) {
  const seen = new Set(seenIds);
  const unseenDogs = dogs.filter((dog) => !seen.has(dog.id));
  const rankedDogs = (unseenDogs.length ? unseenDogs : dogs)
    .map((dog) => ({ dog, score: compatibility(profile, dog).score, shuffle: seeded(`${profile.id}:${dog.id}:discover`)() }))
    .sort((a, b) => b.score + (b.shuffle - 0.5) * 3 - (a.score + (a.shuffle - 0.5) * 3))
    .map(({ dog }) => dog);
  if (unseenDogs.length || !lastSeenId) return rankedDogs;
  const lastIndex = rankedDogs.findIndex((dog) => dog.id === lastSeenId);
  return lastIndex < 0
    ? rankedDogs
    : [...rankedDogs.slice(lastIndex + 1), ...rankedDogs.slice(0, lastIndex + 1)];
}

export function sniffScore(profile, dog) {
  return compatibility(profile, dog).score;
}
