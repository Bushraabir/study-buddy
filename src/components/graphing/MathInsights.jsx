// src/components/graphing/MathInsights.jsx
import React from 'react';

export default function MathInsights({ meta, loading, upgraded, onApplyFix }) {
  if (!meta && !loading) return null;

  const {
    symmetry,
    verticalAsymptotes = [],
    horizontalAsymptotes = [],
    criticalPoints = [],
    domain,
    period,
    _source,
  } = meta ?? {};

  const hasInsights =
    (symmetry && symmetry !== 'none') ||
    verticalAsymptotes.length > 0 ||
    horizontalAsymptotes.length > 0 ||
    criticalPoints.length > 0 ||
    period;

  if (!hasInsights && !loading) return null;

  return (
    <div className="mi-wrap">
      {/* Source indicator */}
      <span
        className="mi-badge mi-subtle"
        title={_source === 'sympy' ? 'Full SymPy analysis' : 'Numeric estimate (SymPy loading…)'}
      >
        {_source === 'sympy' ? '∑ SymPy' : loading ? '⟳ Numeric' : '⟨⟩ Numeric'}
      </span>

      {symmetry !== 'none' && symmetry && (
        <span
          className="mi-badge mi-info"
          title={`f(-x) = ${symmetry === 'even' ? 'f(x)' : '-f(x)'}`}
        >
          {symmetry === 'even' ? '⇔ even' : '↺ odd'}
        </span>
      )}

      {period && (
        <span className="mi-badge mi-info">
          ∿ T={period.toFixed(2)}
        </span>
      )}

      {verticalAsymptotes.length > 0 && (
        <span
          className="mi-badge mi-danger"
          title={`x = ${verticalAsymptotes.join(', ')}`}
        >
          ↕ {verticalAsymptotes.length} vert. asym.
        </span>
      )}

      {horizontalAsymptotes.length > 0 && (
        <span
          className="mi-badge mi-warning"
          title={`y = ${horizontalAsymptotes.map(h => h.y).join(', ')}`}
        >
          ↔ y={horizontalAsymptotes[0].y}
        </span>
      )}

      {criticalPoints.length > 0 && (
        <span className="mi-badge mi-subtle">
          ◇ {criticalPoints.length} crit.
        </span>
      )}

      {domain && domain !== 'Reals' && domain !== 'S.Reals' && (
        <span className="mi-badge mi-subtle" title={domain}>
          𝔻 restricted
        </span>
      )}

      {verticalAsymptotes.length > 0 && onApplyFix && (
        <button className="mi-fix-btn" onClick={() => onApplyFix(meta)}>
          Auto-fix
        </button>
      )}
    </div>
  );
}