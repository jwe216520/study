'use client';
import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, RefreshCw, Download } from 'lucide-react';
import { materialUrl } from '@/lib/repository';
import { pdfjs } from '@/lib/pdf';
import { useModalFocus } from './ui';

export default function PdfViewer({ material, initialPage = 1, onClose }) {
  const canvas = useRef(null); const container = useRef(null);
  const root=useRef(null);useModalFocus(root,onClose);
  const [page, setPage] = useState(initialPage); const [doc, setDoc] = useState(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false; let task;
    setDoc(null); setLoading(true); setError('');
    (async () => {
      try {
        const url = await materialUrl(material); const { getDocument } = await pdfjs();
        if (cancelled) return;
        task = getDocument({ url, isEvalSupported: false });
        const pdf = await task.promise;
        if (!cancelled) setDoc(pdf);
      } catch { if (!cancelled) setError('教材載入失敗，連結可能已過期。請重新取得連結。'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; task?.destroy(); };
  }, [material, retry]);
  useEffect(() => {
    if (!doc) return;
    let stopped = false; let task;
    (async () => {
      try {
        const pdfPage = await doc.getPage(page);
        if (stopped || !canvas.current) return;
        const viewport = pdfPage.getViewport({ scale: Math.max(0.2, (width - 24) / pdfPage.getViewport({ scale: 1 }).width) });
        const ratio = window.devicePixelRatio || 1;
        const c = canvas.current; c.width = viewport.width * ratio; c.height = viewport.height * ratio;
        c.style.width = `${viewport.width}px`; c.style.height = `${viewport.height}px`;
        task = pdfPage.render({ canvasContext: c.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
      } catch (e) { if (!stopped && e.name !== 'RenderingCancelledException') setError('頁面讀取失敗，請重新載入。'); }
    })();
    return () => { stopped = true; task?.cancel(); };
  }, [doc, page, width]);
  return <div ref={root} className="modal-backdrop" role="dialog" aria-modal="true" aria-label="教材閱讀器">
    <section className="pdf-modal"><div className="modal-head"><div><strong>{material.name}</strong><p className="muted">PDF 實際頁面序號 · {material.page_count} 頁</p></div><button className="icon-button" aria-label="關閉教材" onClick={onClose}><X size={20} /></button></div>
      <div className="pdf-tools"><button className="icon-button" aria-label="上一頁" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18}/></button><label>第 <input aria-label="PDF 頁碼" type="number" min="1" max={material.page_count} value={page} onChange={e => setPage(Math.max(1, Math.min(material.page_count, Number(e.target.value) || 1)))} /> / {material.page_count} 頁</label><button className="icon-button" aria-label="下一頁" disabled={page >= material.page_count} onClick={() => setPage(p => p + 1)}><ChevronRight size={18}/></button><button className="button secondary" onClick={async () => { try { window.open(await materialUrl(material), '_blank', 'noopener,noreferrer'); } catch { setError('下載連結取得失敗'); } }}><Download size={16}/>下載原檔</button></div>
      <div className="pdf-pages" ref={container}>{loading && <p>正在取得私人教材…</p>}{error ? <div className="empty"><p>{error}</p><button className="button secondary" onClick={() => setRetry(r => r + 1)}><RefreshCw size={16}/>重新載入</button></div> : <canvas ref={canvas} aria-label={`教材第 ${page} 頁`} />}</div>
    </section>
  </div>;
}
