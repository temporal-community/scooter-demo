interface RideStateResponse {
  distanceKm: number;
  elapsedSeconds: number;
  tokens: number;
}

export async function startRide() {
    // placeholder for POST /ride/start
    return { rideId: 'demo', startedAt: Date.now() };
  }
  
  export async function endRide() {
    // placeholder for POST /ride/end
    console.log('endRide called');
    return { tokens: 12.3 };
  }
  
  export async function getRideState(): Promise<RideStateResponse> {
    // would normally GET /ride/state
    console.log('getRideState called');
    return {
      distanceKm: Math.floor(Math.random() * 100), // Returns a random integer between 0 and 99
      elapsedSeconds: Math.floor(Math.random() * 3600), // Random time between 0 and 1 hour
      tokens: Math.floor(Math.random() * 50) // Random tokens between 0 and 49
    };
  }
  
  export async function addDistance() {
    // placeholder for POST /ride/add-distance or signaling workflow
    console.log('addDistance called');
    // In a real scenario, this would trigger the addDistanceSignal
    // The backend would then update the ride state, which getRideState would pick up.
    return { success: true };
  }
  