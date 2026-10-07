/**
 * Formulário de abertura de empresa — Daniela Neves Advocacia
 * Servidor em Google Apps Script, ligado a uma Planilha Google.
 *
 * Cliente (link individual com código secreto): só consegue ler e guardar o SEU formulário.
 * Escritório (chave secreta): cria links, lista o histórico e apaga registos.
 *
 * Instalação: ver LEIA-ME.md. Depois de colar este código, execute a função `configurar`
 * uma vez e copie a chave do escritório que aparece no "Registo de execução".
 */

const FOLHA = 'Formularios';
const COLUNAS = ['codigo', 'cliente', 'criado', 'atualizado', 'estado', 'passos', 'empresa', 'socios', 'dados', 'documento'];
const TOTAL_PASSOS = 6;
const NOME_PASTA = 'Formulários abertura empresa – Documentos';

// ---------- configuração (executar à mão no editor) ----------

function configurar() {
  folha_();
  const props = PropertiesService.getScriptProperties();
  let chave = props.getProperty('CHAVE_ESCRITORIO');
  if (!chave) {
    chave = novaChave_();
    props.setProperty('CHAVE_ESCRITORIO', chave);
  }
  Logger.log('Chave do escritório (guarde em local seguro): ' + chave);
}

/** Gera uma chave nova (a antiga deixa de funcionar). */
function trocarChave() {
  const chave = novaChave_();
  PropertiesService.getScriptProperties().setProperty('CHAVE_ESCRITORIO', chave);
  Logger.log('Nova chave do escritório: ' + chave);
}

/**
 * Executar uma vez depois de atualizar o código: dá ao script permissão para criar
 * Google Docs e cria os documentos dos formulários já concluídos.
 */
function autorizarDocumentos() {
  const pasta = pasta_();
  const f = folha_();
  const n = f.getLastRow() - 1;
  let criados = 0;
  for (let i = 0; i < n; i++) {
    const intervalo = f.getRange(i + 2, 1, 1, COLUNAS.length);
    const v = intervalo.getValues()[0];
    if (v[col_('codigo')] && v[col_('estado')] === 'Concluído' && !v[col_('documento')]) {
      v[col_('documento')] = documento_(v);
      intervalo.setValues([v]);
      criados++;
    }
  }
  Logger.log('Pasta dos documentos: ' + pasta.getUrl());
  Logger.log('Documentos criados agora: ' + criados);
}

function novaChave_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

// ---------- pedidos HTTP ----------

function doGet() {
  return json_({ ok: true, servico: 'formulario-abertura-empresa' });
}

function doPost(e) {
  let resposta;
  try {
    const pedido = JSON.parse(e.postData.contents);
    resposta = tratar_(pedido);
  } catch (err) {
    resposta = { ok: false, erro: String(err && err.message || err) };
  }
  return json_(resposta);
}

function tratar_(p) {
  switch (p.acao) {
    // ----- cliente -----
    case 'obter': {
      const linha = procurar_(p.codigo);
      if (!linha) throw new Error('Link inválido. Peça um novo link ao escritório.');
      return { ok: true, registo: publico_(linha.valores) };
    }
    case 'guardar': {
      return comBloqueio_(() => {
        const linha = procurar_(p.codigo);
        if (!linha) throw new Error('Link inválido. Peça um novo link ao escritório.');
        const dados = p.dados || {};
        const passos = (Array.isArray(p.passos) ? p.passos : [])
          .map(Number).filter(n => n >= 0 && n < TOTAL_PASSOS);
        const unicos = [...new Set(passos)].sort();
        const concluido = unicos.length === TOTAL_PASSOS;
        const v = linha.valores;
        v[col_('atualizado')] = new Date();
        v[col_('estado')] = concluido ? 'Concluído' : 'Em preenchimento';
        v[col_('passos')] = unicos.join(',');
        v[col_('empresa')] = texto_(dados.nomeA || '');
        v[col_('socios')] = texto_((dados.socios || []).map(s => s && s.nome).filter(Boolean).join('; '));
        v[col_('dados')] = JSON.stringify(dados);
        if (concluido) {
          // Cria (ou atualiza) o Google Doc; uma falha aqui não impede o cliente de guardar.
          try { v[col_('documento')] = documento_(v); }
          catch (err) { console.error('Erro ao criar o documento: ' + err); }
        }
        linha.intervalo.setValues([v]);
        return { ok: true, registo: publico_(v) };
      });
    }

    // ----- escritório -----
    case 'listar': {
      verificarChave_(p.chave);
      const f = folha_();
      const n = f.getLastRow() - 1;
      const linhas = n > 0 ? f.getRange(2, 1, n, COLUNAS.length).getValues() : [];
      return { ok: true, registos: linhas.filter(l => l[0]).map(l => publico_(l, true)).reverse() };
    }
    case 'criar': {
      verificarChave_(p.chave);
      return comBloqueio_(() => {
        const codigo = codigoCurto_();
        const agora = new Date();
        const v = [codigo, texto_(String(p.cliente || '').slice(0, 200)), agora, agora, 'Por preencher', '', '', '', '{}', ''];
        folha_().appendRow(v);
        return { ok: true, registo: publico_(v) };
      });
    }
    case 'apagar': {
      verificarChave_(p.chave);
      return comBloqueio_(() => {
        const linha = procurar_(p.codigo);
        if (linha) folha_().deleteRow(linha.numero);
        return { ok: true };
      });
    }
    case 'verificar': {
      verificarChave_(p.chave);
      return { ok: true };
    }
    default:
      throw new Error('Pedido desconhecido.');
  }
}

