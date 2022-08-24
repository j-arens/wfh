import { createServer } from 'vite'
import { spawn } from 'node:child_process';

async function main() {
  let server = await createServer({
    mode: 'production',

    root: new URL('.', import.meta.url).pathname,

    server: {
      port: 7474,
      strictPort: true,
    },
  });

  await server.listen();

  let tests = spawn('pnpm', ['playwright', 'test'], { stdio: 'inherit' });

  tests.on('error', async (error) => {
    console.error(error);
    await server.close();
    process.exit(1);
  });

  tests.on('close', async () => {
    await server.close();
  });
}

main();
