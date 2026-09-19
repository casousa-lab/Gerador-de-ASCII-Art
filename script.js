"use strict";

/* =========================================================
   ASCII Studio: editor de posters em ASCII com live view

   Organização deste arquivo
   1. Utilidades e constantes
   2. Estado do projeto e histórico (desfazer/refazer)
   3. Imagem de origem, recorte e amostragem
   4. Motor ASCII (imagem → caracteres) e cache de rasterização
   5. Renderização do poster (fundo, camadas, moldura, grão)
   6. Interação no canvas (mover, redimensionar, girar)
   7. Painéis (campos ligados ao estado, camadas, paletas)
   8. Exportação, projeto e inicialização
   ========================================================= */


/* =========================================================
   1. UTILIDADES E CONSTANTES
   ========================================================= */

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function criarCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
}

function hexParaRgb(hex) {
    const n = parseInt(String(hex).replace("#", ""), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminanciaHex(hex) {
    const [r, g, b] = hexParaRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Conjuntos de caracteres, do mais "vazio" para o mais "denso"
const CONJUNTOS = {
    classico:  { nome: "Clássico",  chars: " .:,;+*?%S#@" },
    suave:     { nome: "Suave",     chars: " .:-=+*#%@" },
    detalhado: { nome: "Detalhado", chars: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
    blocos:    { nome: "Blocos",    chars: " ░▒▓█" },
    binario:   { nome: "Binário",   chars: " .10" },
    personalizado: { nome: "Personalizado", chars: null }
};

const FONTES_ASCII = ["Courier New", "Space Mono", "JetBrains Mono", "IBM Plex Mono", "Share Tech Mono", "VT323"];
const FONTES_TEXTO = ["Montserrat", "Bebas Neue", "Anton", "Archivo Black", "Space Grotesk", "Playfair Display", "DM Serif Display", "Space Mono", "VT323"];
const FONTES_MONO = new Set(FONTES_ASCII);
const FONTES_SERIF = new Set(["Playfair Display", "DM Serif Display"]);

function pilha(fonte) {
    const generica = FONTES_MONO.has(fonte) ? "monospace" : FONTES_SERIF.has(fonte) ? "serif" : "sans-serif";
    return `"${fonte}", ${generica}`;
}

const PRESETS_TAMANHO = [
    ["A3/A4 retrato (1:1,414)", 1240, 1754],
    ["A3/A4 paisagem", 1754, 1240],
    ["Retrato 3:4", 1200, 1600],
    ["Instagram 4:5", 1080, 1350],
    ["Quadrado 1:1", 1200, 1200],
    ["Story 9:16", 1080, 1920],
    ["Paisagem 16:9", 1920, 1080]
];

const PALETAS = [
    { nome: "Terminal",       modo: "solid",    bg: "#000000", bg2: "#000000", texto: "#00ff00", c1: "#0b5d2a", c2: "#b6ffcf" },
    { nome: "Âmbar CRT",      modo: "solid",    bg: "#120a00", bg2: "#120a00", texto: "#ffb000", c1: "#7a3d00", c2: "#ffe0a3" },
    { nome: "Papel e tinta",  modo: "solid",    bg: "#ece8dc", bg2: "#ece8dc", texto: "#16161a", c1: "#5a5648", c2: "#16161a" },
    { nome: "Cianótipo",      modo: "solid",    bg: "#0b2545", bg2: "#0b2545", texto: "#dff1ff", c1: "#13315c", c2: "#8ecae6" },
    { nome: "Neon",           modo: "solid",    bg: "#12001f", bg2: "#12001f", texto: "#ff2bd6", c1: "#6a00f4", c2: "#00e5ff" },
    { nome: "Pôr do sol",     modo: "gradient", bg: "#2b0a3d", bg2: "#e4572e", texto: "#fff1d6", c1: "#ffb703", c2: "#fff1d6" },
    { nome: "Alto contraste", modo: "solid",    bg: "#ffffff", bg2: "#ffffff", texto: "#000000", c1: "#444444", c2: "#000000" },
    { nome: "Grafite",        modo: "solid",    bg: "#1c1c1c", bg2: "#1c1c1c", texto: "#eaeaea", c1: "#555555", c2: "#ffffff" }
];

const ICONE = (() => {
    const s = (interno) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${interno}</svg>`;
    return {
        olho: s('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
        olhoOff: s('<path d="M3 3l18 18"/><path d="M10.6 6.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1"/>'),
        cadeado: s('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
        cadeadoAberto: s('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>'),
        texto: s('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
        forma: s('<rect x="4" y="5" width="16" height="14" rx="2"/>'),
        ascii: s('<path d="M4 7h4M4 12h8M4 17h5M14 7h6M16 12h4M12 17h8"/>')
    };
})();


/* =========================================================
   2. ESTADO DO PROJETO E HISTÓRICO
   ========================================================= */

function imagemPadrao() {
    return { ratio: "original", zoom: 1, offX: 0, offY: 0, rot: 0, flipH: false, flipV: false };
}

function camadaTexto(id, extra) {
    return Object.assign({
        id, type: "text", text: "Novo texto", font: "Montserrat", size: 60, weight: "700", italic: false,
        align: "center", color: "#00ff00", spacing: 0, lineH: 1.15, upper: false,
        opacity: 100, rot: 0, x: 0, y: 0, visible: true, locked: false
    }, extra);
}

function camadaForma(id, extra) {
    return Object.assign({
        id, type: "shape", kind: "line", w: 500, h: 120, fillOn: true, fill: "#00ff00",
        stroke: "#00ff00", strokeW: 4, radius: 0,
        opacity: 100, rot: 0, x: 0, y: 0, visible: true, locked: false
    }, extra);
}

function novoEstado() {
    return {
        v: 1,
        nextId: 4,
        sel: 1,
        poster: {
            w: 1200, h: 1600,
            bgMode: "solid", bg: "#000000", bg2: "#0b2a14", bgAngle: 180,
            vignette: 0, grain: 0,
            frame: { on: true, margin: 36, width: 3, style: "solid", radius: 0, color: "#00ff00" }
        },
        image: imagemPadrao(),
        ascii: {
            cols: 110, charset: "classico", custom: " .:-=+*#%@", reverse: false,
            font: "Courier New", bold: false, lineH: 1, mapping: "auto",
            brightness: 0, contrast: 0, gamma: 1, edges: 0, dither: "none"
        },
        color: { mode: "mono", text: "#00ff00", c1: "#0b5d2a", c2: "#b6ffcf", boost: 60, angle: 90, glow: 0, glowColor: "#00ff00" },
        layers: [
            { id: 1, type: "ascii", x: 600, y: 830, size: 78, rot: 0, opacity: 100, visible: true, locked: false },
            camadaTexto(2, { text: "ASCII POSTER", size: 84, weight: "800", spacing: 6, upper: true, x: 600, y: 150 }),
            camadaTexto(3, { text: "arraste, gire e edite tudo ao vivo", size: 26, weight: "500", spacing: 4, x: 600, y: 1490 })
        ]
    };
}

let S = novoEstado();   // estado do projeto (é o que vai para o histórico e para o arquivo salvo)
let RES = null;         // resultado do último cálculo ASCII (não vai para o histórico)
let SRC = null;         // imagem de origem (não vai para o histórico)

const camadaSel = () => S.layers.find((l) => l.id === S.sel) || null;
const camadaAscii = () => S.layers.find((l) => l.type === "ascii") || null;

function mesclar(base, extra) {
    if (base === null || typeof base !== "object" || Array.isArray(base)) return extra === undefined ? base : extra;
    const saida = Object.assign({}, base);
    if (extra && typeof extra === "object") {
        for (const k of Object.keys(extra)) {
            const b = base[k];
            saida[k] = b && typeof b === "object" && !Array.isArray(b) ? mesclar(b, extra[k]) : extra[k];
        }
    }
    return saida;
}

// ----- histórico -----
const hist = { undo: [], redo: [], last: "" };

function commit() {
    const snap = JSON.stringify(S);
    if (snap === hist.last) return;
    hist.undo.push(hist.last);
    if (hist.undo.length > 100) hist.undo.shift();
    hist.redo = [];
    hist.last = snap;
    atualizarBotoesHistorico();
}

function restaurar(snap) {
    S = JSON.parse(snap);
    hist.last = snap;
    if (!camadaSel()) S.sel = S.layers.length ? S.layers[S.layers.length - 1].id : null;
    renderizarLista();
    renderizarProps();
    syncControles();
    syncPoster();
    pedirRender(true);
    atualizarBotoesHistorico();
}

function desfazer() {
    if (!hist.undo.length) return;
    hist.redo.push(hist.last);
    restaurar(hist.undo.pop());
}

function refazer() {
    if (!hist.redo.length) return;
    hist.undo.push(hist.last);
    restaurar(hist.redo.pop());
}

function atualizarBotoesHistorico() {
    $("#btnUndo").disabled = !hist.undo.length;
    $("#btnRedo").disabled = !hist.redo.length;
}

let toastT = 0;
function aviso(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("on"), 2800);
}


/* =========================================================
   3. IMAGEM DE ORIGEM, RECORTE E AMOSTRAGEM
   ========================================================= */

let idFonte = 0;
let cacheOrientada = null;

function temTransparencia(canvas) {
    const t = criarCanvas(48, 48);
    const g = t.getContext("2d", { willReadFrequently: true });
    g.drawImage(canvas, 0, 0, 48, 48);
    const d = g.getImageData(0, 0, 48, 48).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
    return false;
}

function definirFonte(el, nome, bytes, opc = {}) {
    const ow = el.naturalWidth || el.width;
    const oh = el.naturalHeight || el.height;
    const esc = Math.min(1, 1600 / Math.max(ow, oh)); // limita a 1600 px: mais que isso não muda uma arte de 300 colunas
    const c = criarCanvas(ow * esc, oh * esc);
    c.getContext("2d").drawImage(el, 0, 0, c.width, c.height);
    SRC = { canvas: c, nome, bytes, ow, oh, id: ++idFonte, exemplo: !!opc.exemplo, alfa: temTransparencia(c) };
    cacheOrientada = null;
    S.image = imagemPadrao();
    calcularAscii();
    if (opc.ajustar) ajustarArteNaPagina(false);
    atualizarCartaoFonte();
    syncControles();
    pedirRender(true);
    if (!opc.semCommit) commit();
}

function carregarArquivo(arquivo) {
    if (!arquivo) return;
    if (!arquivo.type || !arquivo.type.startsWith("image/")) {
        aviso("Esse arquivo não é uma imagem. Use PNG, JPG ou WEBP.");
        return;
    }
    if (arquivo.size > 25 * 1024 * 1024) {
        aviso("Imagem muito grande. O limite é 25 MB.");
        return;
    }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
        definirFonte(img, arquivo.name, arquivo.size, { ajustar: true });
        URL.revokeObjectURL(url);
    };
    img.onerror = () => {
        URL.revokeObjectURL(url);
        aviso("Não consegui abrir essa imagem. Tente outro arquivo.");
    };
    img.src = url;
}

// Imagem de exemplo desenhada por código, para o editor nascer com algo na tela
function gerarExemplo() {
    const w = 800, h = 1000;
    const c = criarCanvas(w, h);
    const g = c.getContext("2d");
    const horizonte = h * 0.62;

    const ceu = g.createLinearGradient(0, 0, 0, horizonte);
    ceu.addColorStop(0, "#0b1026");
    ceu.addColorStop(0.55, "#7b2d5b");
    ceu.addColorStop(1, "#ff9a4d");
    g.fillStyle = ceu;
    g.fillRect(0, 0, w, h);

    let semente = 7;
    const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    g.fillStyle = "#fff";
    for (let i = 0; i < 70; i++) {
        g.globalAlpha = 0.25 + rnd() * 0.6;
        g.fillRect(rnd() * w, rnd() * horizonte * 0.6, 2, 2);
    }
    g.globalAlpha = 1;

    const sol = g.createRadialGradient(400, 470, 20, 400, 470, 230);
    sol.addColorStop(0, "#fff6d5");
    sol.addColorStop(0.55, "#ffd166");
    sol.addColorStop(1, "#ff6b3d");
    g.fillStyle = sol;
    g.beginPath();
    g.arc(400, 470, 230, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#3a1846";
    g.beginPath();
    g.moveTo(0, horizonte);
    g.lineTo(0, 500); g.lineTo(140, 430); g.lineTo(260, 520); g.lineTo(380, 470);
    g.lineTo(520, 545); g.lineTo(650, 440); g.lineTo(800, 520); g.lineTo(800, horizonte);
    g.closePath();
    g.fill();

    g.fillStyle = "#170b26";
    g.beginPath();
    g.moveTo(0, horizonte);
    g.lineTo(0, 560); g.lineTo(200, 500); g.lineTo(330, 585); g.lineTo(470, 540);
    g.lineTo(600, 590); g.lineTo(740, 520); g.lineTo(800, 560); g.lineTo(800, horizonte);
    g.closePath();
    g.fill();

    const agua = g.createLinearGradient(0, horizonte, 0, h);
    agua.addColorStop(0, "#22103f");
    agua.addColorStop(1, "#05060f");
    g.fillStyle = agua;
    g.fillRect(0, horizonte, w, h - horizonte);

    for (let i = 0; i < 14; i++) {
        const y = horizonte + 14 + i * i * 2.4;
        const largura = 330 - i * 15;
        g.fillStyle = "#ffb15c";
        g.globalAlpha = 0.85 - i * 0.055;
        g.fillRect(400 - largura / 2, y, largura, 5 + i * 0.7);
    }
    g.globalAlpha = 1;
    return c;
}

function orientada() {
    const { rot, flipH, flipV } = S.image;
    const chave = `${SRC.id}|${rot}|${flipH}|${flipV}`;
    if (cacheOrientada && cacheOrientada.chave === chave) return cacheOrientada.canvas;
    const troca = rot === 90 || rot === 270;
    const sw = SRC.canvas.width, sh = SRC.canvas.height;
    const c = criarCanvas(troca ? sh : sw, troca ? sw : sh);
    const g = c.getContext("2d");
    g.translate(c.width / 2, c.height / 2);
    g.rotate((rot * Math.PI) / 180);
    g.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    g.drawImage(SRC.canvas, -sw / 2, -sh / 2);
    cacheOrientada = { chave, canvas: c };
    return c;
}

function razaoRecorte() {
    const r = S.image.ratio;
    if (r === "original") return null;
    const [a, b] = r.split(":").map(Number);
    return a / b;
}

// Calcula qual trecho da imagem vira ASCII (proporção + zoom + posição)
function infoRecorte() {
    const o = orientada();
    const ow = o.width, oh = o.height;
    const aspecto = razaoRecorte() || ow / oh;
    let cw, ch;
    if (ow / oh > aspecto) { ch = oh; cw = ch * aspecto; } else { cw = ow; ch = cw / aspecto; }
    cw /= S.image.zoom;
    ch /= S.image.zoom;
    const mx = (ow - cw) / 2, my = (oh - ch) / 2;
    return { o, aspecto, cw, ch, sx: mx + (S.image.offX / 100) * mx, sy: my + (S.image.offY / 100) * my };
}

// Reduz por etapas (metades) para não serrilhar quando a imagem é muito maior que a grade
function reduzir(g, src, sx, sy, sw, sh, dw, dh) {
    let cur = src, cx = sx, cy = sy, cw = sw, ch = sh;
    while (cw / dw > 2 && ch / dh > 2) {
        const nw = Math.max(dw, Math.round(cw / 2));
        const nh = Math.max(dh, Math.round(ch / 2));
        const t = criarCanvas(nw, nh);
        const tg = t.getContext("2d");
        tg.imageSmoothingQuality = "high";
        tg.drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
        cur = t; cx = 0; cy = 0; cw = nw; ch = nh;
    }
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(cur, cx, cy, cw, ch, 0, 0, dw, dh);
}

function amostrar(ci, cols, rows) {
    const dst = criarCanvas(cols, rows);
    const g = dst.getContext("2d", { willReadFrequently: true });
    g.fillStyle = S.poster.bg; // áreas transparentes da imagem viram a cor do fundo
    g.fillRect(0, 0, cols, rows);
    reduzir(g, ci.o, ci.sx, ci.sy, ci.cw, ci.ch, cols, rows);
    return g.getImageData(0, 0, cols, rows).data;
}

function atualizarCartaoFonte() {
    $("#srcNome").textContent = SRC.nome;
    const kb = SRC.bytes
        ? (SRC.bytes < 1024 * 1024 ? `${Math.round(SRC.bytes / 1024)} KB` : `${(SRC.bytes / 1048576).toFixed(1)} MB`)
        : (SRC.exemplo ? "gerada por código" : "vinda do projeto");
    $("#srcMeta").textContent = `${SRC.ow} × ${SRC.oh} px, ${kb}`;
}

function atualizarMiniatura(ci) {
    const m = $("#miniatura");
    const larg = 240;
    const alt = clamp(Math.round(larg / ci.aspecto), 60, 400);
    if (m.width !== larg || m.height !== alt) { m.width = larg; m.height = alt; }
    const g = m.getContext("2d");
    g.clearRect(0, 0, larg, alt);
    g.imageSmoothingQuality = "high";
    g.drawImage(ci.o, ci.sx, ci.sy, ci.cw, ci.ch, 0, 0, larg, alt);
}


/* =========================================================
   4. MOTOR ASCII
   ========================================================= */

const metricasCache = new Map();
const fontesPedidas = new Set();

// Pede ao navegador que carregue uma fonte da web e redesenha quando ela chegar
function garantirFonte(spec) {
    if (fontesPedidas.has(spec)) return;
    fontesPedidas.add(spec);
    if (!document.fonts || !document.fonts.load) return;
    document.fonts.load(spec).then(() => {
        limparCaches();
        pedirRender(true);
    }).catch(() => {});
}

function limparCaches() {
    metricasCache.clear();
    rasterCache.chave = null;
}

const mctx = criarCanvas(1, 1).getContext("2d");

// Largura de um caractere dividida pelo tamanho da fonte (0,6 no Courier)
function metricaFonte(fonte, negrito) {
    const chave = `${fonte}|${negrito}`;
    if (metricasCache.has(chave)) return metricasCache.get(chave);
    garantirFonte(`${negrito ? 700 : 400} 20px ${pilha(fonte)}`);
    mctx.font = `${negrito ? 700 : 400} 100px ${pilha(fonte)}`;
    const cw = mctx.measureText("M").width / 100 || 0.6;
    metricasCache.set(chave, cw);
    return cw;
}

function obterRampa() {
    const A = S.ascii;
    const bruto = A.charset === "personalizado" ? A.custom || "" : (CONJUNTOS[A.charset] || CONJUNTOS.classico).chars;
    let r = Array.from(bruto);
    if (r.length < 2) r = Array.from(CONJUNTOS.classico.chars);
    if (A.reverse) r.reverse();
    return r;
}

function bordas(L, cols, rows) {
    const saida = new Float32Array(L.length);
    const at = (x, y) => L[clamp(y, 0, rows - 1) * cols + clamp(x, 0, cols - 1)];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
            const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
            saida[y * cols + x] = Math.min(1, Math.hypot(gx, gy) / 1.5);
        }
    }
    return saida;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

let versaoAscii = 0;

function calcularAscii() {
    if (!SRC) return;
    const A = S.ascii, C = S.color;
    const cw = metricaFonte(A.font, A.bold);
    const ci = infoRecorte();
    const cols = clamp(Math.round(A.cols), 10, 400);
    // A altura da grade compensa o formato do caractere: é isso que mantém a proporção da imagem
    const rows = clamp(Math.round((cols / ci.aspecto) * (cw / A.lineH)), 1, 800);
    const d = amostrar(ci, cols, rows);
    atualizarMiniatura(ci);

    const n = cols * rows;
    const L0 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        L0[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
    }
    const E = A.edges > 0 ? bordas(L0, cols, rows) : null;

    const bri = (A.brightness / 100) * 0.5;
    const fc = A.contrast < 0 ? 1 + A.contrast / 100 : 1 + (A.contrast / 100) * 4;
    const g = 1 / Math.max(0.05, A.gamma);
    const e = A.edges / 100;
    // Fundo claro com texto escuro inverte o mapeamento: "denso" passa a representar as sombras
    const inverter = A.mapping === "escuro" || (A.mapping === "auto" && luminanciaHex(S.poster.bg) > 0.5);

    const V = new Float32Array(n); // densidade desejada (0 = vazio, 1 = mais denso)
    for (let i = 0; i < n; i++) {
        let v = (L0[i] - 0.5) * fc + 0.5 + bri;
        v = Math.pow(clamp(v, 0, 1), g);
        if (inverter) v = 1 - v;
        if (E) v = clamp(v * (1 - e * 0.5) + E[i] * e * 1.2, 0, 1);
        V[i] = v;
    }

    const ramp = obterRampa();
    const N = ramp.length;
    const idx = new Uint16Array(n);

    if (A.dither === "floyd") {
        const buf = Float32Array.from(V);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const i = y * cols + x;
                const antigo = clamp(buf[i], 0, 1);
                const q = Math.round(antigo * (N - 1));
                idx[i] = q;
                const erro = antigo - q / (N - 1);
                if (x + 1 < cols) buf[i + 1] += (erro * 7) / 16;
                if (y + 1 < rows) {
                    if (x > 0) buf[i + cols - 1] += (erro * 3) / 16;
                    buf[i + cols] += (erro * 5) / 16;
                    if (x + 1 < cols) buf[i + cols + 1] += erro / 16;
                }
            }
        }
    } else if (A.dither === "ordenado") {
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const i = y * cols + x;
                const t = (BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) / 16 - 0.5;
                idx[i] = Math.round(clamp(V[i] + t / (N - 1), 0, 1) * (N - 1));
            }
        }
    } else {
        for (let i = 0; i < n; i++) idx[i] = Math.round(V[i] * (N - 1));
    }

    // Cor por caractere (só nos modos que precisam)
    let cores = null;
    if (C.mode === "original") {
        cores = new Uint8ClampedArray(n * 3);
        const k = C.boost / 100;
        for (let i = 0; i < n; i++) {
            const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
            const m = Math.max(r, gg, b, 1);
            cores[i * 3] = lerp(r, (r * 255) / m, k);
            cores[i * 3 + 1] = lerp(gg, (gg * 255) / m, k);
            cores[i * 3 + 2] = lerp(b, (b * 255) / m, k);
        }
    } else if (C.mode === "tone") {
        cores = new Uint8ClampedArray(n * 3);
        const a = hexParaRgb(C.c1), b = hexParaRgb(C.c2);
        for (let i = 0; i < n; i++) {
            cores[i * 3] = lerp(a[0], b[0], V[i]);
            cores[i * 3 + 1] = lerp(a[1], b[1], V[i]);
            cores[i * 3 + 2] = lerp(a[2], b[2], V[i]);
        }
    }

    const linhas = [];
    for (let y = 0; y < rows; y++) {
        let s = "";
        for (let x = 0; x < cols; x++) s += ramp[idx[y * cols + x]];
        linhas.push(s);
    }

    RES = {
        cols, rows, cw, ramp, idx, cores, linhas,
        texto: linhas.map((l) => l.replace(/\s+$/, "")).join("\n"),
        ver: ++versaoAscii
    };
    atualizarInfo();
}

function gradienteAngular(ctx, w, h, angulo, c1, c2) {
    const a = (angulo * Math.PI) / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const len = Math.abs(w * dx) + Math.abs(h * dy);
    const g = ctx.createLinearGradient(w / 2 - (dx * len) / 2, h / 2 - (dy * len) / 2, w / 2 + (dx * len) / 2, h / 2 + (dy * len) / 2);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    return g;
}

// A arte é rasterizada uma vez e reaproveitada: mover ou girar a camada não refaz milhares de fillText
const rasterCache = { chave: null, canvas: null };

function rasterizarAscii(larguraUn, escala) {
    const A = S.ascii, C = S.color;
    const wPx = Math.max(1, Math.ceil(larguraUn * escala));
    const hPx = Math.max(1, Math.ceil(RES.rows * A.lineH * (larguraUn / (RES.cols * RES.cw)) * escala));
    const chave = [RES.ver, wPx, hPx, A.font, A.bold, A.lineH, C.mode, C.text, C.c1, C.c2, C.angle].join("|");
    if (rasterCache.chave === chave) return rasterCache.canvas;

    const cv = criarCanvas(wPx, hPx);
    const g = cv.getContext("2d");
    const celW = wPx / RES.cols;
    const celH = hPx / RES.rows;
    g.font = `${A.bold ? 700 : 400} ${celW / RES.cw}px ${pilha(A.font)}`;
    g.textBaseline = "middle";

    const soAscii = RES.ramp.every((ch) => ch.charCodeAt(0) < 128);
    const usaGradiente = C.mode === "gradient";

    if ((C.mode === "mono" || usaGradiente) && soAscii) {
        // Caminho rápido: uma linha por fillText
        g.textAlign = "left";
        g.fillStyle = usaGradiente ? gradienteAngular(g, wPx, hPx, C.angle, C.c1, C.c2) : C.text;
        for (let y = 0; y < RES.rows; y++) g.fillText(RES.linhas[y], 0, (y + 0.5) * celH);
    } else {
        // Caminho por caractere: posiciona cada um na sua célula e agrupa por cor
        g.textAlign = "center";
        const grupos = new Map();
        const total = RES.cols * RES.rows;
        for (let i = 0; i < total; i++) {
            const ch = RES.ramp[RES.idx[i]];
            if (ch.trim() === "") continue;
            let chaveCor = 0;
            if (RES.cores) {
                chaveCor = ((RES.cores[i * 3] >> 3) << 10) | ((RES.cores[i * 3 + 1] >> 3) << 5) | (RES.cores[i * 3 + 2] >> 3);
            }
            let lista = grupos.get(chaveCor);
            if (!lista) { lista = []; grupos.set(chaveCor, lista); }
            lista.push(i);
        }
        for (const [chaveCor, lista] of grupos) {
            if (RES.cores) {
                const r = ((chaveCor >> 10) & 31) * 8 + 4, gg = ((chaveCor >> 5) & 31) * 8 + 4, b = (chaveCor & 31) * 8 + 4;
                g.fillStyle = `rgb(${r},${gg},${b})`;
            } else {
                g.fillStyle = usaGradiente ? gradienteAngular(g, wPx, hPx, C.angle, C.c1, C.c2) : C.text;
            }
            for (const i of lista) {
                const x = i % RES.cols, y = (i / RES.cols) | 0;
                g.fillText(RES.ramp[RES.idx[i]], (x + 0.5) * celW, (y + 0.5) * celH);
            }
        }
    }
    rasterCache.chave = chave;
    rasterCache.canvas = cv;
    return cv;
}

function atualizarInfo() {
    if (RES) $("#stat").textContent = `${RES.cols} colunas × ${RES.rows} linhas, ${(RES.cols * RES.rows).toLocaleString("pt-BR")} caracteres`;
    $("#statPoster").textContent = `${S.poster.w} × ${S.poster.h} px`;
    const esc = parseFloat($("#escalaExp").value) || 1;
    const fmt = $("#fmt").value;
    $("#infoExp").textContent = fmt === "txt"
        ? "Exporta apenas o texto, sem cores nem camadas."
        : `Arquivo final: ${Math.round(S.poster.w * esc)} × ${Math.round(S.poster.h * esc)} px`;
}


/* =========================================================
   5. RENDERIZAÇÃO DO POSTER
   ========================================================= */

const fontesUsadasEmTexto = () => S.layers.filter((l) => l.type === "text");

function fonteTexto(L) {
    return `${L.italic ? "italic " : ""}${L.weight} ${L.size}px ${pilha(L.font)}`;
}

function larguraLinha(ctx, s, esp) {
    if (!esp) return ctx.measureText(s).width;
    const cs = Array.from(s);
    let w = 0;
    for (const c of cs) w += ctx.measureText(c).width;
    return w + esp * Math.max(0, cs.length - 1);
}

function medirTexto(L) {
    garantirFonte(`${L.italic ? "italic " : ""}${L.weight} 20px ${pilha(L.font)}`);
    mctx.font = fonteTexto(L);
    const linhas = (L.upper ? L.text.toUpperCase() : L.text).split("\n");
    const larguras = linhas.map((l) => larguraLinha(mctx, l, L.spacing));
    const lh = L.size * L.lineH;
    return { linhas, larguras, lh, w: Math.max(24, ...larguras), h: Math.max(lh, linhas.length * lh) };
}

// Tamanho da caixa de cada camada, em unidades do poster (usado no desenho, na seleção e no clique)
function tamanhoCamada(L) {
    if (L.type === "ascii") {
        if (!RES) return { w: 1, h: 1 };
        const w = (L.size / 100) * S.poster.w;
        return { w, h: RES.rows * S.ascii.lineH * (w / (RES.cols * RES.cw)) };
    }
    if (L.type === "text") {
        const m = medirTexto(L);
        return { w: m.w, h: m.h };
    }
    return { w: L.w, h: L.kind === "line" ? Math.max(L.strokeW, 10) : L.h };
}

function caminhoRR(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function desenharFundo(ctx, P) {
    ctx.fillStyle = P.bgMode === "gradient" ? gradienteAngular(ctx, P.w, P.h, P.bgAngle, P.bg, P.bg2) : P.bg;
    ctx.fillRect(0, 0, P.w, P.h);
}

function desenharAscii(ctx, L, escala) {
    if (!RES) return;
    const C = S.color;
    const { w, h } = tamanhoCamada(L);
    const ras = rasterizarAscii(w, escala);
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.rotate((L.rot * Math.PI) / 180);
    ctx.globalAlpha = L.opacity / 100;
    if (C.glow > 0) {
        // shadowBlur não acompanha o zoom do contexto, por isso multiplicamos pela escala
        ctx.shadowColor = C.glowColor;
        ctx.shadowBlur = C.glow * escala;
        ctx.drawImage(ras, -w / 2, -h / 2, w, h);
        ctx.shadowBlur = (C.glow * escala) / 3;
        ctx.drawImage(ras, -w / 2, -h / 2, w, h);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
    }
    ctx.drawImage(ras, -w / 2, -h / 2, w, h);
    ctx.restore();
}

function desenharTexto(ctx, L) {
    const m = medirTexto(L);
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.rotate((L.rot * Math.PI) / 180);
    ctx.globalAlpha = L.opacity / 100;
    ctx.font = fonteTexto(L);
    ctx.fillStyle = L.color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    m.linhas.forEach((linha, i) => {
        const lw = m.larguras[i];
        const y = -m.h / 2 + m.lh * (i + 0.5);
        let x = L.align === "left" ? -m.w / 2 : L.align === "right" ? m.w / 2 - lw : -lw / 2;
        if (!L.spacing) {
            ctx.fillText(linha, x, y);
        } else {
            for (const c of Array.from(linha)) {
                ctx.fillText(c, x, y);
                x += ctx.measureText(c).width + L.spacing;
            }
        }
    });
    ctx.restore();
}

function desenharForma(ctx, L) {
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.rotate((L.rot * Math.PI) / 180);
    ctx.globalAlpha = L.opacity / 100;
    if (L.kind === "line") {
        ctx.strokeStyle = L.stroke;
        ctx.lineWidth = Math.max(0.5, L.strokeW);
        ctx.beginPath();
        ctx.moveTo(-L.w / 2, 0);
        ctx.lineTo(L.w / 2, 0);
        ctx.stroke();
    } else {
        if (L.kind === "ellipse") {
            ctx.beginPath();
            ctx.ellipse(0, 0, Math.max(0.5, L.w / 2), Math.max(0.5, L.h / 2), 0, 0, Math.PI * 2);
        } else {
            caminhoRR(ctx, -L.w / 2, -L.h / 2, L.w, L.h, L.radius);
        }
        if (L.fillOn) { ctx.fillStyle = L.fill; ctx.fill(); }
        if (L.strokeW > 0) { ctx.strokeStyle = L.stroke; ctx.lineWidth = L.strokeW; ctx.stroke(); }
    }
    ctx.restore();
}

function desenharMoldura(ctx, P) {
    const F = P.frame;
    if (!F.on) return;
    ctx.save();
    ctx.strokeStyle = F.color;
    const anel = (inset, espessura) => {
        ctx.lineWidth = espessura;
        caminhoRR(ctx, inset, inset, P.w - 2 * inset, P.h - 2 * inset, F.radius - (inset - F.margin));
        ctx.stroke();
    };
    if (F.style === "double") {
        anel(F.margin + F.width / 2, F.width);
        anel(F.margin + F.width * 2.6, Math.max(1, F.width / 2.5));
    } else {
        if (F.style === "dashed") ctx.setLineDash([F.width * 4, F.width * 2.5]);
        if (F.style === "dotted") { ctx.lineCap = "round"; ctx.setLineDash([0, F.width * 2.2]); }
        anel(F.margin + F.width / 2, F.width);
    }
    ctx.restore();
}

let canvasRuido = null;
function padraoRuido(ctx) {
    if (!canvasRuido) {
        canvasRuido = criarCanvas(256, 256);
        const g = canvasRuido.getContext("2d");
        const img = g.createImageData(256, 256);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.random() < 0.5 ? 0 : 255;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = Math.random() * 150;
        }
        g.putImageData(img, 0, 0);
    }
    return ctx.createPattern(canvasRuido, "repeat");
}

// Desenha o poster inteiro. `escala` = pixels do canvas por unidade do poster.
// Serve tanto para o live view quanto para exportar em alta resolução.
function renderizar(ctx, escala, opc = {}) {
    const P = S.poster;
    ctx.save();
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.clearRect(0, 0, P.w, P.h);
    if (!opc.transparente) desenharFundo(ctx, P);

    for (const L of S.layers) {
        if (!L.visible) continue;
        if (L.type === "ascii") desenharAscii(ctx, L, escala);
        else if (L.type === "text") desenharTexto(ctx, L);
        else desenharForma(ctx, L);
    }

    if (P.vignette > 0 && !opc.transparente) {
        const raio = Math.hypot(P.w, P.h) / 2;
        const g = ctx.createRadialGradient(P.w / 2, P.h / 2, raio * 0.25, P.w / 2, P.h / 2, raio);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, `rgba(0,0,0,${(P.vignette / 100) * 0.85})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, P.w, P.h);
    }

    desenharMoldura(ctx, P);

    if (P.grain > 0) {
        ctx.save();
        ctx.globalAlpha = P.grain / 100;
        ctx.fillStyle = padraoRuido(ctx);
        ctx.fillRect(0, 0, P.w, P.h);
        ctx.restore();
    }
    ctx.restore();
}


/* =========================================================
   6. LIVE VIEW E INTERAÇÃO NO CANVAS
   ========================================================= */

const cv = $("#poster");
const cctx = cv.getContext("2d");
const view = { fit: true, escala: 0.4, render: 1 }; // escala = px de tela por unidade; render = px do canvas por unidade
let drag = null;
let hoverId = null;
let guias = { v: false, h: false };

let raf = 0;
let sujoAscii = false;

function pedirRender(recalcular = false) {
    if (recalcular) sujoAscii = true;
    if (!raf) raf = requestAnimationFrame(quadro);
}

function quadro() {
    raf = 0;
    if (sujoAscii) { sujoAscii = false; calcularAscii(); }
    ajustarCanvas();
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    renderizar(cctx, view.render);
    cctx.save();
    cctx.setTransform(view.render, 0, 0, view.render, 0, 0);
    desenharSelecao(cctx);
    cctx.restore();
}

function ajustarCanvas() {
    const st = $("#stage");
    const P = S.poster;
    if (view.fit) {
        const dw = Math.max(80, st.clientWidth - 64);
        const dh = Math.max(80, st.clientHeight - 64);
        view.escala = clamp(Math.min(dw / P.w, dh / P.h), 0.05, 4);
    }
    const cssW = P.w * view.escala, cssH = P.h * view.escala;
    const dpr = window.devicePixelRatio || 1;
    let bw = cssW * dpr, bh = cssH * dpr;
    const f = Math.min(1, 4096 / Math.max(bw, bh));
    bw = Math.round(bw * f);
    bh = Math.round(bh * f);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    view.render = bw / P.w;
    cv.style.width = `${cssW}px`;
    cv.style.height = `${cssH}px`;
    $("#zoomLabel").textContent = `${Math.round(view.escala * 100)}%`;
}

const pad = () => 6 / view.escala;

function alcas(L) {
    const { w, h } = tamanhoCamada(L);
    const p = pad(), u = 1 / view.escala;
    return { canto: { x: w / 2 + p, y: h / 2 + p }, giro: { x: 0, y: -h / 2 - p - 26 * u }, raio: 8 * u, w, h, p };
}

function desenharSelecao(ctx) {
    const u = 1 / view.escala;
    const acento = "#ffb547";

    if (guias.v || guias.h) {
        ctx.save();
        ctx.strokeStyle = "#ff4fd8";
        ctx.lineWidth = u;
        ctx.setLineDash([6 * u, 4 * u]);
        ctx.beginPath();
        if (guias.v) { ctx.moveTo(S.poster.w / 2, 0); ctx.lineTo(S.poster.w / 2, S.poster.h); }
        if (guias.h) { ctx.moveTo(0, S.poster.h / 2); ctx.lineTo(S.poster.w, S.poster.h / 2); }
        ctx.stroke();
        ctx.restore();
    }

    const hover = S.layers.find((l) => l.id === hoverId);
    if (hover && hover.id !== S.sel && hover.visible) {
        const { w, h } = tamanhoCamada(hover);
        ctx.save();
        ctx.translate(hover.x, hover.y);
        ctx.rotate((hover.rot * Math.PI) / 180);
        ctx.strokeStyle = "rgba(255,181,71,0.55)";
        ctx.lineWidth = u;
        ctx.strokeRect(-w / 2 - pad(), -h / 2 - pad(), w + 2 * pad(), h + 2 * pad());
        ctx.restore();
    }

    const L = camadaSel();
    if (!L || !L.visible) return;
    const a = alcas(L);
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.rotate((L.rot * Math.PI) / 180);
    ctx.strokeStyle = acento;
    ctx.lineWidth = 1.5 * u;
    ctx.setLineDash(L.locked ? [6 * u, 4 * u] : []);
    ctx.strokeRect(-a.w / 2 - a.p, -a.h / 2 - a.p, a.w + 2 * a.p, a.h + 2 * a.p);
    if (!L.locked) {
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, -a.h / 2 - a.p);
        ctx.lineTo(a.giro.x, a.giro.y);
        ctx.stroke();
        ctx.fillStyle = "#15161a";
        ctx.beginPath();
        ctx.arc(a.giro.x, a.giro.y, a.raio, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = acento;
        ctx.fillRect(a.canto.x - a.raio, a.canto.y - a.raio, a.raio * 2, a.raio * 2);
    }
    ctx.restore();
}

function paraPoster(e) {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * S.poster.w, y: ((e.clientY - r.top) / r.height) * S.poster.h };
}

function paraLocal(L, p) {
    const a = (-L.rot * Math.PI) / 180;
    const dx = p.x - L.x, dy = p.y - L.y;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

function camadaEm(p) {
    for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i];
        if (!L.visible || L.locked) continue;
        const l = paraLocal(L, p);
        const { w, h } = tamanhoCamada(L);
        const m = pad();
        if (Math.abs(l.x) <= w / 2 + m && Math.abs(l.y) <= h / 2 + m) return L;
    }
    return null;
}

function alcaEm(L, p) {
    if (!L || !L.visible || L.locked) return null;
    const l = paraLocal(L, p), a = alcas(L);
    if (Math.hypot(l.x - a.canto.x, l.y - a.canto.y) <= a.raio * 1.8) return "escala";
    if (Math.hypot(l.x - a.giro.x, l.y - a.giro.y) <= a.raio * 1.8) return "rotacao";
    return null;
}

function aplicarEscala(L, f) {
    if (L.type === "ascii") L.size = Math.round(clamp(drag.size0 * f, 5, 400) * 10) / 10;
    else if (L.type === "text") L.size = Math.round(clamp(drag.size0 * f, 6, 1200));
    else { L.w = Math.round(Math.max(4, drag.w0 * f)); L.h = Math.round(Math.max(2, drag.h0 * f)); }
}

cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const p = paraPoster(e);
    let alvo = null, modo = alcaEm(camadaSel(), p);
    if (modo) alvo = camadaSel();
    else { alvo = camadaEm(p); modo = alvo ? "mover" : null; }
    if (!alvo) { selecionar(null); return; }
    if (S.sel !== alvo.id) selecionar(alvo.id);
    cv.setPointerCapture(e.pointerId);
    drag = {
        modo, id: alvo.id, p0: p, x0: alvo.x, y0: alvo.y,
        dist0: Math.hypot(p.x - alvo.x, p.y - alvo.y) || 1,
        size0: alvo.size, w0: alvo.w, h0: alvo.h, moveu: false
    };
});

