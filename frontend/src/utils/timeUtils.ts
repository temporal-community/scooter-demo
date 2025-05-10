// Purpose: Utility functions for time formatting.

/** Converts raw seconds → "hh:mm" */
export const fmtTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };