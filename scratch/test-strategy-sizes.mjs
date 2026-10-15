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
  const token = signInRes.data.accessToken;

  // Let's test upload-strategy response directly
  const sizes = [1024, 100 * 1024, 1024 * 1024, 5 * 1024 * 1024];

  for (const size of sizes) {
    const res = await fetch('https://insforge.kora.ovh/api/storage/buckets/app-storage/upload-strategy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
      },
      body: JSON.stringify({
        filename: `users/${user.id}/notes/test_${size}.jpg`,
        contentType: 'image/jpeg',
        size
      })
    });
    console.log(`Size ${size} bytes -> Status: ${res.status}`);
    const json = await res.json();
    console.log('Strategy response:', json);
  }
}

run().catch(console.error);
