// ==UserScript==
// @name         QQ邮箱 · 本地主题切换
// @namespace    https://github.com/ITSGJY/qqmail-local-themes
// @version      2.2.0
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
  const VERSION = '2.2.0';
  const PREFIX = `[QQ邮箱本地主题 v${VERSION}]`;
  // Serialize immediately so DevTools shows the state at the time of the event.
  function log(level, event, details = {}) {
    console[level](PREFIX, event, JSON.stringify(details));
  }
  const THEMES = {
    orientalgreen: { name: '东方青绿', className: 'page-theme-orientalgreen', colorTheme: true },
    bambooforest: { name: '竹林清风', className: 'page-theme-bambooforest', colorTheme: false },
    blossomrain: { name: '桃花微雨', className: 'page-theme-blossomrain', colorTheme: false }
  };
  const valid = key => key === 'off' || Object.prototype.hasOwnProperty.call(THEMES, key);
  const KEY = 'selectedTheme';
  let selected;
  try { selected = GM_getValue(KEY, 'bambooforest'); }
  catch { selected = 'bambooforest'; log('warn', 'storage-read-failed'); }
  if (!valid(selected)) {
    log('warn', 'invalid-preference', { fallback: 'bambooforest' });
    selected = 'bambooforest';
  }
  let observedBody = null, bodyObserver = null, rootObserver = null;
  let menuIds = [], queued = false;
  let diagnosticTimer = null, repairs = 0, suppressedRepairs = 0;
  let lastRepairLog = -Infinity, applications = 0, bodyAttachments = 0;
  function themeClasses(body = document.body) {
    // Only structural theme tokens; never dump the page, account or session URL.
    return body ? Array.from(body.classList).filter(name =>
      /^page-theme-[a-z0-9_-]+$/i.test(name) || name === 'page-color-theme'
    ) : [];
  }
  function diagnose(reason = 'manual') {
    try {
      const classes = themeClasses(), theme = THEMES[selected];
      const layers = Array.from(document.querySelectorAll('[class*="frame-theme-bg-"]'));
      const backgrounds = layers.filter(node => getComputedStyle(node).backgroundImage !== 'none').length;
      const classMatches = theme ? classes.includes(theme.className) &&
        classes.includes('page-color-theme') === theme.colorTheme &&
        classes.filter(name => name.startsWith('page-theme-')).length === 1 : null;
      const snapshot = {
        reason, selected, readyState: document.readyState,
        bodyPresent: !!document.body, themeClasses: classes, classMatches,
        layerCount: layers.length, layersWithBackground: backgrounds,
        applications, repairs, suppressedRepairs, bodyAttachments,
        menuCount: menuIds.length,
        apis: {
          read: typeof GM_getValue === 'function', write: typeof GM_setValue === 'function',
          registerMenu: typeof GM_registerMenuCommand === 'function',
          unregisterMenu: typeof GM_unregisterMenuCommand === 'function'
        }
      };
      log('info', 'diagnostic', snapshot);
      if (theme && (!classMatches || !layers.length || !backgrounds)) {
        log('warn', 'theme-check-inconclusive', {
          hint: '主题类或背景层不符合预期，请结合页面截图检查；页面尚未加载完成也可能触发此提示。'
        });
      }
    } catch {
      log('warn', 'diagnostic-failed', { hint: '无法读取主题样式，请检查页面结构是否变化。' });
    }
  }
  function scheduleDiagnostic() {
    clearTimeout(diagnosticTimer);
    diagnosticTimer = setTimeout(() => { diagnosticTimer = null; diagnose('settled'); }, 1500);
  }
  function observeBody() {
    if (observedBody && bodyObserver && selected !== 'off')
      bodyObserver.observe(observedBody, { attributes: true, attributeFilter: ['class'] });
  }
  function applyTheme(reason) {
    if (selected === 'off' || !document.body) return;
    const current = document.body, theme = THEMES[selected];
    const otherThemes = Array.from(current.classList).filter(
      name => name.startsWith('page-theme-') && name !== theme.className
    );
    if (!otherThemes.length && current.classList.contains(theme.className) &&
        current.classList.contains('page-color-theme') === theme.colorTheme) return;
    const before = themeClasses(current);
    bodyObserver?.disconnect();
    try {
      if (otherThemes.length) current.classList.remove(...otherThemes);
      current.classList.add(theme.className);
      current.classList.toggle('page-color-theme', theme.colorTheme);
      applications++;
      if (reason === 'mutation') {
        repairs++;
        const now = Date.now();
        if (now - lastRepairLog >= 10000) {
          log('warn', 'theme-repaired', { selected, before, after: themeClasses(current), repairs, suppressedRepairs });
          lastRepairLog = now;
        } else { suppressedRepairs++; }
      } else {
        log('info', 'theme-applied', { selected, before, after: themeClasses(current) });
      }
    } catch {
      log('error', 'theme-apply-failed', { selected, themeClasses: themeClasses(current) });
    } finally { if (current === observedBody) observeBody(); }
  }
  function attachBody(reason = 'attach') {
    if (selected === 'off' || !document.body) return;
    if (document.body !== observedBody) {
      bodyObserver?.disconnect();
      observedBody = document.body;
      bodyAttachments++;
      bodyObserver = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => { queued = false; attachBody('mutation'); });
      });
      observeBody();
    }
    applyTheme(reason);
  }
  function start() {
    if (selected === 'off') return;
    if (!document.documentElement) {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      return;
    }
    if (!rootObserver) rootObserver = new MutationObserver(() => attachBody());
    rootObserver.observe(document.documentElement, { childList: true });
    attachBody();
  }
  function buildMenu() {
    if (typeof GM_registerMenuCommand !== 'function') {
      log('error', 'menu-api-unavailable');
      return;
    }
    try {
      if (typeof GM_unregisterMenuCommand === 'function')
        for (const id of menuIds) {
          try { GM_unregisterMenuCommand(id); }
          catch { log('warn', 'menu-unregister-failed'); }
        }
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
      menuIds.push(GM_registerMenuCommand(
        '输出诊断信息到控制台', () => diagnose(), { id: 'qqmail-theme-diagnostic' }
      ));
    } catch { log('error', 'menu-register-failed', { registeredCount: menuIds.length }); }
  }
  function chooseTheme(key) {
    if (!valid(key) || key === selected) return;
    const previous = selected;
    selected = key;
    let persisted = true;
    try { GM_setValue(KEY, key); }
    catch { persisted = false; log('warn', 'storage-write-failed', { selected: key }); }
    log('info', 'theme-selected', { previous, selected, persisted });
    if (key === 'off') {
      bodyObserver?.disconnect();
      rootObserver?.disconnect();
      observedBody = null;
      clearTimeout(diagnosticTimer);
      log('info', 'follow-page', { persisted, reload: true });
      location.reload();
      return;
    }
    start();
    buildMenu();
    scheduleDiagnostic();
  }
  log('info', 'startup', { selected });
  buildMenu();
  start();
  scheduleDiagnostic();
  window.addEventListener('pageshow', () => { start(); scheduleDiagnostic(); });
  window.addEventListener('pagehide', () => clearTimeout(diagnosticTimer));
})();
