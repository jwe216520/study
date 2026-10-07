import { PDFDocument } from 'pdf-lib';
import { MAX_PDF_BYTES } from './content.js';
export async function validatePdfBytes(bytes, expectedBytes, expectedPages) {
 if (bytes.length > MAX_PDF_BYTES || bytes.length !== expectedBytes) throw new Error('檔案大小不符合限制');
 if (!new TextDecoder().decode(bytes.slice(0,5)).startsWith('%PDF-')) throw new Error('檔案不是 PDF');
 const doc = await PDFDocument.load(bytes,{ignoreEncryption:false,throwOnInvalidObject:true});
 if(doc.isEncrypted||doc.getPageCount()!==expectedPages) throw new Error('教材加密或頁數驗證失敗');
 return doc.getPageCount();
}
