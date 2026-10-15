import { createClient } from '@insforge/sdk';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
});

async function run() {
  console.log('1. Signing in...');
  const signInRes = await client.auth.signInWithPassword({
    email: 'usuario@segundocerebro.com',
    password: 'SegundoCerebro2026!'
  });
  const token = signInRes.data.accessToken;
  const user = signInRes.data.user;

  console.log('2. Testing direct PUT with FormData via native fetch...');
  const buffer = Buffer.alloc(50 * 1024, 0x58);
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  const objectPath = `users/${user.id}/notes/direct_fetch_test_${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append('file', blob, 'direct_fetch.jpg');

  const start = Date.now();
  const res = await fetch(`https://insforge.kora.ovh/api/storage/buckets/app-storage/objects/${encodeURIComponent(objectPath)}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
    },
    body: formData
  });

  console.log(`Direct fetch status (${Date.now() - start}ms):`, res.status);
  const data = await res.json();
  console.log('Direct fetch response:', data);
}

run().catch(console.error);
