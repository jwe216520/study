import { createClient } from '@supabase/supabase-js';
import { MAX_PDF_BYTES } from '@/lib/content';
import { validatePdfBytes } from '@/lib/pdf-validation';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request, { params }) {
  const headers = { 'Cache-Control': 'no-store' };
  const fail = (error, status = 400) => Response.json({ error }, { status, headers });
  const token = request.headers.get('authorization');
  if (!token?.startsWith('Bearer ')) return fail('請先登入', 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return fail('尚未設定 Supabase', 503);
  const db = createClient(url, key, { global: { headers: { Authorization: token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token.slice(7));
  if (authError || !auth.user) return fail('登入已過期，請重新登入', 401);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('教材代號無效');
  const { data: material, error } = await db.from('materials').select('*').eq('id', id).eq('owner_id', auth.user.id).single();
  if (error || !material) return fail('找不到教材', 404);
  if (material.status !== 'uploading') return fail('教材狀態已變更，請重新整理');
  try {
    const { data: file, error: downloadError } = await db.storage.from('study-materials').download(material.storage_path);
    if (downloadError) return fail('無法取得上傳檔案，請重試');
    if (file.size > MAX_PDF_BYTES || file.size !== material.bytes) return fail('檔案大小不符合限制');
    const bytes = new Uint8Array(await file.arrayBuffer());
    await validatePdfBytes(bytes, material.bytes, material.page_count);
    const result = await db.from('materials').update({ status: 'ready' }).eq('id', id).eq('status', 'uploading').select('id,status').single();
    if (result.error) return fail('教材驗證後保存失敗，請重試');
    return Response.json(result.data, { headers });
  } catch { return fail('PDF 損壞、加密或無法讀取，請重新匯出 PDF'); }
}
