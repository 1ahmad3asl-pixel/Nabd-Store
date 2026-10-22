(function requireTermsConsent(){
  try{
    if(sessionStorage.getItem("nabd_terms_continue_once_v1")==="1"){
      sessionStorage.removeItem("nabd_terms_continue_once_v1");
      return;
    }
  }catch(_){}
  const next=location.pathname+location.search;
  location.replace("/terms.html?next="+encodeURIComponent(next));
})();
