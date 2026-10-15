import { createClient } from '@insforge/sdk';

const baseUrl = 'https://insforge.kora.ovh';
const anonKey = 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba';

const client = createClient({
  baseUrl,
  anonKey
});

const buckets = ['app-storage', 'compras', 'notas', 'productos', 'proyectos_tareas'];

async function check() {
  for (const b of buckets) {
    try {
      const res = await client.storage.from(b).list();
      console.log('--- Bucket:', b, '---');
      console.log('Error:', res.error);
      console.log('Objects:', res.data);
    } catch (e) {
      console.log('Exception in bucket', b, e.message);
    }
  }
}

check();
