import { createClient } from '@insforge/sdk';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba'
});

async function run() {
  console.log('Fetching a task to test update...');
  const { data: tasks, error } = await client.database
    .from('app_tasks')
    .select()
    .limit(1);

  if (error || !tasks || tasks.length === 0) {
    console.error('Could not fetch task:', error);
    return;
  }

  const testTask = tasks[0];
  console.log('Found task:', testTask.id, testTask.title);

  console.log('Testing updateTask with taskData payload...');
  const taskData = {
    title: testTask.title,
    description: testTask.description || '',
    status: testTask.status,
    priority: testTask.priority,
    eisenhower: testTask.eisenhower,
    category_id: testTask.category_id,
    project_id: testTask.project_id,
    note_id: testTask.note_id,
    lista_id: testTask.lista_id,
    product_id: testTask.product_id,
    scheduled_date: testTask.scheduled_date,
    due_date: testTask.due_date,
    completed_at: testTask.completed_at,
    content_rich: {
      version: 1,
      has_multimedia: false
    },
    updated_at: new Date().toISOString()
  };

  const start = Date.now();
  const { data: updated, error: updateErr } = await client.database
    .from('app_tasks')
    .update(taskData)
    .eq('id', testTask.id)
    .select();

  console.log(`Update completed in ${Date.now() - start}ms`);
  if (updateErr) {
    console.error('Update error:', updateErr);
  } else {
    console.log('Update success! Updated title:', updated[0]?.title);
  }
}

run().catch(console.error);
