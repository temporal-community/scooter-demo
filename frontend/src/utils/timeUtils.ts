// Purpose: Utility functions for time formatting.

/** Converts raw seconds → "hh:mm" */
export const fmtTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/** Calculates elapsed seconds between two timestamps */
export const calculateElapsedSeconds = (startTime: string, endTime?: string): number => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    return Math.floor((end - start) / 1000);
};