cv.addEventListener("pointermove", (e) => {
    const p = paraPoster(e);
    if (!drag) {
        const sel = camadaSel();
        const alca = alcaEm(sel, p);
        const sobre = alca ? sel : camadaEm(p);
        cv.style.cursor = alca === "escala" ? "nwse-resize" : alca === "rotacao" ? "grab" : sobre ? "move" : "default";
        const novo = sobre ? sobre.id : null;
        if (novo !== hoverId) { hoverId = novo; pedirRender(); }
        return;
    }
    const L = S.layers.find((l) => l.id === drag.id);
    if (!L) return;
    drag.moveu = true;
    if (drag.modo === "mover") {
        let x = drag.x0 + (p.x - drag.p0.x);
        let y = drag.y0 + (p.y - drag.p0.y);
        guias = { v: false, h: false };
        if (!e.altKey) {
            const lim = 8 / view.escala;
            if (Math.abs(x - S.poster.w / 2) < lim) { x = S.poster.w / 2; guias.v = true; }
            if (Math.abs(y - S.poster.h / 2) < lim) { y = S.poster.h / 2; guias.h = true; }
        }
        L.x = Math.round(x);
        L.y = Math.round(y);
    } else if (drag.modo === "escala") {
        aplicarEscala(L, Math.hypot(p.x - L.x, p.y - L.y) / drag.dist0);
    } else {
        let ang = (Math.atan2(p.y - L.y, p.x - L.x) * 180) / Math.PI + 90;
        const passo = Math.round(ang / 15) * 15;
        if (e.shiftKey || Math.abs(ang - passo) < 2.5) ang = passo;
        while (ang > 180) ang -= 360;
        while (ang < -180) ang += 360;
        L.rot = Math.round(ang * 10) / 10;
    }
    syncControles();
    pedirRender();
});

