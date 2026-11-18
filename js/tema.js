// Tema claro/escuro. A preferência salva é aplicada antes da página pintar,
// pra não piscar no tema errado. Os botões Auto/Claro/Escuro (.theme-opt)
// funcionam em qualquer tela que os tenha (tela inicial e painel).
(function () {
  var CHAVE = 'jaTheme';
  function salva() {
    try { return localStorage.getItem(CHAVE) || 'auto'; } catch (e) { return 'auto'; }
  }
  function aplicar(escolha) {
    var raiz = document.documentElement;
    if (escolha === 'light' || escolha === 'dark') raiz.setAttribute('data-theme', escolha);
    else raiz.removeAttribute('data-theme');
    document.querySelectorAll('.theme-opt').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-theme-choice') === escolha);
    });
  }
  aplicar(salva());
  document.addEventListener('DOMContentLoaded', function () { aplicar(salva()); });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('.theme-opt');
    if (!b) return;
    var escolha = b.getAttribute('data-theme-choice');
    aplicar(escolha);
    try { localStorage.setItem(CHAVE, escolha); } catch (e) {}
  });
})();
