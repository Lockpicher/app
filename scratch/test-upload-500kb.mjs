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

  console.log('Testing upload of 500KB file via client.storage.from().upload()...');
  const buffer = Buffer.alloc(500 * 1024, 0x41);
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  const path = `users/${user.id}/notes/test_500kb_${Date.now()}.jpg`;

  const start = Date.now();
  const res = await client.storage.from('app-storage').upload(path, blob);
  console.log(`Upload completed in ${Date.now() - start}ms:`, res);
}

run().catch(console.error);
