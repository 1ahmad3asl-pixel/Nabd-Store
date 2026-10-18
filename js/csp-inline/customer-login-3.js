
(function lockTextSelection(){
  const block=e=>e.preventDefault();
  document.addEventListener("contextmenu",block,{capture:true});
  document.addEventListener("selectstart",block,{capture:true});
  document.addEventListener("copy",block,{capture:true});
  document.addEventListener("cut",block,{capture:true});
  document.addEventListener("dragstart",block,{capture:true});
})();
