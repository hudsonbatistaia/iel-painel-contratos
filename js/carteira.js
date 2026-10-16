/* Seções comuns aos dois programas (v2.5): ficha da empresa, contratos aguardando
   assinatura, concentração da carteira, evolução ano a ano e pessoas que voltaram.
   Chamado por entrada.js depois do painel e do módulo do programa.
   opc = { programa, rotulos, alertas } — alertas: listas do estágio vindas de iniciarEstagio. */
window.iniciarCarteira = function (RECORDS, opc) {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var G = window.Graficos;
  var esc = G.esc, fmtInt = G.fmtInt, fmtPct = G.fmtPct;
  var DIA = 86400000;
  var HOJE = (function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  var ROT = opc.rotulos || { pessoa: 'Aprendiz', funcao: 'Função' };
  var ESTAGIO = opc.programa === 'estagio';
  var ARQ = ESTAGIO ? 'estagio' : 'jovem_aprendiz';

  function dataDe(iso) { return iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00') : null; }
  function fmtData(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function diasAte(iso) { var d = dataDe(iso); return d ? Math.round((d - HOJE) / DIA) : null; }
  function ex(r) { return r.extras || {}; }
  function media(v) { return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : 0; }
  function contar(lista, chave) {
    var m = {};
    lista.forEach(function (r) { var k = chave(r); if (k != null) m[k] = (m[k] || 0) + 1; });
    return m;
  }
  // "A (5) · B (3) · …" com os 10 maiores; o resto vira "e mais N"
  function principais(m, rotuloResto) {
    var k = Object.keys(m).sort(function (a, b) { return m[b] - m[a] || a.localeCompare(b, 'pt-BR'); });
    if (!k.length) return '—';
    var txt = k.slice(0, 10).map(function (x) { return esc(x) + ' (' + fmtInt(m[x]) + ')'; }).join(' · ');
    return k.length > 10 ? txt + ' · e mais ' + fmtInt(k.length - 10) + ' ' + rotuloResto : txt;
  }
  // abre a ficha ao clicar no nome de uma empresa (rankings desta e das outras seções)
  function abrirFichaDe(nome) { if (window.Carteira) window.Carteira.abrirFicha(nome); }

  var ativos = RECORDS.filter(function (r) { return r.situacao === 'Ativo'; });
  var validos = RECORDS.filter(function (r) { return r.situacao !== 'Cancelado' && r.situacao !== 'Contrato Excluído'; });

  /* ================= 1. CONTRATOS AGUARDANDO ASSINATURA ================= */
  var aguardando = RECORDS.filter(function (r) { return r.situacao === 'Aguardando Assinatura'; })
    .map(function (r) { var d = diasAte(r.inicio); return { r: r, atraso: d == null ? null : -d }; })
    .sort(function (a, b) { return (b.atraso == null ? -1e9 : b.atraso) - (a.atraso == null ? -1e9 : a.atraso); });
  var FILTRO_PEND = {
    todos: { nome: 'aguardando assinatura', f: function () { return true; } },
    vencido: { nome: 'com a data de início já passada', f: function (x) { return x.atraso > 0; } },
    '30': { nome: 'parados há mais de 30 dias', f: function (x) { return x.atraso > 30; } },
    '90': { nome: 'parados há mais de 90 dias', f: function (x) { return x.atraso > 90; } }
  };
  var pendAtual = 'vencido';
  function listaPend() { return aguardando.filter(FILTRO_PEND[pendAtual].f); }
  function desenharPendencias() {
    $('pendTotal').textContent = fmtInt(aguardando.length);
    $('pendVencido').textContent = fmtInt(aguardando.filter(FILTRO_PEND.vencido.f).length);
    $('pend30').textContent = fmtInt(aguardando.filter(FILTRO_PEND['30'].f).length);
    $('pend90').textContent = fmtInt(aguardando.filter(FILTRO_PEND['90'].f).length);
    document.querySelectorAll('#pendencias .alert-tile').forEach(function (t) { t.classList.toggle('active-filter', t.getAttribute('data-pend') === pendAtual); });
    var lista = listaPend(), MAX = 200;
    $('pendTabela').innerHTML = lista.length ? lista.slice(0, MAX).map(function (x) {
      var a = x.atraso;
      var atraso = a == null ? '—' : a > 0
        ? '<span style="color:' + (a > 90 ? 'var(--dias-urgente)' : 'var(--dias-atencao)') + ';font-weight:700;">' + fmtInt(a) + (a === 1 ? ' dia' : ' dias') + '</span>'
        : 'começa em ' + fmtInt(-a) + (a === -1 ? ' dia' : ' dias');
      return '<tr><td class="nome">' + esc(x.r.nome) + '</td><td class="empresa">' + esc(x.r.empresa) + '</td><td>' + fmtData(x.r.inicio) + '</td><td>' + atraso + '</td></tr>';
    }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum contrato nessa situação.</td></tr>';
    $('pendNota').textContent = lista.length ? 'Mostrando ' + fmtInt(Math.min(lista.length, MAX)) + ' de ' + fmtInt(lista.length) + ' contrato(s) ' + FILTRO_PEND[pendAtual].nome +
      (lista.length > MAX ? ' (o Excel traz todos)' : '') + '. Contrato parado em "Aguardando Assinatura" depois da data de início precisa ser assinado ou cancelado.' : '';
    // empresas com mais contratos parados (no filtro escolhido)
    var porEmp = contar(lista, function (x) { return x.r.empresa; });
    rankingPend.mostrar(Object.keys(porEmp).map(function (k) { return { nome: k, valor: porEmp[k], texto: fmtInt(porEmp[k]) + (porEmp[k] === 1 ? ' contrato' : ' contratos') }; })
      .sort(function (a, b) { return b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'); }), {
      rotulo: 'empresas', vazio: 'Nenhuma empresa com contrato nessa situação.', aoClicar: abrirFichaDe,
      csv: { nome: 'aguardando_assinatura_por_empresa_' + ARQ + '.csv', cabecalho: ['Empresa', 'Contratos aguardando assinatura'],
             linhas: function () { return Object.keys(porEmp).sort(function (a, b) { return porEmp[b] - porEmp[a]; }).map(function (k) { return [k, porEmp[k]]; }); } }
    });
  }
  $('pendCabPessoa').textContent = ROT.pessoa;
  var rankingPend = G.ranking('pendEmpresas');
  document.querySelectorAll('#pendencias .alert-tile').forEach(function (t) {
    t.addEventListener('click', function () { pendAtual = t.getAttribute('data-pend'); desenharPendencias(); });
  });
  $('exportPendencias').addEventListener('click', function () {
    G.baixarCsv('aguardando_assinatura_' + ARQ + '.csv', [ROT.pessoa, 'Empresa', 'CPF', 'Contrato', 'Início previsto', 'Dias de atraso'],
      listaPend().map(function (x) { return [x.r.nome, x.r.empresa, x.r.cpf, x.r.contrato, fmtData(x.r.inicio), x.atraso]; }));
  });
  desenharPendencias();

  /* ================= 2. CONCENTRAÇÃO DA CARTEIRA ================= */
  var ativosPorEmp = contar(ativos, function (r) { return r.empresa; });
  var empOrd = Object.keys(ativosPorEmp).map(function (k) { return { nome: k, n: ativosPorEmp[k] }; })
    .sort(function (a, b) { return b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR'); });
  function fatia(n) { return ativos.length ? empOrd.slice(0, n).reduce(function (s, e) { return s + e.n; }, 0) / ativos.length * 100 : 0; }
  var acum = 0, metade = 0;
  for (var i = 0; i < empOrd.length; i++) { acum += empOrd[i].n; if (acum >= ativos.length / 2) { metade = i + 1; break; } }
  acum = 0;
  G.barras('cartConc', empOrd.slice(0, 10).map(function (e) {
    acum += e.n;
    return { nome: e.nome, valor: e.n, texto: fmtInt(e.n) + ' (' + fmtPct(e.n / ativos.length * 100) + ') · soma ' + fmtPct(acum / ativos.length * 100) };
  }), 'Sem contratos ativos.', 0, true, true);
  G.aoClicarLinha($('cartConc'), abrirFichaDe);
  $('cartConcSub').textContent = ativos.length
    ? 'A maior empresa tem ' + fmtPct(fatia(1)) + ' dos ativos; as 5 maiores, ' + fmtPct(fatia(5)) + '; as 10 maiores, ' + fmtPct(fatia(10)) + '. Metade dos ativos está em ' + fmtInt(metade) + (metade === 1 ? ' empresa.' : ' empresas.')
    : 'Sem contratos ativos.';
  $('cartConcLeitura').innerHTML = '<p><b>O que mostra:</b> quanto dos contratos ativos depende das maiores empresas. Cada linha traz os ativos da empresa, a parte que ela representa e a <b>soma</b> acumulada até ela.</p>' +
    '<p><b>Por que importa:</b> quanto mais concentrada a carteira, maior o impacto se uma grande empresa reduzir ou encerrar os contratos. Uma carteira mais distribuída é mais segura.</p>' +
    '<p>Total: ' + fmtInt(ativos.length) + ' contratos ativos em ' + fmtInt(empOrd.length) + ' empresas.</p>';

  /* ================= 3. EVOLUÇÃO ANO A ANO ================= */
  var anoAtual = HOJE.getFullYear();
  var primeiroDaEmpresa = {};
  validos.forEach(function (r) { if (r.inicio && (!primeiroDaEmpresa[r.empresa] || r.inicio < primeiroDaEmpresa[r.empresa])) primeiroDaEmpresa[r.empresa] = r.inicio; });
  var EVOL = {
    contratos: { titulo: 'contratos iniciados', dados: contar(validos, function (r) { return r.inicio ? +String(r.inicio).slice(0, 4) : null; }) },
    empresas: { titulo: 'empresas novas (1º contrato)', dados: contar(Object.keys(primeiroDaEmpresa), function (e) { return +primeiroDaEmpresa[e].slice(0, 4); }) }
  };
  var evolAtual = 'contratos';
  function desenharEvolucao() {
    var d = EVOL[evolAtual].dados;
    var anos = Object.keys(d).map(Number).filter(function (a) { return a <= anoAtual; }).sort();
    G.barras('cartEvol', anos.map(function (a) {
      var prev = d[a - 1], txt = fmtInt(d[a]);
      if (prev && a !== anoAtual) txt += ' (' + (d[a] >= prev ? '+' : '') + fmtPct((d[a] - prev) / prev * 100) + ')';
      return { nome: a === anoAtual ? a + ' (parcial)' : String(a), valor: d[a], texto: txt };
    }), 'Sem contratos com data de início.', 0, false);
    $('cartEvolNota').textContent = 'Por ano de início · entre parênteses, a variação em relação ao ano anterior · ' + anoAtual + ' ainda está em andamento' +
      (evolAtual === 'contratos' ? ' · cancelados não entram' : '');
    document.querySelectorAll('#cartEvolChips .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-evol') === evolAtual); });
  }
  document.querySelectorAll('#cartEvolChips .chip').forEach(function (c) {
    c.addEventListener('click', function () { evolAtual = c.getAttribute('data-evol'); desenharEvolucao(); });
  });
  desenharEvolucao();

  /* ================= 4. PESSOAS QUE VOLTARAM ================= */
  var porPessoa = {};
  validos.forEach(function (r) { (porPessoa[r.pessoa] = porPessoa[r.pessoa] || []).push(r); });
  var pessoas = Object.keys(porPessoa).map(function (k) { return porPessoa[k]; });
  var voltaram = pessoas.filter(function (l) { return l.length > 1; });
  var outraEmpresa = voltaram.filter(function (l) { return new Set(l.map(function (r) { return r.empresa; })).size > 1; }).length;
  var n2 = voltaram.filter(function (l) { return l.length === 2; }).length, n3 = voltaram.filter(function (l) { return l.length === 3; }).length, n4 = voltaram.length - n2 - n3;
  G.barras('cartVoltaram', [
    { nome: '2 contratos', valor: n2, texto: fmtInt(n2) },
    { nome: '3 contratos', valor: n3, texto: fmtInt(n3) },
    { nome: '4 ou mais', valor: n4, texto: fmtInt(n4) },
    { nome: 'Em outra empresa', valor: outraEmpresa, texto: fmtInt(outraEmpresa) + ' (' + fmtPct(voltaram.length ? outraEmpresa / voltaram.length * 100 : 0) + ')' },
    { nome: 'Na mesma empresa', valor: voltaram.length - outraEmpresa, texto: fmtInt(voltaram.length - outraEmpresa) + ' (' + fmtPct(voltaram.length ? (voltaram.length - outraEmpresa) / voltaram.length * 100 : 0) + ')' }
  ], 'Ninguém com mais de um contrato.', 0, false);
  $('cartVoltaramSub').textContent = fmtInt(voltaram.length) + ' de ' + fmtInt(pessoas.length) + ' pessoas (' + fmtPct(pessoas.length ? voltaram.length / pessoas.length * 100 : 0) +
    ') tiveram mais de um contrato no programa';
  $('cartVoltaramLeitura').innerHTML = '<p><b>O que mostra:</b> quantas pessoas fizeram mais de um contrato no programa, e se o novo contrato foi na mesma empresa ou em outra.</p>' +
    '<p>As três primeiras linhas dividem essas pessoas pelo número de contratos; as duas últimas, pela empresa do contrato seguinte. Prorrogações (termos aditivos) não contam como contrato novo, e cancelados não entram.</p>';

  /* ================= 5. FICHA DA EMPRESA ================= */
  var mediaResc = G.taxaGeral(G.baseDeRescisao(RECORDS));
  var porEmpresa = {};
  RECORDS.forEach(function (r) { (porEmpresa[r.empresa] = porEmpresa[r.empresa] || []).push(r); });
  var nomesEmpresas = Object.keys(porEmpresa).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  $('fichaEmpresas').innerHTML = nomesEmpresas.map(function (e) { return '<option value="' + esc(e) + '"></option>'; }).join('');
  $('fichaBuscaAjuda').textContent = fmtInt(nomesEmpresas.length) + ' empresas neste programa. Também dá para abrir a ficha clicando no nome de uma empresa nos rankings.';

  // alertas legais e de qualidade de cada contrato (por empresa)
  function alertasDa(lista) {
    var at = lista.filter(function (r) { return r.situacao === 'Ativo'; });
    var itens = [];
    function add(n, txt, grave) { if (n) itens.push({ n: n, txt: txt, grave: grave }); }
    var venc = function (min, max) { return at.filter(function (r) { var d = diasAte(r.fim); return d != null && d >= min && d <= max; }).length; };
    add(at.filter(function (r) { var d = diasAte(r.fim); return d != null && d < 0; }).length, 'ativos com o fim já vencido', true);
    add(venc(0, 30), 'vencem em até 30 dias', false);
    add(venc(31, 90), 'vencem em 31 a 90 dias', false);
    add(lista.filter(function (r) { return r.situacao === 'Aguardando Assinatura' && diasAte(r.inicio) < 0; }).length, 'aguardando assinatura com início já passado', true);
    if (ESTAGIO && opc.alertas) {
      var de = function (arr) { return (arr || []).filter(function (x) { return x.r.empresa === lista[0].empresa; }).length; };
      add(de(opc.alertas.limite2), 'passam do limite de 2 anos', true);
      add(de(opc.alertas.recesso), 'vencem em até 60 dias com recesso a tirar', false);
      add(de(opc.alertas.formatura), 'terminam depois da formatura', false);
      add(de(opc.alertas.jornada), 'com jornada acima de 6h/30h', true);
    }
    if (!ESTAGIO) {
      add(at.filter(function (r) {
        var n = dataDe(r.nasc), f = dataDe(r.fim); if (!n || !f) return false;
        var d24 = new Date(n); d24.setFullYear(d24.getFullYear() + 24); return f > d24;
      }).length, 'passam dos 24 anos antes do fim do contrato', true);
      var comEx = at.filter(function (r) { return r.extras; });
      add(comEx.filter(function (r) { return !(ex(r).ch_semanal > 0); }).length, 'sem carga horária', false);
      add(comEx.filter(function (r) { return !(ex(r).aula_dia && ex(r).aula_turno); }).length, 'sem horário da aula teórica', false);
    }
    return itens;
  }

  function abrirFicha(nome) {
    var lista = porEmpresa[nome];
    if (!lista) { $('fichaMsg').textContent = 'Empresa não encontrada neste programa. Escolha um nome da lista.'; $('fichaMsg').className = 'carga-msg erro'; return; }
    $('fichaMsg').textContent = ''; $('fichaBusca').value = nome;
    var sit = contar(lista, function (r) { return r.situacao; });
    var at = lista.filter(function (r) { return r.situacao === 'Ativo'; }).sort(function (a, b) { return String(a.fim).localeCompare(String(b.fim)); });
    var enc = (sit['Rescindido'] || 0) + (sit['Concluído'] || 0);
    var taxa = enc ? (sit['Rescindido'] || 0) / enc * 100 : null;
    var inicios = lista.map(function (r) { return r.inicio; }).filter(Boolean).sort();
    var cnpj = (lista.find(function (r) { return r.cnpj; }) || {}).cnpj;
    var cnpjFmt = cnpj && cnpj.length === 14 ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (cnpj || '—');
    var alertas = alertasDa(lista);

    var kpis = [
      ['Ativos', sit['Ativo'] || 0], ['Aguardando assinatura', sit['Aguardando Assinatura'] || 0], ['Concluídos', sit['Concluído'] || 0],
      ['Rescindidos', sit['Rescindido'] || 0], ['Cancelados', sit['Cancelado'] || 0]
    ];
    var html = '<div class="ficha-topo"><div><h3 class="ficha-nome">' + esc(nome) + '</h3>' +
      '<p class="chart-sub">CNPJ ' + esc(cnpjFmt) + ' · ' + fmtInt(lista.length) + ' contratos no programa' +
      (inicios.length ? ' · primeiro contrato em ' + fmtData(inicios[0]) + ' · último iniciado em ' + fmtData(inicios[inicios.length - 1]) : '') + '</p></div>' +
      '<div class="chart-card-actions"><button class="export-btn small" id="fichaExcel" type="button" title="Baixa todos os contratos da empresa em Excel/CSV">⭳ Excel</button>' +
      '<button class="botao-secundario ficha-fechar" id="fichaFechar" type="button">× Fechar</button></div></div>';
    html += '<div class="ficha-kpis">' + kpis.map(function (k) { return '<div class="ficha-kpi"><span class="n">' + fmtInt(k[1]) + '</span><span class="l">' + k[0] + '</span></div>'; }).join('') +
      '<div class="ficha-kpi"><span class="n">' + (taxa == null ? '—' : fmtPct(taxa)) + '</span><span class="l">Rescisão antecipada' +
      (taxa == null ? '' : ' · ' + (taxa > mediaResc ? 'acima' : 'abaixo') + ' da média (' + fmtPct(mediaResc) + ')') + '</span></div></div>';

    // alertas
    html += '<div class="ficha-bloco"><h4>Alertas</h4>' + (alertas.length
      ? '<ul class="ficha-alertas">' + alertas.map(function (a) { return '<li class="' + (a.grave ? 'grave' : '') + '"><b>' + fmtInt(a.n) + '</b> ' + a.txt + '</li>'; }).join('') + '</ul>'
      : '<p class="chart-sub">Nenhum alerta para esta empresa.</p>') + '</div>';

    // dados do programa
    if (ESTAGIO) {
      var bolsas = at.map(function (r) { return ex(r).bolsa; }).filter(function (b) { return b > 0; });
      var valid = lista.filter(function (r) { return r.situacao !== 'Cancelado' && r.situacao !== 'Contrato Excluído' && r.extras; });
      var prorr = valid.filter(function (r) { return (ex(r).aditivos || 0) > 0; }).length;
      var cursos = contar(at, function (r) { return r.funcao; });
      html += '<div class="ficha-bloco"><h4>Estágio</h4><p>' +
        'Bolsa média dos ativos: <b>' + (bolsas.length ? 'R$ ' + Math.round(media(bolsas)).toLocaleString('pt-BR') : '—') + '</b> · ' +
        'Contratos com prorrogação: <b>' + (valid.length ? fmtPct(prorr / valid.length * 100) + ' (' + fmtInt(prorr) + ' de ' + fmtInt(valid.length) + ')' : '—') + '</b></p>' +
        '<p>Cursos dos ativos: ' + principais(cursos, 'cursos') + '</p></div>';
    } else {
      var aulas = contar(at.filter(function (r) { return ex(r).aula_dia && ex(r).aula_turno; }), function (r) { return ex(r).aula_dia + ' de ' + ex(r).aula_turno.toLowerCase(); });
      var funcoes = contar(at, function (r) { return r.funcao; });
      html += '<div class="ficha-bloco"><h4>Aprendizagem</h4>' +
        '<p>Aulas teóricas dos ativos: ' + (Object.keys(aulas).length ? Object.keys(aulas).sort(function (a, b) { return aulas[b] - aulas[a]; }).map(function (k) { return k + ' (' + aulas[k] + ')'; }).join(' · ') : 'sem horário informado') + '</p>' +
        '<p>Funções dos ativos: ' + principais(funcoes, 'funções') + '</p></div>';
    }

    // contratos por ano
    var porAno = contar(lista.filter(function (r) { return r.situacao !== 'Cancelado' && r.situacao !== 'Contrato Excluído'; }), function (r) { return r.inicio ? String(r.inicio).slice(0, 4) : null; });
    html += '<div class="ficha-bloco"><h4>Contratos iniciados por ano</h4><div class="bar-list barras-largas" id="fichaAnos"></div></div>';

    // ativos
    html += '<div class="ficha-bloco"><h4>Contratos ativos (' + fmtInt(at.length) + ')</h4>' + (at.length
      ? '<div class="table-wrap ficha-tabela"><table><thead><tr><th>' + esc(ROT.pessoa) + '</th><th>' + esc(ROT.funcao) + '</th><th>Início</th><th>Encerramento</th><th>Dias p/ vencer</th></tr></thead><tbody>' +
        at.map(function (r) {
          var d = diasAte(r.fim);
          var cor = d == null ? '' : d < 0 ? 'var(--dias-urgente)' : d <= 30 ? 'var(--dias-atencao)' : d <= 90 ? 'var(--dias-preventivo)' : 'var(--text-secondary)';
          return '<tr><td class="nome">' + esc(r.nome) + '</td><td>' + esc(r.funcao) + '</td><td>' + fmtData(r.inicio) + '</td><td>' + fmtData(r.fim) + '</td>' +
            '<td><span style="color:' + cor + ';font-weight:700;">' + (d == null ? '—' : d < 0 ? 'vencido há ' + fmtInt(-d) : fmtInt(d)) + '</span></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="chart-sub">Nenhum contrato ativo.</p>') + '</div>';

    var box = $('fichaConteudo');
    box.innerHTML = html; box.hidden = false;
    var anos = Object.keys(porAno).sort();
    G.barras('fichaAnos', anos.map(function (a) { return { nome: +a === anoAtual ? a + ' (parcial)' : a, valor: porAno[a], texto: fmtInt(porAno[a]) }; }), 'Sem datas de início.', 0, false);
    $('fichaFechar').addEventListener('click', function () { box.hidden = true; box.innerHTML = ''; $('fichaBusca').value = ''; });
    $('fichaExcel').addEventListener('click', function () {
      G.baixarCsv('ficha_' + nome.replace(/[^\wÀ-ú]+/g, '_').slice(0, 40) + '_' + ARQ + '.csv', [ROT.pessoa, 'CPF', 'Contrato', ROT.funcao, 'Situação', 'Início', 'Encerramento'],
        lista.map(function (r) { return [r.nome, r.cpf, r.contrato, r.funcao, r.situacao, fmtData(r.inicio), fmtData(r.fim)]; }));
    });
    $('fichaEmpresa').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function abrirDaBusca() { var v = $('fichaBusca').value.trim(); if (v) abrirFicha(v); }
  $('fichaAbrir').addEventListener('click', abrirDaBusca);
  $('fichaBusca').addEventListener('change', abrirDaBusca);
  $('fichaBusca').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); abrirDaBusca(); } });

  window.Carteira = { abrirFicha: abrirFicha };
};
