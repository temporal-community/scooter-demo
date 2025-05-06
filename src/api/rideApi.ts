export async function startRide() {
    // placeholder for POST /ride/start
    return { rideId: 'demo', startedAt: Date.now() };
  }
  
  export async function endRide() {
    // placeholder for POST /ride/end
    return { tokens: 12.3 };
  }
  
  export async function getRideState() {
    // would normally GET /ride/state
    return { distanceKm: 0, elapsedSeconds: 0, tokens: 0 };
  }
  