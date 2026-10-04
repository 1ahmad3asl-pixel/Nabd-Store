(function(){
  const THEME_KEY="nabd-theme";
  const SOUND_KEY="nabd-sound-enabled";
  function applyTheme(){document.documentElement.dataset.theme=localStorage.getItem(THEME_KEY)==="light"?"light":"dark";}
  function soundEnabled(){return localStorage.getItem(SOUND_KEY)!=="off";}
  window.NabdPreferences={applyTheme,soundEnabled,setSoundEnabled:function(enabled){localStorage.setItem(SOUND_KEY,enabled?"on":"off");}};
  applyTheme();
  window.addEventListener("storage",function(e){if(e.key===THEME_KEY)applyTheme();});
})();