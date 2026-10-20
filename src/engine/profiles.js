import { pick, seeded } from './rng.js';

const PROFILE_PHOTO_COUNT = 6;

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function generateDogs(profiles, photosByDog, photosByBreed, prompts) {
  return profiles.map((profile) => {
    const photos = photosByDog[profile.id]?.length
      ? photosByDog[profile.id]
      : photosByBreed[profile.breed] || profile.photos;
    if (!photos.length) throw new Error(`No dog photos available for breed "${profile.breed}".`);

    const photoRandom = seeded(`howl-profile-photos:${profile.id}`);
    const promptRandom = seeded(`howl-profile-prompts:${profile.id}`);
    const selectedPrompts = shuffled(prompts, promptRandom).slice(0, profile.prompts.length);

    return {
      ...profile,
      photos: shuffled(photos, photoRandom).slice(0, Math.min(PROFILE_PHOTO_COUNT, photos.length)),
      prompts: profile.useAuthoredPrompts
        ? profile.prompts
        : selectedPrompts.map((prompt) => ({
          promptId: prompt.id,
          answer: pick(promptRandom, prompt.suggestions),
        })),
    };
  });
}
