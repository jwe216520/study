import nextEnv from '@next/env';

// Public values are embedded during build; never print their contents.
nextEnv.loadEnvConfig(process.cwd(), false);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || url.includes('your-project') || key === 'your-publishable-key') {
  throw new Error('請在 Cloudflare Build variables 設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY。');
}
if (key.startsWith('sb_secret_')) throw new Error('前端只能使用 Publishable／anon key，不能使用 Secret key。');
if (key.split('.').length === 3) {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (payload.role !== 'anon') throw new Error('前端不能使用 service_role key。');
}
const parsed = new URL(url);
if (parsed.protocol !== 'https:') throw new Error('正式 Supabase URL 必須使用 HTTPS。');
console.log('Supabase 公開設定檢查通過。');
