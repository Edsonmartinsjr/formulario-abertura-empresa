// Código partilhado entre a página do cliente (index.html) e a do escritório (escritorio.html).
(() => {
  const DEMO = !window.SCRIPT_URL;

  // Tema de cores: config.js (window.TEMA) ou ?tema=laranja|dourado para pré-visualizar.
  const raiz = document.documentElement;
  try {
    const t = new URLSearchParams(location.search).get('tema') || window.TEMA;
    if (t && t !== 'laranja') raiz.dataset.tema = t;
  } catch {}

  // Modo diurno/noturno: escolha guardada neste navegador. Sem escolha, o violeta é noturno
  // e os outros temas seguem o sistema. Aplicado já aqui (no <head>) para não piscar.
  const MODO_KEY = 'dna-modo';
  const modoAtual = () => {
    let m = null;
    try { m = localStorage.getItem(MODO_KEY); } catch {}
    if (m === 'claro' || m === 'escuro') return m;
    if (raiz.dataset.tema === 'violeta') return 'escuro';
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  };
  const aplicarModo = m => { raiz.dataset.theme = m === 'claro' ? 'light' : 'dark'; };
  aplicarModo(modoAtual());

  const ICONE_SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  const ICONE_LUA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7z"/></svg>';
  const ROTULOS = { pt: ['Mudar para modo diurno', 'Mudar para modo noturno'],
                    en: ['Switch to light mode', 'Switch to dark mode'],
                    es: ['Cambiar a modo claro', 'Cambiar a modo oscuro'] };
  // No modo noturno mostra o sol (passar a diurno); no diurno mostra a lua.
  function rotularModo() {
    const b = document.getElementById('modo-btn'); if (!b) return;
    const escuro = modoAtual() === 'escuro';
    const r = ROTULOS[(raiz.lang || 'pt').slice(0, 2)] || ROTULOS.pt;
    b.innerHTML = escuro ? ICONE_SOL : ICONE_LUA;
    b.title = escuro ? r[0] : r[1];
    b.setAttribute('aria-label', b.title);
  }
  function botaoModo() {
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'modo-btn'; b.className = 'modo-btn';
    b.onclick = () => {
      const novo = modoAtual() === 'escuro' ? 'claro' : 'escuro';
      try { localStorage.setItem(MODO_KEY, novo); } catch {}
      aplicarModo(novo); rotularModo();
    };
    return b;
  }
  const TOTAL_PASSOS = 6;

  // ---------- logótipo DN (vetorial) ----------
  // O espaço à volta da diagonal é desenhado com a cor do fundo (`gap`).
  const logo = (gap = 'var(--header-bg)') => `<svg class="logo" viewBox="70 30 440 375" fill="none" stroke="currentColor" stroke-width="22" aria-label="Daniela Neves Advocacia">
    <path d="M195 355 V 66 H 268 A 132 144.5 0 0 1 268 355 Z"/>
    <line x1="95" y1="55" x2="485" y2="385" stroke="${gap}" stroke-width="64"/>
    <path d="M95 396 V 55 L 485 385 V 44" stroke-linejoin="miter"/>
  </svg>`;
  // Para o PDF: como imagem (o motor de PDF não desenha bem SVG embutido).
  const logoImg = () => `<img alt="" style="width:52px;display:block" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    logo('#ffffff').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="440" height="375" ').replaceAll('currentColor', '#111111'))}">`;

  // ---------- formatação ----------
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = v => (v === '' || v == null || isNaN(v)) ? '' :
    Number(v).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  const fmtNasc = v => { if (!v) return ''; const [y, m, d] = v.split('-'); return d ? `${d}/${m}/${y}` : v; };
  const fmtData = iso => iso ? new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const extenso = n => ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'][n] ?? String(n);
  const titulo = d => d?.nomeA || d?.nomeB || d?.nomeC || '';

  // ---------- documento PDF ----------
  const row = (k, v) => `<div class="row"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`;
  function buildDoc(d) {
    const socios = (d.socios || []).filter(s => Object.values(s).some(Boolean));
    const num = v => eur(v === '' || v == null ? '' : parseFloat(v));
    const temC = d.temContabilista === 'sim';
    return `
    <div class="doc">
      <div class="dhead"><div class="dlogo">${logoImg()}<div class="t">DANIELA NEVES<small>ADVOCACIA</small></div></div></div>
      <h3>FORMULÁRIO PARA A ABERTURA DA EMPRESA</h3>
      <div class="sec"><p class="q">1-) Três opções de nomes para a empresa (razão social):</p>
        ${row('A-', d.nomeA)}${row('B-', d.nomeB)}${row('C-', d.nomeC)}</div>
      <div class="sec"><p class="q">2-) Atividades principais e secundárias da empresa:</p>
        <div class="box">${esc(d.atividades)}</div></div>
      <div class="sec"><p class="q">3-) Valor do Capital Social:</p>${row('Capital social:', num(d.capital))}</div>
      <div class="sec"><p class="q">4-) Quantidade de sócios: ${String(socios.length).padStart(2, '0')} (${extenso(socios.length)})</p></div>
      ${socios.map((s, i) => `<div class="sec"><p class="q">${i + 1}.º Sócio(a):</p>
        ${row('Nome:', s.nome)}${row('Data de nascimento:', fmtNasc(s.nascimento))}${row('Estado civil:', s.estadoCivil)}
        ${row('Nome do cônjuge:', s.conjuge)}${row('Regime de bens:', s.regime)}${row('NIF:', s.nif)}
        ${row('Morada:', s.morada)}${row('Valor da quota societária:', num(s.quota))}</div>`).join('')}
      <div class="sec"><p class="q">5-) Já possui contabilista? ${temC ? 'Sim' : 'Não'}</p>
        ${temC ? row('Nome completo:', d.contNome) + row('Número da Ordem:', d.contOrdem) + row('NIF:', d.contNif) + row('Morada completa:', d.contMorada) : ''}</div>
      <div class="sec"><p class="q">6-) Morada da empresa:</p>
        ${row('Rua:', d.empRua)}${row('Freguesia:', d.empFreguesia)}${row('Concelho:', d.empConcelho)}
        ${row('Distrito:', d.empDistrito)}${row('Código Postal:', d.empCP)}</div>
      <div class="stamp">Gerado em ${new Date().toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' })}</div>
      <div class="dfoot">
        <div>Avenida Dom João II, 35B, sala 7A, Parque das<br>Nações, Lisboa, Portugal Código postal: 1990-083<br>danielaneves-47953L@adv.oa.pt<br>CP 47953L<br>+351 911011282</div>
        <div>Alameda Armenio Mendes, nº. 66, 6º andar, sala 610<br>Edifício Corporate, Santos, São Paulo. 11035-260.<br>danielaneves-47953L@adv.oa.pt<br>OAB/SP 282.534<br>+55 (13) 98219-7717</div>
      </div>
    </div>`;
  }

  async function gerarPdf(d) {
    let stage = document.getElementById('pdf-stage');
    if (!stage) { stage = document.createElement('div'); stage.id = 'pdf-stage'; document.body.append(stage); }
    stage.innerHTML = buildDoc(d);
    const nome = 'Formulario abertura empresa - ' + (titulo(d) || 'sem nome').replace(/[\\/:*?"<>|]/g, '').slice(0, 60) + '.pdf';
    try {
      if (!window.html2pdf) {
        // Sem a biblioteca (sem internet): impressão do navegador → "Guardar como PDF"
        const w = window.open('', '_blank');
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(nome)}</title>
          <link rel="stylesheet" href="${new URL('estilo.css', location.href)}">
          <style>@page{size:A4;margin:0} body{background:#fff;margin:0}</style></head><body>${stage.innerHTML}</body></html>`);
        w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
        return;
      }
      toast('A gerar PDF…');
      await html2pdf().set({
        margin: 0, filename: nome,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'avoid-all'] }
      }).from(stage.querySelector('.doc')).save();
    } finally {
      stage.innerHTML = '';
    }
  }

  // ---------- aviso rápido ----------
  let tt;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.append(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- ligação ao servidor (Google Apps Script) ----------
  async function api(acao, dados = {}) {
    if (DEMO) return demoApi(acao, dados);
    let r;
    try {
      r = await fetch(window.SCRIPT_URL, { method: 'POST', body: JSON.stringify({ acao, ...dados }) });
    } catch {
      throw new Error('Sem ligação ao servidor. Verifique a internet e tente novamente.');
    }
    const j = await r.json().catch(() => ({ ok: false, erro: 'Resposta inválida do servidor.' }));
    if (!j.ok) throw new Error(j.erro || 'Erro no servidor.');
    return j;
  }

  // Modo demonstração: imita o servidor guardando neste navegador (chave do escritório: "demo").
  const DKEY = 'dna-demo-servidor';
  function demoApi(acao, p) {
    let lista = [];
    try { lista = JSON.parse(localStorage.getItem(DKEY)) || []; } catch {}
    const gravar = () => { try { localStorage.setItem(DKEY, JSON.stringify(lista)); } catch {} };
    const chave = () => { if (p.chave !== 'demo') throw new Error('Chave do escritório inválida. (No modo demonstração use: demo)'); };
    const achar = () => { const r = lista.find(x => x.codigo === p.codigo); if (!r) throw new Error('Link inválido. Peça um novo link ao escritório.'); return r; };
    const agora = new Date().toISOString();
    switch (acao) {
      case 'obter': return { ok: true, registo: achar() };
      case 'guardar': {
        const r = achar();
        if (r.concluido) throw new Error('Este formulário já foi submetido.');
        const passos = [...new Set(p.passos || [])].sort();
        Object.assign(r, { dados: p.dados, passos, concluido: passos.length === TOTAL_PASSOS, atualizado: agora,
          estado: passos.length === TOTAL_PASSOS ? 'Concluído' : 'Em preenchimento' });
        gravar(); return { ok: true, registo: r };
      }
      case 'verificar': chave(); return { ok: true };
      case 'listar': chave(); return { ok: true, registos: [...lista].reverse() };
      case 'criar': {
        chave();
        const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const codigo = [...crypto.getRandomValues(new Uint8Array(10))].map(b => letras[b % letras.length]).join('');
        const r = { codigo, cliente: p.cliente || '', email: p.email || '', idioma: p.idioma || 'pt', criado: agora, atualizado: agora,
          estado: 'Por preencher', passos: [], concluido: false, dados: {}, documento: '' };
        lista.push(r); gravar(); return { ok: true, registo: r, emailEnviado: !!p.email };
      }
      case 'reenviar': {
        chave(); const r = achar();
        if (p.email) r.email = p.email;
        if (p.idioma) r.idioma = p.idioma;
        gravar();
        return { ok: true, registo: r };
      }
      case 'apagar': chave(); lista = lista.filter(x => x.codigo !== p.codigo); gravar(); return { ok: true };
    }
    throw new Error('Pedido desconhecido.');
  }

  // ---------- cabeçalho ----------
  function montarCabecalho() {
    const slot = document.querySelector('.logo-slot');
    if (slot) slot.outerHTML = logo();
    const brand = document.querySelector('header.top .brand');
    if (brand && !document.getElementById('modo-btn')) { brand.after(botaoModo()); rotularModo(); }
    if (DEMO) {
      const b = document.createElement('div');
      b.className = 'demo';
      b.textContent = 'Modo demonstração: os dados ficam só neste navegador. Configure o SCRIPT_URL em config.js para ligar à Planilha Google.';
      document.querySelector('header.top')?.after(b);
    }
  }

  // ---------- barra de carregamento ----------
  // Avança sozinha até ~92% enquanto espera; `fim()` completa os 100%.
  function loader(el, texto) {
    el.innerHTML = `<div class="loader" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(texto)}">
      <div class="loader-txt">${esc(texto)}</div>
      <div class="loader-bar"><div class="loader-track"><div class="loader-fill"></div><span class="loader-pct">0%</span></div></div></div>`;
    const raiz = el.querySelector('.loader'), fill = el.querySelector('.loader-fill'), pct = el.querySelector('.loader-pct');
    let p = 0;
    const set = v => {
      p = Math.min(100, v);
      fill.style.width = p + '%';
      fill.classList.toggle('cheio', p >= 100);
      pct.textContent = Math.round(p) + '%';
      pct.style.left = `calc(${p}% + 12px)`;
      pct.hidden = p > 86;
      raiz.setAttribute('aria-valuenow', Math.round(p));
    };
    set(4);
    const timer = setInterval(() => set(p + (92 - p) * 0.035), 120);
    return {
      async fim() { clearInterval(timer); set(100); await new Promise(r => setTimeout(r, 380)); },
      parar() { clearInterval(timer); }
    };
  }

  window.DNA = { DEMO, loader, rotularModo, TOTAL_PASSOS, logo, esc, eur, fmtData, extenso, titulo, buildDoc, gerarPdf, toast, api, montarCabecalho };
})();
