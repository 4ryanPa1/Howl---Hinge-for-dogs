import appConfig from '../config/app.config.js';
import traits from '../config/traits.config.js';
import breeds from '../data/breeds.json';
import interests from '../data/interests.json';
import prompts from '../data/prompts.json';
import lookingForOptions from '../data/lookingFor.json';

function validateProfile(profile) {
  const fail = (field) => {
    console.error(`Invalid profile data in "${appConfig.storageKey}": ${field}`);
    throw new Error(`Saved profile is invalid: ${field}. Reset app data and create your profile again.`);
  };
  if (!profile || !/^[a-z0-9-]+$/.test(profile.id || '')) fail('id');
  if (typeof profile.name !== 'string' || !profile.name.trim()) fail('name');
  if (!Number.isInteger(profile.ageDogYears) || profile.ageDogYears < 1 || profile.ageDogYears > 20) fail('ageDogYears');
  if (!Number.isInteger(profile.heightPaws) || profile.heightPaws < 1) fail('heightPaws');
  if (!Array.isArray(profile.photos) || profile.photos.length < 3 || profile.photos.length > 6) fail('photos');
  const breed = breeds.find((item) => item.id === profile.breed);
  if (!breed) fail('breed');
  if (profile.photos.some((photo) => !breed.photos.includes(photo))) fail('photos');
  if (!Array.isArray(profile.prompts) || profile.prompts.length !== 3) fail('prompts');
  if (profile.prompts.some((prompt) => !prompts.some((item) => item.id === prompt.promptId) || typeof prompt.answer !== 'string' || !prompt.answer.trim() || prompt.answer.length > 120)) fail('prompts');
  if (!Array.isArray(profile.likes) || !Array.isArray(profile.dislikes)) fail('interests');
  const interestIds = new Set(interests.map((interest) => interest.id));
  if ([...profile.likes, ...profile.dislikes].some((interest) => !interestIds.has(interest))) fail('interests');
  if (!lookingForOptions.some((option) => option.id === profile.lookingFor)) fail('lookingFor');
  for (const trait of traits) {
    const value = profile.traits?.[trait.id];
    if (!Number.isInteger(value) || value < 1 || value > 10) fail(`traits.${trait.id}`);
  }
  return profile;
}

const blankState = () => ({
  version: appConfig.stateVersion,
  profile: null,
  swipes: {},
  lastDiscoverId: null,
  matches: {},
  inboundLikes: {},
  chats: {},
  bones: { remaining: appConfig.bonesPerPeriod, resetAt: 0 },
  seenIds: [],
  settings: { barkTranslateDefault: false },
  nextInboundAt: 0,
});

export function migrate(saved, availableDogIds) {
  let state = { ...saved };
  if (!Number.isInteger(state.version) || state.version < 1) state.version = 1;
  while (state.version < appConfig.stateVersion) {
    if (state.version === 1) state.version = 2;
  }
  const availableIds = availableDogIds ? new Set(availableDogIds) : null;
  const keepKnownDogs = (records) => availableIds
    ? Object.fromEntries(Object.entries(records || {}).filter(([dogId]) => availableIds.has(dogId)))
    : records;
  return {
    ...blankState(),
    ...state,
    profile: state.profile ? { heightPaws: 4, ...state.profile } : state.profile,
    lastDiscoverId: state.lastDiscoverId || null,
    swipes: keepKnownDogs(state.swipes),
    matches: keepKnownDogs(state.matches),
    inboundLikes: keepKnownDogs(state.inboundLikes),
    chats: keepKnownDogs(state.chats),
    seenIds: availableIds ? (state.seenIds || []).filter((dogId) => availableIds.has(dogId)) : state.seenIds,
    version: appConfig.stateVersion,
  };
}

export function loadState(availableDogIds) {
  const raw = window.localStorage.getItem(appConfig.storageKey);
  if (!raw) return blankState();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(`Unable to parse saved Howl data from "${appConfig.storageKey}".`, error);
    throw new Error('Saved app data is invalid. Use Reset app data after clearing the damaged browser storage.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid saved app data in "${appConfig.storageKey}".`);
  }
  const state = migrate(parsed, availableDogIds);
  if (state.profile) validateProfile(state.profile);
  return state;
}

export function saveState(state) {
  const { newMatch, ...persisted } = state;
  window.localStorage.setItem(appConfig.storageKey, JSON.stringify(persisted));
}

export function clearState() {
  window.localStorage.removeItem(appConfig.storageKey);
  return blankState();
}

export { validateProfile };
