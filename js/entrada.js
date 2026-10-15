/* Página do painel: login -> busca os dados no banco -> desenha o painel. */
(function () {
  "use strict";

  var A = window.Acesso;
  var $ = function (id) { return document.getElementById(id); };
  var modoRecuperacao = false;

  function mostrar(qual) {
    document.body.classList.remove('carregando');
    $('avisoCarregando').hidden = qual !== 'carregando';
    $('telaAcesso').hidden = qual !== 'acesso' && qual !== 'senha';
    $('formEntrar').hidden = qual !== 'acesso';
    $('formNovaSenha').hidden = qual !== 'senha';
    $('baseVazia').hidden = qual !== 'vazia';
    $('painel').hidden = qual !== 'painel';
  }
  function aviso(id, texto, ok) {
    var el = $(id);
    el.textContent = texto || '';
    el.classList.toggle('ok', !!ok);
  }
  function fmtData(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  // monta o resumo da última carga no formato que o painel já sabe exibir
  function consolidacaoDe(cargas) {
    var c = cargas[0];
    if (!c) return null;
    var r = c.resumo || {}, alertas = [];
    (r.situacoesNovas || []).forEach(function (s) {
      alertas.push('Status nunca visto antes na base: ' + s + ' — precisa de definição.');
    });
    var notas = [];
    if (r.cpfCompletados) notas.push(r.cpfCompletados + (r.cpfCompletados === 1 ? ' CPF que estava mascarado foi completado' : ' CPFs que estavam mascarados foram completados') + ' com a planilha nova.');
    return {
      tipo: c.tipo === 'inicial' ? 'carga_inicial' : 'incremental',
      dataBaseAtual: c.data_referencia,
      dataBaseAnterior: cargas[1] ? cargas[1].data_referencia : null,
      baseAnteriorTotal: c.total_antes,
      planilhaNovaTotal: c.total_planilha,
      novos: r.novos || 0,
      mudouSituacao: r.mudouSituacao || 0,
      excluidos: r.excluidos || 0,
      reativados: r.reativados || 0,
      alertas: alertas,
      notas: notas
    };
  }

  /* O código dos gráficos (painel.js, herdado do protótipo) monta o HTML juntando
     textos. Para um nome ou empresa vindo da planilha nunca virar código na tela,
     os caracteres que abrem tags e atributos (< > ") são trocados por sinais
     parecidos que não têm efeito. Só muda a exibição; o banco guarda o original. */
  var TROCAS = { '<': '‹', '>': '›', '"': '”' };
  function neutralizar(valor) {
    return typeof valor === 'string' ? valor.replace(/[<>"]/g, function (c) { return TROCAS[c]; }) : valor;
  }
  function neutralizarRegistros(lista) {
    return lista.map(function (r) {
      var o = {};
      Object.keys(r).forEach(function (k) { o[k] = neutralizar(r[k]); });
      return o;
    });
  }

  // aviso quando a última carga completa tem mais de 40 dias: os vencimentos usam a data de hoje
  var DIAS_BASE_ANTIGA = 40;
  function avisarBaseAntiga(dataRef, admin) {
    if (!dataRef) return;
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var dias = Math.round((hoje - new Date(String(dataRef).slice(0, 10) + 'T00:00:00')) / 86400000);
    if (dias <= DIAS_BASE_ANTIGA) return;
    $('avisoBaseTexto').innerHTML = 'A última atualização completa da base é de <b>' + fmtData(dataRef) + '</b> (há ' + dias + ' dias). ' +
      'Vencimentos, alertas e idades usam a data de hoje, então podem estar desatualizados.' +
      (admin ? ' Carregue a extração mais recente.' : ' Peça a atualização da base ao administrador.');
    $('avisoBaseAcao').hidden = !admin;
    $('avisoBaseAntiga').hidden = false;
  }

  async function abrirPainel(registrarEntrada) {
    mostrar('carregando');
    var eu;
    try {
      eu = await A.rpc('sessao', { p_registrar: registrarEntrada === true });
    } catch (e) {
      await A.sair();
      window.location.href = 'https://portal.hbone.com.br';
      return;
    }
    var admin = eu.papel === 'admin';
    $('usuarioNome').textContent = eu.nome + (admin ? ' · administrador' : '');
    $('linkCarga').hidden = !admin;
    $('linkAcessos').hidden = !admin;
    $('linkCargaVazia').hidden = !admin;

    var dados;
    try {
      dados = await A.rpc('dados_painel');
    } catch (e) {
      mostrar('acesso');
      aviso('msgAcesso', 'Não foi possível carregar os dados: ' + e.message);
      return;
    }
    if (!dados.records.length) { mostrar('vazia'); return; }

    var cons = consolidacaoDe(dados.cargas);
    $('badgeBase').textContent = '● Base de ' + fmtData(cons && cons.dataBaseAtual);
    $('infoUltimaCarga').textContent = 'Última atualização: ' + fmtData(dados.cargas[0] && dados.cargas[0].criado_em);

    if (cons) { cons.alertas = cons.alertas.map(neutralizar); cons.notas = cons.notas.map(neutralizar); }
    // a base só fica "em dia" com uma carga completa; a parcial atualiza poucos contratos
    var ultimaCompleta = dados.cargas.filter(function (c) { return c.tipo !== 'parcial'; })[0];
    avisarBaseAntiga(ultimaCompleta && ultimaCompleta.data_referencia, admin);

    var registros = neutralizarRegistros(dados.records);
    mostrar('painel');
    window.iniciarPainel(registros, window.calcularAgregados(registros, cons));
    A.vigiarInatividade(function () { window.location.reload(); });
  }

  $('formEntrar').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var btn = $('btnEntrar');
    btn.disabled = true;
    aviso('msgAcesso', 'Entrando…', true);
    try {
      await A.entrar($('campoUsuario').value, $('campoSenha').value);
      $('campoSenha').value = '';
      aviso('msgAcesso', '');
      await abrirPainel(true);
    } catch (e) {
      aviso('msgAcesso', e.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('btnEsqueci').addEventListener('click', async function () {
    var usuario = $('campoUsuario').value.trim();
    if (!usuario) { aviso('msgAcesso', 'Digite o usuário acima e clique de novo em "Esqueci minha senha".'); return; }
    try {
      await A.enviarRecuperacao(usuario);
      aviso('msgAcesso', 'Se o usuário existir, um e-mail com o link para criar nova senha foi enviado.', true);
    } catch (e) {
      aviso('msgAcesso', e.message);
    }
  });

  $('btnTrocarSenha').addEventListener('click', function () {
    $('tituloNovaSenha').textContent = 'Trocar senha';
    aviso('msgNovaSenha', '');
    mostrar('senha');
    $('campoNova1').focus();
  });
  $('btnCancelarSenha').addEventListener('click', function () {
    if (modoRecuperacao) { modoRecuperacao = false; A.sair().then(function () { mostrar('acesso'); }); }
    else mostrar('painel');
  });

  $('formNovaSenha').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var s1 = $('campoNova1').value, s2 = $('campoNova2').value;
    if (s1.length < 10) { aviso('msgNovaSenha', 'A senha precisa ter pelo menos 10 caracteres.'); return; }
    if (s1 !== s2) { aviso('msgNovaSenha', 'As duas senhas não são iguais.'); return; }
    try {
      await A.trocarSenha(s1);
      A.rpc('registrar', { p_evento: 'troca de senha' }).catch(function () {});
      $('campoNova1').value = $('campoNova2').value = '';
      aviso('msgNovaSenha', 'Senha alterada.', true);
      if (modoRecuperacao) {
        modoRecuperacao = false;
        history.replaceState(null, '', window.location.pathname);
        setTimeout(function () { abrirPainel(true); }, 800);
      } else {
        setTimeout(function () { mostrar('painel'); }, 800);
      }
    } catch (e) {
      aviso('msgNovaSenha', e.message);
    }
  });

  async function sairAgora() {
    try { await A.rpc('registrar', { p_evento: 'saída' }); } catch (e) {}
    await A.sair();
    window.location.href = 'https://portal.hbone.com.br';
  }
  $('btnSair').addEventListener('click', sairAgora);
  $('btnSairVazia').addEventListener('click', sairAgora);

  // chegou pelo link do e-mail de "esqueci minha senha"
  A.cliente.auth.onAuthStateChange(function (evento) {
    if (evento === 'PASSWORD_RECOVERY') {
      modoRecuperacao = true;
      $('tituloNovaSenha').textContent = 'Criar nova senha';
      mostrar('senha');
    }
  });

  (async function iniciar() {
    if (/type=recovery/.test(window.location.hash)) return; // o evento acima cuida
    var s = await A.sessaoAtual();
    if (s) await abrirPainel(); else window.location.href = 'https://portal.hbone.com.br';
  })();
})();