function terminarArraste() {
    if (!drag) return;
    const moveu = drag.moveu;
    drag = null;
    guias = { v: false, h: false };
    if (moveu) commit();
    pedirRender();
}
cv.addEventListener("pointerup", terminarArraste);
cv.addEventListener("pointercancel", terminarArraste);
cv.addEventListener("pointerleave", () => {
    if (!drag && hoverId !== null) { hoverId = null; pedirRender(); }
});

cv.addEventListener("dblclick", (e) => {
    const L = camadaEm(paraPoster(e));
    if (L && L.type === "text") {
        selecionar(L.id);
        trocarAba("camadas");
        const campo = $('#propsCamada textarea[data-bind="layer.text"]');
        if (campo) { campo.focus(); campo.select(); }
    }
});

// Zoom com Ctrl + roda do mouse
$("#stage").addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    view.fit = false;
    view.escala = clamp(view.escala * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.05, 4);
    pedirRender();
}, { passive: false });

new ResizeObserver(() => pedirRender()).observe($("#stage"));


/* =========================================================
   7. PAINÉIS: CAMPOS LIGADOS AO ESTADO, CAMADAS, PALETAS
   ========================================================= */

// ----- geradores de campos (cada campo aponta para um caminho do estado via data-bind) -----
const attrMostrar = (show) => (show ? ` data-show="${show}"` : "");

