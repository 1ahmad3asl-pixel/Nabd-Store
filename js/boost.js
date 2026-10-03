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
function n(v){return typeof normalizeGameText==="function"?normalizeGameText(String(v||"")):String(v||"").toLowerCase().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ـ/g,"").replace(/\s+/g," ").trim();}
function esc(v){return typeof escapeHtml==="function"?escapeHtml(v):String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function groupProducts(g){return products.filter(p=>{const t=n((p.category_name||"")+" "+(p.name||""));if(!/(رشق|boost|followers?|likes?|views?|members?|subscribers?|متابع|مشاهد|اعجاب|لايك|مشترك)/i.test(t))return false;return g.a.map(n).some(a=>t.includes(a));});}
function els(){return{services:document.getElementById("servicesSection"),page:document.getElementById("internalPage"),title:document.getElementById("internalPageTitle"),icon:document.getElementById("internalPageIcon"),content:document.getElementById("internalPageContent")};}
function push(view,data){if(typeof pushInternalHistory==="function")pushInternalHistory(view,data||{});else history.pushState(Object.assign({nabdInternal:true,view},data||{}),"",location.href);}
function openBoost(fromHistory){
 if(!fromHistory)push("boost");
 const e=els();if(!e.services||!e.page||!e.content)return;
 e.services.hidden=true;e.page.hidden=false;if(e.title)e.title.textContent="رشق صفحات";if(e.icon)e.icon.textContent="🚀";
 if(!loaded){
  e.content.innerHTML='<div class="products-loading"><div class="loading-spinner"></div><p>جاري تحميل خدمات رشق الصفحات...</p></div>';
  loadProducts({force:false}).then(p=>{products=Array.isArray(p)?p:[];loaded=true;openBoost(true);}).catch(()=>{e.content.innerHTML='<div class="game-products-placeholder"><div class="game-products-placeholder-icon">🚀</div><h3>رشق صفحات</h3><p>تعذر تحميل الخدمات حاليًا.</p></div>';});
  return;
 }
 const groups=GROUPS.map(g=>({key:g.key,title:g.title,products:groupProducts(g)}));
 e.content.innerHTML='<div class="boost-page-note">اختر المنصة للدخول إلى منتجات الرشق المتاحة.</div><div class="boost-category-grid">'+groups.map(g=>'<button class="boost-category-tile" type="button" data-boost-group="'+g.key+'"><span class="boost-category-title">'+esc(g.title)+'</span><span class="boost-category-count">'+g.products.length+' منتج</span></button>').join("")+'</div>';
 e.content.querySelectorAll("[data-boost-group]").forEach(b=>b.addEventListener("click",()=>{const g=groups.find(x=>x.key===b.dataset.boostGroup);if(g)openBoostProducts(g);}));
 scrollTo({top:0,behavior:"smooth"});
}
function openBoostProducts(g,fromHistory){
 if(!fromHistory)push("boost-products",{boostGroupKey:g.key});
 const e=els();if(!e.content)return;
 if(e.title)e.title.textContent=g.title;if(e.icon)e.icon.textContent="🚀";
 const list=g.products||[];
 e.content.innerHTML='<div class="app-level-toolbar"><button class="pubg-back" type="button" id="boostBack">← العودة إلى رشق الصفحات</button><div class="game-products-heading"><strong>'+list.length+' منتج</strong><span>'+esc(g.title)+'</span></div></div><div class="boost-product-grid">'+(list.length?list.map(p=>{
  const ok=p.available!==false&&p.available!==0,price=getGameProductPrice(p),live=price!==null;
  return '<article class="boost-product-card"><div class="boost-product-name">'+esc(p.name||"منتج")+'</div><div class="boost-product-meta">'+esc(p.category_name||"")+'</div><div class="boost-product-price">'+(live?formatProductMoney(p,price):"السعر غير متاح")+'</div><button class="buy-btn boost-buy-btn" type="button" data-id="'+esc(String(p.id))+'" '+(ok&&live?"":"disabled")+'>'+ (ok?(live?"شراء الآن":"جاري تحديث السعر"):"غير متوفر")+'</button></article>';
 }).join(""):'<div class="products-loading"><p>لا توجد منتجات مرتبطة بهذا النوع حاليًا.</p></div>')+'</div>';
 const back=document.getElementById("boostBack");if(back)back.onclick=()=>openBoost(false);
 e.content.querySelectorAll(".boost-buy-btn[data-id]").forEach(b=>b.addEventListener("click",()=>{const p=list.find(x=>String(x.id)===String(b.dataset.id));if(p)openProductModal(p);}));
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
document.addEventListener("click",e=>{
 const b=e.target.closest('.category[data-category="boost"]');if(!b)return;
 e.preventDefault();e.stopPropagation();openBoost(false);
},true);
})();