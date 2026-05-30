
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { THEMES, DEFAULT_THEME, THEME_IDS } from "../themes.js";

// ─── Context ──────────────────────────────────────────────────────────────────
const ThemeCtx = createContext(null);

// ─── All cursor / sparkle / overlay selectors to wipe on every switch ────────
const CURSOR_SELECTORS = [
  // Pookie
  ".pookie-cursor",
  ".pookie-cursor__trail",
  ".pookie-sparkle",
  // Aesthetic
  ".aesthetic-cursor",
  ".aesthetic-ink-dot",
  ".aesthetic-ink-trail",
  // Steller
  ".steller-cursor",
  ".steller-cursor-h-line",
  ".steller-cursor-v-line",
  ".steller-cursor-scan",
  // Notebook
  ".notebook-cursor",
  ".notebook-ink-stroke",
  // Graph Paper
  ".gp-cursor",
  ".gp-cursor-h-line",
  ".gp-cursor-v-line",
  ".gp-cursor__label",
];

// All overlay class/id selectors injected by themes
const OVERLAY_SELECTORS = [
  "#pookie-stars",
  "#steller-space",
  "#gp-canvas",
  ".pookie-aurora",
  ".pookie-nebula",
  ".pookie-comet",
  ".steller-scanlines",
  ".steller-planet",
  ".steller-hud-corner",
  ".steller-hud-data",
  ".steller-hud-data-br",
  ".aesthetic-grain",
  ".aesthetic-vignette",
  ".aesthetic-warmlight",
  ".aesthetic-watercolor",
  ".aesthetic-botanicals",
  ".nb-page-shell",
  ".gp-grid-layer",
  ".gp-axis-x",
  ".gp-axis-y",
  ".gp-axis-x-label",
  ".gp-axis-y-label",
  ".gp-origin",
  ".gp-ticks-x",
  ".gp-ticks-y",
  ".gp-corner-mark",
  ".gp-annotations",
];

/**
 * Removes every theme-injected cursor and overlay element from the DOM.
 * Called at the VERY START of every theme switch so the next theme begins
 * from a completely clean slate — no ghost cursors, no leftover overlays.
 */
function cleanupThemeElements() {
  // Remove cursors + sparkles
  CURSOR_SELECTORS.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  });

  // Remove overlay fragments that are DIRECT children of <body>
  // (#theme-overlay gets wiped via innerHTML = "" so those are handled separately)
  OVERLAY_SELECTORS.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      if (el && el.parentNode === document.body) {
        el.parentNode.removeChild(el);
      }
    });
  });

  // Reset cursor style
  document.body.style.cursor = "";
  document.documentElement.style.cursor = "";
}

