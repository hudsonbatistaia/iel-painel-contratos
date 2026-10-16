/* Lê a planilha de extração (Sheet1, colunas A–AK) e transforma cada linha no
   formato do banco. Só os campos usados pelo painel são aproveitados:
   telefone, e-mails, supervisor, atividades etc. ficam de fora (LGPD).
   No estágio entram também os campos de EXTRAS (bolsa, carga horária, recesso...). */
(function (raiz) {
  "use strict";

  var COLUNAS = {
    contrato: 'Contrato',
    cpf: 'CPF',
    nome: 'Estagiário',
    empresa: 'Concedente',
    cnpj: 'CNPJ',
    curso: 'Curso',
    instituicao: 'Instituição de Ensino',
    situacao: 'Situação',
    inicio: 'Início',
    fim: 'Encerramento',
    nasc: 'Data de Nascimento do Estagiário'
  };

  // Grafia "chave": sem acento, maiúscula, espaços únicos — "Auxiliar  de escritorio " = "AUXILIAR DE ESCRITORIO"
  function chave(valor) {
    return (valor == null ? '' : String(valor))
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/\s+/g, ' ').trim();
  }

  function soDigitos(valor, tamanho) {
    if (valor == null || valor === '') return null;
    var d = String(valor).replace(/\D/g, '');
    if (!d) return null;
    return tamanho ? d.padStart(tamanho, '0') : d;
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Aceita data do Excel (Date ou número de série) ou texto dd/mm/aaaa / aaaa-mm-dd
  function data(valor) {
    if (valor == null || valor === '') return null;
    if (valor instanceof Date && !isNaN(valor)) {
      // datas do Excel chegam à meia-noite local; ajusta para não "voltar um dia"
      var d = new Date(valor.getTime() + 12 * 3600 * 1000);
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }
    if (typeof valor === 'number') {
      var ms = Math.round((valor - 25569) * 86400 * 1000);
      var u = new Date(ms);
      return u.getUTCFullYear() + '-' + pad2(u.getUTCMonth() + 1) + '-' + pad2(u.getUTCDate());
    }
    var s = String(valor).trim(), m;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1]);
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    return 'invalida';
  }

  function texto(valor) {
    if (valor == null) return null;
    var s = String(valor).replace(/\s+/g, ' ').trim();
    return s || null;
  }

  // campos próprios do estágio, guardados em contratos.extras
  var EXTRAS = {
    tipo_contrato: 'Tipo de Contrato',
    bolsa: 'Bolsa',
    ch_semanal: 'Carga Horária Semanal',
    ch_diaria: 'Carga Horária Diária',
    semestre: 'Semestre',
    previsao_formatura: 'Previsão de Formatura',
    recesso_saldo: 'Recesso Remunerado Acumulado',  // saldo ainda não tirado (ver PLANO.md)
    recesso_tirado: 'Dias de Recesso Tirados'
  };

  // "   640.00" -> 640; vazio ou texto -> null
  function numero(valor) {
    if (valor == null || valor === '') return null;
    var n = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function extrasDe(x) {
    var prev = data(x[EXTRAS.previsao_formatura]);
    var sem = numero(x[EXTRAS.semestre]);
    return {
      tipo_contrato: texto(x[EXTRAS.tipo_contrato]),
      bolsa: numero(x[EXTRAS.bolsa]),
      ch_semanal: numero(x[EXTRAS.ch_semanal]),
      ch_diaria: numero(x[EXTRAS.ch_diaria]),
      semestre: sem != null && sem > 0 ? Math.round(sem) : null,
      previsao_formatura: prev === 'invalida' ? null : prev,
      recesso_saldo: numero(x[EXTRAS.recesso_saldo]),
      recesso_tirado: numero(x[EXTRAS.recesso_tirado]),
      aditivos: 0
    };
  }

  /* Extras do aprendiz: carga horária, fim previsto do curso e o horário da aula
     teórica no IEL, que a extração do aprendiz traz na coluna "Área de Atuação"
     (ex.: "De 13:00 às 17:00 no IEL, às sextas"). */
  var DIAS_SEMANA = [['SEG', 'Segunda'], ['TER', 'Terça'], ['QUA', 'Quarta'], ['QUI', 'Quinta'], ['SEX', 'Sexta'], ['SAB', 'Sábado']];
  function horarioTeorico(valor) {
    var t = texto(valor);
    if (!t) return { aula_teorica: null, aula_dia: null, aula_turno: null };
    var k = chave(t), dia = null, turno = null;
    for (var i = 0; i < DIAS_SEMANA.length; i++) {
      // "QUIINTAS" e outras grafias com letra repetida também valem
      if (new RegExp('\\b' + DIAS_SEMANA[i][0].split('').join('+') + '+').test(k)) { dia = DIAS_SEMANA[i][1]; break; }
    }
    var h = k.match(/(\d{1,2})\s*(?::|H)/);
    if (h) { var hora = +h[1]; turno = hora < 12 ? 'Manhã' : hora < 18 ? 'Tarde' : 'Noite'; }
    else if (/MANHA/.test(k)) turno = 'Manhã';
    else if (/TARDE/.test(k)) turno = 'Tarde';
    else if (/NOITE/.test(k)) turno = 'Noite';
    return { aula_teorica: t.slice(0, 120), aula_dia: dia, aula_turno: turno };
  }
  function extrasAprendizDe(x) {
    var prev = data(x[EXTRAS.previsao_formatura]);
    return Object.assign({
      ch_semanal: numero(x[EXTRAS.ch_semanal]),
      ch_diaria: numero(x[EXTRAS.ch_diaria]),
      previsao_formatura: prev === 'invalida' ? null : prev
    }, horarioTeorico(x['Área de Atuação']));
  }

  // coluna que diz o programa de cada linha (Jovem Aprendiz, estágio...)
  var COLUNA_TIPO = 'Tipo de Contrato';
  var COLUNA_SEQUENCIA = 'Sequência';

  /* linhasPlanilha: saída de XLSX.utils.sheet_to_json(..., {defval: null})
     dicionario: [{tipo, chave, valor}]
     doPrograma: função(valor de "Tipo de Contrato") -> true se a linha é do
                 programa escolhido. Linhas de outro programa são puladas.
     opcoes: { extrasEstagio: true } guarda também os campos de EXTRAS;
             { extrasAprendiz: true } guarda carga horária, fim do curso e aula teórica
     Devolve { linhas, faltandoColunas, problemas, grafiasNovas, outroPrograma, tiposOutros } */
  function interpretar(linhasPlanilha, dicionario, doPrograma, opcoes) {
    var comExtras = !!(opcoes && opcoes.extrasEstagio);
    var comExtrasAprendiz = !!(opcoes && opcoes.extrasAprendiz);
    var faltandoColunas = [];
    var primeira = linhasPlanilha[0] || {};
    Object.keys(COLUNAS).forEach(function (k) {
      if (!(COLUNAS[k] in primeira)) faltandoColunas.push(COLUNAS[k]);
    });
    if (faltandoColunas.length) return { linhas: [], faltandoColunas: faltandoColunas, problemas: [], grafiasNovas: [], outroPrograma: 0, tiposOutros: [] };
    var temTipo = COLUNA_TIPO in primeira;
    var outroPrograma = 0, tiposOutros = {};

    var dic = { funcao: {}, instituicao: {} };
    (dicionario || []).forEach(function (d) { dic[d.tipo][d.chave] = d.valor; });

    var linhas = [], problemas = [], novas = {}, candidatos = {};
    linhasPlanilha.forEach(function (x, i) {
      var nLinha = x.__linha || i + 2; // linha 1 é o cabeçalho; __linha = linha original quando a planilha foi separada por programa
      var contrato = soDigitos(x[COLUNAS.contrato]);
      var vazia = Object.keys(COLUNAS).every(function (k) { return x[COLUNAS[k]] == null || x[COLUNAS[k]] === ''; });
      if (vazia) return;
      if (temTipo && doPrograma) {
        var tipo = texto(x[COLUNA_TIPO]);
        // tipo vazio não decide nada: a linha segue para as conferências normais
        if (tipo && !doPrograma(tipo)) { outroPrograma++; tiposOutros[tipo] = true; return; }
      }
      if (!contrato) { problemas.push({ linha: nLinha, motivo: 'sem número de contrato — linha ignorada' }); return; }

      var cpf = soDigitos(x[COLUNAS.cpf], 11);
      if (!cpf || cpf.length !== 11) { problemas.push({ linha: nLinha, contrato: contrato, motivo: 'CPF ausente ou inválido — linha ignorada' }); return; }

      var nome = texto(x[COLUNAS.nome]);
      var empresa = texto(x[COLUNAS.empresa]);
      var situacao = texto(x[COLUNAS.situacao]);
      if (!nome || !empresa || !situacao) { problemas.push({ linha: nLinha, contrato: contrato, motivo: 'sem nome, empresa ou situação — linha ignorada' }); return; }

      var curso = texto(x[COLUNAS.curso]);
      var kCurso = chave(curso);
      var funcao = dic.funcao[kCurso];
      if (!funcao) {
        if (!kCurso || /^[^A-Z0-9]+$/.test(kCurso)) funcao = 'Não informado';
        else {
          novas['funcao|' + kCurso] = novas['funcao|' + kCurso] || { tipo: 'funcao', chave: kCurso, exemplo: curso, linhas: 0 };
          novas['funcao|' + kCurso].linhas++;
        }
      }

      var inst = texto(x[COLUNAS.instituicao]);
      var kInst = chave(inst);
      var instituicao = kInst ? dic.instituicao[kInst] : null;
      if (kInst && !instituicao) {
        novas['instituicao|' + kInst] = novas['instituicao|' + kInst] || { tipo: 'instituicao', chave: kInst, exemplo: inst, linhas: 0 };
        novas['instituicao|' + kInst].linhas++;
      }

      var inicio = data(x[COLUNAS.inicio]), fim = data(x[COLUNAS.fim]), nasc = data(x[COLUNAS.nasc]);
      ['inicio', 'fim', 'nasc'].forEach(function (campo) {
        var v = { inicio: inicio, fim: fim, nasc: nasc }[campo];
        if (v === 'invalida') problemas.push({ linha: nLinha, contrato: contrato, motivo: 'data inválida em "' + COLUNAS[campo] + '" — campo ficará vazio' });
      });

      var seq = soDigitos(x[COLUNA_SEQUENCIA]);

      var item = {
        linha: nLinha,
        contrato: contrato, cpf: cpf, nome: nome, empresa: empresa,
        cnpj: soDigitos(x[COLUNAS.cnpj], 14),
        funcao: funcao || null, curso_original: curso,
        _chaveFuncao: kCurso, _chaveInst: kInst,
        instituicao: instituicao || null, situacao: situacao,
        inicio: inicio === 'invalida' ? null : inicio,
        fim: fim === 'invalida' ? null : fim,
        nasc: nasc === 'invalida' ? null : nasc,
        sequencia: seq ? Number(seq) : null
      };
      if (comExtrasAprendiz) item.extras = extrasAprendizDe(x);
      if (comExtras) {
        item.extras = extrasDe(x);
        item.extras.aditivos = item.sequencia > 1 ? item.sequencia - 1 : 0;
      }

      var k = contrato + '|' + cpf;
      if (!candidatos[k]) candidatos[k] = [];
      candidatos[k].push(item);
    });

    var aditivosConsolidados = 0;
    Object.keys(candidatos).forEach(function (k) {
      var itens = candidatos[k];
      if (itens.length === 1) {
        linhas.push(itens[0]);
        return;
      }
      // Mais de um termo para o mesmo contrato + CPF:
      // Ordena do mais antigo para o mais recente pela Sequência ou data de término
      itens.sort(function (a, b) {
        if (a.sequencia != null && b.sequencia != null) return a.sequencia - b.sequencia;
        if (a.fim && b.fim) return a.fim.localeCompare(b.fim);
        return a.linha - b.linha;
      });

      var maisRecente = itens[itens.length - 1];
      var consolidado = Object.assign({}, maisRecente);

      // A data de início vem do primeiro termo que tiver início válido
      for (var t = 0; t < itens.length; t++) {
        if (itens[t].inicio) {
          consolidado.inicio = itens[t].inicio;
          break;
        }
      }

      aditivosConsolidados += (itens.length - 1);
      if (consolidado.extras && comExtras) {
        // os extras vêm do termo mais recente; aditivos = maior Sequência - 1 (ou nº de termos - 1)
        consolidado.extras = Object.assign({}, maisRecente.extras, { aditivos: Math.max(maisRecente.extras.aditivos, itens.length - 1) });
      }
      linhas.push(consolidado);
    });

    return {
      linhas: linhas,
      faltandoColunas: [],
      problemas: problemas,
      grafiasNovas: Object.keys(novas).map(function (k) { return novas[k]; }),
      outroPrograma: outroPrograma,
      tiposOutros: Object.keys(tiposOutros),
      aditivosConsolidados: aditivosConsolidados
    };
  }

  /* Depois que o administrador decide o nome oficial de cada grafia nova,
     preenche funcao/instituicao e devolve as linhas prontas para o banco. */
  function aplicarGrafias(linhas, decisoes) {
    var mapa = {};
    (decisoes || []).forEach(function (d) { mapa[d.tipo + '|' + d.chave] = d.valor; });
    return linhas.map(function (l) {
      var o = {};
      Object.keys(l).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = l[k]; });
      if (!o.funcao) o.funcao = mapa['funcao|' + l._chaveFuncao] || 'Não informado';
      if (!o.instituicao && l._chaveInst) o.instituicao = mapa['instituicao|' + l._chaveInst] || null;
      return o;
    });
  }

  var api = { COLUNAS: COLUNAS, EXTRAS: EXTRAS, horarioTeorico: horarioTeorico, COLUNA_TIPO: COLUNA_TIPO, chave: chave, data: data, interpretar: interpretar, aplicarGrafias: aplicarGrafias };
  raiz.Planilha = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
