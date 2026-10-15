process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testStorageCors() {
  console.log('Testing CORS preflight for Storage PUT...');
  const res = await fetch('https://insforge.kora.ovh/api/storage/buckets/app-storage/objects/users%2Ftest.jpg', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'authorization,apikey'
    }
  });
  console.log('Storage PUT OPTIONS status:', res.status);
  console.log('Storage PUT OPTIONS headers:', Object.fromEntries(res.headers.entries()));
}

testStorageCors().catch(console.error);
