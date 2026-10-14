// aplica a preferência salva antes da página pintar, pra não piscar no tema errado
(function () {
  try {
    var t = localStorage.getItem('jaTheme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
