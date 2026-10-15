import { createClient } from '@insforge/sdk';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
});

async function testUpload() {
  console.log('Testing storage upload strategy...');
  const testData = Buffer.from('Hello world test image content');
  const blob = new Blob([testData], { type: 'text/plain' });

  console.log('Calling upload strategy endpoint directly first:');
  const stratRes = await fetch('https://insforge.kora.ovh/api/storage/buckets/app-storage/upload-strategy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba',
      'Authorization': 'Bearer anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
    },
    body: JSON.stringify({
      filename: 'test_file.txt',
      contentType: 'text/plain',
      size: testData.length
    })
  });
  console.log('Strategy HTTP Status:', stratRes.status);
  const stratJson = await stratRes.json().catch(async () => await stratRes.text());
  console.log('Strategy response:', stratJson);
}

testUpload().catch(console.error);
