
const form=document.getElementById("loginForm");
const button=document.getElementById("loginButton");
const error=document.getElementById("loginError");
form.addEventListener("submit",async function(event){
 event.preventDefault();
 error.style.display="none";
 button.disabled=true;
 try{
  const response=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({email:document.getElementById("email").value,password:document.getElementById("password").value})});
  const data=await response.json();
  if(!response.ok) throw new Error(data.message||"تعذر تسجيل الدخول");
  window.location.href="/Chvcdh678gjFbC55Z6gj5ho7/index.html";
 }catch(e){
  error.textContent=e.message;
  error.style.display="block";
 }finally{button.disabled=false;}
});
