export async function pdfjs() {
  const engine = await import('pdfjs-dist/build/pdf.mjs');
  engine.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${engine.version}`;
  return engine;
}
export async function inspectPdf(file) {
  const { getDocument } = await pdfjs();
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try { const doc = await task.promise; return doc.numPages; }
  catch (error) { throw new Error(pdfReadError(error)); }
  // PDF.js 6 exposes destruction on PDFDocumentLoadingTask, not PDFDocumentProxy.
  // Cleanup failure must not turn a successfully parsed document into an invalid PDF.
  finally { await task.destroy().catch(() => {}); }
}
export function pdfReadError(error) {
  if(error?.name==='PasswordException')return '此 PDF 已加密或需要密碼，請先匯出未加密版本。';
  if(error?.name==='InvalidPDFException')return 'PDF 結構無法讀取，請重新匯出或確認檔案是否完整。';
  return 'PDF 讀取器載入或解析失敗，請重新整理網站後再試。若仍失敗，請提供錯誤畫面。';
}
