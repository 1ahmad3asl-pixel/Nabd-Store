/* Nabd-Store - اشتراكات رقمية */
(function(){
"use strict";

const GROUPS = [
  {key:"canva-pro", title:"Canva pro", aliases:["canva pro","canva - pro","canva"]},
  {key:"gemini-18m", title:"Gemini | 18 شهر رابط تفعيل", aliases:["gemini","18 شهر","18 months","رابط تفعيل"]},
  {key:"capcut-1m-personal-1", title:"كاب كات برو | 1 شهر | حساب شخصي", aliases:["capcut pro","capcut","كاب كات","كاب كات برو","1 شهر","شهر","حساب شخصي"]},
  {key:"capcut-1m-personal-2", title:"كاب كات برو | 1 شهر | حساب شخصي", aliases:["capcut pro","capcut","كاب كات","كاب كات برو","1 شهر","شخصي"]},
  {key:"capcut-1m-ready", title:"كاب كات برو | 1 شهر | حساب جاهز", aliases:["capcut pro","capcut","كاب كات","كاب كات برو","1 شهر","حساب جاهز","جاهز"]},
  {key:"capcut-12m-personal", title:"كاب كات برو | 12 شهر | حساب شخصي", aliases:["capcut pro","capcut","كاب كات","كاب كات برو","12 شهر","12 months","حساب شخصي","شخصي"]},
  {key:"canva-pro-en", title:"Canva - Pro", aliases:["canva pro","canva - pro","canva"]},
  {key:"gemini-pro", title:"Gemini - Pro", aliases:["gemini pro","gemini","gemini - pro"]},
  {key:"gamma-ai-pro", title:"Gamma Ai - Pro", aliases:["gamma ai","gamma","gamma - pro"]},
  {key:"super-grok", title:"Super Grok", aliases:["super grok","grok"]},
  {key:"cursor-pro", title:"Cursor - Pro", aliases:["cursor pro","cursor - pro","cursor"]},
  {key:"chatgpt", title:"ChatGPT", aliases:["chatgpt","chat gpt","gpt"]},
];

let loaded = false;
let products = [];
function captureDigitalScope(groupKey){
  if(typeof captureSectionScope === "function") return captureSectionScope(NabdScope.DIGITAL, groupKey || null);
  return {revision:Date.now(),key:groupKey || "digital"};
}
function isCurrentDigitalScope(snapshot){
  if(typeof isCurrentSectionScope === "function") return isCurrentSectionScope(snapshot);
  return !!snapshot;
}

function norm(v){
  if(typeof normalizeGameText === "function") return normalizeGameText(String(v || ""));
  return String(v || "").toLowerCase().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/[._:/\\-]+/g," ").replace(/\s+/g," ").trim();
}

function esc(v){
  return typeof escapeHtml === "function" ? escapeHtml(v) : String(v ?? "");
}

function productText(p){
  return norm(String(p && p.category_name || "") + " " + String(p && p.name || ""));
}

function matchesGroup(p, group){
  const text = productText(p);
  if(!text) return false;
  const aliases = group.aliases.map(norm).filter(Boolean);

  if(group.key.startsWith("canva")){
    return text.includes("canva");
  }
  if(group.key.startsWith("gemini")){
    return text.includes("gemini");
  }
  if(group.key.startsWith("gamma")){
    return text.includes("gamma");
  }
  if(group.key === "super-grok"){
    return text.includes("grok");
  }
  if(group.key === "cursor-pro"){
    return text.includes("cursor");
  }
  if(group.key === "chatgpt"){
    return text.includes("chatgpt") || text.includes("chat gpt");
  }
  if(group.key.startsWith("capcut")){
    if(!(text.includes("capcut") || text.includes("كاب كات"))) return false;
    if(group.key === "capcut-12m-personal") return text.includes("12") || text.includes("12 شهر") || text.includes("12 months");
    if(group.key === "capcut-1m-ready") return text.includes("جاهز") || text.includes("ready");
    return (text.includes("1") || text.includes("شهر") || text.includes("month")) && (text.includes("شخصي") || text.includes("personal"));
  }
  return aliases.some(function(a){ return text.includes(a); });
}

function groupProducts(group){
  return products.filter(function(p){ return matchesGroup(p, group); });
}

function setPage(titleText){
  const services=document.getElementById("servicesSection");
  const page=document.getElementById("internalPage");
  const title=document.getElementById("internalPageTitle");
  const icon=document.getElementById("internalPageIcon");
  if(!services || !page) return false;
  services.hidden=true;
  page.hidden=false;
  if(title) title.textContent=titleText;
  if(icon) icon.textContent="♾️";
  return true;
}

function openDigitalPage(fromHistory){
  const scope=captureDigitalScope();
  if(!fromHistory && typeof pushInternalHistory === "function") pushInternalHistory("digital");
  if(!setPage("اشتراكات رقمية")) return;

  const content=document.getElementById("internalPageContent");
  if(!content) return;

  if(!loaded){
    content.innerHTML='<div class="products-loading"><div class="loading-spinner"></div><p>جاري تحميل الاشتراكات الرقمية...</p></div>';
    const request = typeof loadProducts === "function" ? loadProducts({force:false}) : Promise.reject(new Error("loadProducts unavailable"));
    request.then(function(p){
      products=Array.isArray(p)?p:[];
      loaded=true;
      if(isCurrentDigitalScope(scope)) openDigitalPage(true);
    }).catch(function(){
      if(!isCurrentDigitalScope(scope)) return;
      content.innerHTML='<div class="digital-placeholder"><div class="digital-placeholder-icon">♾️</div><h3>اشتراكات رقمية</h3><p>تعذر تحميل المنتجات حاليًا.</p><button class="pubg-back" type="button" id="digitalRetry">↻ إعادة المحاولة</button></div>';
      const retry=document.getElementById("digitalRetry");
      if(retry) retry.onclick=function(){ loaded=false; openDigitalPage(true); };
    });
    return;
  }

  const groups=GROUPS.map(function(g){
    const list=groupProducts(g);
    return Object.assign({},g,{products:list});
  });

  content.innerHTML =
    '<div class="digital-page-note">اختر الاشتراك للدخول إلى المنتجات المتاحة.</div>' +
    '<div class="digital-category-grid">' +
    groups.map(function(g){
      const disabled=g.products.length===0;
      return '<button class="digital-category-tile'+(disabled?' is-disabled':'')+'" type="button" data-digital-group="'+esc(g.key)+'"'+(disabled?' disabled':'')+'>' +
        '<span class="digital-category-title">'+esc(g.title)+'</span>' +
        '<span class="digital-category-count">'+g.products.length+' منتج</span>' +
      '</button>';
    }).join("") +
    '</div>';

  content.querySelectorAll(".digital-category-tile:not([disabled])").forEach(function(tile){
    tile.addEventListener("click",function(){
      const key=tile.getAttribute("data-digital-group") || "";
      const group=groups.find(function(item){return item.key===key;});
      if(group) openDigitalProducts(group);
    });
  });

  window.scrollTo({top:0,behavior:"smooth"});
}

function openDigitalProducts(group,fromHistory){
  if(!group) return;
  const scope=captureDigitalScope(group.key);
  if(!fromHistory && typeof pushInternalHistory === "function"){
    pushInternalHistory("digital-products",{digitalGroupKey:group.key});
  }
  if(!setPage(group.title)) return;

  const content=document.getElementById("internalPageContent");
  if(!content) return;
  const list=Array.isArray(group.products)?group.products:[];

  content.innerHTML =
    '<div class="app-level-toolbar"><button class="pubg-back" type="button" id="digitalBack">← العودة إلى الاشتراكات الرقمية</button>' +
    '<div class="game-products-heading"><strong>'+list.length+' منتج</strong><span>'+esc(group.title)+'</span></div></div>' +
    '<div class="digital-product-grid">' +
    (list.length ? list.map(function(p){
      const available=p.available!==false && p.available!==0;
      const price=typeof getGameProductPrice === "function" ? getGameProductPrice(p) : (p.price != null ? Number(p.price) : null);
      const live=price!==null && Number.isFinite(Number(price));
      return '<article class="digital-product-card">' +
        '<div class="digital-product-name">'+esc(p.name || group.title)+'</div>' +
        '<div class="digital-product-meta">'+esc(p.category_name || "")+'</div>' +
        '<div class="digital-product-price">'+(live && typeof formatProductMoney==="function" ? formatProductMoney(p,price) : "السعر غير متاح")+'</div>' +
        '<button class="buy-btn digital-buy-btn" type="button" data-digital-product-id="'+esc(String(p.id))+'" '+(available&&live?"":"disabled")+'>'+ (available ? (live?"شراء الآن":"جاري تحديث السعر") : "غير متوفر") +'</button>' +
      '</article>';
    }).join("") : '<div class="digital-empty"><p>لا توجد منتجات مرتبطة بهذا الاشتراك حاليًا.</p></div>') +
    '</div>';

  const back=document.getElementById("digitalBack");
  if(back) back.onclick=function(){openDigitalPage(false);};

  content.querySelectorAll(".digital-buy-btn[data-digital-product-id]").forEach(function(btn){
    btn.addEventListener("click",function(){
      const p=list.find(function(item){return String(item.id)===String(btn.getAttribute("data-digital-product-id"));});
      if(p && isCurrentDigitalScope(scope) && typeof openProductModal==="function") openProductModal(p);
    });
  });

  window.scrollTo({top:0,behavior:"smooth"});
}

window.openDigitalPage=openDigitalPage;
window.openDigitalProducts=openDigitalProducts;
window.getDigitalGroups=function(){
  return GROUPS.map(function(g){return {key:g.key,title:g.title,products:groupProducts(g)};});
};
})();