import { createClient } from '@insforge/sdk';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
});

async function run() {
  console.log('Testing upload-strategy with expired token...');
  const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtpZF9kYTQ1ZWEwMzFkZTkzZTFhOTkzMGNjMGRhMDc4MDYzOSJ9.eyJzdWIiOiIwZjcyZTc0OC1kZTlkLTQ5MTUtYWJhYS01ZjQ5YjYyNjM0ZjEiLCJlbWFpbCI6InVzdWFyaW9Ac2VndW5kb2NlcmVicm8uY29tIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDkwMH0.invalid';

  const start = Date.now();
  const res = await fetch('https://insforge.kora.ovh/api/storage/buckets/app-storage/upload-strategy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${expiredToken}`,
      'apikey': 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
    },
    body: JSON.stringify({
      filename: 'users/0f72e748-de9d-4915-abaa-5f49b62634f1/notes/test.jpg',
      contentType: 'image/jpeg',
      size: 1000
    })
  });
  console.log(`Response in ${Date.now() - start}ms, status:`, res.status);
  console.log(await res.text());
}

run().catch(console.error);
