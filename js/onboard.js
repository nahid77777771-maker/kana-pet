/* KanaPet — Onboarding (language selection) */
(function() {
  'use strict';
  
  function initOnboard() {
    var onboardModal = document.getElementById('onboard-modal');
    var selectedLang = null;
    var startBtn = document.getElementById('onboard-start');
    
    // Check if first run
    if (localStorage.getItem('kanapet_onboarded')) {
      onboardModal.style.display = 'none';
      if (window.I18n) window.I18n.setLang(localStorage.getItem('kanapet_lang') || 'en');
      applyTranslations();
      return;
    }
    
    onboardModal.classList.add('show');
    onboardModal.style.display = 'flex';
    
    // Language selection
    document.querySelectorAll('.lang-select').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.lang-select').forEach(function(b){ b.classList.remove('on'); });
        btn.classList.add('on');
        selectedLang = btn.getAttribute('data-lang');
        startBtn.disabled = false;
      });
    });
    
    startBtn.addEventListener('click', function() {
      if (selectedLang && window.I18n) {
        window.I18n.setLang(selectedLang);
        localStorage.setItem('kanapet_onboarded', 'true');
        localStorage.setItem('kanapet_lang', selectedLang);
        onboardModal.classList.remove('show');
        setTimeout(function(){ onboardModal.style.display = 'none'; }, 300);
        applyTranslations();
        if (window.location.reload) {
          // just apply, no reload needed
        }
      }
    });
  }
  
  function applyTranslations() {
    if (!window.I18n) return;
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var txt = window.I18n.t(key);
      if (txt) el.textContent = txt;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var txt = window.I18n.t(key);
      if (txt) el.setAttribute('placeholder', txt);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-title');
      var txt = window.I18n.t(key);
      if (txt) el.setAttribute('title', txt);
    });
    document.title = window.I18n.t('title');
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ initOnboard(); applyTranslations(); });
  } else {
    initOnboard();
    applyTranslations();
  }
  
  window.addEventListener('languageChanged', applyTranslations);
  
  window.applyTranslations = applyTranslations;
})();
