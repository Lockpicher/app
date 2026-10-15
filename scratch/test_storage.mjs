const baseUrl = 'https://insforge.kora.ovh';
const anonKey = 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba';

async function test() {
  const loginRes = await fetch(baseUrl + '/api/auth/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
    body: JSON.stringify({ email: 'usuario@segundocerebro.com', password: 'SegundoCerebro2026!' })
  });
  console.log('Login HTTP status:', loginRes.status);
  const data = await loginRes.json();
  console.log('Login result:', data.user ? 'User ID: ' + data.user.id : 'No user', 'Token exists:', !!data.accessToken);

  if (data.accessToken) {
    const token = data.accessToken;
    const testBlob = new Blob(['test-insforge-payload-123'], { type: 'text/plain' });
    const filename = `test_${Date.now()}.txt`;
    
    // Check strategy
    const stratRes = await fetch(baseUrl + '/api/storage/buckets/app-storage/upload-strategy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        filename,
        contentType: 'text/plain',
        size: testBlob.size
      })
    });
    console.log('Upload strategy status:', stratRes.status);
    const strat = await stratRes.json();
    console.log('Upload strategy:', strat);

    if (strat.method === 'direct') {
      const formData = new FormData();
      formData.append('file', testBlob, filename);
      const putRes = await fetch(baseUrl + `/api/storage/buckets/app-storage/objects/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey
        },
        body: formData
      });
      console.log('Direct PUT status:', putRes.status);
      console.log('Direct PUT response:', await putRes.text());
    }
  }
}
test().catch(console.error);
