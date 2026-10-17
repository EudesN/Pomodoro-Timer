const test = require('node:test');
const assert = require('node:assert/strict');
const { load, global } = require('./helpers');

load('themes.js');
const Themes = global('Themes');
const THEME_PRESETS = global('THEME_PRESETS');

test('every preset color is readable behind white text', () => {
  for (const [key, preset] of Object.entries(THEME_PRESETS)) {
    for (const mode of ['pomo', 'short', 'long']) {
      const ratio = Themes.contrastWithWhite(Themes.readable(preset[mode]));
      assert.ok(ratio >= 3.4, `${key}.${mode} contrast ${ratio.toFixed(2)}`);
    }
  }
});

test('readable() fixes any custom color, including pure white and yellow', () => {
  for (const color of ['#ffffff', '#ffff00', '#f0f0f0', '#7fffd4', '#000000']) {
    assert.ok(Themes.contrastWithWhite(Themes.readable(color)) >= 3.4, color);
  }
});

test('legacy and unknown theme keys resolve to existing presets', () => {
  assert.equal(Themes.resolveKey('classic'), 'sunset');
  assert.equal(Themes.resolveKey('lavender'), 'night');
  assert.equal(Themes.resolveKey('does-not-exist'), 'sunset');
  assert.equal(Themes.resolveKey('custom'), 'custom');
});

test('invalid custom colors fall back to the default preset', () => {
  const colors = Themes.colorsFor('custom', { customColorPomo: 'red', customColorShort: '#12345', customColorLong: '#123456' });
  assert.equal(colors.pomo, THEME_PRESETS.sunset.pomo);
  assert.equal(colors.short, THEME_PRESETS.sunset.short);
  assert.equal(colors.long, '#123456');
});
