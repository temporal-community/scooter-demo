interface RideStateResponse {
  distanceFt: number;
  elapsedSeconds: number;
  tokens: number;
}

interface StartRideResponse {
  rideId: string;
  startedAt: number;
  workflowId: string;
}

export async function startRide(scooterId: string, emailAddress: string): Promise<StartRideResponse> {
  // placeholder for POST /ride/start
  const workflowId = `scooter-session-${scooterId}`;
  console.log('startRide called for workflow:', workflowId, 'email:', emailAddress);
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

let lastDistanceFt = 0;
export async function getRideState(workflowId: string): Promise<RideStateResponse> {
  // Simulate a ride that moves forward by 1 foot per call
  lastDistanceFt += 1;
  return {
    distanceFt: lastDistanceFt,
    elapsedSeconds: Math.floor(Math.random() * 3600),
    tokens: Math.floor(Math.random() * 50)
  };
}

export async function addDistance(workflowId: string) {
  // placeholder for POST /ride/add-distance or signaling workflow
  console.log('addDistance called for workflow:', workflowId);
  return { success: true };
}
  