// ─── ThemeProvider ────────────────────────────────────────────────────────────
export function ThemeProvider({ children }) {
  var [themeId, setThemeIdRaw] = useState(function () {
    var saved = localStorage.getItem("sb-theme");
    return THEME_IDS.includes(saved) ? saved : DEFAULT_THEME;
  });

  var [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  var [isTransitioning, setIsTransitioning]           = useState(false);

  // Refs for injected DOM nodes
  var overlayRef   = useRef(null);
  var scriptRef    = useRef(null);
  var cursorScrRef = useRef(null);
  var fontLinkRef  = useRef(null);
  var gpCleanupRef = useRef(null);

  // ── Detect prefers-reduced-motion ────────────────────────────────────────
  useEffect(function () {
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    function handler(e) { setPrefersReducedMotion(e.matches); }
    mq.addEventListener("change", handler);
    return function () { mq.removeEventListener("change", handler); };
  }, []);

  // ── Apply/remove sb-reduced-motion class ─────────────────────────────────
  useEffect(function () {
    if (prefersReducedMotion) {
      document.body.classList.add("sb-reduced-motion");
    } else {
      document.body.classList.remove("sb-reduced-motion");
    }
  }, [prefersReducedMotion]);

  // ── Core theme application ────────────────────────────────────────────────
  //
  // CLEANUP ORDER (critical — do NOT reorder):
  //   1. Cancel any pending cursor-script injection timer
  //   2. Remove all cursor/sparkle/overlay DOM elements
  //   3. Remove previous injected scripts (overlayScript + cursorScript)
  //   4. Tear down graph-paper mousemove listener
  //   ── Only after all of the above does new theme code run ──
  //   5. Inject CSS vars onto <html>
  //   6. Apply body class
  //   7. Inject Google Font <link>
  //   8. Populate #theme-overlay innerHTML
  //   9. Run overlayScript
  //  10. Register graph-paper mousemove listener (if needed)
  //  11. Schedule cursorScript injection (80 ms delay so overlay DOM is ready)
  //
  var applyTheme = useCallback(function (id) {
    var theme = THEMES[id] || THEMES[DEFAULT_THEME];
    var root  = document.documentElement;

    // ─── STEP 1: Cancel pending cursor-script timer ──────────────────────
    // This MUST happen before cleanupThemeElements() so that a timer spawned
    // by the previous theme cannot fire after we've already started applying
    // the new one (which would insert ghost cursor elements for the old theme).
    if (cursorScrRef._timer != null) {
      clearTimeout(cursorScrRef._timer);
      cursorScrRef._timer = null;
    }

    // ─── STEP 2: Remove all cursor / sparkle / overlay elements ─────────
    cleanupThemeElements();

    // ─── STEP 3: Remove previously injected scripts ───────────────────────
    if (scriptRef.current) {
      if (scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
      scriptRef.current = null;
    }
    if (cursorScrRef.current) {
      if (cursorScrRef.current.parentNode) {
        cursorScrRef.current.parentNode.removeChild(cursorScrRef.current);
      }
      cursorScrRef.current = null;
    }

    // ─── STEP 4: Tear down graph-paper mousemove listener ────────────────
    if (gpCleanupRef.current) {
      gpCleanupRef.current();
      gpCleanupRef.current = null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Everything above is teardown. Everything below is new-theme setup.
    // ════════════════════════════════════════════════════════════════════════

    // ─── STEP 5: CSS vars on <html> ──────────────────────────────────────
    Object.entries(theme.vars).forEach(function (entry) {
      root.style.setProperty(entry[0], entry[1]);
    });

    // ─── STEP 5b: Typography vars on <body> ──────────────────────────────
    // These are also set via theme.vars (--type-* keys) above, but applying
    // them directly to body ensures they cascade correctly for font-size calc.
    if (theme.typography) {
      var t = theme.typography;
      document.body.style.setProperty("--type-scale",          String(t.scale));
      document.body.style.setProperty("--type-line-height",    String(t.lineHeight));
      document.body.style.setProperty("--type-heading-weight", String(t.headingWeight));
      document.body.style.setProperty("--type-body-weight",    String(t.bodyWeight));
      document.body.style.setProperty("--type-letter-spacing", String(t.letterSpacing));
    }

    // ─── STEP 6: Body class ───────────────────────────────────────────────
    THEME_IDS.forEach(function (tid) {
      document.body.classList.remove("theme-" + tid);
    });
    document.body.classList.add(theme.bodyClass);

    // ─── STEP 7: Google Font ──────────────────────────────────────────────
    if (fontLinkRef.current && fontLinkRef.current.parentNode) {
      fontLinkRef.current.parentNode.removeChild(fontLinkRef.current);
    }
    fontLinkRef.current = null;
    if (theme.fonts && theme.fonts.google) {
      var link = document.createElement("link");
      link.rel  = "stylesheet";
      link.href = theme.fonts.google;
      link.id   = "theme-font";
      document.head.appendChild(link);
      fontLinkRef.current = link;
    }

    // ─── STEP 8: #theme-overlay container ────────────────────────────────
    if (!overlayRef.current) {
      var el = document.createElement("div");
      el.id  = "theme-overlay";
      el.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;";
      document.body.prepend(el);
      overlayRef.current = el;
    }
    // Wipe previous overlay content, then inject new
    overlayRef.current.innerHTML = theme.overlayHTML || "";

    // ─── STEP 9: Overlay script ───────────────────────────────────────────
    if (theme.overlayScript && theme.overlayScript.trim()) {
      var s = document.createElement("script");
      s.textContent = theme.overlayScript;
      document.body.appendChild(s);
      scriptRef.current = s;
    }

    // ─── STEP 10: Graph-paper mousemove listener ──────────────────────────
    if (id === "graphpaper") {
      var onMove = function (e) {
        var c = document.querySelector(".gp-plotting-cursor");
        if (c) {
          c.style.display = "block";
          c.style.left    = e.clientX + "px";
          c.style.top     = e.clientY + "px";
        }
      };
      document.addEventListener("mousemove", onMove);
      gpCleanupRef.current = function () {
        document.removeEventListener("mousemove", onMove);
      };
    }

    // ─── STEP 11: Cursor script (80 ms delay so overlay DOM is ready) ─────
    if (theme.cursorScript && theme.cursorScript.trim()) {
      var cs    = document.createElement("script");
      cs.textContent = theme.cursorScript;
      var timer = setTimeout(function () {
        // Guard: only inject if we haven't already been superseded by another
        // rapid theme switch (the ref would have been nulled by the next call).
        document.body.appendChild(cs);
        cursorScrRef.current = cs;
        cursorScrRef._timer  = null;
      }, 80);
      cursorScrRef._timer = timer;
    }
  }, []);

  // ── Apply on mount + theme change ────────────────────────────────────────
  useEffect(function () {
    var isFirstMount = !document.body.classList.contains("sb-theme-applied");

    if (isFirstMount) {
      // ── First mount: suppress all transitions so there's no flash ───────
      // Add initializing class BEFORE applyTheme so CSS transitions are
      // disabled while we stamp vars + class onto the DOM.
      document.body.classList.add("sb-theme-initializing");
      applyTheme(themeId);
      document.body.classList.add("sb-theme-applied");

      // Remove initializing class on the very next paint so subsequent
      // interactions get smooth transitions.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          document.body.classList.remove("sb-theme-initializing");
        });
      });
    } else {
      // ── Subsequent switches: cancel any lingering cursor timer first,
      //    then run the full transition flow ───────────────────────────────
      if (cursorScrRef._timer != null) {
        clearTimeout(cursorScrRef._timer);
        cursorScrRef._timer = null;
      }

      document.body.classList.add("sb-theme-transitioning");
      setIsTransitioning(true);

      applyTheme(themeId);

      var timer = setTimeout(function () {
        document.body.classList.remove("sb-theme-transitioning");
        setIsTransitioning(false);
      }, 650);

      return function () {
        clearTimeout(timer);
        document.body.classList.remove("sb-theme-transitioning");
      };
    }
  }, [themeId, applyTheme]);

  // ── Full cleanup on unmount ───────────────────────────────────────────────
  useEffect(function () {
    return function () {
      // Cancel any pending cursor timer
      if (cursorScrRef._timer != null) {
        clearTimeout(cursorScrRef._timer);
        cursorScrRef._timer = null;
      }

      if (overlayRef.current && overlayRef.current.parentNode) {
        overlayRef.current.parentNode.removeChild(overlayRef.current);
      }
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
      if (cursorScrRef.current && cursorScrRef.current.parentNode) {
        cursorScrRef.current.parentNode.removeChild(cursorScrRef.current);
      }
      if (fontLinkRef.current && fontLinkRef.current.parentNode) {
        fontLinkRef.current.parentNode.removeChild(fontLinkRef.current);
      }
      cleanupThemeElements();
      if (gpCleanupRef.current) gpCleanupRef.current();

      // Remove sentinel classes
      document.body.classList.remove(
        "sb-theme-applied",
        "sb-theme-initializing",
        "sb-theme-transitioning"
      );
    };
  }, []);

  var setThemeId = useCallback(function (id) {
    if (!THEME_IDS.includes(id)) return;
    localStorage.setItem("sb-theme", id);
    setThemeIdRaw(id);
  }, []);

  var value = useMemo(function () {
    return {
      themeId,
      setThemeId,
      theme:               THEMES[themeId],
      isDark:              THEMES[themeId] ? THEMES[themeId].dark : true,
      isTransitioning,
      prefersReducedMotion,
    };
  }, [themeId, setThemeId, isTransitioning, prefersReducedMotion]);

  return React.createElement(ThemeCtx.Provider, { value }, children);
}

