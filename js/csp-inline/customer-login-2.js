
(async function redirectAlreadyLoggedInCustomer(){
  try{
    const r=await fetch("/api/customer/auth/me",{headers:{"Accept":"application/json"},credentials:"same-origin",cache:"no-store"});
    if(!r.ok) return;
    const data=await r.json();
    if(data && data.customer) {
      location.replace(data.customer.profile_complete ? "/" : "/customer-profile.html");
    }
  }catch(_){}
})();
let mode="login",emailVerified=false,verificationToken="";
const form=document.getElementById("authForm"),googleLogin=document.querySelector(".google-login"),registerReturn=document.getElementById("registerReturn"),returnLoginBtn=document.getElementById("returnLoginBtn"),nameField=document.getElementById("nameField"),loginBtn=document.getElementById("loginBtn"),registerBtn=document.getElementById("registerBtn"),password=document.getElementById("password"),passwordToggle=document.getElementById("passwordToggle"),error=document.getElementById("authError"),email=document.getElementById("email"),sendCodeBtn=document.getElementById("sendCodeBtn"),codeSection=document.getElementById("codeSection"),verificationCode=document.getElementById("verificationCode"),verifyCodeBtn=document.getElementById("verifyCodeBtn"),passwordSection=document.getElementById("passwordSection"),emailVerifiedMessage=document.getElementById("emailVerifiedMessage");
function showError(message,ok=false){error.textContent=message;error.style.display="block";error.style.background=ok?"#e8f7ee":"#ffe8e8";error.style.color=ok?"#176b3a":"#a00";}
function setMode(next){mode=next;const forgotPasswordNote=document.getElementById("forgotPasswordNote");if(forgotPasswordNote)forgotPasswordNote.hidden=mode!=="login";const authTitle=document.getElementById("authTitle"),authSubtitle=document.getElementById("authSubtitle");if(authTitle)authTitle.textContent=mode==="register"?"إنشاء حساب جديد":"تسجيل الدخول";if(authSubtitle){authSubtitle.textContent=mode==="register"?"بعد إرسال الكود، قد يكون موجودًا في الرسائل غير المرغوب فيها الموجودة في القائمة الجانبية في الإيميل":"";authSubtitle.classList.toggle("auth-note",mode==="register");}nameField.hidden=true;loginBtn.textContent=mode==="login"?"تسجيل الدخول":"تسجيل الحساب";registerBtn.textContent="إنشاء حساب";registerBtn.hidden=mode==="register";googleLogin.hidden=mode==="register";const signupPrompt=document.getElementById("signupPrompt");if(signupPrompt)signupPrompt.hidden=mode==="register";registerReturn.hidden=mode!=="register";error.style.display="none";document.getElementById("name").required=false;email.required=true;sendCodeBtn.hidden=mode!=="register";codeSection.hidden=true;emailVerifiedMessage.hidden=true;emailVerified=false;verificationToken="";passwordSection.hidden=mode==="register";password.required=mode==="login";password.value="";loginBtn.hidden=mode==="register";}
registerBtn.onclick=()=>setMode("register");
returnLoginBtn.onclick=()=>setMode("login");
passwordToggle.onclick=()=>{const visible=password.type==="text";password.type=visible?"password":"text";passwordToggle.textContent=visible?"عرض":"إخفاء";};
email.addEventListener("input",()=>{if(mode==="register"){emailVerifiedMessage.hidden=true;emailVerified=false;verificationToken="";codeSection.hidden=true;passwordSection.hidden=true;loginBtn.hidden=true;nameField.hidden=true;}});
sendCodeBtn.onclick=async()=>{error.style.display="none";const value=email.value.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(value)){showError("أدخل بريدًا إلكترونيًا صحيحًا أولًا.");return;}sendCodeBtn.disabled=true;try{const r=await fetch("/api/customer/email/send-code",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({email:value})});const data=await r.json();if(!r.ok)throw new Error(data.message||"تعذر إرسال رمز التحقق.");codeSection.hidden=false;verificationCode.focus();showError("تم إرسال رمز التحقق إلى بريدك الإلكتروني.",true);}catch(err){showError(err.message);}finally{sendCodeBtn.disabled=false;}};
verifyCodeBtn.onclick=async()=>{error.style.display="none";const value=email.value.trim().toLowerCase(),code=verificationCode.value.trim();if(!/^\d{6}$/.test(code)){showError("أدخل رمز التحقق المكوّن من 6 أرقام.");return;}verifyCodeBtn.disabled=true;try{const r=await fetch("/api/customer/email/verify-code",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({email:value,code})});const data=await r.json();if(!r.ok)throw new Error(data.message||"تعذر التحقق من الرمز.");emailVerified=true;verificationToken=String(data.verification_token||"");emailVerifiedMessage.hidden=false;codeSection.hidden=true;sendCodeBtn.hidden=true;nameField.hidden=false;document.getElementById("name").required=true;passwordSection.hidden=false;password.required=true;loginBtn.hidden=false;password.focus();error.style.display="none";}catch(err){showError(err.message);}finally{verifyCodeBtn.disabled=false;}};
async function continueAfterAuthentication(){
  try{
    const r=await fetch("/api/customer/auth/me",{headers:{"Accept":"application/json"},credentials:"same-origin",cache:"no-store"});
    if(r.ok){
      const data=await r.json();
      location.replace(data?.customer?.profile_complete ? "/" : "/customer-profile.html");
      return;
    }
  }catch(_){}
  location.replace("/customer-profile.html");
}
form.addEventListener("submit",async e=>{e.preventDefault();error.style.display="none";if(mode==="register"&&!emailVerified){showError("تحقق من بريدك الإلكتروني أولًا.");return;}loginBtn.disabled=true;registerBtn.disabled=true;try{const body={email:email.value.trim(),password:password.value};if(mode==="register"){body.name=document.getElementById("name").value.trim();body.verification_token=verificationToken;}const r=await fetch("/api/customer/"+(mode==="login"?"login":"register"),{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.message||"تعذر إكمال العملية.");await continueAfterAuthentication();}catch(err){showError(err.message);}finally{loginBtn.disabled=false;registerBtn.disabled=false;}});
const params=new URLSearchParams(location.search);
setMode(params.get("mode")==="register"?"register":"login");
