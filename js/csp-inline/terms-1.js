
(function(){
  const checkbox=document.getElementById("termsAccepted");
  const button=document.getElementById("continueBtn");
  const params=new URLSearchParams(location.search);
  const rawNext=params.get("next")||"/customer-login.html?next=%2F";
  const safeNext=rawNext.startsWith("/")&&!rawNext.startsWith("//")?rawNext:"/customer-login.html?next=%2F";
  try{if(localStorage.getItem("nabd_terms_accepted_v1")==="1"){location.replace(safeNext);return;}}catch(_){}
  checkbox.addEventListener("change",function(){button.disabled=!checkbox.checked;});
  button.addEventListener("click",function(){
    if(!checkbox.checked)return;
    try{localStorage.setItem("nabd_terms_accepted_v1","1");}catch(_){}
    location.href=safeNext;
  });
})();
