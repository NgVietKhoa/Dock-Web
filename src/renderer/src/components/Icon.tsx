import { useEffect, useState, type ReactNode } from 'react';

// Icon from the sprite in index.html; stroke follows the text color
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <svg className={`ic ${className}`}><use href={`#i-${name}`} /></svg>;
}

// Favicon (tab, bookmark, menu): globe until the image has loaded (a broken favicon URL keeps the globe)
export function Fav({ src = '', className, fallback = <Icon name="globe" /> }: { src?: string; className?: string; fallback?: ReactNode }) {
  const [loaded, setLoaded] = useState('');
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setLoaded(src);
    img.src = src;
    return () => { img.onload = null; }; // a newer icon may arrive meanwhile
  }, [src]);
  // draggable = false: dragging a tab/bookmark moves it, not the image
  return <i className={className}>{src && loaded === src ? <img src={src} width={16} height={16} draggable={false} /> : fallback}</i>;
}
