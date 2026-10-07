import { getSupabase, unwrap } from './supabase';

export async function loadWorkspace() {
  const db = getSupabase();
  const names = ['subjects', 'chapters', 'materials', 'scopes', 'content_items', 'card_progress', 'quiz_attempts'];
  const results = await Promise.all(names.map(async name => {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const result = await db.from(name).select('*')
        .order(name === 'card_progress' ? 'updated_at' : 'created_at', { ascending: true })
        .order(name === 'card_progress' ? 'item_id' : 'id')
        .range(offset, offset + 499);
      const page = unwrap(result); rows.push(...page);
      if (page.length < 500) return rows;
    }
  }));
  return Object.fromEntries(results.map((rows, i) => [names[i], rows]));
}
export async function insertRow(table, values) { return unwrap(await getSupabase().from(table).insert(values).select().single()); }
export async function updateRow(table, id, values) { return unwrap(await getSupabase().from(table).update(values).eq('id', id).select().single()); }
export async function rpc(name, args) {
  const result = await getSupabase().rpc(name, args);
  if (name === 'import_content' && result.error?.code === '23505') throw new Error('這批內容已匯入，請勿重複提交。若要修改，請直接編輯已保存的內容。');
  return unwrap(result);
}

export async function uploadMaterial(file, chapterId, userId, pageCount) {
  const db = getSupabase();
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.pdf`;
  // Register first so Storage RLS can restrict uploads to this exact path.
  await insertRow('materials', { id, chapter_id: chapterId, name: file.name, storage_path: path, bytes: file.size, page_count: pageCount });
  const uploaded = await db.storage.from('study-materials').upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (uploaded.error) throw new Error(`上傳未完成：${uploaded.error.message}。教材保留為未完成，可刪除後重試。`);
  const session = unwrap(await db.auth.getSession());
  const res = await fetch(`/api/materials/${id}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${session.session.access_token}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${body.error || 'PDF 驗證失敗'}。可刪除此未完成教材後重試。`);
  return body;
}

export async function deleteMaterial(material) {
  const db = getSupabase();
  await updateRow('materials', material.id, { status: 'delete_pending' });
  const result = await db.storage.from('study-materials').remove([material.storage_path]);
  if (result.error) throw new Error(`檔案刪除未完成：${result.error.message}。已保留待刪除狀態，請按「重試刪除」。`);
  await updateRow('materials', material.id, { status: 'deleted' });
}

export async function materialUrl(material) {
  const result = unwrap(await getSupabase().storage.from('study-materials').createSignedUrl(material.storage_path, 300));
  return result.signedUrl;
}
export function downloadJson(name, payload) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportStudy(data) {
  // Exclude auth tokens, private signed URLs and secrets from the backup.
  return { backupVersion: 1, exportedAt: new Date().toISOString(), subjects: data.subjects, chapters: data.chapters, materials: data.materials, scopes: data.scopes,
    content: data.content_items, progress: data.card_progress, attempts: data.quiz_attempts,
    learningBatches: data.scopes.map(s => ({ scopeId: s.id, scopeName: s.name, payload: {
      schemaVersion: 1,
      notes: data.content_items.filter(i => i.scope_id === s.id && i.kind === 'note').map(i => i.payload),
      flashcards: data.content_items.filter(i => i.scope_id === s.id && i.kind === 'flashcard').map(i => i.payload),
      questions: data.content_items.filter(i => i.scope_id === s.id && i.kind === 'question').map(i => i.payload)
    } })) };
}