const campoRange = (rot, path, min, max, step, unid = "", show) =>
    `<label class="fld"${attrMostrar(show)}><span class="fld-l">${rot}</span><output></output><input type="range" data-bind="${path}" min="${min}" max="${max}" step="${step}" data-unid="${unid}"></label>`;

const campoSelect = (rot, path, opcoes, show) =>
    `<label class="fld"${attrMostrar(show)}><span class="fld-l">${rot}</span><select data-bind="${path}">${opcoes.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>`;

const campoCor = (rot, path, show) =>
    `<label class="fld fld-cor"${attrMostrar(show)}><span class="fld-l">${rot}</span><input type="color" data-bind="${path}"></label>`;

const campoCheck = (rot, path, show) =>
    `<label class="fld-check"${attrMostrar(show)}><input type="checkbox" data-bind="${path}"><span>${rot}</span></label>`;

const campoNum = (rot, path, step = 1, show) =>
    `<label class="fld fld-num"${attrMostrar(show)}><span class="fld-l">${rot}</span><input type="number" data-bind="${path}" step="${step}"></label>`;

const campoTexto = (rot, path, placeholder = "", show) =>
    `<label class="fld"${attrMostrar(show)}><span class="fld-l">${rot}</span><input type="text" data-bind="${path}" placeholder="${placeholder}" maxlength="120"></label>`;

