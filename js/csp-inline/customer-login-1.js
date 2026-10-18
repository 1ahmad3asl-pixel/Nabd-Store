
(function requireTermsConsent(){
  try{if(localStorage.getItem("nabd_terms_accepted_v1")==="1")return;}catch(_){}
  const next=location.pathname+location.search;
  location.replace("/terms.html?next="+encodeURIComponent(next));
})();
