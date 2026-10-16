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
      // aceita "Estágio Não Obrigatório até 30h", "Estagio obrigatório", "40h", etc.
      tipoContrato: function (v) { return /est[aá]gio/i.test(v) || (!/aprendiz/i.test(v) && Boolean(v)); },
      rotulos: { pessoa: 'Estudante', funcao: 'Curso', arquivo: 'estagio', arquivoFuncoes: 'cursos_estagio' },
      // faixas de idade do gráfico "Faixa etária" (o aprendiz usa as do painel.js)
      faixasEtarias: [
        { faixa: 'Até 17 anos', min: 0, max: 18 },
        { faixa: '18-20 anos', min: 18, max: 21 },
        { faixa: '21-24 anos', min: 21, max: 25 },
        { faixa: '25-29 anos', min: 25, max: 30 },
        { faixa: '30+ anos', min: 30, max: Infinity }
      ]
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
     elementos com data-so-aprendiz somem no estágio; os com data-so-estagio
     (escondidos por padrão) aparecem. */
  function aplicarTextos(programa, base) {
    if (programa !== 'estagio') return;
    base = base || document;
    base.querySelectorAll('[data-estagio]').forEach(function (el) { el.textContent = el.getAttribute('data-estagio'); });
    base.querySelectorAll('[data-estagio-placeholder]').forEach(function (el) { el.placeholder = el.getAttribute('data-estagio-placeholder'); });
    base.querySelectorAll('[data-so-aprendiz]').forEach(function (el) { el.hidden = true; });
    base.querySelectorAll('[data-so-estagio]').forEach(function (el) { el.hidden = false; });
  }

  raiz.Programas = { INFO: INFO, LISTA: LISTA, valido: valido, atual: atual, url: url, aplicarTextos: aplicarTextos };
})(window);