const linha2 = (a, b) => `<div class="grid2">${a}${b}</div>`;

// ----- caminho "poster.frame.on" → [objeto, chave] -----
function resolver(path) {
    const partes = path.split(".");
    let obj = partes[0] === "layer" ? camadaSel() : S[partes[0]];
    for (let i = 1; i < partes.length - 1; i++) {
        if (!obj) return [null, null];
        obj = obj[partes[i]];
    }
    return obj ? [obj, partes[partes.length - 1]] : [null, null];
}

function atualizarSaida(el) {
    const saida = el.parentElement && el.parentElement.querySelector("output");
    if (!saida || el.type !== "range") return;
    const passo = String(el.step || "1");
    const casas = passo.includes(".") ? passo.split(".")[1].length : 0;
    saida.textContent = `${parseFloat(el.value).toFixed(casas)}${el.dataset.unid || ""}`;
}

function syncVisibilidade() {
    $$("[data-show]").forEach((el) => {
        const [path, valores] = el.dataset.show.split("=");
        const [o, k] = resolver(path);
        el.hidden = !(o && valores.split(",").includes(String(o[k])));
    });
}

function syncControles() {
    $$("[data-bind]").forEach((el) => {
        const [o, k] = resolver(el.dataset.bind);
        if (!o || o[k] === undefined) return;
        if (el !== document.activeElement) {
            if (el.type === "checkbox") el.checked = !!o[k];
            else el.value = o[k];
        }
        atualizarSaida(el);
    });
    syncVisibilidade();
}

