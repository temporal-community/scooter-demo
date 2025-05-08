import fs from 'fs/promises';
import { Connection, Client } from '@temporalio/client';
import { NativeConnection } from '@temporalio/worker';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { getEnv } from './interfaces/env';
import { addDistanceSignal, endRideSignal } from './workflows';

async function main() {
  const argv = await yargs(hideBin(process.argv)).options({
    scooterId: { type: 'string', demandOption: true },
    addDistance: { type: 'boolean' },
    endRide: { type: 'boolean' },
  }).parse();

  const env = getEnv();
  let connection: Connection | NativeConnection;

  if (env.clientCertPath && env.clientKeyPath) {
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
    connection = await Connection.connect({
      address: env.address,
      tls: true,
      apiKey: env.clientApiKey,
      metadata: {
        'temporal-namespace': env.namespace,
      },
    });
  } else {
    connection = await Connection.connect({ address: env.address });
  }

  const client = new Client({ connection, namespace: env.namespace });

  const workflowId = `scooter-session-${argv.scooterId}`;

  const handle = client.workflow.getHandle(workflowId);

  if (argv.addDistance !== undefined) {
    await handle.signal(addDistanceSignal);
    console.log(`✅ Sent addDistance(${argv.addDistance}) to ${workflowId}`);
  } else if (argv.endRide) {
    await handle.signal(endRideSignal);
    console.log(`✅ Sent endRide() to ${workflowId}`);
  } else {
    console.log('⚠️ No signal provided. Use --addDistance or --endRide');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
