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
        if(name) {
            const flag = customer.phone_country_code
                ? String(customer.phone_country_code).toUpperCase().replace(/[A-Z]/g,c=>String.fromCodePoint(c.charCodeAt(0)+127397))
                : "";
            name.textContent=(customer.name||"عميل") + (flag ? " · "+flag : "");
        }
        if(id) id.textContent=customer.customer_id ? "ID: "+customer.customer_id : "";
    }catch(e){}
})();