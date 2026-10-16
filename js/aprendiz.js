/* Seções só do Programa Jovem Aprendiz (v2.4): aulas teóricas no IEL por dia e
   turno, e rescisão antecipada por empresa e por função.
   Os dados de aula teórica e carga horária vêm em r.extras (carga da extração
   com a coluna "Área de Atuação"); a base inicial antiga não tem esses dados.
   Chamado por entrada.js depois de iniciarPainel, só quando o programa é aprendiz. */
window.iniciarAprendiz = function (RECORDS) {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
  function fmtPct(n) { return (Math.round(n * 10) / 10).toLocaleString('pt-BR') + '%'; }
  function fmtData(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function ex(r) { return r.extras || {}; }

  /* barras no mesmo formato visual do painel: [{ nome, valor, texto }] */
  function barras(id, linhas, vazio) {
    var el = $(id);
    if (!linhas.length) { el.innerHTML = '<p class="estagio-vazio">' + esc(vazio || 'Sem dados suficientes.') + '</p>'; return; }
    var max = Math.max.apply(null, linhas.map(function (l) { return l.valor; })) || 1;
    el.innerHTML = linhas.map(function (l, i) {
      return '<div class="bar-row' + (i === 0 ? ' top' : '') + '">' +
        '<span class="name" title="' + esc(l.nome) + '"><span class="name-text">' + esc(l.nome) + '</span></span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + (l.valor / max * 100).toFixed(1) + '%"></span></span>' +
        '<span class="val">' + esc(l.texto) + '</span></div>';
    }).join('');
  }
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

  var ativos = RECORDS.filter(function (r) { return r.situacao === 'Ativo'; });
  // a base inicial antiga não traz os dados da aula teórica: só a extração nova traz
  var temExtras = ativos.some(function (r) { return r.extras; });

  /* ================= 1. AULAS TEÓRICAS NO IEL (dia × turno) ================= */
  var DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var CURTO = { 'Segunda': 'Seg', 'Terça': 'Ter', 'Quarta': 'Qua', 'Quinta': 'Qui', 'Sexta': 'Sex', 'Sábado': 'Sáb' };
  var TURNOS = ['Manhã', 'Tarde', 'Noite'];
  var comHorario = ativos.filter(function (r) { return ex(r).aula_dia && ex(r).aula_turno; });
  var semHorario = ativos.filter(function (r) { return r.extras && !(ex(r).aula_dia && ex(r).aula_turno); });
  var celula = null; // { dia, turno } ou 'sem'

  function aulasDaCelula() {
    if (celula === 'sem') return semHorario;
    if (!celula) return [];
    return comHorario.filter(function (r) { return ex(r).aula_dia === celula.dia && ex(r).aula_turno === celula.turno; });
  }

  function desenharAulas() {
    if (!temExtras) {
      $('aulasGrade').innerHTML = '';
      $('aulasNota').textContent = 'Ainda sem dados: o horário da aula teórica entra na próxima carga da extração do aprendiz (coluna "Área de Atuação").';
      $('aulasTabelaWrap').hidden = true;
      return;
    }
    // dias e turnos que aparecem nos dados (sábado e noite só se existirem)
    var dias = DIAS.filter(function (d) { return d !== 'Sábado' || comHorario.some(function (r) { return ex(r).aula_dia === d; }); });
    var turnos = TURNOS.filter(function (t) { return t !== 'Noite' || comHorario.some(function (r) { return ex(r).aula_turno === t; }); });
    var n = {};
    comHorario.forEach(function (r) { var k = ex(r).aula_dia + '|' + ex(r).aula_turno; n[k] = (n[k] || 0) + 1; });
    var max = Math.max.apply(null, Object.keys(n).map(function (k) { return n[k]; }).concat([1]));
    function cel(dia, turno) {
      var v = n[dia + '|' + turno] || 0;
      var on = celula && celula !== 'sem' && celula.dia === dia && celula.turno === turno;
      return '<td><button type="button" class="aula-cel' + (on ? ' on' : '') + '" data-dia="' + dia + '" data-turno="' + turno + '" style="--nivel:' + (v / max).toFixed(2) + '"' +
        (v ? '' : ' disabled') + ' aria-label="' + dia + ' de ' + turno.toLowerCase() + ': ' + v + ' aprendizes">' + fmtInt(v) + '</button></td>';
    }
    var totDia = {}, totTurno = {};
    comHorario.forEach(function (r) { totDia[ex(r).aula_dia] = (totDia[ex(r).aula_dia] || 0) + 1; totTurno[ex(r).aula_turno] = (totTurno[ex(r).aula_turno] || 0) + 1; });
    $('aulasGrade').innerHTML =
      '<thead><tr><th></th>' + dias.map(function (d) { return '<th><span class="aula-dia-longo">' + d + '</span><span class="aula-dia-curto">' + CURTO[d] + '</span></th>'; }).join('') + '<th>Total</th></tr></thead>' +
      '<tbody>' + turnos.map(function (t) {
        return '<tr><th scope="row">' + t + '</th>' + dias.map(function (d) { return cel(d, t); }).join('') + '<td class="aula-total">' + fmtInt(totTurno[t] || 0) + '</td></tr>';
      }).join('') +
      '<tr class="aula-linha-total"><th scope="row">Total</th>' + dias.map(function (d) { return '<td class="aula-total">' + fmtInt(totDia[d] || 0) + '</td>'; }).join('') +
      '<td class="aula-total">' + fmtInt(comHorario.length) + '</td></tr></tbody>';
    $('aulasGrade').querySelectorAll('.aula-cel').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.getAttribute('data-dia'), t = b.getAttribute('data-turno');
        celula = (celula && celula !== 'sem' && celula.dia === d && celula.turno === t) ? null : { dia: d, turno: t };
        desenharAulas();
      });
    });
    $('aulasSemHorario').textContent = fmtInt(semHorario.length);
    $('aulasSemBtn').classList.toggle('on', celula === 'sem');
    $('aulasSemBtn').disabled = !semHorario.length;
    $('aulasNota').textContent = fmtInt(comHorario.length) + ' de ' + fmtInt(ativos.length) + ' aprendizes ativos têm o horário da aula teórica informado.' +
      ' Clique num número pra ver a lista.';

    var lista = aulasDaCelula().slice().sort(function (a, b) { return String(a.empresa).localeCompare(b.empresa, 'pt-BR') || String(a.nome).localeCompare(b.nome, 'pt-BR'); });
    $('aulasTabelaWrap').hidden = !celula;
    if (!celula) return;
    $('aulasTabelaTitulo').textContent = celula === 'sem'
      ? 'Aprendizes ativos sem horário da aula teórica (' + fmtInt(lista.length) + ')'
      : celula.dia + ' de ' + celula.turno.toLowerCase() + ' (' + fmtInt(lista.length) + ')';
    $('aulasTabela').innerHTML = lista.map(function (r) {
      return '<tr><td class="nome">' + esc(r.nome) + '</td><td class="empresa">' + esc(r.empresa) + '</td><td>' + esc(ex(r).aula_teorica || '—') + '</td><td>' + fmtData(r.fim) + '</td></tr>';
    }).join('');
  }
  $('aulasSemBtn').addEventListener('click', function () { celula = celula === 'sem' ? null : 'sem'; desenharAulas(); });
  $('exportAulas').addEventListener('click', function () {
    var lista = celula ? aulasDaCelula() : comHorario.concat(semHorario);
    baixarCsv('aulas_teoricas_jovem_aprendiz.csv', ['Aprendiz', 'Empresa', 'CPF', 'Contrato', 'Dia', 'Turno', 'Horário informado', 'Encerramento'],
      lista.map(function (r) { return [r.nome, r.empresa, r.cpf, r.contrato, ex(r).aula_dia || '', ex(r).aula_turno || '', ex(r).aula_teorica || '', fmtData(r.fim)]; }));
  });
  desenharAulas();

  /* ================= 2. RESCISÃO ANTECIPADA (por função ou por empresa) =================
     Igual ao gráfico do estágio: % dos contratos encerrados que terminaram por rescisão.
     Só entram grupos com contratos encerrados suficientes para a taxa fazer sentido. */
  var MIN_RESC = { funcao: 10, empresa: 10 };
  var encerrados = RECORDS.filter(function (r) { return r.situacao === 'Rescindido' || r.situacao === 'Concluído'; });
  var nResc = encerrados.filter(function (r) { return r.situacao === 'Rescindido'; }).length;
  var mediaGeral = encerrados.length ? nResc / encerrados.length * 100 : 0;
  var RESC_POR = { funcao: function (r) { return r.funcao; }, empresa: function (r) { return r.empresa; } };
  var NOME_GRUPO = { funcao: 'funções', empresa: 'empresas' };
  var rescAtual = 'funcao';
  function desenharRescisao() {
    var min = MIN_RESC[rescAtual], g = {};
    encerrados.forEach(function (r) { var k = RESC_POR[rescAtual](r); var c = g[k] = g[k] || { t: 0, r: 0 }; c.t++; if (r.situacao === 'Rescindido') c.r++; });
    barras('aprRescisao', Object.keys(g).filter(function (k) { return g[k].t >= min; })
      .map(function (k) { var c = g[k]; return { nome: k, valor: c.r / c.t * 100, texto: fmtPct(c.r / c.t * 100) + ' · ' + fmtInt(c.r) + ' de ' + fmtInt(c.t) }; })
      .sort(function (a, b) { return b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'); }).slice(0, 10),
      'Nenhum grupo com ' + min + ' contratos encerrados ou mais.');
    $('aprRescisaoNota').textContent = 'As 10 maiores taxas · só ' + NOME_GRUPO[rescAtual] + ' com ' + min +
      ' contratos encerrados ou mais · cada linha: taxa · rescindidos de encerrados';
    document.querySelectorAll('#aprRescisaoChips .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-por') === rescAtual); });
  }
  $('aprRescisaoSub').textContent = 'Contratos encerrados antes do prazo (rescindidos) · média geral ' + fmtPct(mediaGeral);
  document.querySelectorAll('#aprRescisaoChips .chip').forEach(function (c) {
    c.addEventListener('click', function () { rescAtual = c.getAttribute('data-por'); desenharRescisao(); });
  });
  desenharRescisao();
};
