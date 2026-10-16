/* Seções só do Programa de Estágio (v2.3): alertas da Lei do Estágio (11.788/2008)
   e perfil (bolsa, instituições, nível, prorrogações, rescisão, semestre).
   Lê os mesmos registros do painel; os campos próprios do estágio vêm em r.extras.
   Chamado por entrada.js depois de iniciarPainel, só quando o programa é estágio. */
window.iniciarEstagio = function (RECORDS) {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var DIA = 86400000;
  var LIMITE_DIAS = 730;              // 2 anos (art. 11)
  var JANELA_RECESSO = 60;            // contratos que vencem nestes dias com recesso a tirar
  var HOJE = (function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
  function fmtReais(n) { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }); }
  function fmtPct(n) { return (Math.round(n * 10) / 10).toLocaleString('pt-BR') + '%'; }
  function dataDe(iso) { return iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00') : null; }
  function isoDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtData(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function diasEntre(a, b) { return Math.round((b - a) / DIA); }
  function ex(r) { return r.extras || {}; }
  function contar(lista, chave) {
    var m = {};
    lista.forEach(function (r) { var k = chave(r); if (k != null) m[k] = (m[k] || 0) + 1; });
    return m;
  }
  function media(v) { return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : 0; }
  function mediana(v) {
    if (!v.length) return 0;
    var o = v.slice().sort(function (a, b) { return a - b; }), m = o.length >> 1;
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  }
  // nível deduzido do nome do curso
  function nivel(r) {
    var c = String(r.curso_original || r.funcao || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    if (/ENSINO MEDIO/.test(c)) return 'Ensino médio';
    if (/TECNIC/.test(c)) return 'Técnico';
    return 'Superior';
  }

  var ativos = RECORDS.filter(function (r) { return r.situacao === 'Ativo'; });

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

  /* ---------- exportar (mesmo formato dos outros botões ⭳ Excel) ---------- */
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
  function avisar(texto) {
    var t = $('toast');
    if (!t) return;
    t.textContent = texto; t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ================= 1. ALERTAS DA LEI DO ESTÁGIO ================= */

  // 1a. limite de 2 anos na mesma empresa: contrato atual (já com aditivos) +
  //     contratos concluídos antes, da mesma pessoa na mesma empresa
  var porPessoaEmpresa = {};
  RECORDS.forEach(function (r) {
    var k = r.pessoa + '|' + (r.cnpj || r.empresa);
    (porPessoaEmpresa[k] = porPessoaEmpresa[k] || []).push(r);
  });
  var limite2 = [];
  ativos.forEach(function (r) {
    var ini = dataDe(r.inicio), fim = dataDe(r.fim);
    if (!ini || !fim) return;
    var anteriores = 0;
    (porPessoaEmpresa[r.pessoa + '|' + (r.cnpj || r.empresa)] || []).forEach(function (o) {
      if (o === r || o.situacao !== 'Concluído') return;
      var oi = dataDe(o.inicio), of = dataDe(o.fim);
      if (oi && of && of <= ini) anteriores += Math.max(0, diasEntre(oi, of));
    });
    var dataLimite = new Date(ini.getTime() + (LIMITE_DIAS - anteriores) * DIA);
    if (fim <= dataLimite) return; // o contrato termina dentro do limite
    limite2.push({ r: r, anteriores: anteriores, limite: isoDe(dataLimite), dias: diasEntre(HOJE, dataLimite) });
  });
  limite2.sort(function (a, b) { return a.dias - b.dias; });

  // 1b. recesso a tirar em contrato que vence em até 60 dias (inclui vencidos ainda ativos)
  var recesso = ativos.filter(function (r) {
    var fim = dataDe(r.fim);
    return fim && (ex(r).recesso_saldo || 0) > 0 && diasEntre(HOJE, fim) <= JANELA_RECESSO;
  }).map(function (r) { return { r: r, dias: diasEntre(HOJE, dataDe(r.fim)), saldo: ex(r).recesso_saldo }; })
    .sort(function (a, b) { return a.dias - b.dias; });

  // 1c. contrato que termina depois da previsão de formatura
  var formatura = ativos.filter(function (r) {
    var pf = ex(r).previsao_formatura;
    return pf && r.fim && String(r.fim).slice(0, 10) > String(pf).slice(0, 10);
  }).map(function (r) { return { r: r, formatura: ex(r).previsao_formatura, dias: diasEntre(dataDe(ex(r).previsao_formatura), dataDe(r.fim)) }; })
    .sort(function (a, b) { return b.dias - a.dias; });

  // 1d. jornada acima de 6h por dia ou 30h por semana (art. 10)
  var jornada = ativos.filter(function (r) { return (ex(r).ch_diaria || 0) > 6 || (ex(r).ch_semanal || 0) > 30; })
    .map(function (r) { return { r: r }; });

  function emDias(d) {
    if (d < 0) return '<span style="color:var(--dias-urgente);font-weight:700;">há ' + fmtInt(-d) + (d === -1 ? ' dia' : ' dias') + '</span>';
    var cor = d <= 30 ? 'var(--dias-atencao)' : (d <= 90 ? 'var(--dias-preventivo)' : 'var(--text-secondary)');
    return '<span style="color:' + cor + ';font-weight:700;">em ' + fmtInt(d) + (d === 1 ? ' dia' : ' dias') + '</span>';
  }
  function fmtCh(r) {
    var e = ex(r);
    return (e.ch_diaria != null ? String(e.ch_diaria).replace('.', ',') + 'h/dia' : '—') + ' · ' + (e.ch_semanal != null ? String(e.ch_semanal).replace('.', ',') + 'h/semana' : '—');
  }

  var ALERTAS = {
    limite2: {
      itens: limite2, titulo: 'passam do limite de 2 anos na mesma empresa',
      colunas: ['Estudante', 'Empresa', 'Completa 2 anos em', 'Fim contratado', 'Situação'],
      linha: function (x) { return [x.r.nome, x.r.empresa, fmtData(x.limite), fmtData(x.r.fim), x.dias < 0 ? 'passou ' + emDias(x.dias) : 'completa ' + emDias(x.dias)]; },
      csv: function (x) { return [x.r.nome, x.r.empresa, x.r.cpf, x.r.contrato, fmtData(x.r.inicio), x.anteriores, fmtData(x.limite), fmtData(x.r.fim), x.dias]; },
      csvCab: ['Estudante', 'Empresa', 'CPF', 'Contrato', 'Início', 'Dias em contratos anteriores', 'Completa 2 anos em', 'Fim contratado', 'Dias até o limite'],
      nota: 'Soma o contrato atual (com os aditivos) e os contratos concluídos antes na mesma empresa. Contratos rescindidos não entram, porque a base não guarda a data real da rescisão. Estudante com deficiência não tem esse limite, e esse dado não existe na base.'
    },
    recesso: {
      itens: recesso, titulo: 'vencem em até ' + JANELA_RECESSO + ' dias com recesso a tirar',
      colunas: ['Estudante', 'Empresa', 'Encerramento', 'Vence', 'Recesso a tirar'],
      linha: function (x) { return [x.r.nome, x.r.empresa, fmtData(x.r.fim), emDias(x.dias), fmtInt(x.saldo) + (x.saldo === 1 ? ' dia' : ' dias')]; },
      csv: function (x) { return [x.r.nome, x.r.empresa, x.r.cpf, x.r.contrato, fmtData(x.r.fim), x.dias, x.saldo, ex(x.r).recesso_tirado]; },
      csvCab: ['Estudante', 'Empresa', 'CPF', 'Contrato', 'Encerramento', 'Dias para vencer', 'Recesso a tirar (dias)', 'Recesso já tirado (dias)'],
      nota: 'O estudante tem direito a recesso remunerado (art. 13). Quando o contrato acaba antes de tirar, a empresa precisa conceder antes do fim ou pagar. Usa a coluna "Recesso Remunerado Acumulado" como saldo a tirar.'
    },
    formatura: {
      itens: formatura, titulo: 'terminam depois da previsão de formatura',
      colunas: ['Estudante', 'Empresa', 'Previsão de formatura', 'Fim contratado', 'Diferença'],
      linha: function (x) { return [x.r.nome, x.r.empresa, fmtData(x.formatura), fmtData(x.r.fim), fmtInt(x.dias) + (x.dias === 1 ? ' dia' : ' dias') + ' depois']; },
      csv: function (x) { return [x.r.nome, x.r.empresa, x.r.cpf, x.r.contrato, fmtData(x.formatura), fmtData(x.r.fim), x.dias]; },
      csvCab: ['Estudante', 'Empresa', 'CPF', 'Contrato', 'Previsão de formatura', 'Fim contratado', 'Dias depois da formatura'],
      nota: 'Depois de formado, a pessoa deixa de ser estudante e o estágio perde a base legal. Confira se a previsão de formatura está atualizada.'
    },
    jornada: {
      itens: jornada, titulo: 'com jornada acima de 6h por dia ou 30h por semana',
      colunas: ['Estudante', 'Empresa', 'Jornada', 'Tipo de contrato', 'Encerramento'],
      linha: function (x) { return [x.r.nome, x.r.empresa, esc(fmtCh(x.r)), esc(ex(x.r).tipo_contrato || '—'), fmtData(x.r.fim)]; },
      csv: function (x) { return [x.r.nome, x.r.empresa, x.r.cpf, x.r.contrato, ex(x.r).ch_diaria, ex(x.r).ch_semanal, ex(x.r).tipo_contrato, fmtData(x.r.fim)]; },
      csvCab: ['Estudante', 'Empresa', 'CPF', 'Contrato', 'Horas por dia', 'Horas por semana', 'Tipo de contrato', 'Encerramento'],
      nota: 'A lei limita a 6h por dia e 30h por semana. Até 40h por semana só é permitido nos períodos sem aula presencial, se previsto no projeto pedagógico (art. 10, § 1º).'
    }
  };
  var alertaAtual = 'limite2';

  function desenharAlertas() {
    $('estAlerta2anos').textContent = fmtInt(limite2.length);
    var passou = limite2.filter(function (x) { return x.dias < 0; }).length;
    $('estAlerta2anosSub').textContent = passou ? fmtInt(passou) + ' já passaram' : '';
    $('estAlertaRecesso').textContent = fmtInt(recesso.length);
    var dias = recesso.reduce(function (s, x) { return s + x.saldo; }, 0);
    $('estAlertaRecessoSub').textContent = dias ? fmtInt(dias) + ' dias no total' : '';
    $('estAlertaFormatura').textContent = fmtInt(formatura.length);
    $('estAlertaJornada').textContent = fmtInt(jornada.length);
    document.querySelectorAll('#estagioAlertas .alert-tile').forEach(function (t) {
      t.classList.toggle('active-filter', t.getAttribute('data-alerta') === alertaAtual);
    });

    var a = ALERTAS[alertaAtual];
    $('estAlertaCab').innerHTML = '<tr>' + a.colunas.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
    var MAX = 200;
    $('estAlertaTabela').innerHTML = a.itens.length
      ? a.itens.slice(0, MAX).map(function (x) {
          var l = a.linha(x);
          return '<tr><td class="nome">' + esc(l[0]) + '</td><td class="empresa">' + esc(l[1]) + '</td><td>' + l.slice(2).join('</td><td>') + '</td></tr>';
        }).join('')
      : '<tr><td colspan="' + a.colunas.length + '" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum contrato ativo nessa situação.</td></tr>';
    $('estAlertaNota').textContent = (a.itens.length ? 'Mostrando ' + fmtInt(Math.min(a.itens.length, MAX)) + ' de ' + fmtInt(a.itens.length) +
      ' contrato(s) ativo(s) que ' + a.titulo + (a.itens.length > MAX ? ' (o Excel traz todos)' : '') + '. ' : '') + a.nota;
  }

  document.querySelectorAll('#estagioAlertas .alert-tile').forEach(function (t) {
    t.addEventListener('click', function () { alertaAtual = t.getAttribute('data-alerta'); desenharAlertas(); });
  });
  $('exportEstAlerta').addEventListener('click', function () {
    var a = ALERTAS[alertaAtual];
    baixarCsv('estagio_alerta_' + alertaAtual + '.csv', a.csvCab, a.itens.map(a.csv));
  });
  desenharAlertas();

  /* ================= 2. PERFIL DO ESTÁGIO ================= */

  // números do topo
  var bolsas = ativos.map(function (r) { return ex(r).bolsa; }).filter(function (b) { return b != null && b > 0; });
  $('estBolsaMedia').textContent = bolsas.length ? fmtReais(media(bolsas)) : '—';
  $('estBolsaMediana').textContent = bolsas.length ? fmtReais(mediana(bolsas)) : '—';
  // leitura dos números atuais, no fim da legenda "Como ler a bolsa média e a mediana"
  if (bolsas.length) {
    var med = media(bolsas), mdn = mediana(bolsas);
    $('estBolsaLeitura').innerHTML = '<b>Nos dados de agora:</b> média de ' + fmtReais(med) + ' e mediana de ' + fmtReais(mdn) + '. ' +
      (med > mdn * 1.1
        ? 'A média é bem maior que a mediana: a maioria ganha perto de ' + fmtReais(mdn) + ', e algumas bolsas bem mais altas puxam a média para cima.'
        : med < mdn * 0.9
          ? 'A média é menor que a mediana: algumas bolsas bem mais baixas puxam a média para baixo.'
          : 'Média e mediana estão próximas: as bolsas são parecidas entre si, sem valores muito fora da curva.');
  }
  var obrig = ativos.filter(function (r) { return /obrigat[oó]rio/i.test(ex(r).tipo_contrato || '') && !/n[aã]o obrigat/i.test(ex(r).tipo_contrato || ''); }).length;
  $('estObrigatorios').textContent = fmtInt(obrig);
  $('estObrigatoriosSub').textContent = 'de ' + fmtInt(ativos.length) + ' ativos';
  var validos = RECORDS.filter(function (r) { return r.situacao !== 'Cancelado' && r.situacao !== 'Contrato Excluído' && r.extras; });
  var comAditivo = validos.filter(function (r) { return (ex(r).aditivos || 0) > 0; }).length;
  $('estAditivos').textContent = validos.length ? fmtPct(comAditivo / validos.length * 100) : '—';
  $('estAditivosSub').textContent = fmtInt(comAditivo) + ' de ' + fmtInt(validos.length) + ' contratos';

  // bolsa média por curso / empresa / nível (grupos com pelo menos 5 ativos com bolsa)
  var MIN_BOLSA = 5;
  function bolsaPor(chave) {
    var g = {};
    ativos.forEach(function (r) {
      var b = ex(r).bolsa;
      if (b == null || b <= 0) return;
      var k = chave(r); (g[k] = g[k] || []).push(b);
    });
    return Object.keys(g).filter(function (k) { return g[k].length >= MIN_BOLSA; })
      .map(function (k) { return { nome: k, valor: media(g[k]), n: g[k].length }; })
      .sort(function (a, b) { return b.valor - a.valor; }).slice(0, 10)
      .map(function (l) { l.texto = fmtReais(l.valor) + ' · ' + fmtInt(l.n); return l; });
  }
  var BOLSA_POR = { curso: function (r) { return r.funcao; }, empresa: function (r) { return r.empresa; }, nivel: nivel };
  var bolsaAtual = 'curso';
  function desenharBolsa() {
    barras('estBolsaBars', bolsaPor(BOLSA_POR[bolsaAtual]), 'Sem bolsas informadas.');
    document.querySelectorAll('#estBolsaChips .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-por') === bolsaAtual); });
  }
  document.querySelectorAll('#estBolsaChips .chip').forEach(function (c) {
    c.addEventListener('click', function () { bolsaAtual = c.getAttribute('data-por'); desenharBolsa(); });
  });
  desenharBolsa();

  // faixas de bolsa
  var FAIXAS_BOLSA = [[0, 500, 'Até R$ 500'], [500, 800, 'R$ 500 a 799'], [800, 1200, 'R$ 800 a 1.199'], [1200, 2000, 'R$ 1.200 a 1.999'], [2000, Infinity, 'R$ 2.000 ou mais']];
  barras('estBolsaFaixas', FAIXAS_BOLSA.map(function (f) {
    var n = bolsas.filter(function (b) { return b >= f[0] && b < f[1]; }).length;
    return { nome: f[2], valor: n, texto: fmtInt(n) + ' (' + fmtPct(bolsas.length ? n / bolsas.length * 100 : 0) + ')' };
  }), 'Sem bolsas informadas.');

  // instituições de ensino (ativos)
  var inst = contar(ativos, function (r) { return r.instituicao || 'Não informada'; });
  barras('estInstituicoes', Object.keys(inst).map(function (k) { return { nome: k, valor: inst[k] }; })
    .sort(function (a, b) { return b.valor - a.valor; }).slice(0, 12)
    .map(function (l) { l.texto = fmtInt(l.valor) + ' (' + fmtPct(l.valor / ativos.length * 100) + ')'; return l; }));
  $('estInstituicoesSub').textContent = fmtInt(Object.keys(inst).length) + ' instituições com estudantes ativos · as 12 maiores';

  // nível
  var niv = contar(ativos, nivel);
  barras('estNivel', ['Superior', 'Técnico', 'Ensino médio'].map(function (k) {
    return { nome: k, valor: niv[k] || 0, texto: fmtInt(niv[k] || 0) + ' (' + fmtPct(ativos.length ? (niv[k] || 0) / ativos.length * 100 : 0) + ')' };
  }));

  // prorrogações por empresa (empresas com pelo menos 10 contratos)
  var MIN_PROR = 10;
  var porEmpresa = {};
  validos.forEach(function (r) { var e = porEmpresa[r.empresa] = porEmpresa[r.empresa] || { t: 0, a: 0 }; e.t++; if ((ex(r).aditivos || 0) > 0) e.a++; });
  barras('estProrrogacoes', Object.keys(porEmpresa).filter(function (k) { return porEmpresa[k].t >= MIN_PROR; })
    .map(function (k) { var e = porEmpresa[k]; return { nome: k, valor: e.a / e.t * 100, texto: fmtPct(e.a / e.t * 100) + ' · ' + fmtInt(e.a) + ' de ' + fmtInt(e.t) }; })
    .sort(function (a, b) { return b.valor - a.valor; }).slice(0, 10), 'Nenhuma empresa com ' + MIN_PROR + ' contratos ou mais.');

  // rescisão antecipada por curso, com filtro por empresa.
  // Mínimo de encerrados por curso: 20 no geral; 5 com uma empresa escolhida (senão quase nenhum curso aparece)
  var MIN_RESC = 20, MIN_RESC_EMPRESA = 5;
  var encerrados = RECORDS.filter(function (r) { return r.situacao === 'Rescindido' || r.situacao === 'Concluído'; });
  function taxa(lista) { var r = lista.filter(function (x) { return x.situacao === 'Rescindido'; }).length; return lista.length ? r / lista.length * 100 : 0; }
  var mediaGeral = taxa(encerrados);
  function desenharRescisao(empresa) {
    var lista = empresa ? encerrados.filter(function (r) { return r.empresa === empresa; }) : encerrados;
    var min = empresa ? MIN_RESC_EMPRESA : MIN_RESC;
    var porCurso = {};
    lista.forEach(function (r) { var c = porCurso[r.funcao] = porCurso[r.funcao] || { t: 0, r: 0 }; c.t++; if (r.situacao === 'Rescindido') c.r++; });
    barras('estRescisao', Object.keys(porCurso).filter(function (k) { return porCurso[k].t >= min; })
      .map(function (k) { var c = porCurso[k]; return { nome: k, valor: c.r / c.t * 100, texto: fmtPct(c.r / c.t * 100) + ' · ' + fmtInt(c.r) + ' de ' + fmtInt(c.t) }; })
      .sort(function (a, b) { return b.valor - a.valor; }).slice(0, 10),
      empresa ? 'Nenhum curso com ' + min + ' contratos encerrados ou mais nesta empresa.' : 'Nenhum curso com ' + min + ' contratos encerrados ou mais.');
    $('estRescisaoSub').textContent = 'Rescindidos ÷ (rescindidos + concluídos) · ' +
      (empresa
        ? 'nesta empresa ' + fmtPct(taxa(lista)) + ' (' + fmtInt(lista.length) + ' encerrados) · média geral ' + fmtPct(mediaGeral)
        : 'média geral ' + fmtPct(mediaGeral)) +
      ' · cursos com ' + min + ' encerrados ou mais';
  }
  // empresas com pelo menos 5 contratos encerrados, em ordem alfabética
  var encPorEmpresa = contar(encerrados, function (r) { return r.empresa; });
  var selEmp = $('estRescisaoEmpresa');
  Object.keys(encPorEmpresa).filter(function (k) { return encPorEmpresa[k] >= MIN_RESC_EMPRESA; })
    .sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); })
    .forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = k + ' (' + fmtInt(encPorEmpresa[k]) + ' encerrados)';
      selEmp.appendChild(o);
    });
  selEmp.addEventListener('change', function () { desenharRescisao(selEmp.value); });
  desenharRescisao('');

  // semestre dos ativos
  var sem = contar(ativos, function (r) { var s = ex(r).semestre; return s == null ? null : (s >= 10 ? '10º ou mais' : s + 'º'); });
  var ordemSem = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º ou mais'];
  barras('estSemestre', ordemSem.filter(function (k) { return sem[k]; }).map(function (k) { return { nome: k + ' semestre', valor: sem[k], texto: fmtInt(sem[k]) }; }));
  var semInfo = ativos.filter(function (r) { return ex(r).semestre == null; }).length;
  $('estSemestreSub').textContent = 'Só contratos ativos' + (semInfo ? ' · ' + fmtInt(semInfo) + ' sem semestre informado' : '');

  // formaturas previstas nos próximos 6 meses (vagas que devem abrir)
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var meses = [];
  for (var i = 0; i < 6; i++) { var m = new Date(HOJE.getFullYear(), HOJE.getMonth() + i, 1); meses.push(isoDe(m).slice(0, 7)); }
  var form = contar(ativos, function (r) { var pf = ex(r).previsao_formatura; return pf ? String(pf).slice(0, 7) : null; });
  barras('estFormaturas', meses.map(function (k) {
    return { nome: MESES[+k.slice(5, 7) - 1] + '/' + k.slice(0, 4), valor: form[k] || 0, texto: fmtInt(form[k] || 0) };
  }));
};
