/* Nabd-Store - رشق صفحات */
(function(){
"use strict";
const GROUPS=[
 {key:"snapchat",title:"رشق سناب شات",a:["رشق سناب شات","رشـق سناب شات","snapchat","سناب شات","سناب"]},
 {key:"kwai",title:"رشق كواي",a:["رشق كواي","رشـق كواي","kwai","كواي"]},
 {key:"facebook",title:"رشق فيسبوك",a:["رشق فيسبوك","رشـق فيسبوك","facebook","فيسبوك","فيس بوك"]},
 {key:"whatsapp",title:"رشق واتساب",a:["رشق واتساب","رشـق واتساب","whatsapp","واتساب","وتساب"]},
 {key:"instagram",title:"رشق انستغرام",a:["رشق انستغرام","رشـق انستغرام","instagram","انستغرام","انستجرام"]},
 {key:"tiktok",title:"رشق تيك توك",a:["رشق تيك توك","رشـق تيك توك","tiktok","tik tok","تيك توك"]},
 {key:"telegram",title:"رشق تلجرام",a:["رشق تلجرام","رشـق تلجرام","telegram","تلجرام","تليجرام","تيليجرام"]},
 {key:"youtube",title:"رشق يوتيوب",a:["رشق يوتيوب","رشـق يوتيوب","youtube","يوتيوب"]}
];
let products=[];
let loaded=false;
function captureBoostScope(groupKey){ if(typeof captureSectionScope==="function") return captureSectionScope(NabdScope.BOOST,groupKey||null); return {revision:Date.now(),key:groupKey||"boost"}; }
function isCurrentBoostScope(snapshot){ if(typeof isCurrentSectionScope==="function") return isCurrentSectionScope(snapshot); return !!snapshot; }
function n(v){return typeof normalizeGameText==="function"?normalizeGameText(String(v||"")):String(v||"").toLowerCase().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ـ/g,"").replace(/\s+/g," ").trim();}
function esc(v){return typeof escapeHtml==="function"?escapeHtml(v):String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function groupProducts(g){return products.filter(p=>{const t=n((p.category_name||"")+" "+(p.name||""));if(!/(رشق|boost|followers?|likes?|views?|members?|subscribers?|متابع|مشاهد|اعجاب|لايك|مشترك)/i.test(t))return false;return g.a.map(n).some(a=>t.includes(a));});}
function els(){return{services:document.getElementById("servicesSection"),page:document.getElementById("internalPage"),title:document.getElementById("internalPageTitle"),icon:document.getElementById("internalPageIcon"),content:document.getElementById("internalPageContent")};}
function push(view,data){if(typeof pushInternalHistory==="function")pushInternalHistory(view,data||{});else history.pushState(Object.assign({nabdInternal:true,view},data||{}),"",location.href);}
function renderBoostGroups(e){
 const groups=GROUPS.map(g=>({key:g.key,title:g.title,products:groupProducts(g)}));
 e.content.innerHTML='<div class="boost-page-note">اختر المنصة للدخول إلى منتجات الرشق المتاحة.</div><div class="boost-category-grid">'+groups.map(g=>'<button class="boost-category-tile" type="button" data-boost-group="'+g.key+'"><span class="boost-category-title">'+esc(g.title)+'</span><span class="boost-category-count">'+g.products.length+' منتج</span></button>').join("")+'</div>';
 e.content.querySelectorAll("[data-boost-group]").forEach(b=>b.addEventListener("click",()=>{const g=groups.find(x=>x.key===b.dataset.boostGroup);if(g)openBoostProducts(g);}));
 scrollTo({top:0,behavior:"smooth"});
}
function openBoost(fromHistory){
 const scope=captureBoostScope();
 if(!fromHistory)push("boost");
 const e=els();if(!e.services||!e.page||!e.content)return;
 e.services.hidden=true;e.page.hidden=false;if(e.title)e.title.textContent="رشق صفحات";if(e.icon)e.icon.textContent="🚀";

 // لا نربط ظهور المستوى الثاني بنجاح API. المربعات تظهر فورًا،
 // والمنتجات تُحدّث في الخلفية حتى لا تبقى الصفحة على "جاري التحميل".
 products=Array.isArray(window.__nabdBoostProducts)?window.__nabdBoostProducts:products;
 if(Array.isArray(products)&&products.length) loaded=true;
 renderBoostGroups(e);

 if(!loaded){
  e.content.insertAdjacentHTML("afterbegin",'<div class="boost-sync-status" id="boostSyncStatus">جاري تحديث منتجات الرشق في الخلفية…</div>');
  loadProducts({force:false}).then(p=>{
   if(!isCurrentBoostScope(scope)) return;
   products=Array.isArray(p)?p:[];
   loaded=true;
   window.__nabdBoostProducts=products;
   if(document.getElementById("internalPage")?.hidden===false) renderBoostGroups(els());
  }).catch(()=>{
   const status=document.getElementById("boostSyncStatus");
   if(status) status.innerHTML='تعذر تحديث المنتجات الآن. يمكنك الدخول إلى المنصة والمحاولة مرة أخرى.';
  });
 }
}
function openBoostProducts(g,fromHistory){
 const scope=captureBoostScope(g && g.key);
 if(!fromHistory)push("boost-products",{boostGroupKey:g.key});
 const e=els();if(!e.content)return;
 if(e.title)e.title.textContent=g.title;if(e.icon)e.icon.textContent="🚀";
 const list=g.products||[];
 e.content.innerHTML='<div class="app-level-toolbar"><button class="pubg-back" type="button" id="boostBack">← العودة إلى رشق الصفحات</button><div class="game-products-heading"><strong>'+list.length+' منتج</strong><span>'+esc(g.title)+'</span></div></div><div class="boost-product-grid">'+(list.length?list.map(p=>{
  const ok=p.available!==false&&p.available!==0,price=getGameProductPrice(p),live=price!==null;
  return '<article class="boost-product-card"><div class="boost-product-name">'+esc(p.name||"منتج")+'</div><div class="boost-product-meta">'+esc(p.category_name||"")+'</div><div class="boost-product-price">'+(live?formatProductMoney(p,price):"السعر غير متاح")+'</div><button class="buy-btn boost-buy-btn" type="button" data-id="'+esc(String(p.id))+'" '+(ok&&live?"":"disabled")+'>'+ (ok?(live?"شراء الآن":"جاري تحديث السعر"):"غير متوفر")+'</button></article>';
 }).join(""):'<div class="products-loading"><p>لا توجد منتجات مرتبطة بهذا النوع حاليًا.</p></div>')+'</div>';
 const back=document.getElementById("boostBack");if(back)back.onclick=()=>openBoost(false);
 e.content.querySelectorAll(".boost-buy-btn[data-id]").forEach(b=>b.addEventListener("click",()=>{const p=list.find(x=>String(x.id)===String(b.dataset.id));if(p && isCurrentBoostScope(scope))openProductModal(p);}));
 scrollTo({top:0,behavior:"smooth"});
}
window.__nabdHandleBoostHistory=function(s){
 if(!s||!s.nabdInternal)return;
 if(s.view==="boost")openBoost(true);
 else if(s.view==="boost-products"){
  const g=GROUPS.find(x=>x.key===s.boostGroupKey);
  if(g)openBoostProducts({key:g.key,title:g.title,products:groupProducts(g)},true);
  else openBoost(true);
 }
};

})();