function syncPoster() {
    const P = S.poster;
    $("#posterW").value = P.w;
    $("#posterH").value = P.h;
    const i = PRESETS_TAMANHO.findIndex(([, w, h]) => w === P.w && h === P.h);
    $("#posterPreset").value = i >= 0 ? String(i) : "custom";
    atualizarInfo();
}

// ----- reação a qualquer campo que mude -----
function aoMudarCampo(e) {
    const el = e.target;
    if (!el.matches || !el.matches("[data-bind]")) return;
    const path = el.dataset.bind;
    const [o, k] = resolver(path);
    if (!o) return;
    let v;
    if (el.type === "checkbox") v = el.checked;
    else if (el.type === "range" || el.type === "number") {
        v = parseFloat(el.value);
        if (Number.isNaN(v)) return;
    } else v = el.value;
    o[k] = v;

    if (e.type === "input") {
        atualizarSaida(el);
        // Trocar para "linha" precisa de uma espessura visível
        if (path === "layer.kind" && v === "line" && o.strokeW < 1) o.strokeW = 4;
        const recalcula = /^(image|ascii|color)\./.test(path) || path === "poster.bg";
        if (path === "layer.text" || path === "layer.kind") renderizarLista();
        syncVisibilidade();
        pedirRender(recalcula);
    }
    if (e.type === "change") {
        commit();
    }
}
document.addEventListener("input", aoMudarCampo);
document.addEventListener("change", aoMudarCampo);

// ----- montagem dos painéis estáticos -----
function montarPaineis() {
    $("#ctlImagem").innerHTML =
        campoSelect("Proporção do recorte", "image.ratio", [["original", "Original"], ["1:1", "1:1"], ["4:5", "4:5"], ["3:4", "3:4"], ["2:3", "2:3"], ["3:2", "3:2"], ["16:9", "16:9"], ["9:16", "9:16"]]) +
        campoRange("Zoom", "image.zoom", 1, 4, 0.01, "x") +
        campoRange("Posição horizontal", "image.offX", -100, 100, 1) +
        campoRange("Posição vertical", "image.offY", -100, 100, 1);

    $("#ctlAscii").innerHTML =
        campoRange("Colunas (detalhe)", "ascii.cols", 20, 300, 1) +
        campoSelect("Caracteres", "ascii.charset", Object.entries(CONJUNTOS).map(([k, v]) => [k, v.nome])) +
        campoTexto("Do mais vazio ao mais denso", "ascii.custom", " .:-=+*#%@", "ascii.charset=personalizado") +
        campoCheck("Inverter a ordem dos caracteres", "ascii.reverse") +
        campoSelect("Fonte da arte", "ascii.font", FONTES_ASCII.map((f) => [f, f])) +
        campoCheck("Negrito", "ascii.bold") +
        campoRange("Altura da linha", "ascii.lineH", 0.6, 1.5, 0.01) +
        campoSelect("Tons", "ascii.mapping", [["auto", "Automático (segue o fundo)"], ["claro", "Claro vira denso"], ["escuro", "Escuro vira denso"]]) +
        campoRange("Brilho", "ascii.brightness", -100, 100, 1) +
        campoRange("Contraste", "ascii.contrast", -100, 100, 1) +
        campoRange("Gama", "ascii.gamma", 0.3, 3, 0.05) +
        campoRange("Realce de bordas", "ascii.edges", 0, 100, 1) +
        campoSelect("Pontilhado", "ascii.dither", [["none", "Nenhum"], ["ordenado", "Ordenado"], ["floyd", "Floyd-Steinberg"]]);

    $("#ctlCor").innerHTML =
        campoSelect("Modo", "color.mode", [["mono", "Uma cor"], ["original", "Cores da imagem"], ["tone", "Gradiente por tom"], ["gradient", "Gradiente no poster"]]) +
        campoCor("Cor do texto", "color.text", "color.mode=mono") +
        linha2(campoCor("Cor 1", "color.c1", "color.mode=tone,gradient"), campoCor("Cor 2", "color.c2", "color.mode=tone,gradient")) +
        campoRange("Ângulo do gradiente", "color.angle", 0, 360, 1, "°", "color.mode=gradient") +
        campoRange("Vivacidade", "color.boost", 0, 100, 1, "%", "color.mode=original") +
        campoRange("Brilho neon", "color.glow", 0, 60, 1) +
        campoCor("Cor do brilho", "color.glowColor");

    $("#ctlPoster").innerHTML =
        campoSelect("Fundo", "poster.bgMode", [["solid", "Cor sólida"], ["gradient", "Gradiente"]]) +
        linha2(campoCor("Cor do fundo", "poster.bg"), campoCor("Segunda cor", "poster.bg2", "poster.bgMode=gradient")) +
        campoRange("Ângulo", "poster.bgAngle", 0, 360, 1, "°", "poster.bgMode=gradient") +
        campoRange("Vinheta", "poster.vignette", 0, 100, 1, "%") +
        campoRange("Grão de filme", "poster.grain", 0, 100, 1, "%") +
        `<h4>Moldura</h4>` +
        campoCheck("Mostrar moldura", "poster.frame.on") +
        campoSelect("Estilo", "poster.frame.style", [["solid", "Linha"], ["double", "Dupla"], ["dashed", "Tracejada"], ["dotted", "Pontilhada"]], "poster.frame.on=true") +
        campoRange("Margem", "poster.frame.margin", 0, 200, 1, " px", "poster.frame.on=true") +
        campoRange("Espessura", "poster.frame.width", 1, 40, 1, " px", "poster.frame.on=true") +
        campoRange("Cantos arredondados", "poster.frame.radius", 0, 200, 1, " px", "poster.frame.on=true") +
        campoCor("Cor da moldura", "poster.frame.color", "poster.frame.on=true");

    $("#paletas").innerHTML = "";
    PALETAS.forEach((p, i) => {
        const b = document.createElement("button");
        b.className = "paleta";
        b.type = "button";
        b.textContent = "Aa";
        b.title = p.nome;
        b.setAttribute("aria-label", `Paleta ${p.nome}`);
        b.style.background = p.modo === "gradient" ? `linear-gradient(180deg, ${p.bg}, ${p.bg2})` : p.bg;
        b.style.color = p.texto;
        b.dataset.paleta = String(i);
        $("#paletas").appendChild(b);
    });

    const sel = $("#posterPreset");
    PRESETS_TAMANHO.forEach(([nome, w, h], i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = `${nome}, ${w} × ${h}`;
        sel.appendChild(o);
    });
    const pers = document.createElement("option");
    pers.value = "custom";
    pers.textContent = "Personalizado";
    sel.appendChild(pers);
}

function aplicarPaleta(p) {
    const P = S.poster, C = S.color;
    P.bgMode = p.modo;
    P.bg = p.bg;
    P.bg2 = p.bg2;
    C.text = p.texto;
    C.c1 = p.c1;
    C.c2 = p.c2;
    C.glowColor = p.texto;
    P.frame.color = p.texto;
    for (const L of S.layers) {
        if (L.type === "text") L.color = p.texto;
        if (L.type === "shape") { L.fill = p.texto; L.stroke = p.texto; }
    }
    syncControles();
    pedirRender(true);
    commit();
}

// ----- tamanho do poster -----
function definirTamanhoPoster(w, h) {
    w = clamp(Math.round(w) || S.poster.w, 200, 6000);
    h = clamp(Math.round(h) || S.poster.h, 200, 6000);
    const sx = w / S.poster.w, sy = h / S.poster.h;
    S.poster.w = w;
    S.poster.h = h;
    // Mantém a composição: posições e tamanhos acompanham a nova proporção
    for (const L of S.layers) {
        L.x = Math.round(L.x * sx);
        L.y = Math.round(L.y * sy);
        if (L.type === "text") L.size = Math.max(6, Math.round(L.size * sx));
        if (L.type === "shape") { L.w = Math.round(L.w * sx); L.h = Math.round(L.h * sy); }
    }
    S.poster.frame.margin = Math.round(S.poster.frame.margin * sx);
    syncControles();
    syncPoster();
    pedirRender();
    commit();
}

// ----- abas -----
function trocarAba(nome) {
    $$(".tab").forEach((t) => {
        const ativa = t.dataset.tab === nome;
        t.classList.toggle("is-active", ativa);
        t.setAttribute("aria-selected", String(ativa));
    });
    $$(".tab-pane").forEach((p) => { p.hidden = p.id !== `tab-${nome}`; });
}

