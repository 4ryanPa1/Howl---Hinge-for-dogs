import traits from '../../config/traits.config.js';
import interests from '../interests.json';
import breeds from '../breeds.json';
import prompts from '../prompts.json';
import voices from '../../config/voices.config.js';
import { generateDogs } from '../../engine/profiles.js';

const modules = import.meta.glob('./*.json', { eager: true, import: 'default' });
const photoModules = import.meta.glob('../dogPhotos/*/*/*.{jpg,jpeg,png,webp,avif}', { eager: true, import: 'default' });

function validateDog(dog, file) {
  const fail = (field) => { throw new Error(`Invalid dog data in ${file}: ${field}`); };
  if (!dog || !/^[a-z0-9-]+$/.test(dog.id || '')) fail('id');
  if (typeof dog.name !== 'string' || !dog.name.trim()) fail('name');
  if (!Number.isInteger(dog.ageDogYears) || dog.ageDogYears < 1) fail('ageDogYears');
  if (!Number.isInteger(dog.heightPaws) || dog.heightPaws < 1) fail('heightPaws');
  if (typeof dog.breed !== 'string') fail('breed');
  if (typeof dog.sizeLabel !== 'string') fail('sizeLabel');
  if (typeof dog.location !== 'string') fail('location');
  if (!Array.isArray(dog.photos) || !dog.photos.length || dog.photos.some((photo) => typeof photo !== 'string' || !/^\/(?:assets|src\/data\/dogPhotos)\//.test(photo))) fail('photos');
  if (!Array.isArray(dog.prompts) || !dog.prompts.length || dog.prompts.some((prompt) => !prompt.promptId || typeof prompt.answer !== 'string')) fail('prompts');
  if (dog.useAuthoredPrompts !== undefined && typeof dog.useAuthoredPrompts !== 'boolean') fail('useAuthoredPrompts');
  for (const trait of traits) {
    const value = dog.traits?.[trait.id];
    if (!Number.isInteger(value) || value < 1 || value > 10) fail(`traits.${trait.id}`);
  }
  if (!Array.isArray(dog.likes) || !Array.isArray(dog.dislikes)) fail('interests');
  if (typeof dog.lookingFor !== 'string') fail('lookingFor');
  if (!voices.includes(dog.voice)) fail('voice');
  if (typeof dog.behavior?.likesYouFirst !== 'boolean') fail('behavior.likesYouFirst');
  if (typeof dog.behavior?.sendsBone !== 'boolean') fail('behavior.sendsBone');
  if (!['fast', 'normal', 'slow'].includes(dog.behavior?.replySpeed)) fail('behavior.replySpeed');
  if (typeof dog.verified !== 'boolean') fail('verified');
  const vocabulary = new Set(interests.map((item) => item.id));
  for (const item of [...(dog.likes || []), ...(dog.dislikes || [])]) {
    if (!vocabulary.has(item)) console.warn(`Unknown interest "${item}" in ${file}`);
  }
  return dog;
}

const profiles = Object.entries(modules)
  .map(([file, dog]) => validateDog(dog, file))
  .sort((a, b) => a.id.localeCompare(b.id));

const photosByBreed = Object.fromEntries(breeds.map((breed) => [breed.id, [...breed.photos]]));
const profilesByFolder = new Map();
const slug = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const profile of profiles) {
  for (const folder of new Set([profile.id, slug(profile.name)])) {
    const existing = profilesByFolder.get(folder);
    if (existing && existing.id !== profile.id) {
      throw new Error(`Dog photo folder "${folder}" is ambiguous between "${existing.name}" and "${profile.name}".`);
    }
    profilesByFolder.set(folder, profile);
  }
}
const photosByDog = Object.fromEntries(profiles.map((profile) => [profile.id, []]));
for (const [file, photo] of Object.entries(photoModules).sort(([a], [b]) => a.localeCompare(b))) {
  const [, , breedFolder, dogFolder] = file.split('/');
  const breedId = slug(breedFolder);
  if (!photosByBreed[breedId]) {
    throw new Error(`Unknown breed folder "${breedFolder}" in dog photo library: ${file}`);
  }
  const profile = profilesByFolder.get(slug(dogFolder));
  if (!profile) {
    throw new Error(`Unknown dog folder "${dogFolder}" in dog photo library: ${file}`);
  }
  if (profile.breed !== breedId) {
    throw new Error(`Dog "${profile.name}" belongs to breed "${profile.breed}", not "${breedId}": ${file}`);
  }
  photosByDog[profile.id].push(photo);
}

const dogs = generateDogs(profiles, photosByDog, photosByBreed, prompts).map((dog) => validateDog(dog, `generated:${dog.id}`));

export default dogs;
export { validateDog };