// ─── useTheme hook ────────────────────────────────────────────────────────────
export function useTheme() {
  return useContext(ThemeCtx);
}

// ─── Convenience hooks ────────────────────────────────────────────────────────

/** Returns the active theme's primary accent color CSS string */
export function useAccentColor() {
  var ctx = useTheme();
  return ctx && ctx.theme
    ? ctx.theme.vars["--theme-accent"] || ctx.theme.vars["--pookie-pink"] || "#f472b6"
    : "#f472b6";
}

/** Returns true if the active theme has a dark background */
export function useIsDark() {
  var ctx = useTheme();
  return ctx ? ctx.isDark : true;
}

/** Returns a CSS class string for theme-sensitive contrast */
export function useThemeClass(baseClass) {
  var ctx = useTheme();
  if (!ctx) return baseClass || "";
  var classes = [
    baseClass || "",
    ctx.isDark ? "theme-dark" : "theme-light",
  ].filter(Boolean);
  return classes.join(" ");
}

// ─── ThemePicker component ────────────────────────────────────────────────────
export function ThemePicker() {
  var ctxValue   = useTheme();
  var themeId    = ctxValue ? ctxValue.themeId : DEFAULT_THEME;
  var setThemeId = ctxValue ? ctxValue.setThemeId : function () {};

  return React.createElement(
    "div",
    {
      className: "theme-picker-grid",
      role: "radiogroup",
      "aria-label": "Choose a theme",
    },
    THEME_IDS.map(function (id) {
      var t        = THEMES[id];
      var isActive = themeId === id;

      return React.createElement(
        "button",
        {
          key:            id,
          className:      "theme-picker-card" + (isActive ? " theme-picker-card--active" : ""),
          onClick:        function () { setThemeId(id); },
          title:          t.description,
          role:           "radio",
          "aria-checked": isActive,
          "aria-label":   t.name + " theme: " + t.description,
          style: {
            "--card-bg":     t.previewBg,
            "--card-accent": t.previewAccent,
            "--card-inner":  t.previewCard,
          },
        },

        // Preview mini-mockup
        React.createElement(
          "div",
          {
            className: "theme-picker-preview",
            style: { background: t.previewBg },
            "aria-hidden": "true",
          },
          React.createElement("div", {
            className: "theme-picker-preview-bar",
            style: {
              background:   t.previewCard,
              borderBottom: "1px solid " + (t.dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"),
            },
          }),
          React.createElement(
            "div",
            { className: "theme-picker-preview-body" },
            React.createElement("div", {
              className: "theme-picker-preview-card",
              style: {
                background: t.previewCard,
                border: "1px solid " + (t.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"),
              },
            }),
            React.createElement("div", {
              className: "theme-picker-preview-card theme-picker-preview-card--2",
              style: {
                background: t.previewCard,
                border: "1px solid " + (t.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"),
              },
            })
          ),
          React.createElement("div", {
            className: "theme-picker-preview-accent",
            style: { background: t.previewAccent },
          })
        ),

        // Colour swatches
        React.createElement(
          "div",
          { className: "theme-picker-swatches", "aria-hidden": "true" },
          t.swatches.map(function (s, i) {
            return React.createElement("span", {
              key:       i,
              className: "theme-picker-swatch",
              style:     { background: s },
              title:     s,
            });
          })
        ),

        // Meta info
        React.createElement(
          "div",
          { className: "theme-picker-meta" },
          React.createElement("span", { className: "theme-picker-emoji", "aria-hidden": "true" }, t.emoji),
          React.createElement("span", { className: "theme-picker-name" }, t.name)
        ),
        React.createElement("p", { className: "theme-picker-desc" }, t.description),

        // Active ring
        isActive && React.createElement("div", {
          className: "theme-picker-active-ring",
          "aria-hidden": "true",
        })
      );
    })
  );
}