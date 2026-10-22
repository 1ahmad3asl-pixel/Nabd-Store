(function(){
  const checkbox=document.getElementById("termsAccepted");
  const button=document.getElementById("continueBtn");
  const params=new URLSearchParams(location.search);
  const fallbackNext="/customer-login.html?next=%2F";
  const rawNext=params.get("next")||fallbackNext;
  let safeNext=fallbackNext;
  if(rawNext.startsWith("/")&&!rawNext.startsWith("//")&&!rawNext.includes("\\")){
    try{
      const parsedNext=new URL(rawNext,location.origin);
      if(parsedNext.origin===location.origin){safeNext=parsedNext.pathname+parsedNext.search+parsedNext.hash;}
    }catch(_){}
  }
  checkbox.addEventListener("change",function(){button.disabled=!checkbox.checked;});
  button.addEventListener("click",function(){
    if(!checkbox.checked)return;
    try{sessionStorage.setItem("nabd_terms_continue_once_v1","1");}catch(_){}
    location.href=safeNext;
  });
})();
