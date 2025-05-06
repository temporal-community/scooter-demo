import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Retrieves a required environment variable.
 * Throws an error if the variable is not set.
 * @param name - The name of the environment variable.
 * @returns The value of the environment variable.
 */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ReferenceError(`${name} environment variable is not defined`);
  }
  return value;
}

/**
 * Interface for application environment configuration.
 */
export interface EnvConfig {
  temporalAddress: string;
  temporalNamespace: string;
  temporalClientCertPath?: string;
  temporalClientKeyPath?: string;
  temporalApiKey?: string;
  temporalServerNameOverride?: string;
  temporalServerRootCACertPath?: string;
  temporalTaskQueue: string;
  port: number;
}

/**
 * Gets the environment configuration for the application.
 * @returns The environment configuration object.
 */
export function getEnvConfig(): EnvConfig {
  return {
    temporalAddress: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    temporalNamespace: process.env.TEMPORAL_NAMESPACE || 'default',
    temporalClientCertPath: process.env.TEMPORAL_CLIENT_CERT_PATH,
    temporalClientKeyPath: process.env.TEMPORAL_CLIENT_KEY_PATH,
    temporalApiKey: process.env.TEMPORAL_API_KEY,
    temporalServerNameOverride: process.env.TEMPORAL_SERVER_NAME_OVERRIDE,
    temporalServerRootCACertPath: process.env.TEMPORAL_SERVER_ROOT_CA_CERT_PATH,
    temporalTaskQueue: process.env.TEMPORAL_TASK_QUEUE || 'scooter-ride-tq',
    port: parseInt(process.env.PORT || '3001', 10),
  };
}
 