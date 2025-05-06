interface RideStateResponse {
  distanceKm: number;
  elapsedSeconds: number;
  tokens: number;
}

interface StartRideResponse {
  rideId: string;
  startedAt: number;
  workflowId: string;
}

export async function startRide(scooterId: string): Promise<StartRideResponse> {
  // placeholder for POST /ride/start
  const workflowId = `scooter-session-${scooterId}`;
  return { 
    rideId: 'demo', 
    startedAt: Date.now(),
    workflowId 
  };
}

export async function endRide(workflowId: string) {
  // placeholder for POST /ride/end
  console.log('endRide called for workflow:', workflowId);
  return { tokens: 12.3 };
}

export async function getRideState(workflowId: string): Promise<RideStateResponse> {
  // would normally GET /ride/state
  console.log('getRideState called for workflow:', workflowId);
  return {
    distanceKm: Math.floor(Math.random() * 100),
    elapsedSeconds: Math.floor(Math.random() * 3600),
    tokens: Math.floor(Math.random() * 50)
  };
}

export async function addDistance(workflowId: string) {
  // placeholder for POST /ride/add-distance or signaling workflow
  console.log('addDistance called for workflow:', workflowId);
  return { success: true };
}
  