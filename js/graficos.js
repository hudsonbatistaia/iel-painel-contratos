/* Peças comuns dos gráficos próprios de cada programa (estagio.js e aprendiz.js):
   barras no mesmo visual do painel, Excel (CSV) e ranking paginado com as
   setinhas ‹ › e "Pág. X de N", igual a "Empresas com mais contratos". */
window.Graficos = (function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
  function fmtPct(n) { return (Math.round(n * 10) / 10).toLocaleString('pt-BR') + '%'; }

  function avisar(texto) {
    var t = $('toast'); if (!t) return;
    t.textContent = texto; t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function baixarCsv(nome, cabecalho, linhas) {
    if (!linhas.length) { avisar('Nada pra exportar.'); return; }
    function c(v) { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var csv = '﻿' + [cabecalho].concat(linhas).map(function (l) { return l.map(c).join(';'); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    var a = document.createElement('a');
    a.href = url; a.download = nome; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    avisar(fmtInt(linhas.length) + ' linha(s) exportada(s).');
  }

  /* linhas: [{ nome, valor, texto }]. maxRef: valor que vale 100% da barra (numa lista
     paginada, o maior de TODA a lista, para as páginas seguintes não se esticarem). */
  /* clicavel: true deixa cada linha clicável (ex.: abrir a ficha da empresa); o clique é
     tratado por quem chamou, lendo data-nome da linha */
  function barras(id, linhas, vazio, maxRef, destacarPrimeira, clicavel) {
    var el = $(id);
    if (!linhas.length) { el.innerHTML = '<p class="estagio-vazio">' + esc(vazio || 'Sem dados suficientes.') + '</p>'; return; }
    var max = maxRef || Math.max.apply(null, linhas.map(function (l) { return l.valor; })) || 1;
    el.innerHTML = linhas.map(function (l, i) {
      return '<div class="bar-row' + (i === 0 && destacarPrimeira !== false ? ' top' : '') + (clicavel ? ' clicavel" role="button" tabindex="0" title="Ver a ficha de ' + esc(l.nome) + '" data-nome="' + esc(l.nome) : '') + '">' +
        '<span class="name" title="' + esc(l.nome) + '"><span class="name-text">' + esc(l.nome) + '</span></span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + Math.min(100, l.valor / max * 100).toFixed(1) + '%"></span></span>' +
        '<span class="val">' + esc(l.texto) + '</span></div>';
    }).join('');
  }

  /* Ranking com páginas de 10. Elementos esperados na página, a partir do prefixo:
     prefixo (barras), prefixo+'Prev', prefixo+'Pagina' (select), prefixo+'Total',
     prefixo+'Next', prefixo+'Excel' e prefixo+'Faixa' ("Mostrando 1–10 de 42 cursos"). */
  function ranking(prefixo, porPagina) {
    porPagina = porPagina || 10;
    var linhas = [], pagina = 0, vazio = '', rotulo = 'itens', csv = null, aoClicar = null;
    function desenhar() {
      var total = Math.max(1, Math.ceil(linhas.length / porPagina));
      pagina = Math.min(Math.max(pagina, 0), total - 1);
      var ini = pagina * porPagina, pag = linhas.slice(ini, ini + porPagina);
      barras(prefixo, pag, vazio, linhas.length ? Math.max.apply(null, linhas.map(function (l) { return l.valor; })) : 0, pagina === 0, !!aoClicar);
      var sel = $(prefixo + 'Pagina');
      if (sel.getAttribute('data-total') !== String(total)) {
        sel.innerHTML = '';
        for (var p = 1; p <= total; p++) { var o = document.createElement('option'); o.value = String(p - 1); o.textContent = 'Pág. ' + p; sel.appendChild(o); }
        sel.setAttribute('data-total', String(total));
      }
      sel.value = String(pagina);
      $(prefixo + 'Total').textContent = 'de ' + fmtInt(total);
      $(prefixo + 'Prev').disabled = pagina === 0;
      $(prefixo + 'Next').disabled = ini + porPagina >= linhas.length;
      $(prefixo + 'Faixa').textContent = linhas.length
        ? 'Mostrando ' + fmtInt(ini + 1) + '–' + fmtInt(ini + pag.length) + ' de ' + fmtInt(linhas.length) + ' ' + rotulo
        : '';
    }
    $(prefixo + 'Prev').addEventListener('click', function () { pagina--; desenhar(); });
    $(prefixo + 'Next').addEventListener('click', function () { pagina++; desenhar(); });
    $(prefixo + 'Pagina').addEventListener('change', function () { pagina = +this.value; desenhar(); });
    $(prefixo + 'Excel').addEventListener('click', function () { if (csv) baixarCsv(csv.nome, csv.cabecalho, csv.linhas()); });
    aoClicarLinha($(prefixo), function (nome) { if (aoClicar) aoClicar(nome); });
    return {
      // opcoes: { vazio, rotulo ('cursos', 'empresas'...), csv: { nome, cabecalho, linhas: function },
      //           aoClicar: function(nome) — torna as linhas clicáveis }
      mostrar: function (novas, opcoes) {
        linhas = novas; pagina = 0;
        vazio = opcoes.vazio || ''; rotulo = opcoes.rotulo || 'itens'; csv = opcoes.csv || null; aoClicar = opcoes.aoClicar || null;
        desenhar();
      }
    };
  }

  // clique (ou Enter) numa linha clicável de um gráfico de barras
  function aoClicarLinha(el, fn) {
    function achar(ev) { var l = ev.target.closest('.bar-row.clicavel'); return l && el.contains(l) ? l.getAttribute('data-nome') : null; }
    el.addEventListener('click', function (ev) { var n = achar(ev); if (n != null) fn(n); });
    el.addEventListener('keydown', function (ev) { if (ev.key !== 'Enter') return; var n = achar(ev); if (n != null) fn(n); });
  }

  /* Taxa de rescisão antecipada = rescindidos ÷ contratos que já terminaram
     (rescindidos + concluídos). Ativos não entram: decisão do Hudson em 16/10/2026
     ("ativos contamina a análise"). Contrato recente só pode ter terminado por
     rescisão; o "Como ler" avisa isso. */
  var SITUACOES_BASE = ['Rescindido', 'Concluído'];
  function baseDeRescisao(registros) {
    return registros.filter(function (r) { return SITUACOES_BASE.indexOf(r.situacao) !== -1; });
  }
  function taxaGeral(base) {
    var n = base.filter(function (r) { return r.situacao === 'Rescindido'; }).length;
    return base.length ? n / base.length * 100 : 0;
  }
  // por grupo (curso, função, empresa); grupos com menos de "minimo" ficam de fora.
  // ordem: função de ordenação própria (ex.: faixas de bolsa em ordem de valor); padrão = maior taxa
  function taxasDeRescisao(base, chave, minimo, ordem) {
    var g = {};
    base.forEach(function (r) {
      var k = chave(r); if (k == null) return;
      var c = g[k] = g[k] || { t: 0, r: 0 }; c.t++;
      if (r.situacao === 'Rescindido') c.r++;
    });
    return Object.keys(g).filter(function (k) { return g[k].t >= minimo; })
      .map(function (k) {
        var c = g[k];
        return { nome: k, valor: c.r / c.t * 100, rescindidos: c.r, concluidos: c.t - c.r, total: c.t,
                 texto: fmtPct(c.r / c.t * 100) + ' (' + fmtInt(c.r) + ' de ' + fmtInt(c.t) + ')' };
      })
      // empate na taxa: o grupo com mais contratos vem antes (o número é mais confiável)
      .sort(ordem || function (a, b) { return b.valor - a.valor || b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'); });
  }
  // linhas do Excel da rescisão: nome, %, rescindidos, concluídos, total que já terminou
  function csvRescisao(lista) {
    return lista.map(function (l) { return [l.nome, String(Math.round(l.valor * 10) / 10).replace('.', ','), l.rescindidos, l.concluidos, l.total]; });
  }

  /* Texto do 'Como ler' da rescisão antecipada, com exemplo tirado da primeira linha.
     grupo: { um: 'curso', de: 'do curso', muitos: 'cursos' } */
  function leituraRescisao(primeira, grupo, mediaGeral, minimo) {
    var html = '<p><b>O que mostra:</b> dos contratos que <b>já terminaram</b>, quantos foram <b>rescindidos antes do prazo</b>. ' +
      'Entram só os rescindidos e os concluídos; ativos, cancelados e aguardando assinatura ficam de fora.</p>';
    if (primeira) {
      html += '<p><b>Exemplo:</b> ' + esc(primeira.nome) + ' — ' + esc(primeira.texto) + ': dos ' + fmtInt(primeira.total) + ' contratos ' + grupo.de +
        ' que já terminaram, ' + fmtInt(primeira.rescindidos) + (primeira.rescindidos === 1 ? ' foi rescindido' : ' foram rescindidos') + ' antes do prazo e ' +
        (primeira.concluidos ? fmtInt(primeira.concluidos) + (primeira.concluidos === 1 ? ' chegou' : ' chegaram') + ' ao fim do contrato.' : 'nenhum chegou ao fim do contrato.') + '</p>';
    }
    html += '<p><b>Média geral (' + fmtPct(mediaGeral) + '):</b> use como referência. Acima dela, a perda está maior que o normal do programa.</p>' +
      '<p>Só aparecem ' + grupo.muitos + ' com ' + minimo + ' ou mais contratos que já terminaram, para a porcentagem não ser distorcida por poucos casos.</p>' +
      '<p><b>Atenção:</b> um contrato recente ainda não teve tempo de chegar ao fim do prazo; se já terminou, foi por rescisão. ' +
      'Por isso, ' + grupo.muitos + ' com muitos contratos novos tendem a aparecer com taxa mais alta. A extração traz só a data <b>prevista</b> de fim, não a data real da rescisão.</p>';
    return html;
  }

  return { esc: esc, fmtInt: fmtInt, fmtPct: fmtPct, avisar: avisar, baixarCsv: baixarCsv, barras: barras, ranking: ranking, aoClicarLinha: aoClicarLinha, baseDeRescisao: baseDeRescisao, taxaGeral: taxaGeral, taxasDeRescisao: taxasDeRescisao, csvRescisao: csvRescisao, leituraRescisao: leituraRescisao };
})();
