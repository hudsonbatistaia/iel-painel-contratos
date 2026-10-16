/* Os programas atendidos pelo painel. O programa escolhido vai no endereço
   (index.html?programa=estagio) para que recarregar a página não o perca. */
(function (raiz) {
  "use strict";

  var INFO = {
    aprendiz: {
      nome: 'Programa Jovem Aprendiz',
      marca: 'Programa Jovem Aprendiz IEL',
      // valor da coluna "Tipo de Contrato" da extração
      tipoContrato: function (v) { return /aprendiz/i.test(v); },
      rotulos: { pessoa: 'Aprendiz', funcao: 'Função', arquivo: 'jovem_aprendiz', arquivoFuncoes: 'arco_ocupacional_jovem_aprendiz' }
    },
    estagio: {
      nome: 'Programa de Estágio',
      marca: 'Programa de Estágio IEL',
      // ainda a confirmar com a extração real do estágio: por ora, tudo o que não é aprendiz
      tipoContrato: function (v) { return !/aprendiz/i.test(v); },
      rotulos: { pessoa: 'Estudante', funcao: 'Curso', arquivo: 'estagio', arquivoFuncoes: 'cursos_estagio' }
    }
  };
  var LISTA = ['aprendiz', 'estagio'];

  function valido(p) { return LISTA.indexOf(p) !== -1; }

  // programa do endereço atual, ou null quando não há (tela inicial)
  function atual() {
    var p = new URLSearchParams(window.location.search).get('programa');
    return valido(p) ? p : null;
  }

  function url(pagina, programa) {
    return pagina + (programa ? '?programa=' + programa : '');
  }

  /* Troca os textos da página para o programa: elementos com
     data-estagio="texto" (ou data-estagio-placeholder) mudam no estágio;
     elementos com data-so-aprendiz somem no estágio. */
  function aplicarTextos(programa, base) {
    if (programa !== 'estagio') return;
    base = base || document;
    base.querySelectorAll('[data-estagio]').forEach(function (el) { el.textContent = el.getAttribute('data-estagio'); });
    base.querySelectorAll('[data-estagio-placeholder]').forEach(function (el) { el.placeholder = el.getAttribute('data-estagio-placeholder'); });
    base.querySelectorAll('[data-so-aprendiz]').forEach(function (el) { el.hidden = true; });
  }

  raiz.Programas = { INFO: INFO, LISTA: LISTA, valido: valido, atual: atual, url: url, aplicarTextos: aplicarTextos };
})(window);
