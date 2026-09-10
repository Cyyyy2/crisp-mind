(() => {
  const source = app.workspace.getLeavesOfType('crisp-mind-view').find(l => l.view.canvasController).view.canvasController;
  const host = document.createElement('div'); host.style.cssText='position:fixed;width:380px;height:600px;left:0;top:0;z-index:-1'; document.body.appendChild(host);
  let changes=0;
  const c = new source.constructor(host, {theme:'crisp-obsidian',layout:'logicalStructure',root:{id:'root',data:{text:'Root'},children:[{id:'a',data:{text:'中文测试 [[Target|显示名称]]'},children:[]},{id:'b',data:{text:'Sibling'},children:[]}]}}, {onChange:()=>changes++});
  const results=[]; const check=(name,ok)=>{results.push({name,ok});if(!ok)throw Error(name)};
  try {
    check('opening does not save',changes===0);
    const nodeEl=c.nodesGroup.querySelector('[data-node-id="a"]');
    nodeEl.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    check('selection preserves node for double-click',nodeEl.isConnected);
    nodeEl.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
    check('double-click opens editor',!!c.editor);
    const input=c.editor;
    for (const key of ['Backspace',' ','Tab']) input.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
    check('editor keys do not mutate tree',c.docData.root.children.length===2&&c.findNode('a').children.length===0&&changes===0);
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));
    check('IME Enter keeps editor',c.editor===input);
    input.value='Edited'; input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    check('commit edits only text',c.findNode('a').data.text==='Edited'&&c.docData.root.children.length===2&&changes===1);
    c.undo(); check('undo text',c.findNode('a').data.text.startsWith('中文'));
    for(const layout of ['logicalStructure','mindMap','organizationStructure','catalogOrganization']) {
      c.setLayout(layout); c.resetZoom(); const b=c.getBounds();
      check(layout+' fits narrow viewport', b.x*c.scale+c.translateX>=0&&(b.x+b.width)*c.scale+c.translateX<=380);
    }
    const svg=new DOMParser().parseFromString(c.exportSVG(),'image/svg+xml');
    check('standalone SVG valid',!svg.querySelector('parsererror')&&svg.documentElement.hasAttribute('viewBox')&&!svg.documentElement.firstElementChild.hasAttribute('transform'));
    c.destroy(); check('listeners removed',c.disposers.length===0);
    return JSON.stringify(results);
  } finally {c.destroy();host.remove();}
})()
