/* Seções só do Programa Jovem Aprendiz (v2.4): aulas teóricas no IEL por dia e
   turno, e rescisão antecipada por empresa e por função.
   Os dados de aula teórica e carga horária vêm em r.extras (carga da extração
   com a coluna "Área de Atuação"); a base inicial antiga não tem esses dados.
   Chamado por entrada.js depois de iniciarPainel, só quando o programa é aprendiz. */
window.iniciarAprendiz = function (RECORDS) {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var G = window.Graficos;
  var esc = G.esc, fmtInt = G.fmtInt, fmtPct = G.fmtPct, baixarCsv = G.baixarCsv;
  function fmtData(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function ex(r) { return r.extras || {}; }



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
     Igual ao gráfico do estágio, em páginas de 10. */
  var MIN_RESC = { funcao: 10, empresa: 10 };
  var GRUPO_RESC = { funcao: { de: 'da função', muitos: 'funções' }, empresa: { de: 'da empresa', muitos: 'empresas' } };
  var baseResc = G.baseDeRescisao(RECORDS);   // rescindidos + concluídos (contratos que já terminaram)
  var mediaGeral = G.taxaGeral(baseResc);
  var RESC_POR = { funcao: function (r) { return r.funcao; }, empresa: function (r) { return r.empresa; } };
  var rescAtual = 'funcao';
  var rankingResc = G.ranking('aprRescisao');
  function desenharRescisao() {
    var lista = G.taxasDeRescisao(baseResc, RESC_POR[rescAtual], MIN_RESC[rescAtual]);
    rankingResc.mostrar(lista, {
      rotulo: GRUPO_RESC[rescAtual].muitos,
      vazio: 'Nenhum grupo com ' + MIN_RESC[rescAtual] + ' contratos encerrados ou mais.',
      csv: { nome: 'jovem_aprendiz_rescisao_por_' + rescAtual + '.csv',
             cabecalho: [rescAtual === 'funcao' ? 'Função' : 'Empresa', '% rescindidos', 'Rescindidos', 'Concluídos', 'Total que já terminou'],
             linhas: function () { return G.csvRescisao(lista); } }
    });
    $('aprRescisaoLeitura').innerHTML = G.leituraRescisao(lista[0], GRUPO_RESC[rescAtual], mediaGeral, MIN_RESC[rescAtual]);
    document.querySelectorAll('#aprRescisaoChips .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-por') === rescAtual); });
  }
  $('aprRescisaoSub').textContent = 'Dos contratos que já terminaram, quantos foram rescindidos antes do prazo · média geral ' + fmtPct(mediaGeral);
  document.querySelectorAll('#aprRescisaoChips .chip').forEach(function (c) {
    c.addEventListener('click', function () { rescAtual = c.getAttribute('data-por'); desenharRescisao(); });
  });
  desenharRescisao();
};