// ---------- auxiliares ----------

function folha_() {
  const ss = SpreadsheetApp.getActive();
  let f = ss.getSheetByName(FOLHA);
  if (!f) f = ss.insertSheet(FOLHA);
  if (f.getLastRow() === 0) {
    f.appendRow(COLUNAS);
    f.setFrozenRows(1);
    f.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold');
  }
  // planilhas criadas antes da coluna "documento"
  const ultimo = f.getRange(1, COLUNAS.length);
  if (!ultimo.getValue()) ultimo.setValue(COLUNAS[COLUNAS.length - 1]).setFontWeight('bold');
  return f;
}

// ---------- Google Doc ----------

function pasta_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PASTA_DOCS');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const planilha = DriveApp.getFileById(SpreadsheetApp.getActive().getId());
  const pais = planilha.getParents();
  const pasta = (pais.hasNext() ? pais.next() : DriveApp.getRootFolder()).createFolder(NOME_PASTA);
  props.setProperty('PASTA_DOCS', pasta.getId());
  return pasta;
}

/** Cria ou atualiza o Google Doc do formulário e devolve o URL. */
function documento_(v) {
  let d = {};
  try { d = JSON.parse(v[col_('dados')] || '{}'); } catch (e) {}
  const cliente = String(v[col_('cliente')] || '');
  const nome = 'Abertura de empresa – ' + (cliente || d.nomeA || 'cliente') + (d.nomeA && cliente ? ' (' + d.nomeA + ')' : '');

  let doc = null;
  const id = (String(v[col_('documento')] || '').match(/\/d\/([\w-]+)/) || [])[1];
  if (id) { try { doc = DocumentApp.openById(id); doc.setName(nome); } catch (e) { doc = null; } }
  if (!doc) {
    doc = DocumentApp.create(nome);
    DriveApp.getFileById(doc.getId()).moveTo(pasta_());
  }

  const P = DocumentApp.ParagraphHeading;
  const A = DocumentApp.HorizontalAlignment;
  const body = doc.getBody();
  body.clear();
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(60).setMarginRight(60);

  const linha = (texto, opts) => {
    const p = body.appendParagraph(texto || '');
    p.setHeading(P.NORMAL);
    p.editAsText().setFontFamily('Times New Roman').setFontSize(11).setBold(false).setUnderline(false);
    if (opts && opts.centro) p.setAlignment(A.CENTER);
    return p;
  };
  const secao = texto => { const p = linha(texto); p.editAsText().setBold(true); p.setSpacingBefore(12); return p; };
  const campo = (rotulo, valor) => {
    const p = linha('');
    p.appendText(rotulo + ' ').setBold(true);
    p.appendText(valor ? String(valor) : '—').setBold(false).setFontFamily('Arial').setFontSize(10.5);
    return p;
  };

  // cabeçalho
  const marca = linha('DANIELA NEVES', { centro: true });
  marca.editAsText().setFontFamily('Montserrat').setFontSize(20);
  const sub = linha('ADVOCACIA', { centro: true });
  sub.editAsText().setFontFamily('Montserrat').setFontSize(9);
  body.appendHorizontalRule();
  const tit = linha('FORMULÁRIO PARA A ABERTURA DA EMPRESA', { centro: true });
  tit.editAsText().setBold(true).setUnderline(true).setFontSize(12.5);
  tit.setSpacingBefore(6).setSpacingAfter(6);
  if (cliente) campo('Cliente:', cliente);

  secao('1-) Três opções de nomes para a empresa (razão social):');
  campo('A-', d.nomeA); campo('B-', d.nomeB); campo('C-', d.nomeC);

  secao('2-) Atividades principais e secundárias da empresa:');
  const ativ = linha(d.atividades || '—');
  ativ.editAsText().setFontFamily('Arial').setFontSize(10.5);

  secao('3-) Valor do Capital Social:');
  campo('Capital social:', eur_(d.capital));

  const socios = (d.socios || []).filter(s => s && Object.keys(s).some(k => s[k]));
  secao('4-) Quantidade de sócios: ' + ('0' + socios.length).slice(-2) + ' (' + extenso_(socios.length) + ')');
  socios.forEach((s, i) => {
    secao((i + 1) + '.º Sócio(a):');
    campo('Nome:', s.nome);
    campo('Data de nascimento:', data_(s.nascimento));
    campo('Estado civil:', s.estadoCivil);
    campo('Nome do cônjuge:', s.conjuge);
    campo('Regime de bens:', s.regime);
    campo('NIF:', s.nif);
    campo('Morada:', s.morada);
    campo('Valor da quota societária:', eur_(s.quota));
  });

  const temC = d.temContabilista === 'sim';
  secao('5-) Já possui contabilista? ' + (temC ? 'Sim' : 'Não'));
  if (temC) {
    campo('Nome completo:', d.contNome); campo('Número da Ordem:', d.contOrdem);
    campo('NIF:', d.contNif); campo('Morada completa:', d.contMorada);
  }

  secao('6-) Morada da empresa:');
  campo('Rua:', d.empRua); campo('Freguesia:', d.empFreguesia); campo('Concelho:', d.empConcelho);
  campo('Distrito:', d.empDistrito); campo('Código Postal:', d.empCP);

  const rod = linha('Preenchido pelo cliente em ' + Utilities.formatDate(new Date(), 'Europe/Lisbon', 'dd/MM/yyyy HH:mm'));
  rod.setSpacingBefore(18).setAlignment(A.RIGHT);
  rod.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#666666');

  // rodapé com os contactos do escritório
  const footer = doc.getFooter() || doc.addFooter();
  footer.clear();
  const fp = footer.appendParagraph(
    'Avenida Dom João II, 35B, sala 7A, Parque das Nações, Lisboa, Portugal · 1990-083 · CP 47953L · +351 911011282\n' +
    'Alameda Armenio Mendes, nº 66, 6º andar, sala 610, Edifício Corporate, Santos, São Paulo · 11035-260 · OAB/SP 282.534 · +55 (13) 98219-7717\n' +
    'danielaneves-47953L@adv.oa.pt');
  fp.setAlignment(A.CENTER);
  fp.editAsText().setFontFamily('Arial').setFontSize(7).setBold(true);

  // remove o parágrafo vazio que fica no início após body.clear()
  const primeiro = body.getChild(0);
  if (body.getNumChildren() > 1 && primeiro.getType() === DocumentApp.ElementType.PARAGRAPH && !primeiro.asParagraph().getText()) {
    primeiro.removeFromParent();
  }

  doc.saveAndClose();
  return doc.getUrl();
}

