/* Configuração pública do sistema. Estas chaves podem ficar visíveis:
   quem protege os dados são o login e as regras do banco. */
window.CONFIG = {
  supabaseUrl: 'https://tlcmkfterimzhbdczkpa.supabase.co',
  supabaseChavePublica: 'sb_publishable_mPhuLMmhGQE0cJHbbRpJbA_1woDfay4',
  // o usuário digita só "contratos"; o sistema completa com o domínio
  dominioUsuarios: 'hbone.com.br',
  // sai sozinho depois deste tempo sem uso (minutos)
  minutosInatividade: 30
};
