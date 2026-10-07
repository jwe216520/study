'use client';
import { useEffect, useRef } from 'react';
import { X, BookOpen, ExternalLink } from 'lucide-react';
export function Empty({ title, children, icon: Icon = BookOpen }) { return <div className="empty"><span className="empty-icon"><Icon size={26}/></span><h3>{title}</h3><p>{children}</p></div>; }
export function useModalFocus(root,onClose){
 const close=useRef(onClose);useEffect(()=>{close.current=onClose;},[onClose]);
 useEffect(()=>{const node=root.current;if(!node)return;const previous=document.activeElement;const selector='button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]';node.querySelector(selector)?.focus();
  const keydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close.current();}if(e.key==='Tab'){const fields=[...node.querySelectorAll(selector)].filter(el=>el.getClientRects().length);const first=fields[0],last=fields.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  node.addEventListener('keydown',keydown);return()=>{node.removeEventListener('keydown',keydown);if(previous?.isConnected)previous.focus();};
 },[root]);
}
export function Modal({ title, children, onClose, wide = false }) { const root=useRef(null);useModalFocus(root,onClose);return <div ref={root} className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}><section className={`modal ${wide ? 'wide' : ''}`}><div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="關閉" onClick={onClose}><X size={20}/></button></div>{children}</section></div>; }
export function Field({ label, children, hint }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Sources({ sources = [], materials, onOpen }) { return <div className="sources">{sources.map((s, n) => { const m = materials.find(m => m.id === s.materialId); return <button key={n} className="source-link" disabled={!m || m.status !== 'ready'} onClick={() => onOpen(m, s.page)}><ExternalLink size={12}/>{m?.name || '來源不存在'} · PDF p.{s.page}{s.printedPage ? `（書本 ${s.printedPage}）` : ''}{m?.status !== 'ready' ? ' · 不可用' : ''}</button>; })}</div>; }
export function Tags({ concepts = [] }) { return <div className="tags">{concepts.map((c, i) => <span key={i}>{c}</span>)}</div>; }