// ----- lista de camadas -----
function nomeCamada(L) {
    if (L.type === "ascii") return "Arte ASCII";
    if (L.type === "text") return (L.text.split("\n")[0] || "Texto vazio").slice(0, 34);
    return { line: "Linha", rect: "Retângulo", ellipse: "Elipse" }[L.kind] || "Forma";
}

function botaoMini(html, titulo, ativo, aoClicar) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `mini-btn${ativo ? " on" : ""}`;
    b.title = titulo;
    b.setAttribute("aria-label", titulo);
    b.innerHTML = html;
    b.addEventListener("click", (e) => { e.stopPropagation(); aoClicar(); });
    return b;
}

function renderizarLista() {
    const ul = $("#listaCamadas");
    ul.innerHTML = "";
    for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i];
        const li = document.createElement("li");
        li.className = `layer-row${L.id === S.sel ? " is-sel" : ""}${L.visible ? "" : " is-off"}`;
        const tipo = document.createElement("span");
        tipo.className = "layer-kind";
        tipo.innerHTML = ICONE[L.type === "shape" ? "forma" : L.type === "text" ? "texto" : "ascii"];
        const nome = document.createElement("span");
        nome.className = "layer-name";
        nome.textContent = nomeCamada(L);
        li.append(
            tipo,
            nome,
            botaoMini(L.locked ? ICONE.cadeado : ICONE.cadeadoAberto, L.locked ? "Desbloquear" : "Bloquear", L.locked, () => { L.locked = !L.locked; renderizarLista(); renderizarProps(); pedirRender(); commit(); }),
            botaoMini(L.visible ? ICONE.olho : ICONE.olhoOff, L.visible ? "Ocultar" : "Mostrar", false, () => { L.visible = !L.visible; renderizarLista(); pedirRender(); commit(); })
        );
        li.addEventListener("click", () => selecionar(L.id));
        ul.appendChild(li);
    }
}

function selecionar(id) {
    S.sel = id;
    renderizarLista();
    renderizarProps();
    pedirRender();
}

const OPC_PESOS = [["300", "Leve"], ["400", "Normal"], ["500", "Médio"], ["700", "Negrito"], ["800", "Extranegrito"], ["900", "Preto"]];

function htmlProps(L) {
    const posicao =
        linha2(campoNum("Posição X", "layer.x"), campoNum("Posição Y", "layer.y")) +
        campoRange("Rotação", "layer.rot", -180, 180, 0.5, "°") +
        campoRange("Opacidade", "layer.opacity", 0, 100, 1, "%");
    const alinhar = `<div class="row row-wrap"><button class="btn btn-small" data-act="centroH">Centralizar na largura</button><button class="btn btn-small" data-act="centroV">Centralizar na altura</button></div>`;

    if (L.type === "ascii") {
        return `<h4>Arte ASCII</h4>` +
            campoRange("Largura na página", "layer.size", 5, 200, 0.5, "%") +
            `<div class="row"><button class="btn btn-small" data-act="ajustarArte">Ajustar à página</button></div>` +
            posicao + alinhar;
    }
    if (L.type === "text") {
        return `<h4>Texto</h4>` +
            `<label class="fld fld-full"><span class="fld-l">Conteúdo</span><textarea data-bind="layer.text" rows="3" maxlength="400"></textarea></label>` +
            campoSelect("Fonte", "layer.font", FONTES_TEXTO.map((f) => [f, f])) +
            linha2(campoSelect("Peso", "layer.weight", OPC_PESOS), campoSelect("Alinhamento", "layer.align", [["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]])) +
            campoRange("Tamanho", "layer.size", 8, 400, 1, " px") +
            campoRange("Espaço entre letras", "layer.spacing", -10, 80, 0.5, " px") +
            campoRange("Altura da linha", "layer.lineH", 0.7, 2.2, 0.01) +
            campoCor("Cor", "layer.color") +
            linha2(campoCheck("Itálico", "layer.italic"), campoCheck("Maiúsculas", "layer.upper")) +
            posicao + alinhar;
    }
    return `<h4>Forma</h4>` +
        campoSelect("Tipo", "layer.kind", [["line", "Linha"], ["rect", "Retângulo"], ["ellipse", "Elipse"]]) +
        campoRange("Largura", "layer.w", 4, 2400, 1, " px") +
        campoRange("Altura", "layer.h", 2, 2400, 1, " px", "layer.kind=rect,ellipse") +
        campoRange("Cantos arredondados", "layer.radius", 0, 400, 1, " px", "layer.kind=rect") +
        campoCheck("Preencher", "layer.fillOn", "layer.kind=rect,ellipse") +
        campoCor("Cor do preenchimento", "layer.fill", "layer.fillOn=true") +
        campoCor("Cor do traço", "layer.stroke") +
        campoRange("Espessura do traço", "layer.strokeW", 0, 80, 1, " px") +
        posicao + alinhar;
}

function renderizarProps() {
    const el = $("#propsCamada");
    const L = camadaSel();
    if (!L) {
        el.innerHTML = `<p class="stat">Clique em uma camada no poster ou na lista para editar. Use “+ Texto” para adicionar um título.</p>`;
        return;
    }
    el.innerHTML = htmlProps(L);
    syncControles();
}

// ----- ações de camada -----
function novaCamadaNoCentro(tipo) {
    const P = S.poster;
    const id = S.nextId++;
    const L = tipo === "texto"
        ? camadaTexto(id, { x: P.w / 2, y: P.h / 2, color: S.color.text, size: Math.round(P.w * 0.05) })
        : camadaForma(id, { x: P.w / 2, y: P.h / 2, w: Math.round(P.w * 0.4), fill: S.color.text, stroke: S.color.text });
    S.layers.push(L);
    S.sel = id;
    renderizarLista();
    renderizarProps();
    pedirRender();
    commit();
    return L;
}

function moverCamada(delta) {
    const i = S.layers.findIndex((l) => l.id === S.sel);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= S.layers.length) return;
    [S.layers[i], S.layers[j]] = [S.layers[j], S.layers[i]];
    renderizarLista();
    pedirRender();
    commit();
}

function ajustarArteNaPagina(gravar = true) {
    const L = camadaAscii();
    if (!L || !RES) return;
    const P = S.poster;
    const razao = (RES.rows * S.ascii.lineH) / (RES.cols * RES.cw);
    const w = Math.min(P.w * 0.84, (P.h * 0.72) / razao);
    L.size = Math.round((w / P.w) * 1000) / 10;
    L.x = P.w / 2;
    L.y = Math.round(P.h * 0.52);
    L.rot = 0;
    if (gravar) {
        syncControles();
        pedirRender();
        commit();
    }
}

const acoes = {
    desfazer, refazer,
    zoomMais() { view.fit = false; view.escala = clamp(view.escala * 1.2, 0.05, 4); pedirRender(); },
    zoomMenos() { view.fit = false; view.escala = clamp(view.escala / 1.2, 0.05, 4); pedirRender(); },
    zoomAjustar() { view.fit = true; pedirRender(); },
    baixar,
    girar() { S.image.rot = (S.image.rot + 90) % 360; mudouImagem(); },
    espelharH() { S.image.flipH = !S.image.flipH; mudouImagem(); },
    espelharV() { S.image.flipV = !S.image.flipV; mudouImagem(); },
    resetarRecorte() { S.image = imagemPadrao(); mudouImagem(); },
    exemplo() { definirFonte(gerarExemplo(), "Imagem de exemplo", 0, { exemplo: true, ajustar: true }); },
    addTexto() { novaCamadaNoCentro("texto"); trocarAba("camadas"); },
    addForma() { novaCamadaNoCentro("forma"); trocarAba("camadas"); },
    duplicar() {
        const L = camadaSel();
        if (!L) return;
        if (L.type === "ascii") { aviso("A arte ASCII é única no poster. Para outra arte, abra outra imagem."); return; }
        const copia = Object.assign({}, L, { id: S.nextId++, x: L.x + 30, y: L.y + 30 });
        S.layers.splice(S.layers.indexOf(L) + 1, 0, copia);
        S.sel = copia.id;
        renderizarLista();
        renderizarProps();
        pedirRender();
        commit();
    },
    subir() { moverCamada(1); },
    descer() { moverCamada(-1); },
    excluir() {
        const L = camadaSel();
        if (!L) return;
        if (L.type === "ascii") { aviso("A arte ASCII não pode ser excluída, mas você pode ocultá-la pelo olho na lista."); return; }
        const i = S.layers.indexOf(L);
        S.layers.splice(i, 1);
        S.sel = S.layers.length ? S.layers[Math.min(i, S.layers.length - 1)].id : null;
        renderizarLista();
        renderizarProps();
        pedirRender();
        commit();
    },
    centroH() { const L = camadaSel(); if (L) { L.x = S.poster.w / 2; syncControles(); pedirRender(); commit(); } },
    centroV() { const L = camadaSel(); if (L) { L.y = S.poster.h / 2; syncControles(); pedirRender(); commit(); } },
    ajustarArte() { ajustarArteNaPagina(true); },
    copiarTexto,
    salvarProjeto,
    abrirProjeto() { $("#inputProjeto").click(); }
};

function mudouImagem() {
    syncControles();
    pedirRender(true);
    commit();
}

document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (b && acoes[b.dataset.act]) { acoes[b.dataset.act](); return; }
    const t = e.target.closest(".tab");
    if (t) { trocarAba(t.dataset.tab); return; }
    const p = e.target.closest("[data-paleta]");
    if (p) aplicarPaleta(PALETAS[Number(p.dataset.paleta)]);
});


/* =========================================================
   8. EXPORTAÇÃO, PROJETO E INICIALIZAÇÃO
   ========================================================= */

function baixarBlob(blob, nome) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function prepararFontes() {
    const specs = new Set([`${S.ascii.bold ? 700 : 400} 20px ${pilha(S.ascii.font)}`]);
    for (const L of fontesUsadasEmTexto()) specs.add(`${L.italic ? "italic " : ""}${L.weight} 20px ${pilha(L.font)}`);
    if (document.fonts && document.fonts.load) {
        await Promise.all([...specs].map((s) => document.fonts.load(s).catch(() => {})));
    }
    limparCaches();
    calcularAscii();
}

async function baixar() {
    const fmt = $("#fmt").value;
    if (fmt === "txt") {
        if (!RES) return;
        baixarBlob(new Blob([RES.texto], { type: "text/plain;charset=utf-8" }), "ascii-art.txt");
        return;
    }
    aviso("Preparando o arquivo...");
    await prepararFontes();
    const P = S.poster;
    let esc = parseFloat($("#escalaExp").value) || 1;
    esc = Math.min(esc, Math.sqrt(48e6 / (P.w * P.h)), 16000 / Math.max(P.w, P.h)); // evita estourar a memória do navegador
    const c = criarCanvas(P.w * esc, P.h * esc);
    const transparente = fmt === "png" && $("#transp").checked;
    renderizar(c.getContext("2d"), c.width / P.w, { transparente });
    const mime = fmt === "jpg" ? "image/jpeg" : "image/png";
    c.toBlob((blob) => {
        pedirRender();
        if (!blob) { aviso("Não consegui gerar a imagem. Tente uma resolução menor."); return; }
        baixarBlob(blob, `ascii-poster.${fmt}`);
        aviso(`Poster salvo: ${c.width} × ${c.height} px`);
    }, mime, 0.95);
}

async function copiarTexto() {
    if (!RES) return;
    try {
        await navigator.clipboard.writeText(RES.texto);
        aviso("Texto ASCII copiado.");
    } catch (erro) {
        const ta = document.createElement("textarea");
        ta.value = RES.texto;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand && document.execCommand("copy");
        ta.remove();
        aviso(ok ? "Texto ASCII copiado." : "Não foi possível copiar. Use a exportação em TXT.");
    }
}

function salvarProjeto() {
    const dados = {
        app: "ascii-studio",
        versao: 1,
        estado: S,
        imagem: SRC && !SRC.exemplo
            ? { nome: SRC.nome, dataUrl: SRC.alfa ? SRC.canvas.toDataURL("image/png") : SRC.canvas.toDataURL("image/jpeg", 0.9) }
            : null
    };
    baixarBlob(new Blob([JSON.stringify(dados)], { type: "application/json" }), "projeto-ascii.json");
    aviso("Projeto salvo.");
}

function abrirProjeto(arquivo) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
        let dados;
        try { dados = JSON.parse(leitor.result); } catch (e) { dados = null; }
        if (!dados || dados.app !== "ascii-studio" || !dados.estado) {
            aviso("Esse arquivo não é um projeto do ASCII Studio.");
            return;
        }
        const base = novoEstado();
        const est = mesclar(base, dados.estado);
        est.layers = (dados.estado.layers || base.layers).map((L) =>
            L.type === "text" ? camadaTexto(L.id, L) : L.type === "shape" ? camadaForma(L.id, L) : Object.assign({}, base.layers[0], L));
        est.nextId = Math.max(est.nextId || 1, ...est.layers.map((l) => l.id + 1));
        S = est;

        const finalizar = () => {
            hist.undo = [];
            hist.redo = [];
            if (!camadaSel()) S.sel = S.layers.length ? S.layers[S.layers.length - 1].id : null;
            hist.last = JSON.stringify(S);
            renderizarLista();
            renderizarProps();
            syncControles();
            syncPoster();
            pedirRender(true);
            atualizarBotoesHistorico();
            aviso("Projeto aberto.");
        };
        if (dados.imagem && dados.imagem.dataUrl) {
            const img = new Image();
            img.onload = () => {
                const salvo = JSON.parse(JSON.stringify(S.image));
                definirFonte(img, dados.imagem.nome || "imagem", 0, { semCommit: true });
                S.image = salvo;
                finalizar();
            };
            img.onerror = () => aviso("A imagem do projeto está corrompida.");
            img.src = dados.imagem.dataUrl;
        } else {
            const salvo = JSON.parse(JSON.stringify(S.image));
            definirFonte(gerarExemplo(), "Imagem de exemplo", 0, { exemplo: true, semCommit: true });
            S.image = salvo;
            finalizar();
        }
    };
    leitor.readAsText(arquivo);
}

