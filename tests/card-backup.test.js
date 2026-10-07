import test from 'node:test';
import assert from 'node:assert/strict';
import { cardBackupDecks } from '../lib/card-backup.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const item={id,kind:'flashcard',scope_id:'scope',payload:{english:'term',chinese:'名稱'},excluded:true};
test('old backups preserve IDs, exclusions, familiarity and grouping',()=>{
 const groups=cardBackupDecks({backupVersion:1,content:[item],scopes:[{id:'scope',name:'舊範圍'}],progress:[{item_id:id,familiarity:'familiar'}]});
 assert.equal(groups[0].name,'舊範圍');assert.equal(groups[0].cards[0].id,id);assert.equal(groups[0].cards[0].familiarity,'familiar');assert.equal(groups[0].cards[0].excluded,true);
});
test('v2 backup uses independent decks and rejects malformed payloads',()=>{
 const groups=cardBackupDecks({backupVersion:2,content:[{...item,deck_id:'deck'}],decks:[{id:'deck',name:'單字集'}]});assert.equal(groups[0].name,'單字集');
 assert.throws(()=>cardBackupDecks({backupVersion:2,content:[{...item,id:'bad'}]}));
});
