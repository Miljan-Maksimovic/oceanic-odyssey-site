(function () {
  var nav = document.querySelector(".site-header, .site-nav");
  if (!nav) return;

  var css =
    ".nav-smart.is-fixed{position:fixed;top:0;left:0;right:0;z-index:50;color:#fff;" +
    "background:rgba(6,28,40,.95);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);" +
    "box-shadow:0 6px 24px rgba(0,25,35,.18);transform:translateY(-100%)}" +
    ".nav-smart.is-fixed::before,.nav-smart.is-fixed::after{display:none}" +
    ".nav-smart.is-fixed.is-armed{transition:transform .3s ease}" +
    ".nav-smart.is-fixed.is-shown{transform:none}" +
    ".site-nav.nav-smart.is-fixed,.nav-smart.is-fixed .header-inner{height:64px}" +
    "@media (min-width:700px){.site-nav.nav-smart.is-fixed,.nav-smart.is-fixed .header-inner{height:72px}}" +
    "@media (prefers-reduced-motion:reduce){.nav-smart.is-fixed.is-armed{transition:none}}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  nav.classList.add("nav-smart");

  var navHeight = nav.offsetHeight;   // the bar's height in its place over the hero
  var lastY = window.pageYOffset;
  var queued = false;

  function setFixed(on) {
    if (on && !nav.classList.contains("is-fixed")) {
      nav.classList.add("is-fixed");      // arrives hidden, above the screen, with no animation
      void nav.offsetHeight;
      nav.classList.add("is-armed");      // from now on showing and hiding slide
    } else if (!on) {
      nav.classList.remove("is-fixed", "is-armed", "is-shown");
    }
  }

  function update() {
    queued = false;
    var y = window.pageYOffset;
    var dy = y - lastY;
    if (y <= 0) {
      setFixed(false);                    // back at the top: the transparent bar over the hero
    } else if (nav.classList.contains("is-fixed") || y > navHeight) {
      setFixed(true);
      if (dy < -4) nav.classList.add("is-shown");
      else if (dy > 4 && !nav.contains(document.activeElement)) nav.classList.remove("is-shown");
    }
    lastY = y;
  }

  window.addEventListener("scroll", function () {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, {passive: true});
  window.addEventListener("resize", function () {
    if (!nav.classList.contains("is-fixed")) navHeight = nav.offsetHeight;
  });
  nav.addEventListener("focusin", function () {
    if (nav.classList.contains("is-fixed")) nav.classList.add("is-shown");
  });
  update();
})();
