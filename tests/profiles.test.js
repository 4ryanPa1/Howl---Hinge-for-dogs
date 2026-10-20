import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDogs } from '../src/engine/profiles.js';

const profiles = [{
  id: 'biscuit',
  breed: 'golden-retriever',
  photos: ['original-1.jpg', 'original-2.jpg'],
  prompts: [{ promptId: 'old-prompt', answer: 'old answer' }],
}];
const photosByDog = {
  biscuit: [
    'biscuit-1.jpg', 'biscuit-2.jpg', 'biscuit-3.jpg',
    'biscuit-4.jpg', 'biscuit-5.jpg', 'biscuit-6.jpg',
  ],
};
const photosByBreed = {
  'golden-retriever': [
    'breed-1.jpg', 'breed-2.jpg', 'breed-3.jpg',
    'breed-4.jpg', 'breed-5.jpg', 'breed-6.jpg',
  ],
};
const prompts = [
  { id: 'walk', suggestions: ['Long walks.', 'Short walks.'] },
  { id: 'nap', suggestions: ['Big naps.', 'Tiny naps.'] },
];

test('generated profiles consistently randomize photos and prompt suggestions', () => {
  const first = generateDogs(profiles, photosByDog, photosByBreed, prompts);
  const second = generateDogs(profiles, photosByDog, photosByBreed, prompts);

  assert.deepEqual(first, second);
  assert.equal(first[0].photos.length, 6);
  assert.equal(new Set(first[0].photos).size, 6);
  assert.ok(first[0].photos.every((photo) => photosByDog.biscuit.includes(photo)));
  assert.equal(first[0].prompts.length, profiles[0].prompts.length);
  assert.ok(prompts.some((prompt) => prompt.id === first[0].prompts[0].promptId));
  assert.ok(prompts.find((prompt) => prompt.id === first[0].prompts[0].promptId).suggestions.includes(first[0].prompts[0].answer));
});

test('generated profiles use breed illustrations until their own photos are added', () => {
  const [dog] = generateDogs(profiles, { biscuit: [] }, {}, prompts);
  assert.equal(dog.photos.length, profiles[0].photos.length);
  assert.ok(dog.photos.every((photo) => profiles[0].photos.includes(photo)));
});

test('generated profiles use breed photos when no dog-specific photos exist', () => {
  const [dog] = generateDogs(profiles, { biscuit: [] }, photosByBreed, prompts);
  assert.equal(dog.photos.length, 6);
  assert.ok(dog.photos.every((photo) => photosByBreed['golden-retriever'].includes(photo)));
});

test('profiles can keep authored prompt answers', () => {
  const authored = [{
    ...profiles[0],
    useAuthoredPrompts: true,
    prompts: [{ promptId: 'walk', answer: 'Meet me at the park.' }],
  }];
  const [dog] = generateDogs(authored, photosByDog, photosByBreed, prompts);
  assert.deepEqual(dog.prompts, authored[0].prompts);
});
