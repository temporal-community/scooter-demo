import fs from 'fs/promises';
import { Connection, Client } from '@temporalio/client';
import { NativeConnection } from '@temporalio/worker';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runWorkflow } from './starter';
import { getEnv } from './interfaces/env';
import type { Env } from './interfaces/env';

interface EnvWithApiKey extends Env {
  clientApiKey?: string;
}

async function runWithScooter(env: EnvWithApiKey, scooterId: string, emailAddress: string) {
  let connection: Connection | NativeConnection;

  if (env.clientCertPath && env.clientKeyPath) {
    console.log('Using mTLS authentication');
    const serverRootCACertificate = env.serverRootCACertificatePath
      ? await fs.readFile(env.serverRootCACertificatePath)
      : undefined;

    connection = await Connection.connect({
      address: env.address,
      tls: {
        serverNameOverride: env.serverNameOverride,
        serverRootCACertificate,
        clientCertPair: {
          crt: await fs.readFile(env.clientCertPath),
          key: await fs.readFile(env.clientKeyPath),
        },
      },
    });
  } else if (env.clientApiKey) {
    console.log('Using API key authentication');
    connection = await Connection.connect({
      address: env.address,
      tls: true,
      apiKey: env.clientApiKey,
      metadata: {
        'temporal-namespace': env.namespace,
      },
    });
  } else {
    console.log('Warning: Using unencrypted connection');
    connection = await Connection.connect({ address: env.address });
  }

  const client = new Client({ connection, namespace: env.namespace });

  await runWorkflow(client, env.taskQueue, {
    scooterId,
        emailAddress,
    customerId: '',  // An Activity fetches this from Stripe, based on email address
    meterName: 'scooter-ride-tq',
    rideTimeoutSecs: 180,   // 3 minutes default
  });
}

const argv = yargs(hideBin(process.argv)).options({
  scooterId: { type: 'string', demandOption: true, describe: 'Unique ID of the scooter' },
  emailAddress: { type: 'string', demandOption: true, describe: 'e-mail address of the customer' }

}).argv as { scooterId: string, emailAddress: string };

runWithScooter(getEnv(), argv.scooterId, argv.emailAddress).then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
