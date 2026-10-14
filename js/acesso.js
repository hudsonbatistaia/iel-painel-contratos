/* Login, sessão e chamadas ao banco — usado pelas duas páginas. */
(function () {
  "use strict";

  var cfg = window.CONFIG;
  var cliente = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseChavePublica, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.sessionStorage }
  });

  function emailDoUsuario(usuario) {
    usuario = (usuario || '').trim().toLowerCase();
    return usuario.indexOf('@') === -1 ? usuario + '@' + cfg.dominioUsuarios : usuario;
  }

  var MENSAGENS = [
    [/invalid login credentials/i, 'Usuário ou senha incorretos.'],
    [/email not confirmed/i, 'Este usuário ainda não foi ativado.'],
    [/rate limit|too many/i, 'Muitas tentativas. Espere alguns minutos e tente de novo.'],
    [/should be different/i, 'A nova senha precisa ser diferente da atual.'],
    [/password should be at least/i, 'A senha é curta demais.'],
    [/failed to fetch|network/i, 'Sem conexão com o servidor. Verifique a internet.'],
    [/jwt expired|session/i, 'Sua sessão expirou. Entre de novo.']
  ];
  function traduzir(erro) {
    var msg = (erro && (erro.message || erro.msg || erro.error_description)) || String(erro || 'Erro desconhecido');
    for (var i = 0; i < MENSAGENS.length; i++) if (MENSAGENS[i][0].test(msg)) return MENSAGENS[i][1];
    return msg;
  }

  // chama uma função do banco (schema "contratos"); devolve os dados ou lança erro em português
  async function rpc(nome, params) {
    var r = await cliente.schema('contratos').rpc(nome, params || {});
    if (r.error) throw new Error(traduzir(r.error));
    return r.data;
  }

  async function entrar(usuario, senha) {
    var r = await cliente.auth.signInWithPassword({ email: emailDoUsuario(usuario), password: senha });
    if (r.error) throw new Error(traduzir(r.error));
    return r.data.session;
  }

  async function sair() {
    try { await cliente.auth.signOut(); } catch (e) {}
    try { window.sessionStorage.clear(); } catch (e) {}
  }

  async function sessaoAtual() {
    var r = await cliente.auth.getSession();
    return r.data ? r.data.session : null;
  }

  async function enviarRecuperacao(usuario) {
    var r = await cliente.auth.resetPasswordForEmail(emailDoUsuario(usuario), {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (r.error) throw new Error(traduzir(r.error));
  }

  async function trocarSenha(nova) {
    var r = await cliente.auth.updateUser({ password: nova });
    if (r.error) throw new Error(traduzir(r.error));
  }

  // sai sozinho depois de X minutos sem mexer
  function vigiarInatividade(aoExpirar) {
    var limite = (cfg.minutosInatividade || 30) * 60000, timer;
    function reiniciar() {
      clearTimeout(timer);
      timer = setTimeout(async function () { await sair(); aoExpirar(); }, limite);
    }
    ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, reiniciar, { passive: true });
    });
    reiniciar();
  }

  window.Acesso = {
    cliente: cliente, rpc: rpc, entrar: entrar, sair: sair, sessaoAtual: sessaoAtual,
    enviarRecuperacao: enviarRecuperacao, trocarSenha: trocarSenha,
    vigiarInatividade: vigiarInatividade, traduzir: traduzir
  };
})();
