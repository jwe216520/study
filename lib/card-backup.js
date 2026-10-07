import { z } from 'zod';
import { schemas } from './content.js';
const card = z.object({id:z.uuid(),payload:schemas.flashcard,excluded:z.boolean(),familiarity:z.enum(['unknown','unclear','familiar']).nullable()});
export function cardBackupDecks(backup) {
 if(![1,2].includes(backup?.backupVersion)||!Array.isArray(backup.content))throw new Error('請選擇拾知學習備份。');
 const cards=backup.content.filter(i=>i.kind==='flashcard');
 const progress=new Map((backup.progress||[]).map(p=>[p.item_id,p.familiarity]));
 const groups=new Map();
 for(const item of cards){
  const key=item.deck_id||item.scope_id||'default';
  const name=backup.decks?.find(d=>d.id===item.deck_id)?.name||backup.scopes?.find(s=>s.id===item.scope_id)?.name||'我的單字';
  const parsed=card.parse({id:item.id,payload:item.payload,excluded:item.excluded||false,familiarity:progress.get(item.id)||null});
  if(!groups.has(key))groups.set(key,{name,cards:[]});groups.get(key).cards.push(parsed);
 }
 if(!groups.size)throw new Error('這份備份沒有單字卡。');
 return [...groups.values()];
}
