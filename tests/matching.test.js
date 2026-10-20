import test from 'node:test';
import assert from 'node:assert/strict';
import { compatibility, likeBack, rankForDiscover, sniffScore } from '../src/engine/matching.js';

const profile = {
  id: 'me',
  traits: { energy: 7, sociability: 6, pickiness: 4, playfulness: 8 },
  likes: ['fetch', 'naps'],
  dislikes: ['vacuum'],
  lookingFor: 'long-walks',
};

const dog = {
  id: 'biscuit',
  traits: { energy: 8, sociability: 8, pickiness: 3, playfulness: 9 },
  likes: ['fetch', 'tennis-ball'],
  dislikes: ['cats'],
  lookingFor: 'long-walks',
  behavior: { replySpeed: 'fast' },
};

test('compatibility reports shared interests, clashes, and a bounded score', () => {
  const result = compatibility(profile, { ...dog, likes: ['fetch', 'vacuum'] });
  assert.deepEqual(result.sharedLikes, ['fetch']);
  assert.deepEqual(result.clashes, ['vacuum']);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(sniffScore(profile, dog), compatibility(profile, dog).score);
});

test('like-back outcomes are deterministic for a profile and dog pair', () => {
  assert.deepEqual(likeBack(profile, dog), likeBack(profile, dog));
});

test('a Bone raises probability and outcome remains deterministic', () => {
  const withoutBone = likeBack(profile, dog);
  const withBone = likeBack(profile, dog, { bone: true });
  assert.ok(withBone.probability >= withoutBone.probability);
  assert.equal(withBone.willMatch, likeBack(profile, dog, { bone: true }).willMatch);
  assert.ok(withBone.probability <= 0.95);
});

test('like-back probability clamps to both documented bounds', () => {
  const veryCompatible = {
    ...profile,
    likes: Array.from({ length: 20 }, (_, index) => `interest-${index}`),
    traits: { energy: 5, sociability: 5, pickiness: 1, playfulness: 5 },
    lookingFor: 'playdates',
  };
  const verySelectiveDog = {
    ...dog,
    likes: veryCompatible.likes,
    dislikes: [],
    traits: { energy: 5, sociability: 5, pickiness: 1, playfulness: 5 },
    lookingFor: 'playdates',
  };
  const veryIncompatible = {
    ...profile,
    likes: Array.from({ length: 20 }, (_, index) => `interest-${index}`),
    traits: { energy: 1, sociability: 1, pickiness: 1, playfulness: 1 },
    lookingFor: 'playdates',
  };
  const stronglyDislikingDog = {
    ...dog,
    likes: [],
    dislikes: veryIncompatible.likes,
    traits: { energy: 10, sociability: 10, pickiness: 10, playfulness: 10 },
    lookingFor: 'not-a-match',
  };
  assert.equal(likeBack(veryCompatible, verySelectiveDog).probability, 0.95);
  assert.equal(likeBack(veryIncompatible, stronglyDislikingDog).probability, 0.05);
});

test('discover ranking is stable and excludes previously seen dogs', () => {
  const dogs = [dog, { ...dog, id: 'mochi' }, { ...dog, id: 'pepper' }];
  const first = rankForDiscover(profile, dogs, ['mochi']).map((item) => item.id);
  const second = rankForDiscover(profile, dogs, ['mochi']).map((item) => item.id);
  assert.deepEqual(first, second);
  assert.ok(!first.includes('mochi'));
});

test('discover starts a new cycle after every dog has been seen', () => {
  const dogs = [dog, { ...dog, id: 'mochi' }, { ...dog, id: 'pepper' }];
  const firstPass = rankForDiscover(profile, dogs, []);
  const cycle = rankForDiscover(profile, dogs, dogs.map((item) => item.id), firstPass[0].id);
  assert.equal(cycle.length, dogs.length);
  assert.deepEqual(new Set(cycle.map((item) => item.id)), new Set(dogs.map((item) => item.id)));
  assert.notEqual(cycle[0].id, firstPass[0].id);
});
