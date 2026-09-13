/* Reading-mode hint: tells viewers about present mode, auto-dismisses. (site addition) */
(function(){
  if(document.body.classList.contains('show')) return;                 // already presenting
  if(location.hash.indexOf('-present')>-1) return;                      // presenter link
  if(matchMedia('(pointer:coarse)').matches) return;                    // no keyboard
  var hint=document.createElement('div');
  hint.className='deck-hint';
  hint.setAttribute('aria-label','Keyboard shortcut: press P for presentation mode');
  hint.innerHTML='Press <kbd>p</kbd> to present';
  document.body.appendChild(hint);
  var hidden=false;
  function hide(){if(hidden)return;hidden=true;hint.classList.add('hidden');setTimeout(function(){hint.remove();},700);}
  setTimeout(hide,6000);
  addEventListener('keydown',function(){hide();},true);
  addEventListener('pointerdown',function(){hide();},true);
  addEventListener('scroll',function(){hide();},{capture:true,passive:true});
})();
/* Mobile present controls: button, exit, swipe, rotate hint (site addition) */
(function(){
  function key(k){dispatchEvent(new KeyboardEvent('keydown',{key:k}));}
  var coarse=matchMedia('(pointer:coarse)').matches;
  var btn=document.createElement('div');
  btn.className='present-btn';btn.setAttribute('role','button');btn.setAttribute('aria-label','Enter presentation mode');
  btn.innerHTML='<span class="tri">&#9656;</span>Present';
  btn.addEventListener('click',function(e){e.stopPropagation();if(!document.body.classList.contains('show'))key('p');});
  document.body.appendChild(btn);
  var exit=document.createElement('div');
  exit.className='present-exit';exit.setAttribute('role','button');exit.setAttribute('aria-label','Exit presentation');
  exit.innerHTML='&#10005;';
  exit.addEventListener('click',function(e){e.stopPropagation();if(document.body.classList.contains('show'))key('Escape');});
  document.body.appendChild(exit);
  var tx=null,swiped=false;
  addEventListener('touchstart',function(e){tx=e.touches[0].clientX;swiped=false;},{passive:true});
  addEventListener('touchmove',function(e){if(tx!==null&&Math.abs(e.touches[0].clientX-tx)>40)swiped=true;},{passive:true});
  addEventListener('touchend',function(e){
    if(tx===null||!swiped||!document.body.classList.contains('show')){tx=null;return;}
    e.preventDefault();
    var dx=e.changedTouches[0].clientX-tx;
    if(dx<0)key('ArrowRight');else if(dx>0)key('ArrowLeft');
    tx=null;
  },{passive:false});
  var rotatedShown=false;
  function checkRotate(){
    if(!document.body.classList.contains('show')){rotatedShown=false;return;}
    if(!rotatedShown&&coarse&&innerHeight>innerWidth){
      rotatedShown=true;
      var t=document.createElement('div');
      t.className='rotate-hint';t.textContent='Rotate for a bigger slide';
      document.body.appendChild(t);
      setTimeout(function(){t.classList.add('hidden');setTimeout(function(){t.remove();},700);},2600);
    }
  }
  new MutationObserver(checkRotate).observe(document.body,{attributes:true,attributeFilter:['class']});
  checkRotate();
})();
