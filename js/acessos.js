/* Tela "Registro de acessos" (somente administrador). */
(function () {
  "use strict";

  var A = window.Acesso;
  var $ = function (id) { return document.getElementById(id); };
  var todos = [];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function msg(texto, tipo) {
    var el = $('msgGeral');
    el.textContent = texto || '';
    el.className = 'carga-msg' + (tipo ? ' ' + tipo : '');
  }

  // "carga 3" -> "Gravou a carga nº 3"
  function descrever(evento) {
    var m;
    if (evento === 'entrada') return 'Entrou no painel';
    if (evento === 'saída') return 'Saiu';
    if (evento === 'troca de senha') return 'Trocou a senha';
    if ((m = evento.match(/^carga (\d+)$/))) return 'Gravou a carga nº ' + m[1];
    if ((m = evento.match(/^desfez carga (\d+)$/))) return 'Desfez a carga nº ' + m[1];
    return evento;
  }
  function categoria(evento) {
    return /carga/.test(evento) ? 'carga' : evento;
  }

  function desenhar() {
    var u = $('filtroUsuario').value, ev = $('filtroEvento').value;
    var lista = todos.filter(function (a) {
      return (!u || a.nome === u) && (!ev || categoria(a.evento) === ev);
    });

    var trintaDias = Date.now() - 30 * 86400000;
    var entradas30 = todos.filter(function (a) { return a.evento === 'entrada' && new Date(a.em).getTime() >= trintaDias; });
    var ultima = {};
    todos.forEach(function (a) { if (a.evento === 'entrada' && !ultima[a.nome]) ultima[a.nome] = a.em; });
    var cards = [['Entradas nos últimos 30 dias', entradas30.length]];
    Object.keys(ultima).sort().forEach(function (n) { cards.push(['Última entrada · ' + n, fmtDataHora(ultima[n])]); });
    $('resumoAcessos').innerHTML = cards.map(function (c) {
      return '<div class="carga-numero"><div class="n" style="font-size:' + (typeof c[1] === 'number' ? '26px' : '16px') + '">' +
        esc(typeof c[1] === 'number' ? c[1].toLocaleString('pt-BR') : c[1]) + '</div><div class="l">' + esc(c[0]) + '</div></div>';
    }).join('');

    $('tabelaAcessos').innerHTML = lista.length ? lista.map(function (a) {
      return '<tr><td>' + esc(fmtDataHora(a.em)) + '</td><td>' + esc(a.nome) + (a.papel === 'admin' ? ' <small>(admin)</small>' : '') +
        '</td><td>' + esc(descrever(a.evento)) + '</td></tr>';
    }).join('') : '<tr><td colspan="3">Nenhum registro com esse filtro.</td></tr>';
  }

  $('filtroUsuario').addEventListener('change', desenhar);
  $('filtroEvento').addEventListener('change', desenhar);
  $('btnSair').addEventListener('click', async function () {
    try { await A.rpc('registrar', { p_evento: 'saída' }); } catch (e) {}
    await A.sair();
    window.location.href = 'index.html';
  });

  (async function iniciar() {
    if (!(await A.sessaoAtual())) { window.location.href = 'index.html'; return; }
    try {
      var eu = await A.rpc('sessao');
      if (eu.papel !== 'admin') { msg('Esta tela é só para o administrador.', 'erro'); return; }
      $('usuarioNome').textContent = eu.nome + ' · administrador';
      todos = await A.rpc('acessos_lista', { p_limite: 500 });
      var nomes = todos.map(function (a) { return a.nome; }).filter(function (n, i, arr) { return arr.indexOf(n) === i; }).sort();
      $('filtroUsuario').innerHTML = '<option value="">Todos</option>' + nomes.map(function (n) {
        return '<option value="' + esc(n) + '">' + esc(n) + '</option>';
      }).join('');
      desenhar();
      msg('');
      $('conteudo').hidden = false;
      A.vigiarInatividade(function () { window.location.href = 'index.html'; });
    } catch (e) {
      msg(e.message, 'erro');
    }
  })();
})();
