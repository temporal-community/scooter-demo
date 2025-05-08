import fs from 'fs/promises';
import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import { Env, getEnv } from './interfaces/env';

/**
 * Run a Worker with either mTLS or API key authentication.
 * Configuration is provided via environment variables.
 * 
 * For mTLS: Requires clientCertPath and clientKeyPath
 * For API key: Requires clientApiKey
 * Note that serverNameOverride and serverRootCACertificate are optional.
 */
async function run({
  address,
  namespace,
  clientCertPath,
  clientKeyPath,
  clientApiKey,
  serverNameOverride,
  serverRootCACertificatePath,
  taskQueue,
}: Env) {
  let connection: NativeConnection;

  // Check for mTLS certificates first
  if (clientCertPath && clientKeyPath) {
    console.log('Using mTLS authentication');
    const serverRootCACertificate = serverRootCACertificatePath
      ? await fs.readFile(serverRootCACertificatePath)
      : undefined;

    connection = await NativeConnection.connect({
      address,
      tls: {
        serverNameOverride,
        serverRootCACertificate,
        clientCertPair: {
          crt: await fs.readFile(clientCertPath),
          key: await fs.readFile(clientKeyPath),
        },
      },
    });
  }
  // If no mTLS certificates, check for API key
  else if (clientApiKey) {
    console.log('Using API key authentication');
    connection = await NativeConnection.connect({
      address,
      tls: true,
      apiKey: clientApiKey,
      metadata: {
        'temporal-namespace': namespace,
      },
    });
  }
  // Fallback to unencrypted connection (not recommended for production)
  else {
    console.log('Warning: Using unencrypted connection');
    connection = await NativeConnection.connect({ address });
  }

  const worker = await Worker.create({
    connection,
    namespace,
    workflowsPath: require.resolve('./workflows'),
    taskQueue,
    activities,
  });

  console.log('Worker connection successfully established');

  await worker.run();
  await connection.close();
}

run(getEnv()).catch((err) => {
  console.error(err);
  process.exit(1);
});