function eur_(v) {
  if (v === '' || v == null || isNaN(parseFloat(v))) return '';
  const [int, dec] = parseFloat(v).toFixed(2).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + dec + ' €';
}
function data_(v) { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '/' + m[2] + '/' + m[1] : (v || ''); }
function extenso_(n) { return ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'][n] || String(n); }

function col_(nome) { return COLUNAS.indexOf(nome); }

/** Código aleatório de 10 caracteres para o link do cliente (~58 bits, sem 0/O/1/l/I). */
function codigoCurto_() {
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + Utilities.getUuid() + Date.now());
  let s = '';
  for (let i = 0; i < 10; i++) s += letras[(bytes[i] + 256) % letras.length];
  return s;
}

function procurar_(codigo) {
  // aceita códigos curtos (novos) e UUID (links antigos)
  if (!/^[A-Za-z0-9-]{8,36}$/.test(String(codigo || ''))) return null;
  const f = folha_();
  const n = f.getLastRow() - 1;
  if (n < 1) return null;
  const codigos = f.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < codigos.length; i++) {
    if (codigos[i][0] === codigo) {
      const numero = i + 2;
      const intervalo = f.getRange(numero, 1, 1, COLUNAS.length);
      return { numero, intervalo, valores: intervalo.getValues()[0] };
    }
  }
  return null;
}

function publico_(v, escritorio) {
  let dados = {};
  try { dados = JSON.parse(v[col_('dados')] || '{}'); } catch (e) {}
  const passos = String(v[col_('passos')] || '').split(',').filter(s => s !== '').map(Number);
  return {
    codigo: v[col_('codigo')],
    cliente: String(v[col_('cliente')] || '').replace(/^'/, ''),
    criado: iso_(v[col_('criado')]),
    atualizado: iso_(v[col_('atualizado')]),
    estado: v[col_('estado')],
    passos: passos,
    concluido: passos.length === TOTAL_PASSOS,
    dados: dados,
    documento: escritorio ? String(v[col_('documento')] || '') : undefined
  };
}

function iso_(d) { return d instanceof Date ? d.toISOString() : String(d || ''); }

/** Impede que texto escrito pelo cliente seja interpretado como fórmula na planilha. */
function texto_(s) { s = String(s); return /^[=+\-@]/.test(s) ? "'" + s : s; }

function verificarChave_(chave) {
  const certa = PropertiesService.getScriptProperties().getProperty('CHAVE_ESCRITORIO');
  if (!certa) throw new Error('O servidor ainda não foi configurado (execute a função configurar).');
  if (!chave || chave !== certa) throw new Error('Chave do escritório inválida.');
}

function comBloqueio_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
