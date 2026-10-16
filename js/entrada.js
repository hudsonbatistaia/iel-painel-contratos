/* Página do painel: login -> tela inicial (escolha do programa) ->
   busca os dados do programa no banco -> desenha o painel. */
(function () {
  "use strict";

  var A = window.Acesso;
  var PR = window.Programas;
  var $ = function (id) { return document.getElementById(id); };
  var modoRecuperacao = false;
  var telaAtual = null;      // para o "Cancelar" da troca de senha voltar ao lugar certo
  var vigiando = false;

  function mostrar(qual) {
    document.body.classList.remove('carregando');
    if (qual !== 'senha' && qual !== 'carregando') telaAtual = qual;
    $('avisoCarregando').hidden = qual !== 'carregando';
    $('telaAcesso').hidden = qual !== 'acesso' && qual !== 'senha';
    $('formEntrar').hidden = qual !== 'acesso';
    $('formNovaSenha').hidden = qual !== 'senha';
    $('baseVazia').hidden = qual !== 'vazia';
    $('telaInicio').hidden = qual !== 'inicio';
    $('painel').hidden = qual !== 'painel';
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
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
  function avisarBaseAntiga(dataRef, admin, programa) {
    if (!dataRef) return;
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var dias = Math.round((hoje - new Date(String(dataRef).slice(0, 10) + 'T00:00:00')) / 86400000);
    if (dias <= DIAS_BASE_ANTIGA) return;
    $('avisoBaseTexto').innerHTML = 'A última atualização completa da base é de <b>' + fmtData(dataRef) + '</b> (há ' + dias + ' dias). ' +
      'Vencimentos, alertas e idades usam a data de hoje, então podem estar desatualizados.' +
      (admin ? ' Carregue a extração mais recente.' : ' Peça a atualização da base ao administrador.');
    $('avisoBaseAcao').href = PR.url('carga.html', programa);
    $('avisoBaseAcao').hidden = !admin;
    $('avisoBaseAntiga').hidden = false;
  }

  // depois do login: tela inicial, ou direto o painel se o endereço já diz o programa
  async function abrir(registrarEntrada) {
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
    var quem = eu.nome + (admin ? ' · administrador' : '');
    $('usuarioNome').textContent = quem;
    $('inicioUsuario').textContent = quem;
    $('linkAcessos').hidden = !admin;
    $('inicioAcessos').hidden = !admin;
    if (!vigiando) { vigiando = true; A.vigiarInatividade(function () { window.location.reload(); }); }

    var programa = PR.atual();
    if (programa) await abrirPainel(programa, admin);
    else await mostrarInicio(admin);
  }

  async function mostrarInicio(admin) {
    document.title = 'Painel de Contratos';
    var resumo;
    try {
      resumo = await A.rpc('resumo_programas');
    } catch (e) {
      mostrar('inicio');
      $('inicioMsg').textContent = 'Não foi possível carregar o resumo: ' + e.message;
      return;
    }
    $('inicioCartoes').innerHTML = resumo.map(function (r) {
      var info = PR.INFO[r.programa];
      if (!info) return '';
      if (!r.total) {
        return '<div class="card programa-cartao vazio" data-programa="' + esc(r.programa) + '">' +
          '<span class="programa-nome">' + esc(info.nome) + '</span>' +
          '<span class="programa-num">Ainda sem dados</span>' +
          '<span class="programa-meta">Nenhuma planilha deste programa foi carregada.</span>' +
          (admin ? '<a class="programa-ir" href="' + esc(PR.url('carga.html', r.programa)) + '">Carregar a primeira planilha →</a>' : '') +
          '</div>';
      }
      return '<a class="card programa-cartao" data-programa="' + esc(r.programa) + '" href="' + esc(PR.url('index.html', r.programa)) + '">' +
        '<span class="programa-nome">' + esc(info.nome) + '</span>' +
        '<span class="programa-num">' + fmtInt(r.ativos) + '</span>' +
        '<span class="programa-num-l">' + (r.ativos === 1 ? 'contrato ativo' : 'contratos ativos') + '</span>' +
        '<span class="programa-meta">' + fmtInt(r.empresas) + (r.empresas === 1 ? ' empresa' : ' empresas') +
          ' · ' + fmtInt(r.total) + ' contratos na base · dados de ' + esc(fmtData(r.data_referencia)) + '</span>' +
        '<span class="programa-ir">Abrir painel →</span></a>';
    }).join('');
    mostrar('inicio');
  }

  async function abrirPainel(programa, admin) {
    var info = PR.INFO[programa];
    document.title = 'Painel de Contratos · ' + info.nome;
    $('marcaPrograma').textContent = info.marca;
    document.querySelectorAll('#programaTroca .programa-opt').forEach(function (a) {
      var on = a.getAttribute('data-programa') === programa;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('linkCarga').href = PR.url('carga.html', programa);
    $('linkCarga').hidden = !admin;
    $('linkCargaVazia').href = PR.url('carga.html', programa);
    $('linkCargaVazia').hidden = !admin;
    PR.aplicarTextos(programa);

    var dados;
    try {
      dados = await A.rpc('dados_painel', { p_programa: programa });
    } catch (e) {
      mostrar('acesso');
      aviso('msgAcesso', 'Não foi possível carregar os dados: ' + e.message);
      return;
    }
    if (!dados.records.length) {
      $('textoBaseVazia').textContent = 'Ainda não há contratos do ' + info.nome + ' carregados.';
      mostrar('vazia');
      return;
    }

    var cons = consolidacaoDe(dados.cargas);
    $('badgeBase').textContent = '● Base de ' + fmtData(cons && cons.dataBaseAtual);
    $('infoUltimaCarga').textContent = 'Última atualização: ' + fmtData(dados.cargas[0] && dados.cargas[0].criado_em);

    if (cons) { cons.alertas = cons.alertas.map(neutralizar); cons.notas = cons.notas.map(neutralizar); }
    // a base só fica "em dia" com uma carga completa; a parcial atualiza poucos contratos
    var ultimaCompleta = dados.cargas.filter(function (c) { return c.tipo !== 'parcial'; })[0];
    avisarBaseAntiga(ultimaCompleta && ultimaCompleta.data_referencia, admin, programa);

    var registros = neutralizarRegistros(dados.records);
    mostrar('painel');
    window.iniciarPainel(registros, window.calcularAgregados(registros, cons), { programa: programa, rotulos: info.rotulos, faixasEtarias: info.faixasEtarias });
    if (programa === 'estagio') window.iniciarEstagio(registros);
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
      await abrir(true);
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

  function pedirNovaSenha() {
    $('tituloNovaSenha').textContent = 'Trocar senha';
    aviso('msgNovaSenha', '');
    mostrar('senha');
    $('campoNova1').focus();
  }
  $('btnTrocarSenha').addEventListener('click', pedirNovaSenha);
  $('inicioTrocarSenha').addEventListener('click', pedirNovaSenha);
  $('btnCancelarSenha').addEventListener('click', function () {
    if (modoRecuperacao) { modoRecuperacao = false; A.sair().then(function () { mostrar('acesso'); }); }
    else mostrar(telaAtual || 'inicio');
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
        setTimeout(function () { abrir(true); }, 800);
      } else {
        setTimeout(function () { mostrar(telaAtual || 'inicio'); }, 800);
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
  $('inicioSair').addEventListener('click', sairAgora);

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
    if (s) await abrir(); else window.location.href = 'https://portal.hbone.com.br';
  })();
})();
