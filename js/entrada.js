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
    if (r.cpfCompletados) alertas.push(r.cpfCompletados + ' CPF(s) que estavam mascarados foram completados nesta carga.');
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
      alertas: alertas
    };
  }

  async function abrirPainel() {
    mostrar('carregando');
    var eu;
    try {
      eu = await A.rpc('sessao');
    } catch (e) {
      await A.sair();
      mostrar('acesso');
      aviso('msgAcesso', e.message);
      return;
    }
    var admin = eu.papel === 'admin';
    $('usuarioNome').textContent = eu.nome + (admin ? ' · administrador' : '');
    $('linkCarga').hidden = !admin;
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

    mostrar('painel');
    window.iniciarPainel(dados.records, window.calcularAgregados(dados.records, cons));
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
      await abrirPainel();
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
      $('campoNova1').value = $('campoNova2').value = '';
      aviso('msgNovaSenha', 'Senha alterada.', true);
      if (modoRecuperacao) {
        modoRecuperacao = false;
        history.replaceState(null, '', window.location.pathname);
        setTimeout(abrirPainel, 800);
      } else {
        setTimeout(function () { mostrar('painel'); }, 800);
      }
    } catch (e) {
      aviso('msgNovaSenha', e.message);
    }
  });

  async function sairAgora() { await A.sair(); window.location.reload(); }
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
    if (s) await abrirPainel(); else mostrar('acesso');
  })();
})();
