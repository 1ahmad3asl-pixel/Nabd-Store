
(function(){
  "use strict";
  var modal=document.getElementById("customerLevelsModal");
  var trigger=document.getElementById("openCustomerLevels");
  var content=document.getElementById("customerLevelsContent");
  var badge=document.querySelector(".drawer-level-label");
  var avatarFrame=document.querySelector(".drawer-avatar-frame");
  var previousActiveDrawerLink=null;
  if(!modal||!trigger||!content) return;
  var levels=[
    {name:"عميل",short:"عميل",start:0,end:50,discount:0},
    {name:"عميل مميز",short:"عميل مميز",start:50,end:115,discount:1},
    {name:"سعر جملة",short:"سعر جملة",start:115,end:200,discount:2},
    {name:"تاجر",short:"تاجر",start:200,end:300,discount:3},
    {name:"مورد",short:"مورد",start:300,end:425,discount:5}
  ];
  var failedStatuses=["failed","rejected","cancelled","canceled","error"];
  var spend=0;
  function money(n){return "$"+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:3,maximumFractionDigits:3});}
  function currentLevel(total){
    for(var i=0;i<levels.length-1;i++){if(total<levels[i].end)return i;}
    return levels.length-1;
  }
  function render(total){
    spend=total;
    var current=currentLevel(total);
    var tierClass="tier-"+(current+1);
    if(badge) badge.textContent=levels[current].short;
    if(badge&&avatarFrame){
      for(var tier=1;tier<=5;tier++){
        badge.classList.remove("tier-"+tier);
        avatarFrame.classList.remove("tier-"+tier);
      }
      badge.classList.add(tierClass);
      avatarFrame.classList.add(tierClass);
    }
    var badgeClass="levels-current "+tierClass;
    var html='<div class="levels-total"><div><div class="levels-total-label">إجمالي المشتريات المحتسبة</div><div class="levels-total-value">'+money(total)+'</div></div><span class="'+badgeClass+'">'+levels[current].name+'</span></div>';
    levels.forEach(function(level,i){
      var isCurrent=i===current;
      var progress=Math.max(0,Math.min(100,((total-level.start)/(level.end-level.start))*100));
      var shownProgress=Math.round(progress);
      var cardName=level.name;
      var cardDiscount=level.discount===0?"لا يوجد خصم":"خصم "+level.discount+"%";
      var cardState=isCurrent?"مستواك الحالي":"مستوى متقدم";
      html+='<article class="level-card level-card-'+(i+1)+(isCurrent?' is-current':'')+'"><div class="level-card-head"><span class="level-name">'+cardName+'</span><span class="level-state">'+cardState+'</span></div><div class="level-range"><span class="level-range-start">'+money(level.start)+'</span><span class="level-range-percent">'+shownProgress+'%</span><span class="level-range-end">'+money(level.end)+'</span></div><div class="level-track" role="progressbar" aria-label="'+cardName+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+shownProgress+'"><div class="level-fill" style="width:'+shownProgress+'%"></div></div><div class="level-discount">'+cardDiscount+'</div></article>';
    });
    content.innerHTML=html;
  }
  async function loadLevels(){
    content.innerHTML='<div class="levels-message">جارٍ تحميل مشترياتك…</div>';
    try{
      var response=await fetch("/api/customer/orders",{headers:{Accept:"application/json"},credentials:"same-origin",cache:"no-store"});
      if(response.status===401||response.status===403){
        content.innerHTML='<div class="levels-message">سجّل الدخول إلى حسابك لعرض مستواك وتقدّم مشترياتك.</div>';
        if(badge) badge.textContent="";
        return;
      }
      if(!response.ok) throw new Error("orders-load-failed");
      var data=await response.json();
      if(data.status!=="OK"||!Array.isArray(data.orders)) throw new Error("orders-data-invalid");
      var total=0;
      data.orders.forEach(function(order){
        var status=String(order.status||"").toLowerCase();
        if(failedStatuses.indexOf(status)!==-1) return;
        var amount=Number(order.price);
        if(Number.isFinite(amount)&&amount>0) total+=amount;
      });
      render(Math.round((total+Number.EPSILON)*1000)/1000);
    }catch(error){
      content.innerHTML='<div class="levels-message levels-error">تعذّر تحميل مشترياتك الآن. أغلق النافذة وحاول مرة أخرى.</div>';
    }
  }
  function restoreDrawerActiveState(){
    var drawerLinks=document.querySelectorAll(".drawer-link");
    var target=previousActiveDrawerLink;
    if(!target || target===trigger){
      var internalPage=document.getElementById("internalPage");
      if(!internalPage || internalPage.hidden) target=document.querySelector('.drawer-link[href="#home"]');
      else target=null;
    }
    drawerLinks.forEach(function(link){
      var active=!!target && link===target;
      link.classList.toggle("active",active);
      if(active) link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    });
    previousActiveDrawerLink=null;
  }
  function openModal(){
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden","false");
    document.body.style.overflow="hidden";
    loadLevels();
    var close=modal.querySelector(".levels-back");
    if(close) close.focus();
  }
  function closeModal(){
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden","true");
    document.body.style.overflow="";
    restoreDrawerActiveState();
    trigger.focus();
  }
  trigger.addEventListener("click",function(event){
    event.preventDefault();
    event.stopPropagation();
    var drawerLinks=document.querySelectorAll(".drawer-link");
    previousActiveDrawerLink=document.querySelector(".drawer-link.active");
    if(previousActiveDrawerLink===trigger) previousActiveDrawerLink=null;
    drawerLinks.forEach(function(link){
      var active=link===trigger;
      link.classList.toggle("active",active);
      if(active) link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    });
    openModal();
    var drawer=document.getElementById("drawer");
    var overlay=document.getElementById("overlay");
    if(drawer) drawer.classList.remove("active");
    if(overlay) overlay.classList.remove("active");
    document.body.style.overflow="hidden";
  });
  modal.querySelectorAll("[data-levels-close]").forEach(function(el){el.addEventListener("click",function(event){event.preventDefault();event.stopPropagation();closeModal();});});
  var backButton=modal.querySelector("[data-levels-back]");
  if(backButton) backButton.addEventListener("click",function(event){
    event.preventDefault();
    event.stopPropagation();
    // أغلق نافذة المستويات أولًا، ثم أعد القائمة الجانبية دون نقل التركيز
    // إلى زر داخل القائمة قبل إظهارها (قد يمنع ذلك التفاعل على بعض الهواتف).
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden","true");
    restoreDrawerActiveState();
    var drawer=document.getElementById("drawer");
    var overlay=document.getElementById("overlay");
    if(drawer) drawer.classList.add("active");
    if(overlay) overlay.classList.add("active");
    document.body.style.overflow="hidden";
  });
  document.addEventListener("keydown",function(event){if(event.key==="Escape"&&modal.classList.contains("is-open"))closeModal();});
  loadLevels();
})();
