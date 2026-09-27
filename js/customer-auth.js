document.addEventListener("click",function(event){
    const target=event.target.closest("[data-action='account'], .drawer-link[href='#account']");
    if(!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href="/customer-login.html";
},true);

(async function(){
    try{
        const r=await fetch("/api/customer/auth/me",{headers:{Accept:"application/json"}});
        if(!r.ok) return;
        const data=await r.json();
        const customer=data.customer||{};
        const name=document.getElementById("menuUserName");
        const id=document.getElementById("menuCustomerId");
        const avatar=document.querySelector(".drawer-user .user-avatar");
        if(name) {
            const flag = customer.phone_country_code
                ? String(customer.phone_country_code).toUpperCase().replace(/[A-Z]/g,c=>String.fromCodePoint(c.charCodeAt(0)+127397))
                : "";
            name.textContent=(customer.name||"عميل") + (flag ? " · "+flag : "");
        }
        if(id) id.textContent=customer.customer_id ? "ID: "+customer.customer_id : "";
        if(avatar) { avatar.innerHTML=customer.avatar_url ? '<img src="'+customer.avatar_url+'" alt="الصورة الشخصية" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">' : "👤"; }
        if(typeof updateBalance==="function") updateBalance(customer.balance || 0);
    }catch(e){}
})();