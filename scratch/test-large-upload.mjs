import { createClient } from '@insforge/sdk';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
});

async function run() {
  const signInRes = await client.auth.signInWithPassword({
    email: 'usuario@segundocerebro.com',
    password: 'SegundoCerebro2026!'
  });
  const user = signInRes.data.user;

  const testSizes = [
    { name: '100KB', size: 100 * 1024 },
    { name: '1MB', size: 1024 * 1024 },
    { name: '3MB', size: 3 * 1024 * 1024 },
    { name: '6MB', size: 6 * 1024 * 1024 },
  ];

  for (const item of testSizes) {
    console.log(`\nTesting upload of ${item.name} (${item.size} bytes)...`);
    const buffer = Buffer.alloc(item.size, 0x42);
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const path = `users/${user.id}/notes/bench_${item.name}_${Date.now()}.jpg`;

    const start = Date.now();
    try {
      const res = await client.storage.from('app-storage').upload(path, blob);
      const elapsed = Date.now() - start;
      if (res.error) {
        console.error(`FAILED in ${elapsed}ms:`, res.error.message);
      } else {
        console.log(`SUCCESS in ${elapsed}ms! URL:`, res.data.url);
      }
    } catch (err) {
      console.error(`THREW in ${Date.now() - start}ms:`, err.message);
    }
  }
}

run().catch(console.error);
