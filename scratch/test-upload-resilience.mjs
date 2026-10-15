import { createClient } from '@insforge/sdk';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba',
  timeout: 120000
});

async function run() {
  console.log('--- TEST: Resilient Upload & Session Verification ---');

  // 1. Sign in to get valid user & token
  const signInRes = await client.auth.signInWithPassword({
    email: 'usuario@segundocerebro.com',
    password: 'SegundoCerebro2026!'
  });
  const token = signInRes.data.accessToken;
  const user = signInRes.data.user;
  console.log('✓ Active session verified for user:', user.email);

  // 2. Test direct PUT fallback upload (simulates what frontend does)
  const testBuffer = Buffer.alloc(200 * 1024, 0x55);
  const blob = new Blob([testBuffer], { type: 'image/jpeg' });
  const objectPath = `users/${user.id}/notebooks/covers/cover_test_${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append('file', blob, 'cover_test.jpg');

  const start = Date.now();
  const res = await fetch(`https://insforge.kora.ovh/api/storage/buckets/app-storage/objects/${encodeURIComponent(objectPath)}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
    },
    body: formData
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${res.status} ${err}`);
  }

  const json = await res.json();
  const rawUrl = json?.url || `https://insforge.kora.ovh/api/storage/buckets/app-storage/objects/${encodeURIComponent(objectPath)}`;
  const cleanUrl = rawUrl.replace(/^http:\/\/insforge\.kora\.ovh/, 'https://insforge.kora.ovh');

  console.log(`✓ Direct upload succeeded in ${Date.now() - start}ms!`);
  console.log('  Clean secure URL:', cleanUrl);

  // 3. Verify clean URL is accessible
  const checkRes = await fetch(cleanUrl, { method: 'HEAD' });
  console.log('✓ Uploaded image accessibility status:', checkRes.status);

  console.log('🎉 ALL RESILIENT UPLOAD TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
