const voiceModules = import.meta.glob('../data/chat/voices/*.json', { eager: true });
const voices = Object.values(voiceModules).map((module) => module.default.id);

export default voices;
