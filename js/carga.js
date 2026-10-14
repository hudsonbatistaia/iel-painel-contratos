/* Tela "Atualizar base" (somente administrador). */
(function () {
  "use strict";

  var A = window.Acesso;
  var $ = function (id) { return document.getElementById(id); };
  var estado = { arquivo: null, linhas: null, grafiasNovas: [], dicionario: [], baseInicial: null, totalContratos: 0, ultimaData: null };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
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

  function limparPrevia() {
    $('passoPrevia').hidden = true;
    msg('msgGravar', '');
  }
  function limparTudo() {
    estado.linhas = null; estado.grafiasNovas = []; estado.baseInicial = null; estado.arquivo = null;
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
        if (estado.totalContratos > 0) throw new Error('A base inicial só pode ser importada com o banco vazio.');
        estado.baseInicial = j;
        estado.linhas = j.linhas;
        $('dataReferencia').value = j.data_referencia;
        msg('msgLeitura', 'Base inicial com ' + fmtInt(j.linhas.length) + ' contratos (dados de ' + fmtData(j.data_referencia) + ').', 'ok');
        $('botoesPrevia').hidden = false;
        return;
      }

      var wb = XLSX.read(await arquivo.arrayBuffer(), { cellDates: true });
      var aba = wb.Sheets[wb.SheetNames[0]];
      var brutas = XLSX.utils.sheet_to_json(aba, { defval: null });
      var r = window.Planilha.interpretar(brutas, estado.dicionario);

      if (r.faltandoColunas.length) {
        msg('msgLeitura', 'Esta planilha não tem as colunas esperadas: ' + r.faltandoColunas.join(', ') + '. Confira se é a extração de contratos.', 'erro');
        return;
      }
      estado.linhas = r.linhas;
      estado.grafiasNovas = r.grafiasNovas;
      msg('msgLeitura', fmtInt(r.linhas.length) + ' contratos lidos' +
        (r.problemas.length ? ' · ' + fmtInt(r.problemas.length) + ' aviso(s) abaixo' : ' · nenhum problema encontrado'), r.linhas.length ? 'ok' : 'erro');
      mostrarProblemas(r.problemas);
      mostrarGrafias(r.grafiasNovas);
      $('botoesPrevia').hidden = !r.linhas.length;
    } catch (e) {
      msg('msgLeitura', 'Não foi possível ler o arquivo: ' + e.message, 'erro');
    }
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

  function mostrarGrafias(novas) {
    var box = $('listaGrafias');
    if (!novas.length) { $('passoGrafias').hidden = true; box.innerHTML = ''; return; }
    $('passoGrafias').hidden = false;
    box.innerHTML = novas.map(function (g, i) {
      var existentes = estado.dicionario.filter(function (d) { return d.tipo === g.tipo; })
        .map(function (d) { return d.valor; })
        .filter(function (v, k, arr) { return arr.indexOf(v) === k; }).sort();
      var opcoes = existentes.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
      return '<div class="grafia-linha" data-i="' + i + '">' +
        '<div><span class="bruto">"' + esc(g.exemplo) + '"</span><small>' + (g.tipo === 'funcao' ? 'função (coluna Curso)' : 'instituição de ensino') + ' · ' + fmtInt(g.linhas) + ' contrato(s)</small></div>' +
        '<div><select class="input grafia-escolha"><option value="__nova">Nova categoria…</option>' + opcoes + '</select>' +
        '<input class="input grafia-nova" style="margin-top:6px" value="' + esc(tituloCaso(g.exemplo)) + '" aria-label="Nome da nova categoria"></div>' +
        '</div>';
    }).join('');
    box.querySelectorAll('.grafia-escolha').forEach(function (sel) {
      sel.addEventListener('change', function () {
        sel.parentNode.querySelector('.grafia-nova').hidden = sel.value !== '__nova';
        limparPrevia();
      });
    });
    box.querySelectorAll('.grafia-nova').forEach(function (inp) { inp.addEventListener('input', limparPrevia); });
  }

  function decisoesGrafias() {
    var out = [];
    $('listaGrafias').querySelectorAll('.grafia-linha').forEach(function (div) {
      var g = estado.grafiasNovas[+div.getAttribute('data-i')];
      var sel = div.querySelector('.grafia-escolha').value;
      var valor = sel === '__nova' ? div.querySelector('.grafia-nova').value.trim() : sel;
      out.push({ tipo: g.tipo, chave: g.chave, valor: valor });
    });
    return out;
  }

  /* ---------- prévia e gravação ---------- */
  function parametros(aplicar) {
    var decisoes = decisoesGrafias();
    var vazia = decisoes.filter(function (d) { return !d.valor; });
    if (vazia.length) throw new Error('Dê um nome para cada grafia nova (passo 3).');
    var linhas = estado.baseInicial ? estado.linhas : window.Planilha.aplicarGrafias(estado.linhas, decisoes);
    var data = $('dataReferencia').value;
    if (!data) throw new Error('Informe a data de referência dos dados (passo 1).');
    return {
      p_linhas: linhas,
      p_tipo: estado.baseInicial ? 'inicial' : tipoEscolhido(),
      p_data_referencia: data,
      p_arquivo: estado.arquivo ? estado.arquivo.name : null,
      p_aplicar: aplicar,
      p_novas_grafias: decisoes
    };
  }

  function tabela(titulo, colunas, linhas, render) {
    if (!linhas || !linhas.length) return '';
    return '<details class="carga-lista"><summary>' + esc(titulo) + ' (' + fmtInt(linhas.length) + ')</summary>' +
      '<div class="table-wrap"><table><thead><tr>' + colunas.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + linhas.map(function (l) { return '<tr>' + render(l).map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div></details>';
  }

  var NOMES_CAMPOS = { nome: 'nome', empresa: 'empresa', cnpj: 'CNPJ', funcao: 'função', curso_original: 'curso', instituicao: 'instituição', inicio: 'início', fim: 'encerramento', nasc: 'nascimento' };

  async function verPrevia() {
    limparPrevia();
    var btn = $('btnPrevia');
    btn.disabled = true;
    msg('msgLeitura', 'Comparando com a base atual…', 'ok');
    try {
      var r = await A.rpc('processar_carga', parametros(false));
      var numeros = [
        ['Novos', r.novos], ['Mudaram de situação', r.mudouSituacao], ['Viram "Contrato Excluído"', r.excluidos, r.excluidos > 0],
        ['Reativados', r.reativados], ['Com dados corrigidos', r.dadosAlterados], ['CPFs completados', r.cpfCompletados]
      ];
      $('numerosPrevia').innerHTML = numeros.map(function (n) {
        return '<div class="carga-numero' + (n[2] ? ' alerta' : '') + '"><div class="n">' + fmtInt(n[1]) + '</div><div class="l">' + esc(n[0]) + '</div></div>';
      }).join('');

      var alertas = [];
      if (r.excluidos > 0 && estado.totalContratos && r.excluidos > estado.totalContratos * 0.1) {
        alertas.push('Atenção: ' + fmtInt(r.excluidos) + ' contratos vão virar "Contrato Excluído". Confira se esta é mesmo a extração completa; se for só uma parte, escolha "Só alguns contratos" no passo 1.');
      }
      var dataRef = $('dataReferencia').value;
      if (estado.ultimaData && dataRef < estado.ultimaData) {
        alertas.push('A data de referência (' + fmtData(dataRef) + ') é anterior à da base atual (' + fmtData(estado.ultimaData) + '). Se a planilha for antiga, ela pode desfazer atualizações mais novas.');
      }
      if (r.situacoesNovas && r.situacoesNovas.length) alertas.push('Situação nunca vista antes: ' + r.situacoesNovas.join(', ') + '.');
      $('alertaPrevia').textContent = alertas.join(' ');

      $('listasPrevia').innerHTML =
        tabela('Contratos novos', ['Contrato', 'Aprendiz', 'Empresa', 'Situação'], r.listaNovos, function (l) { return [l.contrato, l.nome, l.empresa, l.situacao]; }) +
        tabela('Mudança de situação', ['Contrato', 'Aprendiz', 'Empresa', 'Antes', 'Depois'], r.listaSituacao, function (l) { return [l.contrato, l.nome, l.empresa, l.antes, l.depois]; }) +
        tabela('Vão virar "Contrato Excluído"', ['Contrato', 'Aprendiz', 'Empresa', 'Situação atual'], r.listaExcluidos, function (l) { return [l.contrato, l.nome, l.empresa, l.antes]; }) +
        tabela('Dados corrigidos', ['Contrato', 'Aprendiz', 'Empresa', 'O que mudou'], r.listaDados, function (l) {
          return [l.contrato, l.nome, l.empresa, (l.campos || []).map(function (c) { return NOMES_CAMPOS[c] || c; }).join(', ')];
        });

      var nada = !r.novos && !r.mudouSituacao && !r.excluidos && !r.reativados && !r.dadosAlterados && !r.cpfCompletados;
      $('btnConfirmar').hidden = nada;
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
      var r = await A.rpc('processar_carga', parametros(true));
      msg('msgGravar', 'Pronto! Carga nº ' + r.carga_id + ' gravada. O painel já mostra os dados novos.', 'ok');
      $('btnConfirmar').hidden = true;
      $('btnCancelar').textContent = 'Carregar outra planilha';
      await carregarDicionario();
      await carregarHistorico();
    } catch (e) {
      msg('msgGravar', 'Não foi gravado: ' + e.message, 'erro');
      btn.disabled = false;
    }
  }

  /* ---------- histórico e desfazer ---------- */
  var ROTULO_TIPO = { inicial: 'Base inicial', completa: 'Completa', parcial: 'Parcial' };

  async function carregarHistorico() {
    var h = await A.rpc('cargas_lista');
    estado.totalContratos = h.total_contratos;
    var ativas = h.cargas.filter(function (c) { return !c.desfeita_em; });
    estado.ultimaData = ativas.length ? ativas[0].data_referencia : null;
    $('tabelaCargas').innerHTML = h.cargas.length ? h.cargas.map(function (c) {
      var r = c.resumo || {};
      return '<tr' + (c.desfeita_em ? ' style="opacity:.55"' : '') + '><td>' + esc(fmtData(c.data_referencia)) + '</td><td>' + esc(ROTULO_TIPO[c.tipo] || c.tipo) +
        '</td><td>' + esc(c.arquivo || '—') + '</td><td>' + esc(fmtDataHora(c.criado_em)) + (c.por ? ' · ' + esc(c.por) : '') +
        '</td><td>' + fmtInt(r.novos) + '</td><td>' + fmtInt(r.mudouSituacao) + '</td><td>' + fmtInt(r.excluidos) +
        '</td><td>' + (c.desfeita_em ? 'desfeita em ' + esc(fmtDataHora(c.desfeita_em)) : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="8">Nenhuma carga ainda. Comece pela base inicial (arquivo base-inicial.json).</td></tr>';
    $('btnDesfazer').hidden = !ativas.length;
    if (ativas.length) {
      $('btnDesfazer').textContent = 'Desfazer a última carga (dados de ' + fmtData(ativas[0].data_referencia) + ')';
    }
  }

  async function desfazer() {
    if (!window.confirm('Desfazer a última carga? A base volta exatamente como estava antes dela.')) return;
    $('btnDesfazer').disabled = true;
    try {
      var r = await A.rpc('desfazer_ultima_carga');
      msg('msgDesfazer', 'Carga nº ' + r.carga_id + ' desfeita.', 'ok');
      limparTudo();
      await carregarHistorico();
    } catch (e) {
      msg('msgDesfazer', e.message, 'erro');
    } finally {
      $('btnDesfazer').disabled = false;
    }
  }

  async function carregarDicionario() {
    estado.dicionario = await A.rpc('dicionario_lista');
  }

  /* ---------- eventos ---------- */
  $('campoArquivo').addEventListener('change', function () { if (this.files[0]) lerArquivo(this.files[0]); });
  var zona = $('zonaArquivo');
  ['dragenter', 'dragover'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('arrastando'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('arrastando'); }); });
  zona.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) lerArquivo(e.dataTransfer.files[0]); });
  document.querySelectorAll('input[name="tipo"]').forEach(function (r) { r.addEventListener('change', limparPrevia); });
  $('dataReferencia').addEventListener('change', limparPrevia);
  $('btnPrevia').addEventListener('click', verPrevia);
  $('btnConfirmar').addEventListener('click', confirmar);
  $('btnCancelar').addEventListener('click', function () { $('btnCancelar').textContent = 'Cancelar'; $('btnConfirmar').hidden = false; $('btnConfirmar').disabled = false; limparTudo(); window.scrollTo(0, 0); });
  $('btnDesfazer').addEventListener('click', desfazer);
  $('btnSair').addEventListener('click', async function () { await A.sair(); window.location.href = 'index.html'; });

  (async function iniciar() {
    $('dataReferencia').value = hojeISO();
    if (!(await A.sessaoAtual())) { window.location.href = 'index.html'; return; }
    try {
      var eu = await A.rpc('sessao');
      if (eu.papel !== 'admin') { msg('msgGeral', 'Esta tela é só para o administrador.', 'erro'); return; }
      $('usuarioNome').textContent = eu.nome + ' · administrador';
      await carregarDicionario();
      await carregarHistorico();
      msg('msgGeral', '');
      $('conteudo').hidden = false;
      A.vigiarInatividade(function () { window.location.href = 'index.html'; });
    } catch (e) {
      msg('msgGeral', e.message, 'erro');
    }
  })();
})();
