// ==UserScript==
// @name         QQ邮箱 · 本地主题切换
// @namespace    https://github.com/ITSGJY/qqmail-local-themes
// @version      2.1.0
// @description  本地切换东方青绿、竹林清风、桃花微雨
// @match        https://wx.mail.qq.com/home/index*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @noframes
// ==/UserScript==
(function () {
  'use strict';
  const THEMES = {
    orientalgreen: { name: '东方青绿', className: 'page-theme-orientalgreen', colorTheme: true },
    bambooforest: { name: '竹林清风', className: 'page-theme-bambooforest', colorTheme: false },
    blossomrain: { name: '桃花微雨', className: 'page-theme-blossomrain', colorTheme: false }
  };
  const valid = key => key === 'off' || Object.prototype.hasOwnProperty.call(THEMES, key);
  const KEY = 'selectedTheme';
  let selected;
  try { selected = GM_getValue(KEY, 'bambooforest'); } catch { selected = 'bambooforest'; }
  if (!valid(selected)) selected = 'bambooforest';
  let observedBody = null, bodyObserver = null, rootObserver = null;
  let menuIds = [], queued = false;
  function observeBody() {
    if (observedBody && bodyObserver && selected !== 'off')
      bodyObserver.observe(observedBody, { attributes: true, attributeFilter: ['class'] });
  }
  function applyTheme() {
    if (selected === 'off' || !document.body) return;
    const current = document.body, theme = THEMES[selected];
    const otherThemes = Array.from(current.classList).filter(
      name => name.startsWith('page-theme-') && name !== theme.className
    );
    if (!otherThemes.length && current.classList.contains(theme.className) &&
        current.classList.contains('page-color-theme') === theme.colorTheme) return;
    bodyObserver?.disconnect();
    try {
      if (otherThemes.length) current.classList.remove(...otherThemes);
      current.classList.add(theme.className);
      current.classList.toggle('page-color-theme', theme.colorTheme);
    } finally { if (current === observedBody) observeBody(); }
  }
  function attachBody() {
    if (selected === 'off' || !document.body) return;
    if (document.body !== observedBody) {
      bodyObserver?.disconnect();
      observedBody = document.body;
      bodyObserver = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => { queued = false; attachBody(); });
      });
      observeBody();
    }
    applyTheme();
  }
  function start() {
    if (selected === 'off') return;
    if (!document.documentElement) {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      return;
    }
    if (!rootObserver) rootObserver = new MutationObserver(attachBody);
    rootObserver.observe(document.documentElement, { childList: true });
    attachBody();
  }
  function buildMenu() {
    if (typeof GM_registerMenuCommand !== 'function') return;
    if (typeof GM_unregisterMenuCommand === 'function')
      for (const id of menuIds) { try { GM_unregisterMenuCommand(id); } catch {} }
    menuIds = [];
    for (const [key, theme] of Object.entries(THEMES))
      menuIds.push(GM_registerMenuCommand(
        (selected === key ? '✓ ' : '') + theme.name,
        () => chooseTheme(key), { id: 'qqmail-theme-' + key }
      ));
    menuIds.push(GM_registerMenuCommand(
      selected === 'off' ? '✓ 跟随网页设置' : '跟随网页设置（关闭本地换肤）',
      () => chooseTheme('off'), { id: 'qqmail-theme-off' }
    ));
  }
  function chooseTheme(key) {
    if (!valid(key) || key === selected) return;
    selected = key;
    try { GM_setValue(KEY, key); }
    catch (error) { console.warn('[QQ邮箱本地主题] 保存失败', error); }
    if (key === 'off') {
      bodyObserver?.disconnect();
      rootObserver?.disconnect();
      observedBody = null;
      location.reload();
      return;
    }
    start();
    buildMenu();
  }
  buildMenu();
  start();
  window.addEventListener('pageshow', start);
})();