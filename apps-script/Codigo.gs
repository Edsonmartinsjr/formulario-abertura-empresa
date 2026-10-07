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
const COLUNAS = ['codigo', 'cliente', 'criado', 'atualizado', 'estado', 'passos', 'empresa', 'socios', 'dados'];
const TOTAL_PASSOS = 6;

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
      return { ok: true, registos: linhas.filter(l => l[0]).map(publico_).reverse() };
    }
    case 'criar': {
      verificarChave_(p.chave);
      return comBloqueio_(() => {
        const codigo = codigoCurto_();
        const agora = new Date();
        const v = [codigo, texto_(String(p.cliente || '').slice(0, 200)), agora, agora, 'Por preencher', '', '', '', '{}'];
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
  return f;
}

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

function publico_(v) {
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
    dados: dados
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
