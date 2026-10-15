process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function run() {
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    try {
      const res = await fetch('https://insforge.kora.ovh/api/storage/buckets', {
        headers: { apikey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba' }
      });
      console.log(`Ping ${i}: status=${res.status} time=${Date.now() - t0}ms`);
    } catch (e) {
      console.log(`Ping ${i} failed after ${Date.now() - t0}ms:`, e.message);
    }
  }
}

run();
