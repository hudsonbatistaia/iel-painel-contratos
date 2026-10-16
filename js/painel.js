/* Painel (código do protótipo v1). Agora recebe os dados do banco em vez de
   lê-los de dentro do HTML: chamado por entrada.js depois do login.
   OPC = { programa: 'aprendiz' | 'estagio', rotulos: {...} } (js/programas.js) */
window.iniciarPainel = function (RECORDS, AGG, OPC) {
  "use strict";
  OPC = OPC || {};
  var ROT = OPC.rotulos || { pessoa: 'Aprendiz', funcao: 'Função', arquivo: 'jovem_aprendiz', arquivoFuncoes: 'arco_ocupacional_jovem_aprendiz' };

  var STATUS_COLOR = {
    "Ativo":                 { c: "var(--status-good)",     wash: "var(--status-good-wash)" },
    "Aguardando Assinatura": { c: "var(--status-warning)",  wash: "var(--status-warning-wash)" },
    "Cancelado":             { c: "var(--status-serious)",  wash: "var(--status-serious-wash)" },
    "Rescindido":            { c: "var(--status-critical)", wash: "var(--status-critical-wash)" },
    "Concluído":             { c: "var(--status-neutral)",  wash: "var(--status-neutral-wash)" },
    "Contrato Excluído":     { c: "var(--accent)",          wash: "var(--accent-wash)" },
    "Incluído":              { c: "var(--status-pending)",  wash: "var(--status-pending-wash)" }
  };
  var SIT_ORDER = ["Ativo", "Aguardando Assinatura", "Cancelado", "Rescindido", "Concluído", "Contrato Excluído", "Incluído"];

  function fmtInt(n) { return n.toLocaleString('pt-BR'); }
  function fmtDate(iso) {
    if (!iso) return "—";
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function monthLabel(ym) {
    var meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    var p = ym.split('-');
    return meses[parseInt(p[1],10)-1] + '/' + p[0].slice(2);
  }

  var TODAY = new Date();
  TODAY.setHours(0,0,0,0);
  var TODAY_ISO = TODAY.getFullYear() + '-' + String(TODAY.getMonth()+1).padStart(2,'0') + '-' + String(TODAY.getDate()).padStart(2,'0');
  document.getElementById('refDate').textContent =
    'Hoje: ' + TODAY.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });

  function daysUntil(iso) {
    var d = new Date(iso + 'T00:00:00');
    return Math.round((d - TODAY) / 86400000);
  }

  // Nomes na base vêm em formatos variados (tudo maiúsculo na maioria,
  // já capitalizado em alguns) — normaliza pra Title Case só na exibição,
  // sem alterar o dado original. Preposições/artigos comuns em nome
  // composto ficam em minúsculo (exceto se forem a primeira palavra).
  var NOME_MINUSCULO = ['da', 'de', 'do', 'das', 'dos', 'e'];
  function toTitleCasePt(str) {
    if (!str) return str;
    return str.toLowerCase().split(' ').map(function(w, i) {
      if (!w) return w;
      if (i > 0 && NOME_MINUSCULO.indexOf(w) !== -1) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  // Gradiente de urgência único, reaproveitado no preview de vencimentos
  // e na tabela de consulta — quanto mais perto do vencimento, mais
  // quente a cor; já vencido usa um tom à parte (roxo) pra não ser
  // confundido com "vence em poucos dias" (decisão visual de 23/08/2026).
  function diasSeverityColor(dias) {
    var label = function(n) { return fmtInt(n) + ' ' + (n === 1 ? 'dia' : 'dias'); };
    if (dias < 0) return { color: 'var(--dias-vencido)', text: 'vencido há ' + label(-dias) };
    if (dias <= 7) return { color: 'var(--dias-urgente)', text: label(dias) };
    if (dias <= 30) return { color: 'var(--dias-atencao)', text: label(dias) };
    if (dias <= 60) return { color: 'var(--dias-preventivo)', text: label(dias) };
    return { color: 'var(--dias-tranquilo)', text: label(dias) };
  }
  function ageAt(nascIso, refIso) {
    if (!nascIso || !refIso) return null;
    var nasc = new Date(nascIso + 'T00:00:00');
    var ref = new Date(refIso + 'T00:00:00');
    return (ref - nasc) / 86400000 / 365.25;
  }
  function normStr(s) {
    return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  var toastTimer;
  function showToast(msg, durationMs) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.classList.remove('show'); }, durationMs || 3200);
  }

  /* ================= TEMA ================= */
  var THEME_KEY = 'jaTheme';
  function getSavedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function saveTheme(choice) {
    try { localStorage.setItem(THEME_KEY, choice); } catch (e) {}
  }
  function applyTheme(choice) {
    var root = document.documentElement;
    if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
    else root.removeAttribute('data-theme');
    document.querySelectorAll('.theme-opt').forEach(function(btn){
      btn.classList.toggle('on', btn.getAttribute('data-theme-choice') === choice);
    });
  }
  /* Botão "voltar ao topo" (24/08/2026). scroll com requestAnimationFrame
     pra não rodar a lógica de show/hide a cada pixel — só uma vez por frame,
     leve mesmo num painel longo como esse. */
  function initBackToTop() {
    var btn = document.getElementById('backToTop');
    if (!btn) return;
    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || document.documentElement.scrollTop;
      btn.classList.toggle('show', y > 400);
    }
    window.addEventListener('scroll', function(){
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update(); // estado inicial, caso a página já carregue rolada
    btn.addEventListener('click', function(){
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initThemeSwitch() {
    var saved = getSavedTheme() || 'auto';
    applyTheme(saved);
    document.querySelectorAll('.theme-opt').forEach(function(btn){
      btn.addEventListener('click', function(){
        var choice = this.getAttribute('data-theme-choice');
        applyTheme(choice);
        saveTheme(choice);
      });
    });
  }

  /* ================= ÍCONE DE INFORMAÇÃO DO PROTÓTIPO =================
     Abre no hover (CSS) e também no clique/toque (JS, pra funcionar em
     mobile e ficar aberto sem precisar manter o mouse em cima). O total de
     registros é sempre lido de AGG.totalGeral, nunca fixo no texto — assim
     continua correto quando a base for atualizada no fechamento mensal. */
  function initInfoTooltip() {
    var wrap = document.getElementById('infoWrap');
    var btn = document.getElementById('infoBtn');
    document.getElementById('infoTotalRegistros').textContent =
      fmtInt(AGG.totalGeral) + ' registros consolidados por Contrato + CPF';

    function closeTooltip() {
      wrap.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var isOpen = wrap.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function(e){
      if (!wrap.contains(e.target)) closeTooltip();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeTooltip();
    });
  }

  /* ================= KPI ROW ================= */
  function renderKPIs() {
    var total = RECORDS.length;
    var pessoas = AGG.pessoasUnicas;
    var empresas = AGG.empresasUnicas;
    document.getElementById('kpiTotal').textContent = fmtInt(total);
    document.getElementById('kpiFoot').textContent = fmtInt(pessoas) + ' pessoas em ' + fmtInt(empresas) + ' empresas';

    var counts = {};
    RECORDS.forEach(function(r){ counts[r.situacao] = (counts[r.situacao]||0) + 1; });

    // Só visual (23/08/2026, a pedido do Hudson) — sem percentual e sem
    // clique: esses 5 cards não filtram mais nada, só mostram a contagem.
    var map = {
      "Ativo": 'stAtivo',
      "Aguardando Assinatura": 'stAguardando',
      "Cancelado": 'stCancelado',
      "Rescindido": 'stRescindido',
      "Concluído": 'stConcluido'
    };
    Object.keys(map).forEach(function(k){
      document.getElementById(map[k]).textContent = fmtInt(counts[k] || 0);
    });
  }

  /* ================= MÓDULO GENÉRICO: barras ano a ano ================= */
  var MONTH_ABBR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  function yearBarRoundedTopPath(x, top, w, base, r) {
    r = Math.max(0, Math.min(r, w / 2, base - top));
    if (r <= 0.01) {
      return 'M' + x + ',' + base + ' L' + x + ',' + top + ' L' + (x + w) + ',' + top + ' L' + (x + w) + ',' + base + ' Z';
    }
    return 'M' + x + ',' + base +
      ' L' + x + ',' + (top + r) +
      ' Q' + x + ',' + top + ' ' + (x + r) + ',' + top +
      ' L' + (x + w - r) + ',' + top +
      ' Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + r) +
      ' L' + (x + w) + ',' + base +
      ' Z';
  }

  /**
   * Cria um módulo de "gráfico de barras ano a ano com indicador" — usado tanto
   * pra "Novos contratos por mês" quanto "Novas empresas por mês". cfg:
   *   dataKey        nome do campo em AGG (array de {mes, total})
   *   ids            {prev, next, label, indicator, chart, exportBtn}
   *   itemLabel      rótulo plural usado no indicador e no tooltip (ex.: 'novos contratos')
   *   csvFilename    nome do arquivo exportado
   *   csvValueHeader cabeçalho da coluna de valor no CSV
   */
  function makeYearBarModule(cfg) {
    var anos = [], porAno = {}, yearIdx = 0, maxGlobal = 1, minMes = null, maxMes = null;
    var svgId = cfg.ids.chart + 'Svg', tooltipId = cfg.ids.chart + 'Tooltip';

    function build() {
      var data = AGG[cfg.dataKey] || [];
      var byYear = {};
      maxGlobal = 1;
      data.forEach(function(d){
        var y = d.mes.slice(0, 4);
        var mi = parseInt(d.mes.slice(5, 7), 10) - 1;
        if (!byYear[y]) byYear[y] = new Array(12).fill(0);
        byYear[y][mi] = d.total;
        if (d.total > maxGlobal) maxGlobal = d.total;
      });
      porAno = byYear;
      anos = Object.keys(byYear).sort();
      yearIdx = anos.length - 1;
      minMes = data.length ? data[0].mes : null;
      maxMes = data.length ? data[data.length - 1].mes : null;
    }

    function monthKey(year, mi) { return year + '-' + String(mi + 1).padStart(2, '0'); }
    function inRange(year, mi) {
      if (!minMes) return false;
      var key = monthKey(year, mi);
      return key >= minMes && key <= maxMes;
    }
    function inRangeMonths(year) {
      var out = [];
      for (var mi = 0; mi < 12; mi++) if (inRange(year, mi)) out.push(mi);
      return out;
    }

    function renderIndicator() {
      var year = anos[yearIdx];
      var arr = porAno[year];
      var inRangeIdx = inRangeMonths(year);
      var total = inRangeIdx.reduce(function(s, mi){ return s + arr[mi]; }, 0);
      var isPartial = inRangeIdx.length > 0 && inRangeIdx.length < 12;
      var rangeLabel = isPartial
        ? (MONTH_ABBR[inRangeIdx[0]] + '–' + MONTH_ABBR[inRangeIdx[inRangeIdx.length - 1]])
        : null;

      var prevYear = String(parseInt(year, 10) - 1);
      var deltaHtml = '';
      // só compara com o ano anterior se ele cobrir os MESMOS meses (senão um ano
      // parcial de arranque vira base de comparação artificial e a % fica sem sentido)
      var prevCoversSameMonths = inRangeIdx.length > 0 && inRangeIdx.every(function(mi){ return inRange(prevYear, mi); });
      if (porAno[prevYear] && prevCoversSameMonths) {
        var prevTotal = inRangeIdx.reduce(function(s, mi){ return s + porAno[prevYear][mi]; }, 0);
        if (prevTotal > 0) {
          var pct = Math.round(((total - prevTotal) / prevTotal) * 100);
          var up = pct >= 0;
          var cls = up ? 'good' : 'critical';
          var arrow = up ? '▲' : '▼';
          var vsLabel = isPartial ? ('vs mesmo período ' + prevYear) : ('vs ' + prevYear);
          deltaHtml = '<span class="novos-delta ' + cls + '">' + arrow + ' ' + Math.abs(pct) + '% ' + vsLabel + '</span>';
        }
      }

      document.getElementById(cfg.ids.indicator).innerHTML =
        '<span class="novos-value">' + fmtInt(total) + '</span>' +
        '<span class="novos-label">' + cfg.itemLabel + ' em ' + year + (isPartial ? ' (parcial, ' + rangeLabel + ')' : '') + '</span>' +
        deltaHtml;
    }

    function renderChart() {
      var year = anos[yearIdx];
      var arr = porAno[year];
      var el = document.getElementById(cfg.ids.chart);
      var W = 620, H = 200, padL = 34, padR = 16, padT = 22, padB = 26;
      var innerW = W - padL - padR, innerH = H - padT - padB;
      var niceMax = Math.ceil(maxGlobal / 20) * 20;
      if (niceMax === 0) niceMax = 10;

      var slot = innerW / 12;
      var barW = Math.min(24, slot * 0.55);
      var baseY = padT + innerH;

      function xCenter(i) { return padL + slot * i + slot / 2; }
      function yTop(v) { return padT + innerH - (v / niceMax) * innerH; }

      var gridLines = '';
      var ticks = 4;
      for (var t = 0; t <= ticks; t++) {
        var v = (niceMax / ticks) * t;
        var yy = yTop(v);
        gridLines += '<line class="gridline" x1="' + padL + '" x2="' + (padL + innerW) + '" y1="' + yy + '" y2="' + yy + '"></line>';
        gridLines += '<text class="axis-label" x="' + (padL - 8) + '" y="' + (yy + 3) + '" text-anchor="end">' + Math.round(v) + '</text>';
      }

      var bars = '', labels = '', hitTargets = '', valueLabels = '';
      for (var mi = 0; mi < 12; mi++) {
        var cx = xCenter(mi);
        var xLeft = cx - barW / 2;
        labels += '<text class="axis-label" x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + MONTH_ABBR[mi] + '</text>';

        if (!inRange(year, mi)) continue;

        var val = arr[mi];
        if (val > 0) {
          var top = yTop(val);
          var r = Math.min(4, baseY - top, barW / 2);
          bars += '<path class="novos-bar" d="' + yearBarRoundedTopPath(xLeft, top, barW, baseY, r) + '"></path>';
          var labelY = Math.max(top - 6, 10);
          valueLabels += '<text class="bar-value-label" x="' + cx.toFixed(1) + '" y="' + labelY.toFixed(1) + '" text-anchor="middle">' + fmtInt(val) + '</text>';
        }
        hitTargets += '<rect class="hv-target-bar" data-mi="' + mi + '" x="' + xLeft.toFixed(1) + '" y="' + padT + '" width="' + barW.toFixed(1) + '" height="' + innerH + '" fill="transparent"></rect>';
      }

      el.innerHTML =
        '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;overflow:visible;" id="' + svgId + '">' +
          gridLines +
          '<line class="baseline" x1="' + padL + '" x2="' + (padL + innerW) + '" y1="' + baseY + '" y2="' + baseY + '"></line>' +
          bars + valueLabels + labels + hitTargets +
        '</svg>' +
        '<div class="tooltip" id="' + tooltipId + '"></div>';

      var svg = document.getElementById(svgId);
      var tooltip = document.getElementById(tooltipId);

      svg.querySelectorAll('.hv-target-bar').forEach(function(rectEl){
        rectEl.addEventListener('mouseenter', function(){
          var mi = parseInt(this.getAttribute('data-mi'), 10);
          var val = arr[mi];
          var cx = xCenter(mi);
          var top = yTop(val);
          var rect = svg.getBoundingClientRect();
          var scale = rect.width / W;
          tooltip.style.left = (cx * scale) + 'px';
          tooltip.style.top = (Math.min(top, baseY) * scale) + 'px';
          tooltip.innerHTML = '<div class="t-label">' + MONTH_ABBR[mi] + '/' + year + '</div><div class="t-value">' + fmtInt(val) + ' ' + cfg.itemLabel + '</div>';
          tooltip.classList.add('show');
        });
        rectEl.addEventListener('mouseleave', function(){
          tooltip.classList.remove('show');
        });
      });
    }

    function render() {
      var year = anos[yearIdx];
      document.getElementById(cfg.ids.label).textContent = year;
      if (cfg.ids.count) {
        document.getElementById(cfg.ids.count).textContent = (yearIdx + 1) + '/' + anos.length;
      }
      document.getElementById(cfg.ids.prev).disabled = (yearIdx === 0);
      document.getElementById(cfg.ids.next).disabled = (yearIdx === anos.length - 1);
      renderIndicator();
      renderChart();
    }

    function bind() {
      document.getElementById(cfg.ids.prev).addEventListener('click', function(){
        if (yearIdx > 0) { yearIdx -= 1; render(); }
      });
      document.getElementById(cfg.ids.next).addEventListener('click', function(){
        if (yearIdx < anos.length - 1) { yearIdx += 1; render(); }
      });
      document.getElementById(cfg.ids.exportBtn).addEventListener('click', cfg.customExportCsv || exportCsv);
    }

    function exportCsv() {
      var rows = AGG[cfg.dataKey] || [];
      if (rows.length === 0) { showToast('Nada pra exportar.'); return; }
      var headers = ['Ano', 'Mês', cfg.csvValueHeader];
      function esc(v) {
        v = (v === null || v === undefined) ? '' : String(v);
        if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
        return v;
      }
      var lines = [headers.map(esc).join(';')];
      rows.forEach(function(d){
        var y = d.mes.slice(0, 4);
        var mi = parseInt(d.mes.slice(5, 7), 10) - 1;
        lines.push([y, MONTH_ABBR[mi] + '/' + y, d.total].map(esc).join(';'));
      });
      var csv = '﻿' + lines.join('\r\n');
      saveCsvString(cfg.csvFilename, csv, fmtInt(rows.length) + ' meses exportados.');
    }

    return { build: build, render: render, bind: bind };
  }

  // Pedido do Hudson (10/09/2026): o Excel de "Novas empresas por mês" tem
  // que trazer nome da empresa e CNPJ, não só o total por mês — substitui a
  // exportação genérica (Ano/Mês/Total, ainda usada por "Novos contratos
  // por mês") por uma linha por empresa nova.
  function exportNovasEmpresasDetalhe() {
    // "1º contrato da empresa na base" = mesma definição usada pra montar
    // o gráfico (generate_payload.py, groupby('empresa')['inicio'].min()):
    // considera contratos em qualquer situação, não só Ativo — é sobre
    // quando a empresa virou concedente, não sobre um contrato específico.
    var porEmpresa = {};
    RECORDS.forEach(function(r){
      if (!porEmpresa[r.empresa] || r.inicio < porEmpresa[r.empresa].inicio) {
        porEmpresa[r.empresa] = { empresa: r.empresa, cnpj: r.cnpj, inicio: r.inicio };
      }
    });
    var lista = Object.keys(porEmpresa).map(function(k){ return porEmpresa[k]; });
    if (lista.length === 0) { showToast('Nada pra exportar.'); return; }
    lista.sort(function(a, b){
      if (a.inicio !== b.inicio) return a.inicio < b.inicio ? -1 : 1;
      return a.empresa.localeCompare(b.empresa);
    });

    var headers = ['Empresa', 'CNPJ', 'Mês de entrada', 'Data do 1º contrato'];
    function esc(v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(esc).join(';')];
    lista.forEach(function(e){
      var y = e.inicio.slice(0, 4);
      var mi = parseInt(e.inicio.slice(5, 7), 10) - 1;
      lines.push([e.empresa, e.cnpj || '', MONTH_ABBR[mi] + '/' + y, fmtDate(e.inicio)].map(esc).join(';'));
    });
    var csv = '﻿' + lines.join('\r\n');
    saveCsvString('novas_empresas_por_mes.csv', csv, fmtInt(lista.length) + ' empresa(s) exportada(s).');
  }

  var novosContratosMod = makeYearBarModule({
    dataKey: 'monthly',
    ids: { prev: 'novosYearPrev', next: 'novosYearNext', label: 'novosYearLabel', count: 'novosYearCount', indicator: 'novosIndicator', chart: 'novosMesChart', exportBtn: 'exportNovosMes' },
    itemLabel: 'novos contratos',
    csvFilename: 'novos_contratos_por_mes.csv',
    csvValueHeader: 'Novos contratos',
  });

  var novasEmpresasMod = makeYearBarModule({
    dataKey: 'novasEmpresas',
    ids: { prev: 'empresasMesYearPrev', next: 'empresasMesYearNext', label: 'empresasMesYearLabel', count: 'empresasMesYearCount', indicator: 'empresasMesIndicator', chart: 'empresasMesChart', exportBtn: 'exportEmpresasMes' },
    itemLabel: 'novas empresas',
    csvFilename: 'novas_empresas_por_mes.csv',
    csvValueHeader: 'Novas empresas',
    customExportCsv: exportNovasEmpresasDetalhe,
  });

  /* ================= FAIXA ETÁRIA ================= */
  var FAIXA_ETARIA_BUCKETS = OPC.faixasEtarias || [
    { faixa: '14-15 anos', min: 0, max: 16 },
    { faixa: '16-17 anos', min: 16, max: 18 },
    { faixa: '18-19 anos', min: 18, max: 20 },
    { faixa: '20-21 anos', min: 20, max: 22 },
    { faixa: '22-24 anos', min: 22, max: 25 },
    { faixa: '25+ anos', min: 25, max: Infinity },
  ];

  function renderFaixaEtaria() {
    var ativos = RECORDS.filter(function(r){ return r.situacao === 'Ativo'; });
    var counts = FAIXA_ETARIA_BUCKETS.map(function(){ return 0; });
    var semData = 0;
    ativos.forEach(function(r){
      var age = ageAt(r.nasc, TODAY_ISO);
      if (age === null || isNaN(age)) { semData++; return; }
      for (var i = 0; i < FAIXA_ETARIA_BUCKETS.length; i++) {
        var b = FAIXA_ETARIA_BUCKETS[i];
        if (age >= b.min && age < b.max) { counts[i]++; break; }
      }
    });
    var data = FAIXA_ETARIA_BUCKETS.map(function(b, i){ return { faixa: b.faixa, total: counts[i] }; });

    document.getElementById('faixaEtariaSub').textContent =
      'Idade hoje · só contratos ativos' + (semData > 0 ? ' · ' + fmtInt(semData) + ' sem data de nascimento' : '');
    // highlightKey: realça "18-19 anos" — junto com o mesmo realce em Rescisão
    // antecipada, chama atenção pro padrão de maior volume + maior índice.
    renderBars('faixaEtariaBars', data, 'faixa', 'total', { showPct: true, highlightKey: '18-19 anos' });
  }

  /* ================= MAIORES E MENORES DE IDADE =================
     24/08/2026, 2ª troca: virou barra empilhada horizontal — rosca ocupava
     altura grande no card e a legenda ao lado repetia info que já dá pra ler
     direto nos rótulos dentro da barra. Números absolutos + % continuam
     sempre visíveis (contexto legal da aprendizagem), e o total some
     centralizado abaixo da barra. Quando há menor de idade na base, um
     badge de alerta reforça a obrigação de acompanhamento. */
  function renderIdadeLegal() {
    var ativos = RECORDS.filter(function(r){ return r.situacao === 'Ativo'; });
    var menores = 0, maiores = 0, semData = 0;
    ativos.forEach(function(r){
      var age = ageAt(r.nasc, TODAY_ISO);
      if (age === null || isNaN(age)) { semData++; return; }
      if (age < 18) menores++; else maiores++;
    });
    var total = menores + maiores;

    document.getElementById('idadeLegalSub').textContent =
      'Idade hoje · só contratos ativos' + (semData > 0 ? ' · ' + fmtInt(semData) + ' sem data de nascimento' : '');

    var stackEl = document.getElementById('idadeLegalStack');

    if (total === 0) {
      stackEl.innerHTML = '<span style="color:var(--text-muted);font-size:12.5px;">Sem dados suficientes.</span>';
      return;
    }

    var pctMenor = menores / total * 100;
    var pctMaior = maiores / total * 100;

    var track = '<div class="idade-legal-track">';
    var catlabels = '<div class="idade-legal-catlabels">';
    if (menores > 0) {
      track += '<div class="idade-legal-seg menor" style="flex-basis:' + pctMenor.toFixed(2) + '%">' +
        '<span class="seg-value">' + fmtInt(menores) + '</span>' +
        '<span class="seg-pct">' + pctMenor.toFixed(1).replace('.', ',') + '%</span></div>';
      catlabels += '<span style="flex-basis:' + pctMenor.toFixed(2) + '%">Menores de 18 anos</span>';
    }
    if (maiores > 0) {
      track += '<div class="idade-legal-seg maior" style="flex-basis:' + pctMaior.toFixed(2) + '%">' +
        '<span class="seg-value">' + fmtInt(maiores) + '</span>' +
        '<span class="seg-pct">' + pctMaior.toFixed(1).replace('.', ',') + '%</span></div>';
      catlabels += '<span style="flex-basis:' + pctMaior.toFixed(2) + '%">Maiores de idade</span>';
    }
    track += '</div>';
    catlabels += '</div>';

    var totalLine = '<p class="idade-legal-total">' + fmtInt(total) + ' contratos ativos</p>';

    // Texto encurtado (24/08/2026, 3ª rodada) — a versão anterior ("N
    // aprendizes menores de idade — exige acompanhamento legal") quebrava
    // em 2 linhas com corte estranho em telas de card mais estreitas.
    var alertLine = menores > 0
      ? '<div class="idade-legal-alert"><span class="icon" aria-hidden="true">⚠️</span>' +
        '<span><strong>' + fmtInt(menores) + '</strong> menor' + (menores === 1 ? '' : 'es') +
        ' de idade — acomp. legal obrigatório</span></div>'
      : '';

    stackEl.innerHTML = track + catlabels + totalLine + alertLine;
  }

  /* ================= RESCISÃO ANTECIPADA POR IDADE DE ENTRADA =================
     Não dá pra calcular "idade na rescisão" de verdade (o campo "fim" guarda a
     data PREVISTA de encerramento, não a data real — ver nota em vigentesEmData()).
     Alternativa validada com Hudson em 22-23/08/2026: idade no INÍCIO do contrato,
     olhando só pra contratos que encerraram de fato de forma antecipada
     (Rescindido/Cancelado). Concluído NÃO entra aqui — decisão explícita do Hudson
     em 23/08/2026: se concluiu, cumpriu o ciclo todo e não é rescisão antecipada,
     nem como base de comparação. Isso faz esse gráfico ser uma DISTRIBUIÇÃO (em
     que faixa de idade de entrada mais aconteceram rescisões), não uma taxa de
     risco — não dá pra dizer que uma faixa "tem mais chance" de rescindir, só que
     concentra mais rescisões em volume (que pode ser efeito do volume total de
     contratos que começam ali, não de risco maior). Mesmo limite de 14–24 anos já
     usado em ANOMALIES.idade (Qualidade dos dados) é reaplicado aqui, pra ficar
     consistente com o que já é tratado como erro de cadastro no resto do painel. */
  var IDADE_RESCISAO_BUCKETS = [
    { faixa: '14-15 anos', min: 14, max: 16 },
    { faixa: '16-17 anos', min: 16, max: 18 },
    { faixa: '18-19 anos', min: 18, max: 20 },
    { faixa: '20-21 anos', min: 20, max: 22 },
    { faixa: '22-24 anos', min: 22, max: 25 },
  ];
  var DESFECHO_ANTECIPADO = ['Rescindido', 'Cancelado'];

  function renderIdadeRescisao() {
    var counts = IDADE_RESCISAO_BUCKETS.map(function(){ return 0; });
    var foraFaixa = 0, semData = 0;

    RECORDS.forEach(function(r){
      if (DESFECHO_ANTECIPADO.indexOf(r.situacao) === -1) return;
      var age = ageAt(r.nasc, r.inicio);
      if (age === null || isNaN(age)) { semData++; return; }
      if (age < 14 || age > 24) { foraFaixa++; return; }

      for (var i = 0; i < IDADE_RESCISAO_BUCKETS.length; i++) {
        var b = IDADE_RESCISAO_BUCKETS[i];
        if (age >= b.min && age < b.max) { counts[i]++; break; }
      }
    });

    var data = IDADE_RESCISAO_BUCKETS.map(function(b, i){ return { faixa: b.faixa, total: counts[i] }; });

    var extras = [];
    if (foraFaixa > 0) extras.push(fmtInt(foraFaixa) + ' fora da faixa 14–24 anos excluídos');
    if (semData > 0) extras.push(fmtInt(semData) + ' sem data de nascimento');
    document.getElementById('idadeRescisaoSub').textContent =
      'Idade no início do contrato · só contratos Rescindidos ou Cancelados' +
      (extras.length ? ' · ' + extras.join(' · ') : '');

    renderBars('idadeRescisaoBars', data, 'faixa', 'total', { showPct: true, highlightKey: '18-19 anos' });
  }

  // Cruza Faixa etária (ativos) com Rescisão antecipada pra destacar o padrão
  // de "18-19 anos" concentrar mais volume E mais rescisões ao mesmo tempo.
  // Recalcula os dois lados de forma independente (não reaproveita estado das
  // outras funções) pra não depender de ordem de chamada.
  function renderIdade1819Insight() {
    var el = document.getElementById('idade1819Insight');
    if (!el) return;

    var ativosComIdade = 0, ativos1819 = 0;
    RECORDS.forEach(function(r){
      if (r.situacao !== 'Ativo') return;
      var age = ageAt(r.nasc, TODAY_ISO);
      if (age === null || isNaN(age)) return;
      ativosComIdade++;
      if (age >= 18 && age < 20) ativos1819++;
    });

    var rescComIdade = 0, resc1819 = 0;
    RECORDS.forEach(function(r){
      if (DESFECHO_ANTECIPADO.indexOf(r.situacao) === -1) return;
      var age = ageAt(r.nasc, r.inicio);
      if (age === null || isNaN(age) || age < 14 || age > 24) return;
      rescComIdade++;
      if (age >= 18 && age < 20) resc1819++;
    });

    if (!ativosComIdade || !rescComIdade) { el.textContent = ''; return; }

    var pctAtivos = (ativos1819 / ativosComIdade * 100).toFixed(1).replace('.', ',');
    var pctResc = (resc1819 / rescComIdade * 100).toFixed(1).replace('.', ',');
    el.innerHTML = '18–19 anos concentra <b>' + pctAtivos + '%</b> dos contratos ativos e <b>' + pctResc + '%</b> das rescisões — maior volume e maior índice.';
  }

  /* ================= EMPRESAS: paginação ================= */
  var EMPRESA_PAGE_SIZE = 10;
  var empresaPage = 0;

  function renderEmpresaBars() {
    var all = AGG.topEmpresas || [];
    var totalPages = Math.max(1, Math.ceil(all.length / EMPRESA_PAGE_SIZE));
    if (empresaPage >= totalPages) empresaPage = totalPages - 1;
    if (empresaPage < 0) empresaPage = 0;

    var start = empresaPage * EMPRESA_PAGE_SIZE;
    var page = all.slice(start, start + EMPRESA_PAGE_SIZE);
    renderBars('empresaBars', page, 'empresa', 'total', {
      highlightFirst: empresaPage === 0, topCallout: true, showPct: true,
      maxRef: all.length ? all[0].total : 0
    });

    var end = Math.min(start + page.length, all.length);
    var sub = all.length
      ? 'Mostrando ' + fmtInt(start + 1) + '–' + fmtInt(end) + ' de ' + fmtInt(all.length) + ' · só contratos ativos'
      : 'Sem contratos ativos';
    document.getElementById('empresaBarsSub').textContent = sub;

    // dropdown "ir para página" — reconstrói as opções só quando o total de
    // páginas muda (base nova/exportação diferente), pra não perder o foco
    // do usuário toda hora que ele navega
    var select = document.getElementById('empresaPageSelect');
    if (select.getAttribute('data-total') !== String(totalPages)) {
      select.innerHTML = '';
      for (var p = 1; p <= totalPages; p++) {
        var opt = document.createElement('option');
        opt.value = String(p - 1);
        opt.textContent = 'Pág. ' + p;
        select.appendChild(opt);
      }
      select.setAttribute('data-total', String(totalPages));
    }
    select.value = String(empresaPage);
    document.getElementById('empresaPageTotal').textContent = 'de ' + fmtInt(totalPages);
    document.getElementById('empresaPagePrev').disabled = empresaPage === 0;
    document.getElementById('empresaPageNext').disabled = end >= all.length;
  }

  function bindEmpresaPagination() {
    document.getElementById('empresaPagePrev').addEventListener('click', function(){
      empresaPage -= 1;
      renderEmpresaBars();
    });
    document.getElementById('empresaPageNext').addEventListener('click', function(){
      empresaPage += 1;
      renderEmpresaBars();
    });
    document.getElementById('empresaPageSelect').addEventListener('change', function(){
      empresaPage = parseInt(this.value, 10);
      renderEmpresaBars();
    });
    document.getElementById('exportEmpresas').addEventListener('click', function(){
      exportEmpresaRanking();
    });
    document.getElementById('exportFuncoes').addEventListener('click', function(){
      exportFuncoes();
    });
    document.getElementById('exportVencArco').addEventListener('click', function(){
      exportVencimentoArco();
    });
  }

  function exportEmpresaRanking() {
    var all = AGG.topEmpresas || [];
    if (all.length === 0) { showToast('Nada pra exportar.'); return; }
    var headers = ['Posição', 'Empresa', 'Contratos ativos', '% do total ativo'];
    function esc(v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(esc).join(';')];
    all.forEach(function(e, i){
      lines.push([i + 1, e.empresa, e.total, String(e.pct).replace('.', ',') + '%'].map(esc).join(';'));
    });
    var csv = '﻿' + lines.join('\r\n');
    saveCsvString('ranking_empresas_' + ROT.arquivo + '.csv', csv, fmtInt(all.length) + ' empresas exportadas.');
  }

  function exportFuncoes() {
    var all = AGG.funcoesCompletas || [];
    if (all.length === 0) { showToast('Nada pra exportar.'); return; }
    var headers = [ROT.funcao, 'Contratos ativos', '% do total ativo'];
    function esc(v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(esc).join(';')];
    all.forEach(function(f){
      lines.push([f.funcao, f.total, String(f.pct).replace('.', ',') + '%'].map(esc).join(';'));
    });
    var csv = '﻿' + lines.join('\r\n');
    saveCsvString(ROT.arquivoFuncoes + '.csv', csv, fmtInt(all.length) + ' funções exportadas.');
  }

  /* ================= ARCO OCUPACIONAL =================
     23/08/2026: tentamos um gráfico de Pareto (barra + linha de % acumulado)
     pra resolver a concentração de 77,3% em "Auxiliar de Escritório", mas o
     Hudson achou que ficou ruim — único gráfico vertical/rotacionado do
     painel, poluído (grade + linha 80/20 + linha de acumulado + rótulo em
     cada ponto), e com dois rótulos truncados idênticos ("Auxiliar Admin…"
     pra duas funções diferentes). Voltou pro estilo de barra horizontal
     (mesma linguagem visual do resto do painel), mas só com as 3 funções
     mais frequentes + "Outras" (as outras 5 categorias, que somadas dão
     ~1,4%, viravam barrinhas ilegíveis). Reaproveita o mesmo destaque de
     concentração já usado em "Empresas com mais contratos" (topCallout). */
  var ARCO_TOP_N = 3;
  function renderArcoBars() {
    var data = AGG.funcoes || [];
    if (!data.length) return;

    var totalGeral = data.reduce(function(s, d){ return s + d.total; }, 0);
    var top = data.slice(0, ARCO_TOP_N);
    var restTotal = data.slice(ARCO_TOP_N).reduce(function(s, d){ return s + d.total; }, 0);
    var rows = top.map(function(d){ return { funcao: d.funcao, total: d.total }; });
    if (restTotal > 0) rows.push({ funcao: 'Outras', total: restTotal });
    rows.forEach(function(r){
      r.pct = totalGeral ? Math.round((r.total / totalGeral) * 1000) / 10 : 0;
    });

    renderBars('funcaoBars', rows, 'funcao', 'total', { highlightFirst: true, topCallout: true, showPct: true });
  }

  /* ================= VENCIMENTO POR ARCO OCUPACIONAL (25/08/2026) =================
     Pedido do Hudson: cruzar "Arco ocupacional" com "Alertas de vencimento" —
     quais funções concentram contratos vencendo/vencidos. Só contratos
     Ativos, 3 janelas de urgência mutuamente exclusivas (mesma lógica de
     classificação já usada em "Limite de idade", 3.9, sem o 4º nível ">90
     dias" — aqui só interessa o que precisa de atenção nos próximos 90 dias;
     a distribuição geral por função já existe em "Arco ocupacional", 3.4).
     Função sem nenhum contrato nessas janelas não entra na lista — é um
     gráfico de alerta, não um censo. */
  function vencimentoArcoData() {
    var ativos = RECORDS.filter(function(r){ return r.situacao === 'Ativo'; });
    var byFuncao = {};
    ativos.forEach(function(r){
      var dias = daysUntil(r.fim);
      if (isNaN(dias) || dias > 90) return; // fora da janela de alerta
      var bucket = dias < 0 ? 'vencido' : (dias <= 30 ? 'ate30' : 'ate90');
      var funcao = r.funcao || 'Não informado';
      if (!byFuncao[funcao]) byFuncao[funcao] = { funcao: funcao, vencido: 0, ate30: 0, ate90: 0, itens: [] };
      byFuncao[funcao][bucket] += 1;
      byFuncao[funcao].itens.push({ r: r, dias: dias });
    });
    var rows = Object.keys(byFuncao).map(function(k){ return byFuncao[k]; });
    rows.forEach(function(r){ r.total = r.vencido + r.ate30 + r.ate90; });
    // ordena sozinho por gravidade (maior total primeiro) — mesmo princípio
    // já usado em "Qualidade dos dados" (3.12), não precisa mexer no código
    // quando os números mudarem.
    rows.sort(function(a, b){ return b.total - a.total; });
    return rows;
  }

  // 2ª versão (31/08/2026) — explorador de abas + tabela, ver nota no bloco
  // CSS logo acima (#vencArcoTabs). vencArcoTab é o índice selecionado
  // dentro do array retornado por vencimentoArcoData() (já ordenado por
  // gravidade — maior total primeiro — então a aba 0 é sempre a pior).
  var vencArcoTab = 0;
  // Paginação (31/08/2026, ~02:30) — Hudson achou a lista muito grande pras
  // funções com muito contrato (ex.: 71 linhas de "Aprendizagem (genérico)"
  // de uma vez). Mesmo tamanho de página já usado em "Empresas por arco
  // ocupacional" (3.5, FUNC_EMP_PAGE_SIZE), reaproveitando o componente
  // visual .pagination já usado em "Consulta de contratos" (3.14).
  var VENC_ARCO_PAGE_SIZE = 15;
  var vencArcoPage = 1;

  function renderVencimentoArco() {
    var rows = vencimentoArcoData();
    var banner = document.getElementById('vencArcoAlertBanner');
    var tabsEl = document.getElementById('vencArcoTabs');
    var tbody = document.getElementById('vencArcoTable');
    var note = document.getElementById('vencArcoTableNote');

    if (!rows.length) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      tabsEl.innerHTML = '';
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum contrato ativo vencendo nos próximos 90 dias ou já vencido.</td></tr>';
      document.getElementById('vencArcoPagination').innerHTML = '';
      note.innerHTML = '';
      return;
    }

    if (vencArcoTab >= rows.length) vencArcoTab = 0;

    // Banner do topo — mantido do refinamento de 31/08/2026 (mesmo dia,
    // 6 pontos): fica visível sempre, independente da aba selecionada,
    // porque mostra o pior caso do painel inteiro (não só da aba aberta),
    // com ação recomendada.
    var top = rows[0];
    if (top.vencido > 0) {
      var pctVencido = Math.round((top.vencido / top.total) * 100);
      banner.style.display = 'flex';
      banner.innerHTML = '<span class="icon" aria-hidden="true">🚨</span>' +
        '<span>' + fmtInt(top.vencido) + ' de ' + fmtInt(top.total) + ' contratos de <b>"' + top.funcao + '"</b> já venceram (' + pctVencido + '%).' +
        '<span class="rec">Recomendado: verificar no sistema de origem se esses contratos possuem rescisão formal não importada.</span></span>';
    } else {
      banner.style.display = 'none';
      banner.innerHTML = '';
    }

    renderVencArcoTabs(rows);
    renderVencArcoTable(rows);
  }

  function renderVencArcoTabs(rows) {
    var el = document.getElementById('vencArcoTabs');
    el.innerHTML = rows.map(function(r, i){
      return '<button class="funcao-tab' + (i === vencArcoTab ? ' on' : '') + '" data-idx="' + i + '" type="button">' +
        r.funcao + ' <span class="count">(' + fmtInt(r.total) + ')</span></button>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.funcao-tab'), function(btn){
      btn.addEventListener('click', function(){
        vencArcoTab = parseInt(btn.getAttribute('data-idx'), 10);
        vencArcoPage = 1;
        var rows2 = vencimentoArcoData();
        renderVencArcoTabs(rows2);
        renderVencArcoTable(rows2);
      });
    });
  }

  function renderVencArcoTable(rows) {
    var tbody = document.getElementById('vencArcoTable');
    var pag = document.getElementById('vencArcoPagination');
    var note = document.getElementById('vencArcoTableNote');
    var r = rows[vencArcoTab];
    var itens = (r.itens || []).slice().sort(function(a, b){ return a.dias - b.dias; });

    var totalPages = Math.max(1, Math.ceil(itens.length / VENC_ARCO_PAGE_SIZE));
    if (vencArcoPage > totalPages) vencArcoPage = totalPages;
    if (vencArcoPage < 1) vencArcoPage = 1;
    var start = (vencArcoPage - 1) * VENC_ARCO_PAGE_SIZE;
    var pageItens = itens.slice(start, start + VENC_ARCO_PAGE_SIZE);

    tbody.innerHTML = pageItens.map(function(x){
      var info = diasSeverityColor(x.dias);
      return '<tr><td class="nome">' + toTitleCasePt(x.r.nome) + '</td><td class="empresa">' + x.r.empresa + '</td>' +
        '<td>' + fmtDate(x.r.fim) + '</td>' +
        '<td class="dias-cell" style="color:' + info.color + ';font-weight:700;">' + info.text + '</td></tr>';
    }).join('');

    if (totalPages <= 1) {
      pag.innerHTML = '';
    } else {
      pag.innerHTML =
        '<button id="vencArcoPrev" ' + (vencArcoPage <= 1 ? 'disabled' : '') + '>← Anterior</button>' +
        '<span>Página ' + vencArcoPage + ' de ' + totalPages + '</span>' +
        '<button id="vencArcoNext" ' + (vencArcoPage >= totalPages ? 'disabled' : '') + '>Próxima →</button>';
      var prevBtn = document.getElementById('vencArcoPrev');
      var nextBtn = document.getElementById('vencArcoNext');
      if (prevBtn) prevBtn.addEventListener('click', function(){ vencArcoPage -= 1; renderVencArcoTable(vencimentoArcoData()); });
      if (nextBtn) nextBtn.addEventListener('click', function(){ vencArcoPage += 1; renderVencArcoTable(vencimentoArcoData()); });
    }

    note.innerHTML = fmtInt(itens.length) + ' contrato' + (itens.length === 1 ? '' : 's') + ' de <b>"' + r.funcao + '"</b> vencendo nos próximos 90 dias ou já vencido' + (itens.length === 1 ? '' : 's') + '.';
  }

  function exportVencimentoArco() {
    var rows = vencimentoArcoData();
    if (!rows.length) { showToast('Nada pra exportar.'); return; }
    var r = rows[vencArcoTab] || rows[0];
    var itens = (r.itens || []).slice().sort(function(a, b){ return a.dias - b.dias; });
    if (itens.length === 0) { showToast('Nada pra exportar.'); return; }
    var headers = [ROT.funcao, ROT.pessoa, 'Empresa', 'Encerramento', 'Dias'];
    function esc(v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(esc).join(';')];
    itens.forEach(function(x){
      var diasLabel = x.dias < 0 ? ('vencido há ' + fmtInt(-x.dias) + ' dias') : (fmtInt(x.dias) + ' dias');
      lines.push([r.funcao, toTitleCasePt(x.r.nome), x.r.empresa, fmtDate(x.r.fim), diasLabel].map(esc).join(';'));
    });
    var csv = '﻿' + lines.join('\r\n');
    var fileSlug = r.funcao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    saveCsvString('vencimento_' + (fileSlug || 'arco') + '.csv', csv, fmtInt(itens.length) + ' contrato(s) exportado(s).');
  }

  /* ================= EMPRESAS POR FUNÇÃO ================= */
  // 15 (era 10) desde 23/08/2026 — reduz a paginação (ex.: 120 empresas de
  // "Auxiliar de Escritório" caem de 12 pra 8 páginas).
  var FUNC_EMP_PAGE_SIZE = 15;
  var funcaoEmpTab = 0;
  var funcaoEmpPage = 0;

  function renderFuncaoEmpTabs() {
    var data = AGG.empresasPorFuncao;
    if (!data || !data.funcoes || !data.funcoes.length) return;
    var el = document.getElementById('funcaoEmpTabs');
    el.innerHTML = data.funcoes.map(function(f, i){
      return '<button class="funcao-tab' + (i === funcaoEmpTab ? ' on' : '') + '" data-idx="' + i + '" type="button">' +
        f.funcao + ' <span class="count">(' + fmtInt(f.totalContratos) + ')</span></button>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.funcao-tab'), function(btn){
      btn.addEventListener('click', function(){
        funcaoEmpTab = parseInt(btn.getAttribute('data-idx'), 10);
        funcaoEmpPage = 0;
        renderFuncaoEmpTabs();
        renderFuncaoEmpBars();
      });
    });
  }

  function renderFuncaoEmpBars() {
    var data = AGG.empresasPorFuncao;
    if (!data || !data.funcoes || !data.funcoes.length) return;
    var f = data.funcoes[funcaoEmpTab];
    var all = f.empresas || [];
    var totalPages = Math.max(1, Math.ceil(all.length / FUNC_EMP_PAGE_SIZE));
    if (funcaoEmpPage >= totalPages) funcaoEmpPage = totalPages - 1;
    if (funcaoEmpPage < 0) funcaoEmpPage = 0;

    var start = funcaoEmpPage * FUNC_EMP_PAGE_SIZE;
    var page = all.slice(start, start + FUNC_EMP_PAGE_SIZE);
    renderBars('funcaoEmpBars', page, 'empresa', 'total', { highlightFirst: funcaoEmpPage === 0, showPct: true });

    var end = Math.min(start + page.length, all.length);
    var sub = 'Mostrando ' + fmtInt(start + 1) + '–' + fmtInt(end) + ' de ' + fmtInt(all.length) +
      ' empresas · ' + fmtInt(f.totalContratos) + ' contratos ativos em ' + f.funcao;
    if (funcaoEmpTab === 0 && data.excluidosBaixaAmostra > 0) {
      sub += ' · ' + fmtInt(data.excluidosBaixaAmostra) + ' contrato(s) em função(ões) muito raras não entram aqui';
    }
    document.getElementById('empresasPorFuncaoSub').textContent = sub;

    document.getElementById('funcaoEmpPageLabel').textContent = fmtInt(funcaoEmpPage + 1) + '/' + fmtInt(totalPages);
    document.getElementById('funcaoEmpPagePrev').disabled = funcaoEmpPage === 0;
    document.getElementById('funcaoEmpPageNext').disabled = end >= all.length;
  }

  function bindFuncaoEmpPagination() {
    document.getElementById('funcaoEmpPagePrev').addEventListener('click', function(){
      funcaoEmpPage -= 1;
      renderFuncaoEmpBars();
    });
    document.getElementById('funcaoEmpPageNext').addEventListener('click', function(){
      funcaoEmpPage += 1;
      renderFuncaoEmpBars();
    });
    document.getElementById('exportFuncaoEmp').addEventListener('click', function(){
      exportFuncaoEmpresas();
    });
  }

  function exportFuncaoEmpresas() {
    var data = AGG.empresasPorFuncao;
    if (!data || !data.funcoes || !data.funcoes.length) { showToast('Nada pra exportar.'); return; }
    var f = data.funcoes[funcaoEmpTab];
    var all = f.empresas || [];
    if (all.length === 0) { showToast('Nada pra exportar.'); return; }
    var headers = [ROT.funcao, 'Empresa', 'Contratos ativos'];
    function esc(v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(esc).join(';')];
    all.forEach(function(e){
      lines.push([f.funcao, e.empresa, e.total].map(esc).join(';'));
    });
    var csv = '﻿' + lines.join('\r\n');
    var slug = f.funcao.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    saveCsvString('empresas_' + slug + '.csv', csv, fmtInt(all.length) + ' empresas exportadas.');
  }

  /* ================= BAR LISTS ================= */
  function renderBars(containerId, data, labelKey, valueKey, opts) {
    opts = opts || {};
    var el = document.getElementById(containerId);
    // maxRef: referência fixa pra escala da barra (ex.: o maior valor de TODA a
    // lista, não só da página visível) — sem isso, uma lista paginada faz cada
    // página recalcular o próprio máximo, e um item pequeno sozinho numa página
    // (ex.: a última) acaba desenhado com barra de 100%, o que é enganoso.
    var max = opts.maxRef || Math.max.apply(null, data.map(function(d){return d[valueKey];}));
    // sum só é calculado quando showPct precisa dele pra tirar a média na hora —
    // se o item já vem com "pct" pronto do Python (caso de lista paginada, onde
    // a página visível não é a base de cálculo certa), usa esse valor direto.
    var sum = (opts.showPct && data.every(function(d){ return d.pct === undefined; }))
      ? data.reduce(function(s,d){ return s + d[valueKey]; }, 0) : 0;
    el.innerHTML = data.map(function(d, i){
      var pct = max ? (d[valueKey]/max*100) : 0;
      var isTop = opts.highlightFirst && i === 0;
      // highlightKey: dá um realce visual (anel na barra + nome em negrito) na
      // linha cujo label bate com esse valor — usado pra chamar atenção pra um
      // ponto específico do gráfico (ex.: "18-19 anos" em Faixa etária e em
      // Rescisão antecipada, que juntos mostram maior volume + maior índice).
      var isHl = opts.highlightKey && d[labelKey] === opts.highlightKey;
      var callout = (isTop && opts.topCallout && d.pct !== undefined)
        ? '<div class="callout">'+d.pct+'% dos contratos ativos estão concentrados em '+d[labelKey]+'</div>' : '';
      var valText = fmtInt(d[valueKey]);
      if (opts.showPct) {
        var sharePct = d.pct !== undefined ? d.pct : (sum ? (d[valueKey] / sum * 100) : 0);
        valText += ' (' + sharePct.toFixed(1) + '%)';
      }
      return '<div class="bar-row'+(isTop?' top':'')+(isHl?' hl':'')+'">' +
        '<span class="name" title="'+d[labelKey]+'"><span class="name-text">'+d[labelKey]+'</span></span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:'+pct.toFixed(1)+'%"></span></span>' +
        '<span class="val">'+valText+'</span>' +
        callout +
      '</div>';
    }).join('');
  }

  /* ================= VARIAÇÃO DE EMPRESAS (crescendo/diminuindo) ================= */
  function renderVariacaoBars(containerId, data, colorVar) {
    var el = document.getElementById(containerId);
    if (!data || data.length === 0) {
      el.innerHTML = '<div class="variacao-empty">Nenhuma empresa nessa situação no período.</div>';
      return;
    }
    var max = Math.max.apply(null, data.map(function(d){ return Math.abs(d.diff); }));
    el.innerHTML = data.map(function(d){
      // largura da barra é limitada a 78% da faixa, deixando espaço reservado
      // pro valor ficar colado na ponta dela, sem ser cortado nem sobrepor o nome
      var pct = max ? (Math.abs(d.diff) / max * 78) : 0;
      var sign = d.diff > 0 ? '+' : '';
      // seta reforça o sentido da variação sem depender só da cor verde/vermelho
      // (acessibilidade — daltonismo)
      var arrow = d.diff > 0 ? ' ↑' : ' ↓';
      return '<div class="bar-row variacao-row">' +
        '<span class="name" title="'+d.empresa+'"><span class="name-text">'+d.empresa+'</span></span>' +
        '<span class="bar-track">' +
          '<span class="bar-fill" style="width:'+pct.toFixed(1)+'%;background:'+colorVar+'"></span>' +
          '<span class="variacao-val" style="left:calc('+pct.toFixed(1)+'% + 8px);color:'+colorVar+'">'+sign+fmtInt(d.diff)+arrow+'</span>' +
        '</span>' +
      '</div>';
    }).join('');
  }

  function renderVariacaoBadges(novas, sumiram) {
    var el = document.getElementById('variacaoBadges');
    var html = '';
    if (novas && novas.length) {
      html += '<div class="variacao-badge-group">' +
        '<span class="variacao-badge-label">Novas empresas ativas</span>' +
        '<div class="variacao-badge-chips">' +
          novas.map(function(n){
            return '<span class="variacao-chip good">'+n.empresa+' <b>+'+fmtInt(n.ativosAgora)+' ↑</b></span>';
          }).join('') +
        '</div>' +
      '</div>';
    }
    if (sumiram && sumiram.length) {
      html += '<div class="variacao-badge-group">' +
        '<span class="variacao-badge-label">Saíram da base (zeraram)</span>' +
        '<div class="variacao-badge-chips">' +
          sumiram.map(function(n){
            return '<span class="variacao-chip critical">'+n.empresa+' <b>&minus;'+fmtInt(n.ativosAntes)+' ↓</b></span>';
          }).join('') +
        '</div>' +
      '</div>';
    }
    el.innerHTML = html;
  }

  // "vigente em D" é aproximado por início ≤ D ≤ fim — é a única forma de
  // reconstruir um ponto no passado sem depender de qual arquivo foi
  // carregado quando. Contrato Rescindido/Cancelado FICA DE FORA dessa
  // conta inteira (decisão com Hudson em 22/08/2026): a base guarda em
  // "fim" a data PREVISTA de encerramento, não a data real da rescisão
  // (validado com o dado: duração mediana idêntica à de um Concluído
  // normal) — então não dá pra saber até quando eles estiveram vigentes
  // de fato, e contá-los até o fim previsto inflava o período recente.
  var VIGENTE_SITUACOES = ['Ativo', 'Concluído', 'Aguardando Assinatura', 'Incluído'];
  var variacaoState = { gran: 'semestral', periodoA: null, periodoB: null, periodos: [] };

  function pad2(n) { return String(n).padStart(2, '0'); }
  function lastDayOfMonth(y, m) { return new Date(y, m, 0).getDate(); }

  function menorInicio() {
    var datas = RECORDS.map(function(r){ return r.inicio; }).filter(Boolean);
    return datas.length ? datas.reduce(function(a,b){ return b < a ? b : a; }) : null;
  }

  function gerarPeriodosSemestrais() {
    var minIni = menorInicio();
    if (!minIni) return [];
    var anoIni = parseInt(minIni.slice(0,4), 10);
    var semIni = parseInt(minIni.slice(5,7), 10) <= 6 ? 1 : 2;
    var anoHoje = parseInt(TODAY_ISO.slice(0,4), 10);
    var semHoje = parseInt(TODAY_ISO.slice(5,7), 10) <= 6 ? 1 : 2;
    var anoFim = anoHoje, semFim = semHoje - 1;
    if (semFim === 0) { semFim = 2; anoFim -= 1; }
    var fimMes = [6, 12];
    var periodos = [];
    var ano = anoIni, sem = semIni;
    while (ano < anoFim || (ano === anoFim && sem <= semFim)) {
      var mes = fimMes[sem-1];
      var dia = lastDayOfMonth(ano, mes);
      periodos.push({
        value: ano + '-S' + sem,
        label: 'S' + sem + '/' + ano,
        dataFim: ano + '-' + pad2(mes) + '-' + pad2(dia),
      });
      sem += 1;
      if (sem > 2) { sem = 1; ano += 1; }
    }
    return periodos;
  }

  function gerarPeriodosAnuais() {
    var minIni = menorInicio();
    if (!minIni) return [];
    var anoIni = parseInt(minIni.slice(0,4), 10);
    var anoHoje = parseInt(TODAY_ISO.slice(0,4), 10);
    var anoFim = anoHoje - 1; // o ano corrente ainda não fechou
    var periodos = [];
    for (var ano = anoIni; ano <= anoFim; ano++) {
      periodos.push({
        value: String(ano),
        label: String(ano),
        dataFim: ano + '-12-31',
      });
    }
    return periodos;
  }

  function vigentesEmData(dataISO) {
    var counts = {};
    RECORDS.forEach(function(r){
      if (VIGENTE_SITUACOES.indexOf(r.situacao) === -1) return;
      if (r.inicio <= dataISO && dataISO <= r.fim) {
        counts[r.empresa] = (counts[r.empresa] || 0) + 1;
      }
    });
    return counts;
  }

  function periodoByValue(value) {
    return variacaoState.periodos.filter(function(p){ return p.value === value; })[0];
  }

  function populatePeriodoSelects() {
    var periodos = variacaoState.gran === 'anual' ? gerarPeriodosAnuais() : gerarPeriodosSemestrais();
    variacaoState.periodos = periodos;
    var selA = document.getElementById('variacaoPeriodoA');
    var selB = document.getElementById('variacaoPeriodoB');
    var optsHtml = periodos.map(function(p){ return '<option value="'+p.value+'">'+p.label+'</option>'; }).join('');
    selA.innerHTML = optsHtml;
    selB.innerHTML = optsHtml;
    if (periodos.length >= 2) {
      selA.value = periodos[periodos.length - 2].value;
      selB.value = periodos[periodos.length - 1].value;
    } else if (periodos.length === 1) {
      selA.value = selB.value = periodos[0].value;
    }
    variacaoState.periodoA = selA.value;
    variacaoState.periodoB = selB.value;
  }

  function computeVariacao() {
    var pA = periodoByValue(variacaoState.periodoA);
    var pB = periodoByValue(variacaoState.periodoB);
    if (!pA || !pB) return null;
    var contA = vigentesEmData(pA.dataFim);
    var contB = vigentesEmData(pB.dataFim);
    var todasEnvolvidas = {};
    Object.keys(contA).forEach(function(e){ todasEnvolvidas[e] = true; });
    Object.keys(contB).forEach(function(e){ todasEnvolvidas[e] = true; });
    var variacoes = Object.keys(todasEnvolvidas).map(function(e){
      var antes = contA[e] || 0, agora = contB[e] || 0;
      return { empresa: e, ativosAntes: antes, ativosAgora: agora, diff: agora - antes };
    });
    var crescendo = variacoes.filter(function(v){ return v.ativosAntes > 0 && v.diff > 0; })
      .sort(function(a,b){ return b.diff - a.diff; }).slice(0, 10);
    var diminuindo = variacoes.filter(function(v){ return v.ativosAgora > 0 && v.diff < 0; })
      .sort(function(a,b){ return a.diff - b.diff; }).slice(0, 10);
    var novasAtivas = variacoes.filter(function(v){ return v.ativosAntes === 0 && v.ativosAgora > 0; })
      .sort(function(a,b){ return b.ativosAgora - a.ativosAgora; });
    var sumiram = variacoes.filter(function(v){ return v.ativosAntes > 0 && v.ativosAgora === 0; })
      .sort(function(a,b){ return b.ativosAntes - a.ativosAntes; });
    var todas = variacoes.slice().sort(function(a,b){ return b.diff - a.diff; });
    return { crescendo: crescendo, diminuindo: diminuindo, novasAtivas: novasAtivas, sumiram: sumiram, todas: todas, periodoA: pA, periodoB: pB };
  }

  var variacaoAtual = null;

  function renderVariacaoEmpresas() {
    variacaoAtual = computeVariacao();
    var exportBtn = document.getElementById('exportVariacao');
    if (!variacaoAtual) {
      document.getElementById('variacaoSub').textContent = 'Sem períodos suficientes pra comparar ainda.';
      exportBtn.disabled = true;
      return;
    }
    exportBtn.disabled = false;
    exportBtn.title = 'Baixa a lista completa de empresas (crescendo e diminuindo) em Excel/CSV';
    document.getElementById('variacaoSub').textContent =
      'Contratos vigentes por empresa (início–fim do contrato) · ' + variacaoAtual.periodoA.label + ' → ' + variacaoAtual.periodoB.label;
    renderVariacaoBars('variacaoCrescBars', variacaoAtual.crescendo, 'var(--status-good)');
    renderVariacaoBars('variacaoDiminBars', variacaoAtual.diminuindo, 'var(--status-critical)');
    renderVariacaoBadges(variacaoAtual.novasAtivas, variacaoAtual.sumiram);
  }

  function bindVariacaoControls() {
    document.querySelectorAll('#variacaoGranularidade .chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        document.querySelectorAll('#variacaoGranularidade .chip').forEach(function(c){ c.classList.remove('on'); });
        chip.classList.add('on');
        variacaoState.gran = chip.getAttribute('data-gran');
        populatePeriodoSelects();
        renderVariacaoEmpresas();
      });
    });
    document.getElementById('variacaoPeriodoA').addEventListener('change', function(){
      variacaoState.periodoA = this.value;
      renderVariacaoEmpresas();
    });
    document.getElementById('variacaoPeriodoB').addEventListener('change', function(){
      variacaoState.periodoB = this.value;
      renderVariacaoEmpresas();
    });
  }

  function bindVariacaoExport() {
    document.getElementById('exportVariacao').addEventListener('click', function(){
      exportVariacaoEmpresas();
    });
  }

  function exportVariacaoEmpresas() {
    var v = variacaoAtual;
    var all = (v && v.todas) || [];
    if (all.length === 0) { showToast('Nada pra exportar.'); return; }
    var headers = ['Empresa', 'Vigentes em ' + v.periodoA.label, 'Vigentes em ' + v.periodoB.label, 'Diferença'];
    function esc(val) {
      val = (val === null || val === undefined) ? '' : String(val);
      if (/[",;\n]/.test(val)) val = '"' + val.replace(/"/g, '""') + '"';
      return val;
    }
    var lines = [headers.map(esc).join(';')];
    all.forEach(function(e){
      lines.push([e.empresa, e.ativosAntes, e.ativosAgora, e.diff].map(esc).join(';'));
    });
    var csv = '﻿' + lines.join('\r\n');
    saveCsvString('variacao_empresas_' + ROT.arquivo + '.csv', csv, fmtInt(all.length) + ' empresas exportadas.');
  }

  /* ================= VENCIMENTOS =================
     O clique nos cards filtra a lista logo abaixo deles, não a tabela de
     "Consulta de contratos" lá embaixo (decisão de 23/08/2026 a pedido do
     Hudson — antes o clique rolava a tela até uma tabela 8 seções abaixo,
     e essa prévia aqui do lado nem reagia ao clique). Sem card selecionado,
     mostra uma amostra dos mais urgentes dos dois grupos; com um card
     selecionado, mostra a lista inteira daquela janela + Excel exporta
     exatamente o que está na tela no momento. */
  var vencLocal = { tipo: null, janela: null }; // tipo: 'vencer' | 'vencido' | null
  var vencLocalRows = []; // o que está mostrado agora — é o que o botão Excel exporta

  function renderVencimentos() {
    var ativos = RECORDS.filter(function(r){ return r.situacao === 'Ativo'; });
    // uma lista só, com sinal: dias negativo = já vencido, positivo/zero = a
    // vencer.
    var todos = ativos.map(function(r){
      return { r: r, dias: daysUntil(r.fim) };
    }).filter(function(x){ return !isNaN(x.dias); });

    var withDays = todos.filter(function(x){ return x.dias >= 0; });
    var vencidos = todos.filter(function(x){ return x.dias < 0; });
    withDays.sort(function(a,b){ return a.dias - b.dias; });
    vencidos.sort(function(a,b){ return a.dias - b.dias; });

    var totalAtivos = ativos.length;
    function pctOf(n) { return totalAtivos ? (n / totalAtivos * 100).toFixed(1).replace('.', ',') + '% dos ativos' : ''; }

    var c30 = withDays.filter(function(x){ return x.dias <= 30; }).length;
    var c60 = withDays.filter(function(x){ return x.dias <= 60; }).length;
    var c90 = withDays.filter(function(x){ return x.dias <= 90; }).length;
    document.getElementById('alert30').textContent = fmtInt(c30);
    document.getElementById('alert60').textContent = fmtInt(c60);
    document.getElementById('alert90').textContent = fmtInt(c90);
    document.getElementById('alert30Pct').textContent = pctOf(c30);
    document.getElementById('alert60Pct').textContent = pctOf(c60);
    document.getElementById('alert90Pct').textContent = pctOf(c90);

    var v30 = vencidos.filter(function(x){ return -x.dias <= 30; }).length;
    var v60 = vencidos.filter(function(x){ return -x.dias <= 60; }).length;
    var v90 = vencidos.filter(function(x){ return -x.dias <= 90; }).length;
    document.getElementById('vencido30').textContent = fmtInt(v30);
    document.getElementById('vencido60').textContent = fmtInt(v60);
    document.getElementById('vencido90').textContent = fmtInt(v90);
    document.getElementById('vencido30Pct').textContent = pctOf(v30);
    document.getElementById('vencido60Pct').textContent = pctOf(v60);
    document.getElementById('vencido90Pct').textContent = pctOf(v90);

    var tbody = document.getElementById('venceTable');
    var note = document.getElementById('venceTableNote');
    var top, noteHtml;

    if (vencLocal.tipo) {
      // card selecionado: lista inteira daquela janela, sem cortar
      var fonte = vencLocal.tipo === 'vencer' ? withDays : vencidos;
      top = fonte.filter(function(x){ return Math.abs(x.dias) <= vencLocal.janela; });
      var rotulo = vencLocal.tipo === 'vencer'
        ? 'vencem em até ' + vencLocal.janela + ' dias'
        : 'estão vencidos há até ' + vencLocal.janela + ' dias';
      noteHtml = 'Mostrando ' + fmtInt(top.length) + ' contrato' + (top.length === 1 ? '' : 's') + ' que ' + rotulo + '.' +
        ' <button type="button" class="reset-link" id="vencClearFilter">× limpar filtro</button>';
    } else {
      // sem filtro: amostra dos mais urgentes dos dois grupos — reserva
      // metade das linhas pra cada (com backfill se um grupo tiver menos
      // que isso), senão um grupo inteiro some da amostra quando o outro
      // tem muito mais registros.
      var LIMITE_PREVIEW = 12;
      var metade = Math.ceil(LIMITE_PREVIEW / 2);
      var topVencidos = vencidos.slice(0, metade);
      var topAVencer = withDays.slice(0, LIMITE_PREVIEW - topVencidos.length);
      if (topVencidos.length + topAVencer.length < LIMITE_PREVIEW) {
        topVencidos = vencidos.slice(0, LIMITE_PREVIEW - topAVencer.length);
      }
      top = topVencidos.concat(topAVencer);
      // não esconde silenciosamente quem ficou de fora — clicar num card
      // acima traz a lista inteira daquela janela, sem corte
      noteHtml = todos.length > top.length
        ? 'Mostrando ' + fmtInt(top.length) + ' de ' + fmtInt(todos.length) + ' (' + fmtInt(vencidos.length) + ' vencidos, ' + fmtInt(withDays.length) + ' a vencer) — clique num card acima pra ver a lista completa de uma janela.'
        : '';
    }

    vencLocalRows = top;

    if (top.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum contrato ativo com encerramento à vista' + (vencLocal.tipo ? ' nessa janela.' : '.') + '</td></tr>';
    } else {
      tbody.innerHTML = top.map(function(x){
        var info = diasSeverityColor(x.dias);
        return '<tr><td class="nome">'+toTitleCasePt(x.r.nome)+'</td><td class="empresa">'+x.r.empresa+'</td>' +
          '<td>'+fmtDate(x.r.fim)+'</td>' +
          '<td class="dias-cell" style="color:'+info.color+';font-weight:700;">'+info.text+'</td></tr>';
      }).join('');
    }
    note.innerHTML = noteHtml;
    var clearBtn = document.getElementById('vencClearFilter');
    if (clearBtn) clearBtn.addEventListener('click', function(){ setVencLocalFilter(null, null); });
  }

  function setVencLocalFilter(tipo, janela) {
    vencLocal.tipo = tipo;
    vencLocal.janela = janela;
    document.querySelectorAll('.alert-tile[data-window], .alert-tile[data-vencido-window]').forEach(function(t){ t.classList.remove('active-filter'); });
    if (tipo === 'vencer') {
      var elA = document.querySelector('.alert-tile[data-window="'+janela+'"]');
      if (elA) elA.classList.add('active-filter');
    } else if (tipo === 'vencido') {
      var elV = document.querySelector('.alert-tile[data-vencido-window="'+janela+'"]');
      if (elV) elV.classList.add('active-filter');
    }
    renderVencimentos();
  }

  function exportVencimentos() {
    if (vencLocalRows.length === 0) { showToast('Nada pra exportar.'); return; }
    var headers = [ROT.pessoa, 'Empresa', 'CPF', 'Contrato', 'Encerramento', 'Dias'];
    function esc(v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(esc).join(';')];
    vencLocalRows.forEach(function(x){
      var diasLabel = x.dias < 0 ? ('vencido há ' + fmtInt(-x.dias) + ' dias') : (fmtInt(x.dias) + ' dias');
      lines.push([toTitleCasePt(x.r.nome), x.r.empresa, x.r.cpf, x.r.contrato, fmtDate(x.r.fim), diasLabel].map(esc).join(';'));
    });
    var csv = '﻿' + lines.join('\r\n');
    var filename = vencLocal.tipo === 'vencer' ? 'contratos_vencem_ate_' + vencLocal.janela + 'dias.csv'
      : vencLocal.tipo === 'vencido' ? 'contratos_vencidos_ha_ate_' + vencLocal.janela + 'dias.csv'
      : 'alertas_vencimento_amostra.csv';
    saveCsvString(filename, csv, fmtInt(vencLocalRows.length) + ' contrato(s) exportado(s).');
  }

  /* ================= LIMITE DE IDADE (24 ANOS) =================
     A Lei da Aprendizagem limita o contrato até os 24 anos do aprendiz,
     exceto PCD (dado que não existe nesta base). Quando a data em que o
     aprendiz completa 24 anos é ANTERIOR ao fim contratado, o contrato
     precisa de rescisão antecipada — não vai rodar até a data cheia. */
  function dataAos24(nascIso) {
    if (!nascIso) return null;
    var p = nascIso.split('-');
    if (p.length !== 3) return null;
    return (parseInt(p[0], 10) + 24) + '-' + p[1] + '-' + p[2];
  }

  function idade24Info(r) {
    if (r.situacao !== 'Ativo' || !r.nasc || !r.fim) return null;
    var d24 = dataAos24(r.nasc);
    if (!d24) return null;
    if (!(d24 < r.fim)) return null;
    return { d24: d24, dias: daysUntil(d24) };
  }

  // Igual à seção de vencimento (decisão de 23/08/2026): clique num card
  // filtra a lista local abaixo dele, não a tabela de "Consulta de
  // contratos" — ver setIdade24Filter() e os cliques mais abaixo.
  var idade24Local = { tipo: null }; // 'total' | 'vencido' | '90' | '180' | null (null = mostra tudo, sem destaque)
  var idade24LocalRows = [];

  function renderLimiteIdade() {
    var ativos = RECORDS.filter(function(r){ return r.situacao === 'Ativo'; });
    var items = [];
    ativos.forEach(function(r){
      var info = idade24Info(r);
      if (info) items.push({ r: r, info: info });
    });
    items.sort(function(a,b){ return a.info.dias - b.info.dias; });

    var vencido = items.filter(function(x){ return x.info.dias < 0; }).length;
    var em90 = items.filter(function(x){ return x.info.dias >= 0 && x.info.dias <= 90; }).length;
    var em180 = items.filter(function(x){ return x.info.dias >= 0 && x.info.dias <= 180; }).length;
    document.getElementById('idade24Total').textContent = fmtInt(items.length);
    document.getElementById('idade24Vencido').textContent = fmtInt(vencido);
    document.getElementById('idade24em90').textContent = fmtInt(em90);
    document.getElementById('idade24em180').textContent = fmtInt(em180);

    var tipo = idade24Local.tipo;
    var filtered = items;
    var rotulo = 'com rescisão obrigatória por limite de idade';
    if (tipo === 'vencido') {
      filtered = items.filter(function(x){ return x.info.dias < 0; });
      rotulo = 'que já deveriam ter sido rescindidos';
    } else if (tipo === '90') {
      filtered = items.filter(function(x){ return x.info.dias >= 0 && x.info.dias <= 90; });
      rotulo = 'que completam 24 anos em até 90 dias';
    } else if (tipo === '180') {
      filtered = items.filter(function(x){ return x.info.dias >= 0 && x.info.dias <= 180; });
      rotulo = 'que completam 24 anos em até 180 dias';
    }
    idade24LocalRows = filtered;

    var tbody = document.getElementById('idade24Table');
    var note = document.getElementById('idade24TableNote');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum contrato ' + (tipo ? 'nessa janela.' : 'ativo com fim contratado além dos 24 anos do aprendiz.') + '</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(function(x){
        var dias = x.info.dias;
        var sitHtml;
        if (dias < 0) {
          var diasV = -dias;
          sitHtml = '<span style="color:var(--dias-urgente);font-weight:700;">vencido há '+fmtInt(diasV)+' '+(diasV===1?'dia':'dias')+'</span>';
        } else {
          // Reaproveita a escala --dias-* já usada em "Dias p/ vencer" da Consulta
          // de contratos (mesma paleta, mesmo contraste já verificado) — aqui com
          // limiares diferentes: ≤30 dias é o mais urgente pra rescisão por idade.
          var sev = dias <= 30 ? 'var(--dias-atencao)' : (dias <= 90 ? 'var(--dias-preventivo)' : 'var(--text-secondary)');
          sitHtml = '<span style="color:'+sev+';font-weight:700;">em '+fmtInt(dias)+' '+(dias===1?'dia':'dias')+'</span>';
        }
        return '<tr><td class="nome">'+x.r.nome+'</td><td class="empresa">'+x.r.empresa+'</td>' +
          '<td>'+fmtDate(x.info.d24)+'</td>' +
          '<td>'+fmtDate(x.r.fim)+'</td>' +
          '<td>'+sitHtml+'</td></tr>';
      }).join('');
    }
    note.innerHTML = tipo
      ? 'Mostrando ' + fmtInt(filtered.length) + ' contrato' + (filtered.length === 1 ? '' : 's') + ' ' + rotulo + '.' +
        ' <button type="button" class="reset-link" id="idade24ClearFilter">× limpar filtro</button>'
      : '';
    var clearBtn = document.getElementById('idade24ClearFilter');
    if (clearBtn) clearBtn.addEventListener('click', function(){ setIdade24Filter(null); });
  }

  function setIdade24Filter(tipo) {
    idade24Local.tipo = tipo;
    document.querySelectorAll('.alert-tile[data-idade-window]').forEach(function(t){ t.classList.remove('active-filter'); });
    if (tipo) {
      var el = document.querySelector('.alert-tile[data-idade-window="'+tipo+'"]');
      if (el) el.classList.add('active-filter');
    }
    renderLimiteIdade();
  }

  function exportIdade24() {
    if (idade24LocalRows.length === 0) { showToast('Nada pra exportar.'); return; }
    var headers = ['Aprendiz', 'Empresa', 'CPF', 'Contrato', 'Completa 24 anos em', 'Fim contratado', 'Situação'];
    function esc(v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(esc).join(';')];
    idade24LocalRows.forEach(function(x){
      var dias = x.info.dias;
      var sitLabel = dias < 0 ? ('vencido há ' + fmtInt(-dias) + ' dias') : ('em ' + fmtInt(dias) + ' dias');
      lines.push([x.r.nome, x.r.empresa, x.r.cpf, x.r.contrato, fmtDate(x.info.d24), fmtDate(x.r.fim), sitLabel].map(esc).join(';'));
    });
    var csv = '﻿' + lines.join('\r\n');
    var filename = idade24Local.tipo ? 'limite_24anos_' + idade24Local.tipo + '.csv' : 'limite_24anos_total.csv';
    saveCsvString(filename, csv, fmtInt(idade24LocalRows.length) + ' contrato(s) exportado(s).');
  }

  /* ================= FILTER STATE ================= */
  // Padrão agora é só "Ativo" (24/08/2026, a pedido do Hudson) — a versão
  // anterior vinha com todos os status marcados e ordenava por "Início"
  // mais recente primeiro, o que empurrava contratos "Aguardando
  // Assinatura" (que costumam ser os mais novos) pro topo da lista e virava
  // ruído no acompanhamento do dia a dia. "Limpar filtros" continua
  // voltando pra TODOS os status (ver função abaixo), não só Ativo — é o
  // botão que existe justamente pra quando alguém quer ver tudo.
  var state = {
    situacoes: new Set(['Ativo']),
    empresa: '',
    funcao: '',
    search: '',
    anomalyFilter: null,
    // vencimentoWindow/vencidoWindow: não são mais setados por nenhum clique
    // (23/08/2026) — os cards de "Alertas de vencimento" agora filtram a
    // lista local da própria seção (var vencLocal, perto de renderVencimentos),
    // não mais esta tabela. Ficam aqui só porque getFiltered()/countLabel/
    // export ainda os checam; sempre null na prática, sem efeito na tela.
    vencimentoWindow: null,
    vencidoWindow: null,
    idade24Window: null,
    sortKey: 'inicio',
    sortDir: -1,
    page: 1,
    pageSize: 25
  };

  function buildEmpresaOptions() {
    var sel = document.getElementById('empresaFilter');
    var empresas = Array.from(new Set(RECORDS.map(function(r){return r.empresa;}))).sort(function(a,b){return a.localeCompare(b,'pt-BR');});
    empresas.forEach(function(e){
      var opt = document.createElement('option');
      opt.value = e; opt.textContent = e;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function(){ state.empresa = this.value; state.page = 1; render(); });
  }

  // Igual ao dropdown de empresa acima, só que pra função (24/08/2026, a
  // pedido do Hudson — filtro refinado além da busca livre).
  function buildFuncaoOptions() {
    var sel = document.getElementById('funcaoFilter');
    var funcoes = Array.from(new Set(RECORDS.map(function(r){return r.funcao;}))).sort(function(a,b){return a.localeCompare(b,'pt-BR');});
    funcoes.forEach(function(f){
      var opt = document.createElement('option');
      opt.value = f; opt.textContent = f;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function(){ state.funcao = this.value; state.page = 1; render(); });
  }

  // Rótulo curto pros 2 chips mais longos (24/08/2026) — "Aguardando
  // Assinatura" e "Contrato Excluído" eram os que mais quebravam a largura
  // da linha; o texto completo continua acessível no title (hover/leitor
  // de tela). Os demais já eram curtos o bastante.
  var CHIP_LABEL = {
    'Aguardando Assinatura': 'A assinar',
    'Contrato Excluído': 'Excluído'
  };

  function buildChips() {
    var el = document.getElementById('situacaoChips');
    el.innerHTML = SIT_ORDER.map(function(s){
      var col = STATUS_COLOR[s].c;
      var on = state.situacoes.has(s) ? ' on' : '';
      var label = CHIP_LABEL[s] || s;
      return '<button class="chip'+on+'" data-s="'+s+'" title="'+s+'" style="--c:'+col+'"><span class="dot"></span>'+label+'</button>';
    }).join('');
    el.querySelectorAll('.chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        var s = this.getAttribute('data-s');
        if (state.situacoes.has(s)) { state.situacoes.delete(s); this.classList.remove('on'); }
        else { state.situacoes.add(s); this.classList.add('on'); }
        state.page = 1;
        render();
      });
    });
  }

  function getFiltered() {
    var q = normStr(state.search.trim());
    var base = state.anomalyFilter ? ANOMALIES[state.anomalyFilter].records : RECORDS;
    return base.filter(function(r){
      if (!state.situacoes.has(r.situacao)) return false;
      if (state.empresa && r.empresa !== state.empresa) return false;
      if (state.funcao && r.funcao !== state.funcao) return false;
      if (state.vencimentoWindow) {
        if (r.situacao !== 'Ativo') return false;
        var d = daysUntil(r.fim);
        if (d < 0 || d > state.vencimentoWindow) return false;
      }
      if (state.vencidoWindow) {
        if (r.situacao !== 'Ativo') return false;
        var dv = daysUntil(r.fim);
        if (dv >= 0 || -dv > state.vencidoWindow) return false;
      }
      if (state.idade24Window) {
        var info = idade24Info(r);
        if (!info) return false;
        if (state.idade24Window === 'vencido') {
          if (info.dias >= 0) return false;
        } else if (state.idade24Window !== 'total') {
          if (info.dias < 0 || info.dias > state.idade24Window) return false;
        }
      }
      if (q) {
        var hay = normStr(r.nome + ' ' + r.empresa + ' ' + r.funcao + ' ' + r.cpf + ' ' + r.contrato);
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function sortRecords(list) {
    var k = state.sortKey, dir = state.sortDir;
    return list.slice().sort(function(a,b){
      var av = a[k] || '', bv = b[k] || '';
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function pillHtml(situacao) {
    var col = STATUS_COLOR[situacao] || { c: 'var(--accent)', wash: 'var(--accent-wash)' };
    return '<span class="pill" style="--p-color:'+col.c+';--p-wash:'+col.wash+'"><span class="dot"></span>'+situacao+'</span>';
  }

  function diasVencerHtml(r) {
    if (r.situacao !== 'Ativo') return '<span class="no-data" title="Não se aplica — contrato não está ativo">—</span>';
    var info = diasSeverityColor(daysUntil(r.fim));
    return '<span style="color:'+info.color+'">'+info.text+'</span>';
  }

  function renderTable() {
    var filtered = sortRecords(getFiltered());
    var total = filtered.length;
    var countLabel = fmtInt(total) + ' de ' + fmtInt(RECORDS.length) + ' contratos';
    if (state.anomalyFilter) countLabel += ' · filtro: ' + ANOMALIES[state.anomalyFilter].label.toLowerCase();
    if (state.vencimentoWindow) countLabel += ' · vence em até ' + state.vencimentoWindow + ' dias';
    if (state.vencidoWindow) countLabel += ' · vencido há até ' + state.vencidoWindow + ' dias';
    if (state.idade24Window === 'vencido') countLabel += ' · limite de 24 anos já vencido';
    else if (state.idade24Window === 'total') countLabel += ' · rescisão obrigatória por limite de idade';
    else if (state.idade24Window) countLabel += ' · completa 24 anos em até ' + state.idade24Window + ' dias';
    document.getElementById('resultCount').textContent = countLabel;

    var pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    var startIdx = (state.page - 1) * state.pageSize;
    var pageItems = filtered.slice(startIdx, startIdx + state.pageSize);

    var tbody = document.getElementById('mainTable');
    var emptyState = document.getElementById('emptyState');
    if (pageItems.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      tbody.innerHTML = pageItems.map(function(r){
        return '<tr>' +
          '<td class="nome">'+r.nome+'</td>' +
          '<td class="empresa" title="'+r.empresa+' · CNPJ '+r.cnpj+'">'+r.empresa+'</td>' +
          '<td class="mono">'+r.contrato+'</td>' +
          '<td>'+r.funcao+'</td>' +
          '<td>'+pillHtml(r.situacao)+'</td>' +
          '<td>'+fmtDate(r.inicio)+'</td>' +
          '<td>'+fmtDate(r.fim)+'</td>' +
          '<td class="dias-cell">'+diasVencerHtml(r)+'</td>' +
          '</tr>';
      }).join('');
    }

    document.querySelectorAll('#mainTable').forEach(function(){});
    var pag = document.getElementById('pagination');
    if (pages <= 1) {
      pag.innerHTML = '';
    } else {
      pag.innerHTML =
        '<button id="prevPage" '+(state.page<=1?'disabled':'')+'>← Anterior</button>' +
        '<span>Página '+state.page+' de '+pages+'</span>' +
        '<button id="nextPage" '+(state.page>=pages?'disabled':'')+'>Próxima →</button>';
      var prev = document.getElementById('prevPage');
      var next = document.getElementById('nextPage');
      // Antes o "Anterior" dava scrollTo(top:0) — jogava a página inteira lá
      // pro topo do painel em vez de só voltar a página da tabela (bug
      // reportado pelo Hudson, 12/09/2026). Tirado: agora os dois botões só
      // trocam de página, sem mexer no scroll — igual o "Próxima" já fazia.
      if (prev) prev.addEventListener('click', function(){ state.page--; renderTable(); });
      if (next) next.addEventListener('click', function(){ state.page++; renderTable(); });
    }

    document.querySelectorAll('thead th[data-key]').forEach(function(th){
      th.classList.toggle('sorted', th.getAttribute('data-key') === state.sortKey);
      var arrow = th.querySelector('.arrow');
      if (th.getAttribute('data-key') === state.sortKey) {
        arrow.textContent = state.sortDir === 1 ? '▴' : '▾';
      } else {
        arrow.textContent = '▾';
      }
    });
  }

  function bindTableEvents() {
    document.querySelectorAll('thead th[data-key]').forEach(function(th){
      th.addEventListener('click', function(){
        var k = this.getAttribute('data-key');
        if (state.sortKey === k) { state.sortDir *= -1; }
        else { state.sortKey = k; state.sortDir = 1; }
        renderTable();
      });
    });

    var searchInput = document.getElementById('search');
    var debounceTimer;
    searchInput.addEventListener('input', function(){
      clearTimeout(debounceTimer);
      var val = this.value;
      debounceTimer = setTimeout(function(){
        state.search = val; state.page = 1; renderTable();
      }, 120);
    });

    var pageSizeSelect = document.getElementById('pageSizeSelect');
    pageSizeSelect.addEventListener('change', function(){
      state.pageSize = parseInt(this.value, 10);
      state.page = 1;
      renderTable();
    });

    // "Limpar filtros" volta pra TODOS os status (não só o padrão "Ativo")
    // — é o botão que existe justamente pra quando alguém quer ver a base
    // inteira sem nenhum filtro aplicado.
    document.getElementById('resetFilters').addEventListener('click', function(){
      state.situacoes = new Set(SIT_ORDER);
      state.empresa = '';
      state.funcao = '';
      state.search = '';
      state.anomalyFilter = null;
      state.vencimentoWindow = null;
      state.vencidoWindow = null;
      state.idade24Window = null;
      state.page = 1;
      state.pageSize = 25;
      searchInput.value = '';
      document.getElementById('empresaFilter').value = '';
      document.getElementById('funcaoFilter').value = '';
      pageSizeSelect.value = '25';
      document.querySelectorAll('#situacaoChips .chip').forEach(function(c){ c.classList.add('on'); });
      document.querySelectorAll('.anomaly-tile, .alert-tile').forEach(function(t){ t.classList.remove('active-filter'); });
      renderTable();
    });

    // Clique filtra a lista local (função setVencLocalFilter, na seção
    // VENCIMENTOS) — não mexe na tabela "Consulta de contratos" nem rola a
    // tela (decisão de 23/08/2026, ver comentário lá em cima).
    document.querySelectorAll('.alert-tile[data-window]').forEach(function(tile){
      tile.addEventListener('click', function(){
        var w = parseInt(this.getAttribute('data-window'), 10);
        var same = vencLocal.tipo === 'vencer' && vencLocal.janela === w;
        setVencLocalFilter(same ? null : 'vencer', same ? null : w);
      });
    });

    document.querySelectorAll('.alert-tile[data-vencido-window]').forEach(function(tile){
      tile.addEventListener('click', function(){
        var w = parseInt(this.getAttribute('data-vencido-window'), 10);
        var same = vencLocal.tipo === 'vencido' && vencLocal.janela === w;
        setVencLocalFilter(same ? null : 'vencido', same ? null : w);
      });
    });

    document.getElementById('exportVencimentos').addEventListener('click', exportVencimentos);

    // Igual aos cards de vencimento: filtra a lista local (idade24Table),
    // não mexe na tabela "Consulta de contratos" nem rola a tela.
    document.querySelectorAll('.alert-tile[data-idade-window]').forEach(function(tile){
      tile.addEventListener('click', function(){
        var w = this.getAttribute('data-idade-window'); // 'total' | 'vencido' | '90' | '180'
        var same = idade24Local.tipo === w;
        setIdade24Filter(same ? null : w);
      });
    });

    document.getElementById('exportIdade24').addEventListener('click', exportIdade24);

    // Os 5 cards de situação do topo (Ativos/Aguard./Cancelados/Rescindidos/
    // Concluídos) são só visuais desde 23/08/2026 — sem clique, sem filtro,
    // sem percentual (a pedido do Hudson). Pra filtrar por situação, os
    // chips logo acima da tabela de consulta continuam funcionando normal.
  }

  function render() { renderTable(); }

  /* ================= QUALIDADE DOS DADOS ================= */
  var ANOMALIES = {};

  function computeAnomalies() {
    var idadeInvalida = RECORDS.filter(function(r){
      var age = ageAt(r.nasc, r.inicio);
      return age !== null && !isNaN(age) && (age < 14 || age > 24);
    });

    var atraso = RECORDS.filter(function(r){
      return r.situacao === 'Aguardando Assinatura' && daysUntil(r.inicio) < 0;
    });

    // chave de identidade real é Contrato + CPF completo (Contrato sozinho se repete
    // no sistema de origem depois de alguns meses — validado com dado real em ago/2026).
    // O CPF mostrado no navegador vem mascarado por privacidade, então essa checagem
    // é feita no servidor com o CPF completo e chega aqui já como flag por registro.
    var duplicados = RECORDS.filter(function(r){ return r.dup; });

    var contratoExcluido = RECORDS.filter(function(r){ return r.situacao === 'Contrato Excluído'; });

    var KNOWN_STATUS = ['Ativo','Aguardando Assinatura','Cancelado','Rescindido','Concluído','Contrato Excluído'];
    var statusIndefinido = RECORDS.filter(function(r){ return KNOWN_STATUS.indexOf(r.situacao) === -1; });

    ANOMALIES = {
      idade:      { records: idadeInvalida,   label: 'Idade fora da faixa do programa (14–24 anos)', hint: 'calculado na data de início do contrato' },
      atraso:     { records: atraso,          label: 'Aguardando assinatura com início já ultrapassado', hint: 'data de início já passou e o contrato segue pendente' },
      duplicado:  { records: duplicados,      label: 'Contrato + CPF duplicado', hint: 'validação de chave única — deve ficar em zero' },
      excluido:   { records: contratoExcluido, label: 'Contrato Excluído (sumiu de uma extração pra outra)', hint: 'não apareceu na última planilha — checar manualmente o que houve' },
      indefinido: { records: statusIndefinido, label: 'Situação com status ainda não definido', hint: 'apareceu um valor novo no sistema de origem — aguardando confirmação' }
    };
    // a faixa de 14 a 24 anos é regra da aprendizagem; não vale para o estágio
    if (OPC.programa === 'estagio') delete ANOMALIES.idade;
  }

  // Igual às outras seções (decisão de 23/08/2026): clique num item filtra
  // a lista local abaixo do grid, não a tabela de "Consulta de contratos".
  var anomalyLocal = { key: null };
  var anomalyLocalRows = [];

  function anomalyDetalhe(key, r) {
    if (key === 'idade') {
      var age = ageAt(r.nasc, r.inicio);
      return (age === null || isNaN(age)) ? '—' : 'idade no início: ' + age.toFixed(1).replace('.', ',') + ' anos';
    }
    if (key === 'atraso') {
      var d = daysUntil(r.inicio);
      return 'início ' + fmtDate(r.inicio) + ' (' + fmtInt(-d) + ' ' + (-d === 1 ? 'dia' : 'dias') + ' atrás)';
    }
    if (key === 'duplicado') return 'contrato ' + r.contrato + ' repetido pra esse CPF';
    if (key === 'excluido') return 'sumiu da última extração';
    if (key === 'indefinido') return 'situação: "' + r.situacao + '"';
    return '—';
  }

  function renderAnomalyLocalTable() {
    var tbody = document.getElementById('anomalyTable');
    var note = document.getElementById('anomalyTableNote');
    var key = anomalyLocal.key;

    if (!key) {
      anomalyLocalRows = [];
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Clique num item de qualidade acima pra ver os registros aqui.</td></tr>';
      note.innerHTML = '';
      return;
    }

    var rows = ANOMALIES[key].records;
    anomalyLocalRows = rows;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum registro nesse item.</td></tr>';
    } else {
      tbody.innerHTML = rows.map(function(r){
        return '<tr><td class="nome">'+r.nome+'</td><td class="empresa">'+r.empresa+'</td>' +
          '<td>'+pillHtml(r.situacao)+'</td>' +
          '<td>'+anomalyDetalhe(key, r)+'</td></tr>';
      }).join('');
    }
    note.innerHTML = 'Mostrando ' + fmtInt(rows.length) + ' registro' + (rows.length === 1 ? '' : 's') + ' — ' + ANOMALIES[key].label.toLowerCase() + '.' +
      ' <button type="button" class="reset-link" id="anomalyClearFilter">× limpar filtro</button>';
    var clearBtn = document.getElementById('anomalyClearFilter');
    if (clearBtn) clearBtn.addEventListener('click', function(){ setAnomalyFilter(null); });
  }

  function setAnomalyFilter(key) {
    anomalyLocal.key = key;
    document.querySelectorAll('.anomaly-tile').forEach(function(t){ t.classList.remove('active-filter'); });
    if (key) {
      var el = document.querySelector('.anomaly-tile[data-anomaly="'+key+'"]');
      if (el) el.classList.add('active-filter');
    }
    renderAnomalyLocalTable();
  }

  function exportAnomalias() {
    if (anomalyLocalRows.length === 0) { showToast('Nada pra exportar.'); return; }
    var key = anomalyLocal.key;
    var headers = [ROT.pessoa, 'Empresa', 'CPF', 'Contrato', 'Situação', 'Detalhe'];
    function esc(v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(esc).join(';')];
    anomalyLocalRows.forEach(function(r){
      lines.push([r.nome, r.empresa, r.cpf, r.contrato, r.situacao, anomalyDetalhe(key, r)].map(esc).join(';'));
    });
    var csv = '﻿' + lines.join('\r\n');
    saveCsvString('qualidade_dados_' + key + '.csv', csv, fmtInt(anomalyLocalRows.length) + ' registro(s) exportado(s).');
  }

  // Limiar de volume "alto" pra elevar um item flag pra urgent (destaque
  // reforçado). 10 é arbitrário mas separa bem "um caso isolado pra revisar"
  // de "processo travado em lote" (decisão de 24/08/2026).
  var ANOMALY_URGENT_THRESHOLD = 10;

  function renderAnomalies() {
    var el = document.getElementById('anomalyGrid');
    // Ordem fixa original vira só o desempate — a ordem visual é por
    // gravidade (maior contagem primeiro), como pedido: quem tem mais
    // registros pendentes fica no início da fila.
    var baseOrder = ['idade', 'atraso', 'duplicado', 'excluido', 'indefinido'];
    var order = baseOrder.filter(function(k){ return ANOMALIES[k]; }).sort(function(k1, k2){
      return ANOMALIES[k2].records.length - ANOMALIES[k1].records.length;
    });
    el.innerHTML = order.map(function(key){
      var a = ANOMALIES[key];
      var n = a.records.length;
      var tier;
      if (n === 0) tier = 'ok';
      else if (n >= ANOMALY_URGENT_THRESHOLD) tier = 'urgent';
      else if (key === 'indefinido') tier = 'warn';
      else tier = 'flag';
      var icon = tier === 'ok' ? '✓' : '⚠';
      return '<button class="card anomaly-tile '+tier+'" data-anomaly="'+key+'" '+(tier==='ok'?'disabled':'')+'>' +
        '<div class="a-top"><span class="a-value">'+n+'</span><span class="a-icon">'+icon+'</span></div>' +
        '<span class="a-label">'+a.label+'</span>' +
        '<span class="a-hint">'+a.hint+'</span>' +
      '</button>';
    }).join('');

    el.querySelectorAll('.anomaly-tile:not(:disabled)').forEach(function(tile){
      tile.addEventListener('click', function(){
        var key = this.getAttribute('data-anomaly');
        var same = anomalyLocal.key === key;
        setAnomalyFilter(same ? null : key);
      });
    });

    renderAnomalyLocalTable();
    document.getElementById('exportAnomalias').addEventListener('click', exportAnomalias);
  }

  /* ================= EXPORTAÇÃO CSV ================= */
  function toCsv(records) {
    var cols = ['nome','empresa','contrato','cpf','funcao','situacao','inicio','fim','dias'];
    var headers = [ROT.pessoa,'Empresa','Contrato','CPF',ROT.funcao,'Situação','Início','Encerramento','Dias p/ vencer'];
    function esc(v) {
      v = (v === null || v === undefined) ? '' : String(v);
      if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var lines = [headers.map(esc).join(';')];
    records.forEach(function(r){
      lines.push(cols.map(function(c){
        if (c === 'inicio' || c === 'fim') return esc(fmtDate(r[c]));
        if (c === 'dias') {
          if (r.situacao !== 'Ativo') return '';
          var d = daysUntil(r.fim);
          return d >= 0 ? esc(d) : '';
        }
        return esc(r[c]);
      }).join(';'));
    });
    return '﻿' + lines.join('\r\n');
  }

  function bindExport() {
    var btn = document.getElementById('exportCsv');
    btn.addEventListener('click', function(){
      handleExport();
    });
  }

  function handleExport() {
    var data = sortRecords(getFiltered());
    if (data.length === 0) { showToast('Nada pra exportar com os filtros atuais.'); return; }
    var filename = 'contratos_' + ROT.arquivo + '.csv';
    if (state.vencimentoWindow) filename = 'vencimentos_' + state.vencimentoWindow + 'dias.csv';
    else if (state.vencidoWindow) filename = 'vencidos_' + state.vencidoWindow + 'dias.csv';
    else if (state.idade24Window) filename = 'limite_24anos_' + state.idade24Window + '.csv';
    else if (state.anomalyFilter) filename = 'inconsistencias_' + state.anomalyFilter + '.csv';
    doSave(filename, data);
  }

  function doSave(filename, data) {
    var csv = toCsv(data);
    saveCsvString(filename, csv, fmtInt(data.length) + ' contratos exportados.');
  }

  /* 24-25/08/2026 — passou a funcionar em dois modos, a pedido do Hudson
     (ele precisa compartilhar o painel com todo mundo, e o Claude não
     permite link público num Artifact com download ativado). Saída:
     distribuir o PRÓPRIO ARQUIVO HTML (sem depender do link do Artifact)
     — fora do visualizador do Claude, window.claude não existe, então cai
     no download padrão do navegador (Blob + <a download>), que funciona
     normalmente. IMPORTANTE (corrigido em 25/08/2026): dentro do
     visualizador do Artifact, se a permissão de download não estiver
     concedida, o próprio visualizador BLOQUEIA qualquer download que a
     página tente iniciar sozinha — inclusive esse fallback de Blob. Não
     dá pra "simular" o download nesse caso, então em vez de tentar (e
     falhar em silêncio, clique sem efeito nenhum) o código agora avisa
     claramente que a exportação não está disponível por esse link. */
  function saveCsvString(filename, csv, successMsg) {
    function browserDownloadFallback() {
      try {
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
        showToast(successMsg);
      } catch (e) {
        showToast('Não foi possível exportar agora.');
      }
    }
    function noDownloadInViewer() {
      showToast('Exportação indisponível por este link público. Peça o arquivo do painel (dashboard_final.html) pra exportar Excel.', 5200);
    }
    if (!window.claude || typeof window.claude.use !== 'function') {
      // Sem window.claude = não estamos dentro do visualizador do Artifact
      // (arquivo aberto direto, ou outra hospedagem) — o Blob normal funciona.
      browserDownloadFallback();
      return;
    }
    window.claude.use('downloads').then(function(downloads){
      // window.claude existe = estamos dentro do visualizador do Artifact.
      // Sem a capability, o visualizador bloqueia até o fallback de Blob —
      // avisar em vez de tentar (e falhar mudo).
      if (!downloads) { noDownloadInViewer(); return; }
      downloads.save({ filename: filename, data: csv }).then(function(){
        showToast(successMsg);
      }).catch(function(err){
        if (err && err.code === 'declined') return;
        if (err && (err.code === 'extension_not_enabled' || err.code === 'rejected_extension')) {
          downloads.save({ filename: filename.replace(/\.csv$/, '.txt'), data: csv }).then(function(){
            showToast(successMsg.replace(/\.$/, '') + ' (.txt).');
          }).catch(function(){ showToast('Não foi possível exportar agora.'); });
          return;
        }
        showToast('Não foi possível exportar agora.');
      });
    }).catch(function(){ noDownloadInViewer(); });
  }

  /* ================= CONSOLIDAÇÃO ================= */
  function renderConsolidacaoBanner() {
    var c = AGG.consolidacao;
    var el = document.getElementById('consolidacaoBanner');
    // informações da carga que não são problema (ex.: CPFs completados) — tom neutro
    var notasHtml = (c && c.notas && c.notas.length)
      ? '<div class="cb-notas">' + c.notas.map(function(n){ return '<span>✓ ' + n + '</span>'; }).join('') + '</div>'
      : '';
    if (!c) { el.closest('.section').style.display = 'none'; return; }
    var alertsHtml = '';
    if (c.alertas && c.alertas.length) {
      alertsHtml = '<div class="cb-alerts"><b>Fora do padrão nesta rodada:</b><ul>' +
        c.alertas.map(function(a){ return '<li>'+a+'</li>'; }).join('') + '</ul></div>';
    }
    if (c.tipo === 'carga_inicial') {
      el.innerHTML =
        '<span class="cb-icon">🗂️</span>' +
        '<span class="cb-text">Carga inicial da base histórica em <b>'+fmtDate(c.dataBaseAtual)+'</b>: <b>'+fmtInt(c.planilhaNovaTotal)+' registros</b> consolidados por Contrato + CPF. Importada do painel anterior; as próximas atualizações entram pela planilha de extração mensal.</span>' +
        alertsHtml;
      return;
    }
    el.innerHTML =
      '<span class="cb-icon">🔄</span>' +
      '<span class="cb-text">Consolidação rodada em <b>'+fmtDate(c.dataBaseAtual)+'</b>: base de '+fmtDate(c.dataBaseAnterior)+' (<b>'+fmtInt(c.baseAnteriorTotal)+'</b>) + extração nova (<b>'+fmtInt(c.planilhaNovaTotal)+'</b>) → <b>'+fmtInt(AGG.totalGeral)+' registros</b> consolidados por Contrato + CPF.</span>' +
      '<span class="cb-stats">' +
        '<span class="cb-stat"><span class="n">'+fmtInt(c.novos)+'</span><span class="l">Novos</span></span>' +
        '<span class="cb-stat"><span class="n">'+fmtInt(c.mudouSituacao)+'</span><span class="l">Mudaram situação</span></span>' +
        '<span class="cb-stat"><span class="n">'+fmtInt(c.excluidos)+'</span><span class="l">Marcados excluído</span></span>' +
        '<span class="cb-stat"><span class="n">'+fmtInt(c.reativados)+'</span><span class="l">Reativados</span></span>' +
      '</span>' +
      notasHtml +
      alertsHtml;
  }

  function renderPendingList() {
    var el = document.getElementById('pendingList');
    var fp = AGG.pendenciasFuncao || [];
    var ip = AGG.pendenciasInstituicao || [];
    var origem = AGG.acoesSistemaOrigem || { funcao: [], instituicao: [] };
    var of = origem.funcao || [];
    var oi = origem.instituicao || [];
    if (fp.length === 0 && ip.length === 0 && of.length === 0 && oi.length === 0) { el.innerHTML = ''; return; }

    function pendingRow(p, tipo) {
      var sug = p.sugestao
        ? '<span class="p-arrow">→ sugestão:</span> <span class="p-suggestion">'+p.sugestao+'</span> <span class="p-arrow">('+Math.round((p.similaridade||0)*100)+'% parecido)</span>'
        : '<span class="p-none">sem correspondência conhecida — vira categoria nova</span>';
      return '<div class="pending-row"><span class="p-raw">"'+p.raw+'"</span><span class="p-arrow">·</span><span>'+tipo+'</span>'+sug+'</div>';
    }
    function origemRow(p, tipo) {
      var motivo = p.motivo
        ? '<span class="p-motivo">— '+p.motivo+'</span>'
        : '<span class="p-motivo">— sem correspondência conhecida, criada como categoria nova</span>';
      return '<div class="pending-row origem-row"><span class="p-tag">ajustar na origem</span><span class="p-raw">"'+p.raw+'"</span><span class="p-arrow">·</span><span>'+tipo+'</span>'+motivo+'</div>';
    }

    var html = '';
    if (fp.length > 0 || ip.length > 0) {
      html += '<h4>Sugestões de normalização aguardando sua aprovação</h4>';
      fp.forEach(function(p){ html += pendingRow(p, 'função'); });
      ip.forEach(function(p){ html += pendingRow(p, 'instituição de ensino'); });
    }
    if (of.length > 0 || oi.length > 0) {
      html += '<h4 class="origem-head">Categorias novas aceitas automaticamente · avisar quem mantém o sistema de origem</h4>';
      of.forEach(function(p){ html += origemRow(p, 'função'); });
      oi.forEach(function(p){ html += origemRow(p, 'instituição de ensino'); });
    }
    el.innerHTML = html;
  }

  /* ================= INIT ================= */
  initThemeSwitch();
  initInfoTooltip();
  initBackToTop();
  renderKPIs();
  renderFaixaEtaria();
  renderIdadeLegal();
  renderIdadeRescisao();
  renderIdade1819Insight();
  novosContratosMod.build();
  novosContratosMod.render();
  novosContratosMod.bind();
  novasEmpresasMod.build();
  novasEmpresasMod.render();
  novasEmpresasMod.bind();
  renderEmpresaBars();
  bindEmpresaPagination();
  renderArcoBars();
  renderVencimentoArco();
  renderFuncaoEmpTabs();
  renderFuncaoEmpBars();
  bindFuncaoEmpPagination();
  populatePeriodoSelects();
  bindVariacaoControls();
  renderVariacaoEmpresas();
  bindVariacaoExport();
  renderVencimentos();
  renderLimiteIdade();
  computeAnomalies();
  renderAnomalies();
  renderConsolidacaoBanner();
  renderPendingList();
  buildEmpresaOptions();
  buildFuncaoOptions();
  buildChips();
  bindTableEvents();
  bindExport();
  renderTable();
};
