export interface RideStateResponse {
  scooterId: string;
  emailAddress: string;
  customerId: string;
  meterName: string;
  rideTimeoutSecs: number;
  pricePerThousand: number;
  currency: string;
  status: {
    phase: 'INITIALIZING' | 'ACTIVE' | 'ENDED' | 'FAILED';
    startedAt: string;
    lastMeterAt: string;
    endedAt?: string;
    distanceFt: number;
    tokens: {
      unlock: number;
      time: number;
      distance: number;
      total: number;
    };
    lastError?: string;
  };
}

interface StartRideResponse {
  rideId: string;
  startedAt: number;
  workflowId: string;
}

interface ActionSuccessResponse {
  success: boolean;
  message: string;
}

const API_BASE_URL = 'http://localhost:3001';

export async function startRide(scooterId: string, emailAddress: string): Promise<StartRideResponse> {
  const response = await fetch(`${API_BASE_URL}/ride/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      scooterId, 
      emailAddress,
      pricePerThousand: 25,
      currency: "USD"
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start ride');
  }

  return response.json();
}

export async function endRide(workflowId: string): Promise<ActionSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/ride/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflowId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to end ride');
  }

  return response.json();
}

export async function getRideState(workflowId: string): Promise<RideStateResponse> {
  const response = await fetch(`${API_BASE_URL}/ride/state/${workflowId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get ride state');
  }

  return response.json();
}

export async function addDistance(workflowId: string): Promise<ActionSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/ride/add-distance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflowId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add distance');
  }

  return response.json();
}
  