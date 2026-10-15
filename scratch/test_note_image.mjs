import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
});

async function testCreateNoteWithImage() {
  const notePayload = {
    title: 'Nota de Prueba con Imagen',
    content: '<p>Probando</p><img src="https://example.com/test.jpg" />',
    plain_text: 'Probando',
    note_type: 'image',
    thumbnail_url: 'https://example.com/test.jpg',
    category: 'General',
    is_pinned: false,
    is_favorite: false
  };

  const res = await client.database.from('app_notes').insert([notePayload]).select();
  console.log('Create note result error:', res.error);
  console.log('Create note result data:', res.data);

  if (res.data?.[0]?.id) {
    const noteId = res.data[0].id;
    const attPayload = {
      entity_id: noteId,
      entity_type: 'note',
      file_name: 'test_note_img.jpg',
      display_name: 'test_note_img.jpg',
      file_url: 'https://example.com/test.jpg',
      file_path: `notes/${noteId}/images/test.jpg`,
      bucket_name: 'app-storage',
      file_size: 5000,
      mime_type: 'image/jpeg'
    };

    const attRes = await client.database.from('app_attachments').insert([attPayload]).select();
    console.log('Create attachment result error:', attRes.error);
    console.log('Create attachment result data:', attRes.data);

    // Clean up
    await client.database.from('app_attachments').delete().eq('entity_id', noteId);
    await client.database.from('app_notes').delete().eq('id', noteId);
    console.log('Cleanup complete');
  }
}

testCreateNoteWithImage();
