const baseUrl = 'https://insforge.kora.ovh';
const anonKey = 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba';

async function test() {
  const loginRes = await fetch(baseUrl + '/api/auth/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
    body: JSON.stringify({ email: 'usuario@segundocerebro.com', password: 'SegundoCerebro2026!' })
  });
  console.log('Login HTTP status:', loginRes.status);
  const text = await loginRes.text();
  console.log('Login response text:', text.slice(0, 300));
}
test().catch(console.error);
