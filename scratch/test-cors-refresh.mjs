process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testCors() {
  console.log('Testing CORS preflight for /api/auth/refresh...');
  const res = await fetch('https://insforge.kora.ovh/api/auth/refresh', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization,apikey,x-csrf-token'
    }
  });
  console.log('OPTIONS status:', res.status);
  console.log('OPTIONS headers:', Object.fromEntries(res.headers.entries()));
}

testCors().catch(console.error);
