'use client';

import { useState } from 'react';

export function ShareButtons({ id, text }: { id: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? `/run/${id}` : `${window.location.origin}/run/${id}`;
  const tweet = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  const saveImage = async () => {
    const response = await fetch(`/api/card/${id}`);
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `jjk-gauntlet-${id}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <a className="btn" href={tweet} target="_blank" rel="noreferrer">
        Share on X
      </a>
      <button className="btn" type="button" onClick={saveImage}>
        Save image
      </button>
      <button
        className="btn"
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
