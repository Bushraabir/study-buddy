// src/components/graphing/CASLoader.jsx
import React from 'react';

export default function CASLoader({ status, progress }) {
  if (status === 'ready' || status === 'error' || status === 'idle') return null;

  return (
    <div className="cas-loader" role="status" aria-live="polite">
      <span className="cas-loader__icon">⟳</span>
      <div className="cas-loader__text">
        <span>Loading math engine</span>
        <span className="cas-loader__sub">asymptotes &amp; critical points</span>
      </div>
      <div className="cas-loader__bar">
        <div
          className="cas-loader__fill"
          style={{ width: `${progress ?? 40}%` }}
        />
      </div>
    </div>
  );
}