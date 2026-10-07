// Interface examples only. They are never sent to Supabase or used as real course material.
const subject = '00000000-0000-4000-8000-000000000001';
const chapter = '00000000-0000-4000-8000-000000000002';
const scope = '00000000-0000-4000-8000-000000000003';
export const previewData = {
 subjects: [{id:subject,name:'解剖學',created_at:'2026-01-01'}],
 chapters: [{id:chapter,subject_id:subject,name:'我的第一個學習章節',created_at:'2026-01-01'}],
 materials: [], scopes: [{id:scope,chapter_id:chapter,name:'本週授課範圍',ranges:[],teacher_focus:'先理解概念，再說明構造之間的關係',exclusions:'尚未授課的內容',revision:1}],
 content_items: [{id:'preview-note',scope_id:scope,kind:'note',reviewed:true,excluded:false,payload:{title:'讓概念連起來，而不只是背起來',markdown:'## 用自己的話說明\n讀完一段教材，先闔上課本，試著回答：這個構造在哪裡？它有什麼功能？和相鄰構造有什麼關係？\n\n## 比較容易混淆的地方\n| 比較項目 | 構造 A | 構造 B |\n| --- | --- | --- |\n| 位置 | 依教材填寫 | 依教材填寫 |\n| 功能 | 依教材填寫 | 依教材填寫 |\n\n## 回到教材確認\n每一篇筆記都能附上來源頁碼，遇到疑問時直接回查。\n\n*這是介面示範，不是你的授課內容。*',supplement:true,concepts:['概念理解','構造關係'],sources:[]}}],
 card_progress: [], quiz_attempts: []
};
