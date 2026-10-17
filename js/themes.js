/**
 * THEME ENGINE - POPOMUS
 * Single source of truth for color presets, background styles and the
 * contrast-safe color math used to paint the interface.
 *
 * Every color that ends up behind white text goes through `readable()`,
 * so presets and custom colors stay legible no matter what the user picks.
 */

const THEME_PRESETS = {
  sunset:   { name: 'Sunset Glow',    pomo: '#da4d4f', short: '#ea845e', long: '#f39336' },
  tomato:   { name: 'Classic Tomato', pomo: '#ba4949', short: '#38858a', long: '#397097' },
  earth:    { name: 'Warm Earth',     pomo: '#ea845e', short: '#f39336', long: '#eab66a' },
  dusk:     { name: 'Dusk Horizons',  pomo: '#dd7057', short: '#f4a971', long: '#213241' },
  forest:   { name: 'Forest',         pomo: '#3d7a57', short: '#4f8a6e', long: '#2f5e4e' },
  lagoon:   { name: 'Lagoon',         pomo: '#1f6f8b', short: '#2a9d8f', long: '#264653' },
  violet:   { name: 'Violet Hour',    pomo: '#7a4f9a', short: '#a05a8f', long: '#4c4f94' },
  night:    { name: 'Deep Night',     pomo: '#3d2228', short: '#dd7057', long: '#213241' },
  gunmetal: { name: 'Midnight Slate', pomo: '#213241', short: '#272233', long: '#3d2228' },
  graphite: { name: 'Graphite',       pomo: '#2e3138', short: '#3c424c', long: '#22262c' }
};

// Keys used by older versions of the app, mapped to their current preset.
const LEGACY_THEME_ALIASES = {
  classic: 'sunset',
  palette: 'sunset',
  mint: 'earth',
  ocean: 'dusk',
  lavender: 'night',
  dark: 'gunmetal'
};

const BACKGROUND_STYLES = {
  solid:    { name: 'Solid' },
  gradient: { name: 'Gradient' },
  deep:     { name: 'Deep' }
};

const DEFAULT_THEME = 'sunset';
const DEFAULT_BACKGROUND = 'solid';
const MODE_KEYS = ['pomo', 'short', 'long'];
const HEX_RE = /^#[0-9a-f]{6}$/i;

const Themes = {
  presets: THEME_PRESETS,
  backgrounds: BACKGROUND_STYLES,

  resolveKey(key) {
    if (key === 'custom' || THEME_PRESETS[key]) return key;
    return LEGACY_THEME_ALIASES[key] || DEFAULT_THEME;
  },

  resolveBackground(key) {
    return BACKGROUND_STYLES[key] ? key : DEFAULT_BACKGROUND;
  },

  isHex(value) {
    return typeof value === 'string' && HEX_RE.test(value);
  },

  /** Raw (unadjusted) mode colors for a theme key, reading custom colors from settings. */
  colorsFor(themeKey, settings = {}) {
    const key = this.resolveKey(themeKey);
    if (key === 'custom') {
      const fallback = THEME_PRESETS[DEFAULT_THEME];
      return {
        pomo: this.isHex(settings.customColorPomo) ? settings.customColorPomo : fallback.pomo,
        short: this.isHex(settings.customColorShort) ? settings.customColorShort : fallback.short,
        long: this.isHex(settings.customColorLong) ? settings.customColorLong : fallback.long
      };
    }
    const { pomo, short, long } = THEME_PRESETS[key];
    return { pomo, short, long };
  },

  // Color math

  _toRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  _toHex(rgb) {
    return '#' + rgb.map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('');
  },

  _luminance(hex) {
    const [r, g, b] = this._toRgb(hex).map(c => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  },

  /** WCAG contrast ratio between a color and white text. */
  contrastWithWhite(hex) {
    return 1.05 / (this._luminance(hex) + 0.05);
  },

  /** Mixes `hex` toward `target` by `amount` (0..1). */
  mix(hex, target, amount) {
    const a = this._toRgb(hex);
    const b = this._toRgb(target);
    return this._toHex(a.map((c, i) => c + (b[i] - c) * amount));
  },

  /**
   * Darkens a color just enough for white text to reach `minRatio`.
   * 3.4 keeps the large timer digits and bold UI labels comfortably readable
   * while preserving the hue of light palettes (amber, gold, sand).
   */
  readable(hex, minRatio = 3.4) {
    let color = hex;
    for (let i = 0; i < 20 && this.contrastWithWhite(color) < minRatio; i++) {
      color = this.mix(color, '#000000', 0.06);
    }
    return color;
  },

  rgba(hex, alpha) {
    const [r, g, b] = this._toRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  /** Full set of CSS values for one mode color under a background style. */
  paletteFor(rawHex, background) {
    const base = this.readable(rawHex);
    let bg = base;
    let bgImage = 'none';

    if (background === 'deep') {
      bg = this.mix(base, '#0f1014', 0.62);
    } else if (background === 'gradient') {
      const top = this.readable(this.mix(base, '#ffffff', 0.1));
      const bottom = this.mix(base, '#000000', 0.32);
      bgImage = `linear-gradient(160deg, ${top} 0%, ${base} 45%, ${bottom} 100%)`;
    }

    return {
      accent: base,
      bg,
      bgImage,
      glow: this.rgba(base, 0.4)
    };
  },

  /** Applies a theme to the document. Returns the resolved theme key. */
  apply(themeKey, settings = {}, background = DEFAULT_BACKGROUND) {
    const key = this.resolveKey(themeKey);
    const bgStyle = this.resolveBackground(background);
    const colors = this.colorsFor(key, settings);
    const root = document.documentElement;

    MODE_KEYS.forEach(mode => {
      const p = this.paletteFor(colors[mode], bgStyle);
      root.style.setProperty(`--theme-${mode}-primary`, p.accent);
      root.style.setProperty(`--theme-${mode}-bg`, p.bg);
      root.style.setProperty(`--theme-${mode}-bg-image`, p.bgImage);
      root.style.setProperty(`--theme-${mode}-glow`, p.glow);
    });

    root.dataset.background = bgStyle;
    this.syncMetaThemeColor();
    return key;
  },

  /** Keeps the browser/OS chrome color in sync with the active mode. */
  syncMetaThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    requestAnimationFrame(() => {
      const bg = getComputedStyle(document.body).getPropertyValue('--primary-bg').trim();
      if (bg) meta.setAttribute('content', bg);
    });
  },

  /** Three-stripe swatch markup previewing a theme's mode colors. */
  swatchHtml(colors) {
    return MODE_KEYS
      .map(mode => `<span style="background:${this.readable(colors[mode])}"></span>`)
      .join('');
  }
};

if (typeof window !== 'undefined') {
  window.Themes = Themes;
  window.THEME_PRESETS = THEME_PRESETS;
}
