const baseUrl = 'https://insforge.kora.ovh';
const anonKey = 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba';

async function test() {
  const loginRes = await fetch(baseUrl + '/api/auth/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
    body: JSON.stringify({ email: 'usuario@segundocerebro.com', password: 'SegundoCerebro2026!' })
  });
  const data = await loginRes.json();
  const token = data.accessToken;
  const userId = data.user.id;

  const testBlob = new Blob(['sample-nested-data'], { type: 'text/plain' });
  const cleanName = 'nested_test.txt';
  const objectPath = `users/${userId}/notes/${Date.now()}_${cleanName}`;

  console.log('Testing upload to nested path:', objectPath);
  const formData = new FormData();
  formData.append('file', testBlob, cleanName);

  // Strategy test first
  const stratRes = await fetch(baseUrl + '/api/storage/buckets/app-storage/upload-strategy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': anonKey
    },
    body: JSON.stringify({
      filename: objectPath,
      contentType: 'text/plain',
      size: testBlob.size
    })
  });
  console.log('Upload strategy status:', stratRes.status);
  const strat = await stratRes.json();
  console.log('Upload strategy result:', strat);

  // Direct PUT test
  const targetEndpoint = `${baseUrl}/api/storage/buckets/app-storage/objects/${encodeURIComponent(objectPath)}`;
  const putRes = await fetch(targetEndpoint, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': anonKey
    },
    body: formData
  });
  console.log('Direct PUT status:', putRes.status);
  console.log('Direct PUT text:', await putRes.text());
}

test().catch(console.error);