// ----- entrada de arquivos: clique, arrastar, colar -----
$("#inputImagem").addEventListener("change", (e) => {
    carregarArquivo(e.target.files[0]);
    e.target.value = "";
});
$("#inputProjeto").addEventListener("change", (e) => {
    abrirProjeto(e.target.files[0]);
    e.target.value = "";
});

const temArquivo = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
let contadorArraste = 0;
document.addEventListener("dragenter", (e) => {
    if (!temArquivo(e)) return;
    contadorArraste++;
    $("#dropOverlay").classList.add("on");
    $("#dropzone").classList.add("dragover");
});
document.addEventListener("dragleave", (e) => {
    if (!temArquivo(e)) return;
    contadorArraste = Math.max(0, contadorArraste - 1);
    if (!contadorArraste) { $("#dropOverlay").classList.remove("on"); $("#dropzone").classList.remove("dragover"); }
});
document.addEventListener("dragover", (e) => { if (temArquivo(e)) e.preventDefault(); });
document.addEventListener("drop", (e) => {
    if (!temArquivo(e)) return;
    e.preventDefault();
    contadorArraste = 0;
    $("#dropOverlay").classList.remove("on");
    $("#dropzone").classList.remove("dragover");
    carregarArquivo(e.dataTransfer.files[0]);
});
document.addEventListener("paste", (e) => {
    const item = Array.from((e.clipboardData && e.clipboardData.items) || []).find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); carregarArquivo(item.getAsFile()); }
});

// ----- tamanho do poster e opções de exportação -----
$("#posterPreset").addEventListener("change", (e) => {
    if (e.target.value === "custom") return;
    const [, w, h] = PRESETS_TAMANHO[Number(e.target.value)];
    definirTamanhoPoster(w, h);
});
$("#posterW").addEventListener("change", (e) => definirTamanhoPoster(parseFloat(e.target.value), S.poster.h));
$("#posterH").addEventListener("change", (e) => definirTamanhoPoster(S.poster.w, parseFloat(e.target.value)));
$("#posterTrocar").addEventListener("click", () => definirTamanhoPoster(S.poster.h, S.poster.w));

function atualizarOpcoesExport() {
    const fmt = $("#fmt").value;
    $$("[data-only-img]").forEach((el) => { el.hidden = fmt === "txt"; });
    $$("[data-only-png]").forEach((el) => { el.hidden = fmt !== "png"; });
    atualizarInfo();
}
$("#fmt").addEventListener("change", atualizarOpcoesExport);
$("#escalaExp").addEventListener("change", atualizarInfo);

// ----- atalhos de teclado -----
let nudgeT = 0;
document.addEventListener("keydown", (e) => {
    const alvo = e.target;
    const tag = (alvo.tagName || "").toLowerCase();
    const digitando = tag === "textarea" || (tag === "input" && ["text", "number", "search"].includes(alvo.type));
    const focoEmCampo = digitando || tag === "select" || (tag === "input" && alvo.type === "range");
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && !digitando) {
        const k = e.key.toLowerCase();
        if (k === "z") { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); return; }
        if (k === "y") { e.preventDefault(); refazer(); return; }
        if (k === "d") { e.preventDefault(); acoes.duplicar(); return; }
        if (k === "s") { e.preventDefault(); salvarProjeto(); return; }
    }
    if (focoEmCampo) return;

    const L = camadaSel();
    if (!L) return;
    if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        acoes.excluir();
    } else if (e.key === "Escape") {
        selecionar(null);
    } else if (e.key.startsWith("Arrow") && !L.locked) {
        e.preventDefault();
        const passo = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") L.x -= passo;
        if (e.key === "ArrowRight") L.x += passo;
        if (e.key === "ArrowUp") L.y -= passo;
        if (e.key === "ArrowDown") L.y += passo;
        syncControles();
        pedirRender();
        clearTimeout(nudgeT);
        nudgeT = setTimeout(commit, 400);
    }
});

// ----- início -----
function iniciar() {
    montarPaineis();
    definirFonte(gerarExemplo(), "Imagem de exemplo", 0, { exemplo: true, semCommit: true });
    hist.last = JSON.stringify(S);
    renderizarLista();
    renderizarProps();
    syncControles();
    syncPoster();
    atualizarOpcoesExport();
    atualizarBotoesHistorico();
    pedirRender(true);
}

iniciar();