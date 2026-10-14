/* Calcula, a partir da lista de contratos, os mesmos indicadores que antes
   vinham prontos dentro do HTML (bloco "aggregates-data"). */
(function (raiz) {
  "use strict";

  function contar(lista, chave) {
    var m = {};
    lista.forEach(function (r) { var k = chave(r); m[k] = (m[k] || 0) + 1; });
    return m;
  }
  function pct(n, total) { return total ? Math.round(n / total * 1000) / 10 : 0; }
  function ordenarDesc(m, nome) {
    return Object.keys(m).map(function (k) { var o = {}; o[nome] = k; o.total = m[k]; return o; })
      .sort(function (a, b) { return b.total - a.total || a[nome].localeCompare(b[nome], 'pt-BR'); }); // empate: ordem alfabética
  }
  function porMes(m) {
    return Object.keys(m).sort().map(function (k) { return { mes: k, total: m[k] }; });
  }

  function calcularAgregados(records, consolidacao) {
    var ativos = records.filter(function (r) { return r.situacao === 'Ativo'; });

    var mensal = contar(records.filter(function (r) { return r.inicio; }), function (r) { return r.inicio.slice(0, 7); });

    var primeiro = {};
    records.forEach(function (r) {
      if (!r.inicio) return;
      if (!primeiro[r.empresa] || r.inicio < primeiro[r.empresa]) primeiro[r.empresa] = r.inicio;
    });
    var novasEmpresas = contar(Object.keys(primeiro), function (e) { return primeiro[e].slice(0, 7); });

    var topEmpresas = ordenarDesc(contar(ativos, function (r) { return r.empresa; }), 'empresa')
      .map(function (o) { o.pct = pct(o.total, ativos.length); return o; });

    var funcoes = ordenarDesc(contar(ativos, function (r) { return r.funcao; }), 'funcao');
    var funcoesCompletas = funcoes.map(function (o) { return { funcao: o.funcao, total: o.total, pct: pct(o.total, ativos.length) }; });

    // arcos com menos de 5 ativos ficam de fora do detalhe por empresa (amostra pequena demais)
    var AMOSTRA_MINIMA = 5;
    var empresasPorFuncao = {
      funcoes: funcoes.filter(function (f) { return f.total >= AMOSTRA_MINIMA; }).map(function (f) {
        var doArco = ativos.filter(function (r) { return r.funcao === f.funcao; });
        var emp = ordenarDesc(contar(doArco, function (r) { return r.empresa; }), 'empresa')
          .map(function (o) { o.pct = pct(o.total, doArco.length); return o; });
        return { funcao: f.funcao, totalContratos: doArco.length, empresasDistintas: emp.length, empresas: emp };
      }),
      amostraMinima: AMOSTRA_MINIMA,
      excluidosBaixaAmostra: funcoes.filter(function (f) { return f.total < AMOSTRA_MINIMA; })
        .reduce(function (soma, f) { return soma + f.total; }, 0)
    };

    var pessoas = {};
    records.forEach(function (r) { pessoas[r.pessoa || r.cpf + '|' + r.nome] = true; });

    var origem = { funcao: [], instituicao: [] };
    var vistos = {};
    records.forEach(function (r) {
      if (r.funcao === 'Não informado' && r.curso_original != null && !vistos[r.curso_original]) {
        vistos[r.curso_original] = true;
        origem.funcao.push({ motivo: 'valor vazio/lixo — campo provavelmente não preenchido na origem', raw: r.curso_original, sugestao: null });
      }
    });

    return {
      totalGeral: records.length,
      totalAtivos: ativos.length,
      empresasUnicas: Object.keys(contar(records, function (r) { return r.empresa; })).length,
      pessoasUnicas: Object.keys(pessoas).length,
      monthly: porMes(mensal),
      novasEmpresas: porMes(novasEmpresas),
      topEmpresas: topEmpresas,
      funcoes: funcoes,
      funcoesCompletas: funcoesCompletas,
      empresasPorFuncao: empresasPorFuncao,
      situacoes: ordenarDesc(contar(records, function (r) { return r.situacao; }), 'situacao'),
      consolidacao: consolidacao || null,
      pendenciasFuncao: [],
      pendenciasInstituicao: [],
      acoesSistemaOrigem: origem
    };
  }

  raiz.calcularAgregados = calcularAgregados;
  if (typeof module !== 'undefined') module.exports = calcularAgregados;
})(typeof window !== 'undefined' ? window : globalThis);
