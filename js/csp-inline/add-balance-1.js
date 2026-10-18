
document.querySelectorAll(".method[data-href]").forEach(function(button){
button.addEventListener("click",function(){var href=button.getAttribute("data-href");if(href)window.location.href=href;});
});
