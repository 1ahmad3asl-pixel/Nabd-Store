
(function(){
  try{if(sessionStorage.getItem("nabd_guest_mode")==="1") return;}catch(_){}
  document.documentElement.classList.add("nabd-auth-check");
  fetch("/api/customer/auth/me",{headers:{Accept:"application/json"},credentials:"same-origin",cache:"no-store"})
    .then(function(response){if(!response.ok) throw new Error("not-authenticated");return response.json();})
    .then(function(data){
      if(data&&data.customer){document.documentElement.classList.remove("nabd-auth-check");return;}
      location.replace("/terms.html?next=%2Fcustomer-login.html%3Fnext%3D%252F");
    })
    .catch(function(){location.replace("/terms.html?next=%2Fcustomer-login.html%3Fnext%3D%252F");});
})();
