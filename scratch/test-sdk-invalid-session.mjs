import { createClient } from '@insforge/sdk';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
});

async function run() {
  console.log('Testing client with invalid token on storage upload...');
  const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtpZF9kYTQ1ZWEwMzFkZTkzZTFhOTkzMGNjMGRhMDc4MDYzOSJ9.eyJzdWIiOiIwZjcyZTc0OC1kZTlkLTQ5MTUtYWJhYS01ZjQ5YjYyNjM0ZjEiLCJlbWFpbCI6InVzdWFyaW9Ac2VndW5kb2NlcmVicm8uY29tIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDkwMH0.invalid';

  // Force fake session in tokenManager
  client.tokenManager.saveSession({
    accessToken: expiredToken,
    user: { id: '0f72e748-de9d-4915-abaa-5f49b62634f1', email: 'usuario@segundocerebro.com' }
  });

  const blob = new Blob([Buffer.from('hello')], { type: 'text/plain' });
  const start = Date.now();
  try {
    const res = await client.storage.from('app-storage').upload('test.txt', blob);
    console.log(`Finished in ${Date.now() - start}ms:`, res);
  } catch (err) {
    console.error(`Error in ${Date.now() - start}ms:`, err);
  }
}

run().catch(console.error);
