
// ── FIX ALL GESTURES ──
(function(){

  // 1. FIX IFRAME SCROLL — inject touch-action into iframe content
  const frame = $('htmlViewerFrame');
  if(frame) {
    frame.addEventListener('load', function(){
      try {
        const doc = frame.contentDocument;
        if(!doc) return;
        // Add scroll and touch support
        const style = doc.createElement('style');
        style.textContent = `
          * { -webkit-overflow-scrolling: touch; }
          body { overflow-y: auto !important; touch-action: auto !important; }
          html { overflow-y: auto !important; touch-action: auto !important; }
        `;
        doc.head.appendChild(style);
      } catch(e) {}
    });
    // Allow touch events through iframe
    frame.style.touchAction = 'auto';
    frame.setAttribute('scrolling', 'yes');
  }

  // 2. FIX RIGHT PANEL SCROLL
  const rp = $('rightPanel');
  if(rp) {
    rp.style.overflowY = 'auto';
    rp.style.webkitOverflowScrolling = 'touch';
    rp.style.touchAction = 'pan-y';
  }

  // 3. FIX LEFT PANEL SCROLL
  const lp = $('leftPanel');
  if(lp) {
    lp.style.overflowY = 'auto';
    lp.style.webkitOverflowScrolling = 'touch';
    lp.style.touchAction = 'pan-y';
  }

  // 4. FIX EDITOR TEXTAREA SCROLL
  const ta = $('editorArea');
  if(ta) {
    ta.style.touchAction = 'auto';
    ta.style.webkitOverflowScrolling = 'touch';
    ta.style.userSelect = 'text';
    ta.style.webkitUserSelect = 'text';
  }

  // 5. FIX MODALS SCROLL
  ['editorModal','dialogModal','propsModal','msgModal','htmlViewerModal'].forEach(id=>{
    const el=$(id);
    if(el){
      el.style.touchAction = 'pan-y';
      el.style.overflowY = 'auto';
    }
  });

  // 6. FIX SWIPE BACK (swipe right = go back)
  let swipeStartX = 0, swipeStartY = 0;
  document.addEventListener('touchstart', e=>{
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, {passive:true});

  document.addEventListener('touchend', e=>{
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeStartY);
    // Swipe right (>80px, mostly horizontal) = go back
    if(dx > 80 && dy < 60) {
      const anyModal = ['editorModal','dialogModal','propsModal','msgModal','htmlViewerModal']
        .some(id=>$(id)&&$(id).style.display!=='none');
      if(!anyModal && historyStack.length) goBack();
    }
  }, {passive:true});

  // 7. FIX BREADCRUMB SCROLL
  const bc = $('breadcrumb');
  if(bc) {
    bc.style.touchAction = 'pan-x';
    bc.style.overflowX = 'auto';
  }

  // 8. FIX HTML VIEWER FRAME SIZE
  const htmlModal = $('htmlViewerModal');
  if(htmlModal) {
    const fr = $('htmlViewerFrame');
    if(fr) {
      fr.style.flex = '1';
      fr.style.width = '100%';
      fr.style.overflow = 'auto';
      fr.allow = 'fullscreen';
    }
  }

  console.log('✅ All gestures fixed');
})();
