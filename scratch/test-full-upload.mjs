import { createClient } from '@insforge/sdk';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
});

async function run() {
  console.log('1. Signing in with default workspace user...');
  const signInRes = await client.auth.signInWithPassword({
    email: 'usuario@segundocerebro.com',
    password: 'SegundoCerebro2026!'
  });
  console.log('Sign in result:', signInRes.data ? 'Success' : 'Failed', signInRes.error || '');
  const user = signInRes.data?.user;
  console.log('User id:', user?.id, 'email:', user?.email);

  console.log('2. Testing storage upload strategy with authenticated client...');
  const testData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const blob = new Blob([testData], { type: 'image/png' });

  const path = `users/${user.id}/notes/test_${Date.now()}.png`;
  console.log('Attempting upload to path:', path);
  
  const startTime = Date.now();
  try {
    const uploadRes = await client.storage.from('app-storage').upload(path, blob);
    console.log(`Upload result (${Date.now() - startTime}ms):`, uploadRes);
  } catch (err) {
    console.error(`Upload caught error (${Date.now() - startTime}ms):`, err);
  }
}

run().catch(console.error);
