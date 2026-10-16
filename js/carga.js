/* Tela "Atualizar base" (somente administrador).
   Programa escolhido: 'aprendiz', 'estagio' ou 'ambos' (planilha única com os
   dois programas, separada pela coluna "Tipo de Contrato"). Cada programa da
   planilha vira uma "parte", com suas linhas, grafias novas e prévia. */
(function () {
  "use strict";

  var A = window.Acesso;
  var PR = window.Programas;
  var $ = function (id) { return document.getElementById(id); };
  var AMBOS = 'ambos';
  var escolhaInicial = new URLSearchParams(window.location.search).get('programa');
  var estado = {
    programa: escolhaInicial === AMBOS ? AMBOS : (PR.atual() || 'aprendiz'),
    arquivo: null,
    partes: [],          // [{ programa, linhas, grafiasNovas }]
    baseInicial: null,
    dicionarios: { aprendiz: [], estagio: [] },
    bases: { aprendiz: { total: 0, ultimaData: null }, estagio: { total: 0, ultimaData: null } }
  };
  function ambos() { return estado.programa === AMBOS; }
  function programasDaEscolha() { return ambos() ? PR.LISTA.slice() : [estado.programa]; }
  function nomeDaEscolha() { return ambos() ? 'Os dois programas' : PR.INFO[estado.programa].nome; }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
  function contratos(n) { return fmtInt(n) + (n === 1 ? ' contrato' : ' contratos'); }
  function fmtData(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function fmtDataHora(iso) {
    return iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  }
  function msg(id, texto, tipo) {
    var el = $(id);
    el.textContent = texto || '';
    el.className = 'carga-msg' + (tipo ? ' ' + tipo : '');
  }
  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function tipoEscolhido() {
    return document.querySelector('input[name="tipo"]:checked').value;
  }
  function tituloCaso(s) {
    var mini = ['da', 'de', 'do', 'das', 'dos', 'e'];
    return String(s || '').toLowerCase().split(' ').map(function (w, i) {
      return i > 0 && mini.indexOf(w) !== -1 ? w : w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }
  function texto(v) {
    if (v == null) return null;
    var s = String(v).replace(/\s+/g, ' ').trim();
    return s || null;
  }

  function limparPrevia() {
    $('passoPrevia').hidden = true;
    msg('msgGravar', '');
  }
  function limparTudo() {
    estado.partes = []; estado.baseInicial = null; estado.arquivo = null;
    $('campoArquivo').value = '';
    $('textoArquivo').innerHTML = '<b>Clique para escolher</b> ou arraste a planilha de extração (.xlsx) aqui';
    msg('msgLeitura', '');
    $('listaProblemas').hidden = true;
    $('passoGrafias').hidden = true;
    $('botoesPrevia').hidden = true;
    limparPrevia();
  }

  /* ---------- leitura do arquivo ---------- */
  async function lerArquivo(arquivo) {
    limparTudo();
    estado.arquivo = arquivo;
    $('textoArquivo').innerHTML = 'Arquivo: <b>' + esc(arquivo.name) + '</b> — clique para trocar';
    msg('msgLeitura', 'Lendo a planilha…');

    try {
      if (/\.json$/i.test(arquivo.name)) {
        var j = JSON.parse(await arquivo.text());
        if (j.tipo !== 'base-inicial' || !Array.isArray(j.linhas)) throw new Error('Este .json não é uma base inicial do painel.');
        if (ambos() || (j.programa || 'aprendiz') !== estado.programa) throw new Error('Esta base inicial é de outro programa.');
        if (estado.bases[estado.programa].total > 0) throw new Error('A base inicial só pode ser importada com o banco vazio.');
        estado.baseInicial = j;
        estado.partes = [{ programa: estado.programa, linhas: j.linhas, grafiasNovas: [] }];
        $('dataReferencia').value = j.data_referencia;
        msg('msgLeitura', 'Base inicial com ' + fmtInt(j.linhas.length) + ' contratos (dados de ' + fmtData(j.data_referencia) + ').', 'ok');
        $('botoesPrevia').hidden = false;
        return;
      }

      var wb = XLSX.read(await arquivo.arrayBuffer(), { cellDates: true });
      var aba = wb.Sheets[wb.SheetNames[0]];
      var brutas = XLSX.utils.sheet_to_json(aba, { defval: null });
      if (ambos()) lerAmbos(brutas); else lerUm(brutas);
    } catch (e) {
      msg('msgLeitura', 'Não foi possível ler o arquivo: ' + e.message, 'erro');
    }
  }

  function faltamColunas(r) {
    if (!r.faltandoColunas.length) return false;
    msg('msgLeitura', 'Esta planilha não tem as colunas esperadas: ' + r.faltandoColunas.join(', ') + '. Confira se é a extração de contratos.', 'erro');
    return true;
  }

  // um programa só: as linhas do outro programa são puladas e contadas
  function lerUm(brutas) {
    var info = PR.INFO[estado.programa];
    var r = window.Planilha.interpretar(brutas, estado.dicionarios[estado.programa], info.tipoContrato, { extrasEstagio: estado.programa === 'estagio' });
    if (faltamColunas(r)) return;
    // trava: planilha de outro programa (ex.: estágio escolhido, planilha de aprendiz)
    if (!r.linhas.length && r.outroPrograma) {
      msg('msgLeitura', 'Esta planilha não é do ' + info.nome + ': o "' + window.Planilha.COLUNA_TIPO + '" dela é ' +
        r.tiposOutros.join(', ') + '. Confira o programa escolhido acima.', 'erro');
      return;
    }
    estado.partes = [{ programa: estado.programa, linhas: r.linhas, grafiasNovas: r.grafiasNovas, aditivosConsolidados: r.aditivosConsolidados }];
    msg('msgLeitura', contratos(r.linhas.length) + ' do ' + info.nome + (r.linhas.length === 1 ? ' lido' : ' lidos') +
      (r.aditivosConsolidados ? ' · ' + fmtInt(r.aditivosConsolidados) + ' aditivo(s) consolidado(s)' : '') +
      (r.outroPrograma ? ' · ' + fmtInt(r.outroPrograma) + ' linha(s) de outro programa ignorada(s) (' + r.tiposOutros.join(', ') + ')' : '') +
      (r.problemas.length ? ' · ' + fmtInt(r.problemas.length) + ' aviso(s) abaixo' : ' · nenhum problema encontrado'), r.linhas.length ? 'ok' : 'erro');
    mostrarProblemas(r.problemas);
    mostrarGrafias();
    if (r.linhas.length) sugerirPeriodo();
    $('botoesPrevia').hidden = !r.linhas.length;
  }

  // os dois programas: separa as linhas pelo "Tipo de Contrato" e lê cada grupo
  function lerAmbos(brutas) {
    var COL = window.Planilha.COLUNA_TIPO;
    if (!brutas.length || !(COL in brutas[0])) {
      msg('msgLeitura', 'Para carregar os dois programas de uma vez, a planilha precisa da coluna "' + COL + '".', 'erro');
      return;
    }
    var grupos = { aprendiz: [], estagio: [] }, problemas = [];
    brutas.forEach(function (x, i) {
      x.__linha = i + 2; // linha 1 é o cabeçalho
      var tipo = texto(x[COL]);
      if (!tipo) {
        if (texto(x['Contrato'])) problemas.push({ linha: i + 2, contrato: texto(x['Contrato']), motivo: 'sem "' + COL + '": não dá para saber o programa — linha ignorada' });
        return;
      }
      grupos[PR.INFO.aprendiz.tipoContrato(tipo) ? 'aprendiz' : 'estagio'].push(x);
    });
    var vazio = PR.LISTA.filter(function (p) { return !grupos[p].length; });
    if (vazio.length) {
      var tem = PR.LISTA.filter(function (p) { return grupos[p].length; });
      msg('msgLeitura', tem.length
        ? 'Esta planilha só tem contratos do ' + PR.INFO[tem[0]].nome + '. Escolha esse programa acima, em vez de "Os dois programas".'
        : 'Nenhum contrato encontrado na planilha.', 'erro');
      return;
    }
    var partes = [];
    for (var k = 0; k < PR.LISTA.length; k++) {
      var p = PR.LISTA[k];
      var r = window.Planilha.interpretar(grupos[p], estado.dicionarios[p], null, { extrasEstagio: p === 'estagio' });
      if (faltamColunas(r)) return;
      r.problemas.forEach(function (pr) { pr.motivo = PR.INFO[p].nome + ': ' + pr.motivo; problemas.push(pr); });
      partes.push({ programa: p, linhas: r.linhas, grafiasNovas: r.grafiasNovas, aditivosConsolidados: r.aditivosConsolidados });
    }
    problemas.sort(function (a, b) { return a.linha - b.linha; });
    estado.partes = partes;
    var totalAditivos = partes.reduce(function (soma, pt) { return soma + (pt.aditivosConsolidados || 0); }, 0);
    msg('msgLeitura', 'Lidos: ' + partes.map(function (pt) { return contratos(pt.linhas.length) + ' do ' + PR.INFO[pt.programa].nome; }).join(' e ') +
      (totalAditivos ? ' · ' + fmtInt(totalAditivos) + ' aditivo(s) consolidado(s)' : '') +
      (problemas.length ? ' · ' + fmtInt(problemas.length) + ' aviso(s) abaixo' : ' · nenhum problema encontrado'), 'ok');
    mostrarProblemas(problemas);
    mostrarGrafias();
    sugerirPeriodo();
    $('botoesPrevia').hidden = false;
  }

  /* Período da extração: tenta tirar do nome do arquivo (ex.: "Geral - 01-01-2020 30-09-26.xlsx");
     se não der, usa do contrato mais antigo da planilha até a data de referência. Fica editável. */
  function datasDoNome(nome) {
    var out = [], m, re = /(\d{1,2})[-.](\d{1,2})[-.](\d{4}|\d{2})(?!\d)/g;
    while ((m = re.exec(nome || ''))) {
      var a = m[3].length === 2 ? '20' + m[3] : m[3], mes = +m[2], dia = +m[1];
      if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) out.push(a + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0'));
    }
    return out;
  }
  function sugerirPeriodo() {
    var nomeArq = estado.arquivo ? estado.arquivo.name : '';
    var doNome = datasDoNome(nomeArq);
    var inicios = [];
    estado.partes.forEach(function (pt) { pt.linhas.forEach(function (l) { if (l.inicio) inicios.push(l.inicio); }); });
    inicios.sort();
    var maisAntigo = inicios[0] || '';
    var ini, fim, origem;
    if (doNome.length >= 2) { ini = doNome[0]; fim = doNome[doNome.length - 1]; origem = 'pelo nome do arquivo'; }
    else if (doNome.length === 1) { ini = maisAntigo; fim = doNome[0]; origem = 'o fim pelo nome do arquivo e o início pelo contrato mais antigo da planilha'; }
    else { ini = maisAntigo; fim = $('dataReferencia').value; origem = 'pelo contrato mais antigo da planilha até a data de referência'; }
    if (doNome.length) $('dataReferencia').value = fim; // a data dos dados é o fim da extração
    $('periodoInicio').value = ini || '';
    $('periodoFim').value = fim || '';
    msg('periodoDica', 'Período sugerido ' + origem + '. Confira e corrija se a extração foi feita com outro período.', 'ok');
  }

  function mostrarProblemas(problemas) {
    var el = $('listaProblemas');
    if (!problemas.length) { el.hidden = true; return; }
    el.hidden = false;
    el.querySelector('summary').textContent = 'Ver os ' + fmtInt(problemas.length) + ' aviso(s) da leitura';
    el.querySelector('tbody').innerHTML = problemas.map(function (p) {
      return '<tr><td>' + esc(p.linha) + '</td><td>' + esc(p.contrato || '—') + '</td><td>' + esc(p.motivo) + '</td></tr>';
    }).join('');
  }

  // grafias novas de todas as partes; data-p / data-i apontam para a parte e a grafia
  function mostrarGrafias() {
    var box = $('listaGrafias'), html = '';
    var totalGrafias = 0;
    estado.partes.forEach(function (parte, pi) {
      totalGrafias += parte.grafiasNovas.length;
      parte.grafiasNovas.forEach(function (g, i) {
        var existentes = estado.dicionarios[parte.programa].filter(function (d) { return d.tipo === g.tipo; })
          .map(function (d) { return d.valor; })
          .filter(function (v, k, arr) { return arr.indexOf(v) === k; }).sort();
        var opcoes = existentes.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
        var oQue = g.tipo === 'funcao' ? (parte.programa === 'estagio' ? 'curso' : 'função (coluna Curso)') : 'instituição de ensino';
        html += '<div class="grafia-linha" data-p="' + pi + '" data-i="' + i + '">' +
          '<div><span class="bruto">"' + esc(g.exemplo) + '"</span><small>' + (ambos() ? esc(PR.INFO[parte.programa].nome) + ' · ' : '') +
          oQue + ' · ' + fmtInt(g.linhas) + ' contrato(s)</small></div>' +
          '<div><select class="input grafia-escolha"><option value="__nova">Nova categoria…</option>' + opcoes + '</select>' +
          '<input class="input grafia-nova" style="margin-top:6px" value="' + esc(tituloCaso(g.exemplo)) + '" aria-label="Nome da nova categoria"></div>' +
          '</div>';
      });
    });
    if ($('contGrafiasNovas')) $('contGrafiasNovas').textContent = fmtInt(totalGrafias);
    box.innerHTML = html;
    $('passoGrafias').hidden = !html;
    box.querySelectorAll('.grafia-escolha').forEach(function (sel) {
      sel.addEventListener('change', function () {
        sel.parentNode.querySelector('.grafia-nova').hidden = sel.value !== '__nova';
        limparPrevia();
      });
    });
    box.querySelectorAll('.grafia-nova').forEach(function (inp) { inp.addEventListener('input', limparPrevia); });
    var btnAceitar = $('btnAceitarTodasGrafias');
    if (btnAceitar) {
      btnAceitar.onclick = function () {
        $('btnPrevia').focus();
        $('btnPrevia').scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    }
  }

  // decisões de grafia por parte: [[{tipo, chave, valor}], ...]
  function decisoesGrafias() {
    var out = estado.partes.map(function () { return []; });
    $('listaGrafias').querySelectorAll('.grafia-linha').forEach(function (div) {
      var pi = +div.getAttribute('data-p');
      var g = estado.partes[pi].grafiasNovas[+div.getAttribute('data-i')];
      var sel = div.querySelector('.grafia-escolha').value;
      var valor = sel === '__nova' ? div.querySelector('.grafia-nova').value.trim() : sel;
      out[pi].push({ tipo: g.tipo, chave: g.chave, valor: valor });
    });
    return out;
  }

  /* ---------- prévia e gravação ---------- */
  // devolve { funcao, params } para a chamada ao banco
  function chamada(aplicar) {
    var decisoes = decisoesGrafias();
    if (decisoes.some(function (d) { return d.some(function (x) { return !x.valor; }); })) throw new Error('Dê um nome para cada grafia nova (passo 3).');
    var linhas = estado.partes.map(function (parte, pi) {
      return estado.baseInicial ? parte.linhas : window.Planilha.aplicarGrafias(parte.linhas, decisoes[pi]);
    });
    var data = $('dataReferencia').value;
    if (!data) throw new Error('Informe a data de referência dos dados (passo 1).');
    var pIni = $('periodoInicio').value || null, pFim = $('periodoFim').value || null;
    if (!estado.baseInicial && (!pIni || !pFim)) throw new Error('Informe o período da extração, de e até (passo 1).');
    if (pIni && pFim && pIni > pFim) throw new Error('No período da extração, a data "de" está depois da data "até" (passo 1).');
    var comum = {
      p_tipo: estado.baseInicial ? 'inicial' : tipoEscolhido(),
      p_data_referencia: data,
      p_arquivo: estado.arquivo ? estado.arquivo.name : null,
      p_aplicar: aplicar
    };
    if (pIni && pFim) { comum.p_periodo_inicio = pIni; comum.p_periodo_fim = pFim; } // sem período: o banco grava vazio
    if (ambos()) {
      return { funcao: 'processar_carga_ambos', params: Object.assign(comum, {
        p_aprendiz: linhas[0], p_estagio: linhas[1], p_grafias_aprendiz: decisoes[0], p_grafias_estagio: decisoes[1] }) };
    }
    return { funcao: 'processar_carga', params: Object.assign(comum, {
      p_linhas: linhas[0], p_novas_grafias: decisoes[0], p_programa: estado.programa }) };
  }
  // resultado do banco como lista [{ programa, r }], na ordem das partes
  function resultados(r) {
    return ambos() ? PR.LISTA.map(function (p) { return { programa: p, r: r[p] }; }) : [{ programa: estado.programa, r: r }];
  }

  function tabela(titulo, colunas, linhas, render) {
    if (!linhas || !linhas.length) return '';
    return '<details class="carga-lista"><summary>' + esc(titulo) + ' (' + fmtInt(linhas.length) + ')</summary>' +
      '<div class="table-wrap"><table><thead><tr>' + colunas.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + linhas.map(function (l) { return '<tr>' + render(l).map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div></details>';
  }

  var NOMES_CAMPOS = { nome: 'nome', empresa: 'empresa', cnpj: 'CNPJ', funcao: 'função', curso_original: 'curso', instituicao: 'instituição', inicio: 'início', fim: 'encerramento', nasc: 'nascimento', extras: 'bolsa/carga horária/recesso' };

  function numerosHtml(r) {
    return [
      ['Novos', r.novos], ['Mudaram de situação', r.mudouSituacao], ['Viram "Contrato Excluído"', r.excluidos, r.excluidos > 0],
      ['Reativados', r.reativados], ['Com dados corrigidos', r.dadosAlterados], ['CPFs completados', r.cpfCompletados]
    ].map(function (n) {
      return '<div class="carga-numero' + (n[2] ? ' alerta' : '') + '"><div class="n">' + fmtInt(n[1]) + '</div><div class="l">' + esc(n[0]) + '</div></div>';
    }).join('');
  }
  function listasHtml(programa, r) {
    var pessoa = PR.INFO[programa].rotulos.pessoa;
    return tabela('Contratos novos', ['Contrato', pessoa, 'Empresa', 'Situação'], r.listaNovos, function (l) { return [l.contrato, l.nome, l.empresa, l.situacao]; }) +
      tabela('Mudança de situação', ['Contrato', pessoa, 'Empresa', 'Antes', 'Depois'], r.listaSituacao, function (l) { return [l.contrato, l.nome, l.empresa, l.antes, l.depois]; }) +
      tabela('Vão virar "Contrato Excluído"', ['Contrato', pessoa, 'Empresa', 'Situação atual'], r.listaExcluidos, function (l) { return [l.contrato, l.nome, l.empresa, l.antes]; }) +
      tabela('Dados corrigidos', ['Contrato', pessoa, 'Empresa', 'O que mudou'], r.listaDados, function (l) {
        return [l.contrato, l.nome, l.empresa, (l.campos || []).map(function (c) { return NOMES_CAMPOS[c] || c; }).join(', ')];
      });
  }
  function alertasDe(programa, r) {
    var alertas = [], nome = PR.INFO[programa].nome, base = estado.bases[programa];
    if (r.excluidos > 0 && base.total && r.excluidos > base.total * 0.1) {
      alertas.push('Atenção: ' + fmtInt(r.excluidos) + ' contratos do ' + nome + ' vão virar "Contrato Excluído". Confira se esta é mesmo a extração completa deste programa; se for só uma parte, escolha "Só alguns contratos" no passo 1.');
    }
    var dataRef = $('dataReferencia').value;
    if (base.ultimaData && dataRef < base.ultimaData) {
      alertas.push(nome + ': a data de referência (' + fmtData(dataRef) + ') é anterior à da base atual (' + fmtData(base.ultimaData) + '). Se a planilha for antiga, ela pode desfazer atualizações mais novas.');
    }
    if (r.situacoesNovas && r.situacoesNovas.length) alertas.push(nome + ': situação nunca vista antes: ' + r.situacoesNovas.join(', ') + '.');
    return alertas;
  }
  function semMudanca(r) {
    return !r.novos && !r.mudouSituacao && !r.excluidos && !r.reativados && !r.dadosAlterados && !r.cpfCompletados;
  }

  async function verPrevia() {
    limparPrevia();
    var btn = $('btnPrevia');
    btn.disabled = true;
    msg('msgLeitura', 'Comparando com a base atual…', 'ok');
    try {
      var c = chamada(false);
      var res = resultados(await A.rpc(c.funcao, c.params));
      var alertas = [];
      res.forEach(function (x) { alertas = alertas.concat(alertasDe(x.programa, x.r)); });
      if (ambos()) {
        $('numerosPrevia').innerHTML = '';
        $('listasPrevia').innerHTML = res.map(function (x) {
          return '<div class="carga-previa-programa" data-programa="' + esc(x.programa) + '"><h3>' + esc(PR.INFO[x.programa].nome) + '</h3>' +
            '<div class="carga-numeros">' + numerosHtml(x.r) + '</div>' + listasHtml(x.programa, x.r) + '</div>';
        }).join('');
      } else {
        $('numerosPrevia').innerHTML = numerosHtml(res[0].r);
        $('listasPrevia').innerHTML = listasHtml(res[0].programa, res[0].r);
      }
      $('alertaPrevia').textContent = alertas.join(' ');

      var nada = res.every(function (x) { return semMudanca(x.r); });
      $('btnConfirmar').hidden = nada;
      $('btnConfirmar').textContent = ambos() ? 'Confirmar e gravar os dois programas' : 'Confirmar e gravar';
      if (nada) $('alertaPrevia').textContent = 'A planilha é igual à base atual: não há nada para gravar.';
      $('passoPrevia').hidden = false;
      msg('msgLeitura', '');
      $('passoPrevia').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      msg('msgLeitura', e.message, 'erro');
    } finally {
      btn.disabled = false;
    }
  }

  async function confirmar() {
    var btn = $('btnConfirmar');
    btn.disabled = true;
    msg('msgGravar', 'Gravando…');
    try {
      var c = chamada(true);
      var res = resultados(await A.rpc(c.funcao, c.params));
      msg('msgGravar', ambos()
        ? 'Pronto! Cargas gravadas: ' + res.map(function (x) { return 'nº ' + x.r.carga_id + ' (' + PR.INFO[x.programa].nome + ')'; }).join(' e ') + '. O painel já mostra os dados novos.'
        : 'Pronto! Carga nº ' + res[0].r.carga_id + ' do ' + PR.INFO[res[0].programa].nome + ' gravada. O painel já mostra os dados novos.', 'ok');
      $('btnConfirmar').hidden = true;
      $('btnCancelar').textContent = 'Carregar outra planilha';
      await carregarDicionarios();
      await carregarHistorico();
    } catch (e) {
      msg('msgGravar', 'Não foi gravado: ' + e.message + (ambos() ? ' Nenhum dos dois programas foi alterado.' : ''), 'erro');
      btn.disabled = false;
    }
  }

  /* ---------- histórico e desfazer ---------- */
  var ROTULO_TIPO = { inicial: 'Base inicial', completa: 'Completa', parcial: 'Parcial' };

  // guarda total e data da última carga de cada programa (para os alertas da prévia)
  // e desenha o histórico quando há um programa só escolhido
  async function carregarHistorico() {
    var listas = {};
    for (var k = 0; k < PR.LISTA.length; k++) {
      var p = PR.LISTA[k];
      var h = await A.rpc('cargas_lista', { p_programa: p });
      var ativas = h.cargas.filter(function (c) { return !c.desfeita_em; });
      estado.bases[p] = { total: h.total_contratos, ultimaData: ativas.length ? ativas[0].data_referencia : null };
      listas[p] = h.cargas;
    }
    $('historicoTabela').hidden = ambos();
    $('notaHistoricoAmbos').hidden = !ambos();
    if (ambos()) { $('btnDesfazer').hidden = true; return; }

    var cargas = listas[estado.programa], nome = PR.INFO[estado.programa].nome;
    var ativasP = cargas.filter(function (c) { return !c.desfeita_em; });
    $('tabelaCargas').innerHTML = cargas.length ? cargas.map(function (c) {
      var r = c.resumo || {};
      return '<tr' + (c.desfeita_em ? ' style="opacity:.55"' : '') + '><td>' + esc(fmtData(c.data_referencia)) + '</td><td>' + (c.periodo_inicio ? esc(fmtData(c.periodo_inicio) + ' a ' + fmtData(c.periodo_fim)) : '—') + '</td><td>' + esc(ROTULO_TIPO[c.tipo] || c.tipo) +
        '</td><td>' + esc(c.arquivo || '—') + '</td><td>' + esc(fmtDataHora(c.criado_em)) + (c.por ? ' · ' + esc(c.por) : '') +
        '</td><td>' + fmtInt(r.novos) + '</td><td>' + fmtInt(r.mudouSituacao) + '</td><td>' + fmtInt(r.excluidos) +
        '</td><td>' + (c.desfeita_em ? 'desfeita em ' + esc(fmtDataHora(c.desfeita_em)) : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="9">Nenhuma carga do ' + esc(nome) + ' ainda.' +
      (estado.programa === 'aprendiz' ? ' Comece pela base inicial (arquivo base-inicial.json).' : ' Comece pela extração completa.') + '</td></tr>';
    $('btnDesfazer').hidden = !ativasP.length;
    if (ativasP.length) {
      $('btnDesfazer').textContent = 'Desfazer a última carga (dados de ' + fmtData(ativasP[0].data_referencia) + ')';
    }
  }

  async function desfazer() {
    if (ambos()) return;
    var nome = PR.INFO[estado.programa].nome;
    if (!window.confirm('Desfazer a última carga do ' + nome + '? A base deste programa volta exatamente como estava antes dela.')) return;
    $('btnDesfazer').disabled = true;
    try {
      var r = await A.rpc('desfazer_ultima_carga', { p_programa: estado.programa });
      msg('msgDesfazer', 'Carga nº ' + r.carga_id + ' desfeita.', 'ok');
      limparTudo();
      await carregarHistorico();
    } catch (e) {
      msg('msgDesfazer', e.message, 'erro');
    } finally {
      $('btnDesfazer').disabled = false;
    }
  }

  async function carregarDicionarios() {
    for (var k = 0; k < PR.LISTA.length; k++) {
      estado.dicionarios[PR.LISTA[k]] = await A.rpc('dicionario_lista', { p_programa: PR.LISTA[k] });
    }
  }

  // troca de programa: tudo o que foi lido ou previsto é do programa anterior
  function mostrarPrograma() {
    var p = estado.programa;
    document.querySelectorAll('input[name="programa"]').forEach(function (r) { r.checked = r.value === p; });
    $('tituloPrograma').textContent = '· ' + nomeDaEscolha();
    $('historicoPrograma').textContent = ambos() ? '' : '· ' + nomeDaEscolha();
    $('linkVoltar').href = PR.url('index.html', ambos() ? null : p);
    document.title = 'Atualizar base · ' + nomeDaEscolha() + ' – Painel de Contratos';
  }
  async function trocarPrograma(p) {
    if (p === estado.programa) return;
    estado.programa = p;
    history.replaceState(null, '', 'carga.html?programa=' + p);
    mostrarPrograma();
    limparTudo();
    msg('msgDesfazer', '');
    try {
      await carregarHistorico();
    } catch (e) {
      msg('msgGeral', e.message, 'erro');
    }
  }

  /* ---------- eventos ---------- */
  $('campoArquivo').addEventListener('change', function () { if (this.files[0]) lerArquivo(this.files[0]); });
  var zona = $('zonaArquivo');
  ['dragenter', 'dragover'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('arrastando'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('arrastando'); }); });
  zona.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) lerArquivo(e.dataTransfer.files[0]); });
  document.querySelectorAll('input[name="tipo"]').forEach(function (r) { r.addEventListener('change', limparPrevia); });
  document.querySelectorAll('input[name="programa"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) trocarPrograma(r.value); });
  });
  $('dataReferencia').addEventListener('change', limparPrevia);
  $('periodoInicio').addEventListener('change', limparPrevia);
  $('periodoFim').addEventListener('change', limparPrevia);
  $('btnPrevia').addEventListener('click', verPrevia);
  $('btnConfirmar').addEventListener('click', confirmar);
  $('btnCancelar').addEventListener('click', function () { $('btnCancelar').textContent = 'Cancelar'; $('btnConfirmar').hidden = false; $('btnConfirmar').disabled = false; limparTudo(); window.scrollTo(0, 0); });
  $('btnDesfazer').addEventListener('click', desfazer);
  $('btnSair').addEventListener('click', async function () {
    try { await A.rpc('registrar', { p_evento: 'saída' }); } catch (e) {}
    await A.sair();
    window.location.href = 'https://portal.hbone.com.br';
  });

  (async function iniciar() {
    $('dataReferencia').value = hojeISO();
    if (!(await A.sessaoAtual())) { window.location.href = 'https://portal.hbone.com.br'; return; }
    try {
      var eu = await A.rpc('sessao');
      if (eu.papel !== 'admin') { msg('msgGeral', 'Esta tela é só para o administrador.', 'erro'); return; }
      $('usuarioNome').textContent = eu.nome + ' · administrador';
      mostrarPrograma();
      await carregarDicionarios();
      await carregarHistorico();
      msg('msgGeral', '');
      $('conteudo').hidden = false;
      A.vigiarInatividade(function () { window.location.href = 'https://portal.hbone.com.br'; });
    } catch (e) {
      msg('msgGeral', e.message, 'erro');
    }
  })();
})();
