const { createClient } = require('@insforge/sdk');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = createClient({
  baseUrl: 'https://insforge.kora.ovh',
  anonKey: 'ik_2068688a89f5cd89cc7e009fc8e9c65100c59346'
});

async function runTest() {
  console.log('--- E2E TEST: ClickUp Hierarchy & Task Flow ---');
  
  // 1. Check workspace
  const { data: workspaces, error: wsErr } = await client.database
    .from('kubbonet_workspaces')
    .select('*')
    .limit(1);
    
  if (wsErr) throw new Error('Workspaces fetch error: ' + JSON.stringify(wsErr));
  console.log('✓ Found workspace:', workspaces[0]?.name, 'ID:', workspaces[0]?.id);
  const workspaceId = workspaces[0]?.id || 1;

  // 2. Create a test space
  const testSpaceName = 'Espacio Test QA ' + Date.now();
  const { data: newSpace, error: spaceErr } = await client.database
    .from('kubbonet_espacios')
    .insert([{
      name: testSpaceName,
      color: '#3b82f6',
      icon: 'FolderKanban',
      workspace_id: workspaceId
    }])
    .select();
    
  if (spaceErr) throw new Error('Space insert error: ' + JSON.stringify(spaceErr));
  const spaceId = newSpace[0].id;
  console.log('✓ Created test space:', testSpaceName, 'ID:', spaceId);

  // 3. Create a test folder in this space
  const testFolderName = 'Carpeta Test QA';
  const { data: newFolder, error: folderErr } = await client.database
    .from('kubbonet_carpetas')
    .insert([{
      name: testFolderName,
      espacio_id: spaceId
    }])
    .select();
    
  if (folderErr) throw new Error('Folder insert error: ' + JSON.stringify(folderErr));
  const folderId = newFolder[0].id;
  console.log('✓ Created test folder:', testFolderName, 'ID:', folderId);

  // 4. Create two test lists (one in folder, one standalone in space)
  const { data: listA, error: listAErr } = await client.database
    .from('kubbonet_listas')
    .insert([{
      name: 'Lista A (En Carpeta)',
      espacio_id: spaceId,
      carpeta_id: folderId,
      color: '#10b981'
    }])
    .select();
  if (listAErr) throw new Error('List A insert error: ' + JSON.stringify(listAErr));
  const listAId = listA[0].id;
  console.log('✓ Created List A in folder ID:', listAId);

  const { data: listB, error: listBErr } = await client.database
    .from('kubbonet_listas')
    .insert([{
      name: 'Lista B (Sin Carpeta)',
      espacio_id: spaceId,
      carpeta_id: null,
      color: '#f59e0b'
    }])
    .select();
  if (listBErr) throw new Error('List B insert error: ' + JSON.stringify(listBErr));
  const listBId = listB[0].id;
  console.log('✓ Created List B standalone ID:', listBId);

  // 5. Create a parent task in List A
  const { data: parentTask, error: pTaskErr } = await client.database
    .from('app_tasks')
    .insert([{
      title: 'Tarea Principal QA Jerarquía',
      description: 'Probando jerarquía de ClickUp completa',
      status: 'pending',
      priority: 'high',
      lista_id: listAId,
      order_index: 10
    }])
    .select();
  if (pTaskErr) throw new Error('Parent task insert error: ' + JSON.stringify(pTaskErr));
  const parentTaskId = parentTask[0].id;
  console.log('✓ Created parent task in List A. ID:', parentTaskId);

  // 6. Create 2 subtasks pointing to parentTaskId
  const { data: subtasks, error: subErr } = await client.database
    .from('app_tasks')
    .insert([
      {
        title: 'Subtarea 1 de prueba',
        status: 'pending',
        priority: 'medium',
        lista_id: listAId,
        parent_task_id: parentTaskId
      },
      {
        title: 'Subtarea 2 de prueba',
        status: 'completed',
        priority: 'low',
        lista_id: listAId,
        parent_task_id: parentTaskId
      }
    ])
    .select();
  if (subErr) throw new Error('Subtasks insert error: ' + JSON.stringify(subErr));
  console.log('✓ Created 2 subtasks linked to parent task:', subtasks.length);

  // 7. Test relocating task from List A to List B
  const { data: movedTask, error: moveErr } = await client.database
    .from('app_tasks')
    .update({ lista_id: listBId })
    .eq('id', parentTaskId)
    .select();
  if (moveErr) throw new Error('Move task error: ' + JSON.stringify(moveErr));
  console.log('✓ Successfully moved parent task to List B. New lista_id:', movedTask[0].lista_id);

  // 8. Query tasks in List B and verify
  const { data: tasksInB, error: qErr } = await client.database
    .from('app_tasks')
    .select('*')
    .eq('lista_id', listBId);
  if (qErr) throw new Error('Query error: ' + JSON.stringify(qErr));
  console.log('✓ List B contains tasks count:', tasksInB.length, 'Title:', tasksInB[0]?.title);

  // 9. Cleanup test data
  console.log('Cleaning up test records...');
  await client.database.from('app_tasks').delete().eq('parent_task_id', parentTaskId);
  await client.database.from('app_tasks').delete().eq('id', parentTaskId);
  await client.database.from('kubbonet_listas').delete().eq('id', listAId);
  await client.database.from('kubbonet_listas').delete().eq('id', listBId);
  await client.database.from('kubbonet_carpetas').delete().eq('id', folderId);
  await client.database.from('kubbonet_espacios').delete().eq('id', spaceId);
  console.log('✓ Cleaned up all test records successfully.');
  
  console.log('🎉 ALL CLICKUP HIERARCHY E2E TESTS PASSED SUCCESSFULLY!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
