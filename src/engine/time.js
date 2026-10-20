let clock = () => Date.now();

export const now = () => clock();
export const setClock = (nextClock) => {
  if (typeof nextClock !== 'function') throw new TypeError('Clock must be a function.');
  clock = nextClock;
};
export const resetClock = () => { clock = () => Date.now(); };
export const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
