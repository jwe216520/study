export async function pdfjs() {
  const engine = await import('pdfjs-dist/build/pdf.mjs');
  engine.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  return engine;
}
export async function inspectPdf(file) {
  const { getDocument } = await pdfjs();
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try { const doc = await task.promise; const pages = doc.numPages; await doc.destroy(); return pages; }
  catch { await task.destroy(); throw new Error('無法讀取 PDF。請確認不是損壞或加密檔案。'); }
}
