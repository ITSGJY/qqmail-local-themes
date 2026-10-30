const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('qqmail-local-themes.user.js','utf8');
function load(initial='bambooforest') {
  const names=new Set(['page-theme-default']), callbacks=new Map(), saved={selectedTheme:initial};
  let reloads=0;
  const classList={
    contains:k=>names.has(k),
    add:(...ks)=>ks.forEach(k=>names.add(k)),
    remove:(...ks)=>ks.forEach(k=>names.delete(k)),
    toggle:(k,v)=>v?names.add(k):names.delete(k),
    [Symbol.iterator]:function*(){yield* names;}
  };
  class Observer {observe(){} disconnect(){}}
  vm.runInNewContext(source,{
    document:{body:{classList},documentElement:{},addEventListener(){}},
    window:{addEventListener(){}},location:{reload(){reloads++;}},
    MutationObserver:Observer,queueMicrotask,console,
    GM_getValue:(k,d)=>saved[k]??d,GM_setValue:(k,v)=>saved[k]=v,
    GM_registerMenuCommand:(_label,cb,opts)=>{callbacks.set(opts.id,cb);return opts.id;},
    GM_unregisterMenuCommand:id=>callbacks.delete(id)
  });
  return {names,callbacks,saved,get reloads(){return reloads;}};
}
test('default theme applied',()=>assert(load().names.has('page-theme-bambooforest')));
test('switch themes and persist',()=>{
  const s=load();s.callbacks.get('qqmail-theme-orientalgreen')();
  assert(s.names.has('page-color-theme'));
  assert.equal(s.saved.selectedTheme,'orientalgreen');
  s.callbacks.get('qqmail-theme-blossomrain')();
  assert(!s.names.has('page-color-theme'));
});
test('turn off reloads native page',()=>{
  const s=load();s.callbacks.get('qqmail-theme-off')();
  assert.equal(s.reloads,1);assert.equal(s.saved.selectedTheme,'off');
});
test('invalid preference falls back',()=>assert(load('invalid').names.has('page-theme-bambooforest')));
