import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase";

// ═══ GP Proveedores · "Mercado Público, a domicilio" ═══
// Diseño v2: sidebar en escritorio, rail de acciones circular estilo TikTok,
// Manrope + IBM Plex Mono, paleta #111114 / #e9b44c.
// Funcional: API en vivo (backend → n8n → demo), perfil Mi pyme, carro de ventas,
// panel de negocio, ficha, compartir, reportes, racha y doble check.

const INK = "#080a10";
const CARD = "#12141c";
const CARD_GRAD = "linear-gradient(180deg, #1b1d26, #12141c)";
const CARD2 = "#1b1d26";
const BORDE = "#2a2e3a";
const GOLD = "#EFB700"; // dorado corporativo Gestor Público
const GOLD_DEEP = "#a97f00";
const GOLD_BG = "rgba(239,183,0,.06)";
const SOBRE_GOLD = "#17130a"; // texto sobre superficies doradas
const PAPER = "#f2efe9";
const MUTED = "#9a9aa4";
const ROJO = "#ff6b5a";
const VERDE = "#6fbf9a";
const VERDE_MONTO = "#55d68c";
const SOMBRA_CARD = "0 50px 100px -50px rgba(0,0,0,.9)";
const GLOW_ORO = "0 0 12px rgba(239,183,0,.5)";

const URL_DEMO = "https://app.gestorpublico.cl/oportunidad/";
const ENDPOINT_DATOS =
  import.meta.env.VITE_ENDPOINT_DATOS ?? "https://egonzalezm.app.n8n.cloud/webhook/gp-proveedores";
const ENDPOINT_BACKEND = import.meta.env.VITE_ENDPOINT_BACKEND ?? ""; // ej: "https://gp-backend.up.railway.app"

// ── Ronda diaria ──
const RONDA_META = 10;
const hoyChile = () => {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
};
const esAyer = (iso) => {
  const d = new Date(hoyChile() + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return iso === d.toISOString().slice(0, 10);
};
const horasRestantesHoy = () => {
  try {
    const h = Number(new Intl.DateTimeFormat("es-CL", { hour: "numeric", hour12: false, timeZone: "America/Santiago" }).format(new Date()));
    return Math.max(1, 24 - h);
  } catch { return Math.max(1, 24 - new Date().getHours()); }
};
// La mejor oportunidad del reparto se guarda para el final de la ronda: la Joya del día.
function ordenarRonda(tarjetas) {
  if (!Array.isArray(tarjetas) || tarjetas.length < 3) return tarjetas;
  const ronda = tarjetas.slice(0, RONDA_META);
  const resto = tarjetas.slice(RONDA_META);
  const iJoya = ronda.reduce((mi, c, i) => ((c.match || 0) > (ronda[mi].match || 0) ? i : mi), 0);
  const [joya] = ronda.splice(iJoya, 1);
  return [...ronda, { ...joya, joya: true }, ...resto];
}

const PALABRAS_INICIALES = ["aseo", "limpieza", "mantención"];
const RUBROS_SUGERIDOS = [
  "aseo", "limpieza", "sanitización", "mantención", "ferretería", "insumos",
  "alimentos", "transporte", "impresión", "arriendo", "vigilancia", "informática",
  "capacitación", "construcción", "jardinería", "mobiliario", "eléctrico", "climatización",
];

const SEMILLA = [
  { id: "1057-45-LE26", titulo: "Servicio de aseo y sanitización de dependencias", organismo: "SERVIU Región Metropolitana", tipo: "LE", monto: "$38.500.000", cierre: "En 6 días", match: 92, region: "Metropolitana", razon: "Coincide con tu rubro y has cotizado 3 veces a este organismo", tags: ["Aseo industrial", "Contrato 12 meses"], insight: "SERVIU RM adjudica en 21 días promedio y suele cerrar 8% bajo el precio referencial: compite en precio, no en plazo.", social: { likes: 12, carro: 7 } },
  { id: "2239-18-COT26", titulo: "Compra Ágil: insumos de ferretería y herramientas menores", organismo: "I. Municipalidad de Maipú", tipo: "Compra Ágil", monto: "Hasta 100 UTM", cierre: "Cierra mañana", match: 88, region: "Metropolitana", razon: "Primer llamado exclusivo para micro y pequeñas empresas", tags: ["Sin garantías", "Adjudicación rápida"], insight: "Maipú responde compras ágiles en 48 horas: aquí llegar primero pesa más que afinar el precio.", social: { likes: 4, carro: 2 } },
  { id: "894-12-LE26", titulo: "Suministro de alimentos no perecibles para programas sociales", organismo: "JUNAEB Valparaíso", tipo: "LE", monto: "$52.900.000", cierre: "En 9 días", match: 86, region: "Valparaíso", razon: "Tu competencia directa se adjudicó un proceso similar en marzo", tags: ["Entrega mensual", "12 comunas"], insight: "JUNAEB pondera 40% la experiencia acreditable: adjunta contratos similares a la oferta.", social: { likes: 9, carro: 5 } },
  { id: "3411-7-L126", titulo: "Mantención de áreas verdes y sistemas de riego", organismo: "I. Municipalidad de La Florida", tipo: "L1", monto: "$9.800.000", cierre: "En 4 días", match: 84, region: "Metropolitana", razon: "Monto bajo, exigencias mínimas: buena puerta de entrada", tags: ["Sin experiencia previa", "Pago a 30 días"], insight: "Las L1 municipales promedian 4 oferentes: buena cancha para tu primera adjudicación.", social: { likes: 6, carro: 3 } },
  { id: "1660-33-LE26", titulo: "Arriendo de equipos computacionales para establecimientos", organismo: "SLEP Barrancas", tipo: "LE", monto: "$47.200.000", cierre: "En 11 días", match: 82, region: "Metropolitana", razon: "Piden soporte en terreno: tu cobertura calza con las comunas", tags: ["24 meses", "Soporte incluido"], insight: "Los SLEP nuevos priorizan continuidad de servicio: el plan de soporte pesa más que el precio unitario.", social: { likes: 8, carro: 4 } },
  { id: "782-51-COT26", titulo: "Compra Ágil: servicio de coffee break para jornadas", organismo: "Servicio de Salud Concepción", tipo: "Compra Ágil", monto: "Hasta 30 UTM", cierre: "Cierra hoy 18:00", match: 80, region: "Biobío", razon: "Cotización simple: precio y plazo, sin anexos técnicos", tags: ["Pago rápido", "Recurrente"], insight: "Este organismo repite el servicio cada mes: una buena primera entrega abre compras recurrentes.", social: { likes: 3, carro: 2 } },
  { id: "4520-9-LE26", titulo: "Servicio de vigilancia y control de accesos", organismo: "Hospital San José", tipo: "LE", monto: "$61.300.000", cierre: "En 8 días", match: 78, region: "Metropolitana", razon: "Ya trabajaste con establecimientos de salud este año", tags: ["Turnos 24/7", "OS-10 vigente"], insight: "Los hospitales excluyen ofertas sin OS-10 vigente al día de apertura: revísalo antes de invertir horas.", social: { likes: 11, carro: 6 } },
  { id: "1198-22-COT26", titulo: "Compra Ágil: artículos de escritorio y papelería", organismo: "SLEP Gabriela Mistral", tipo: "Compra Ágil", monto: "Hasta 50 UTM", cierre: "En 2 días", match: 76, region: "Metropolitana", razon: "Compra recurrente: este organismo cotiza cada mes", tags: ["Entrega única", "Sin garantías"], insight: "Ticket chico pero mensual: sirve de piso de ventas mientras licitas lo grande.", social: { likes: 2, carro: 1 } },
  { id: "2871-14-LE26", titulo: "Servicio de transporte de personal y encomiendas", organismo: "INDAP Región del Maule", tipo: "LE", monto: "$28.400.000", cierre: "En 12 días", match: 74, region: "Maule", razon: "Tu flota declarada cumple los requisitos de las bases", tags: ["Rutas rurales", "10 meses"], insight: "INDAP pondera cobertura rural: detalla comunas y frecuencias en la oferta técnica.", social: { likes: 5, carro: 2 } },
  { id: "655-38-L126", titulo: "Impresión de material gráfico institucional", organismo: "I. Municipalidad de Ñuñoa", tipo: "L1", monto: "$7.200.000", cierre: "En 5 días", match: 71, region: "Metropolitana", razon: "Guardaste dos procesos de imprenta este mes", tags: ["Diseño incluido", "Entrega parcializada"], insight: "Ñuñoa evalúa muestras físicas: incluirlas sube tu puntaje técnico sin costo relevante.", social: { likes: 7, carro: 3 } },
];

// ── Generador de similares (scroll infinito) ──
const TITULOS_SIM = [
  "Servicio de aseo de oficinas y espacios comunes", "Compra Ágil: insumos de limpieza e higiene",
  "Mantención preventiva de infraestructura menor", "Suministro de colaciones para actividades",
  "Servicio de jardinería y ornato", "Arriendo de impresoras multifuncionales",
  "Compra Ágil: herramientas eléctricas menores", "Servicio de traslado de mobiliario",
  "Provisión de equipos de protección personal", "Servicio de desratización y control de plagas",
];
const ORGANISMOS_SIM = [
  "I. Municipalidad de Puente Alto", "Gobierno Regional de O'Higgins", "CESFAM Los Volcanes",
  "I. Municipalidad de Quilicura", "Dirección Regional SERNATUR", "Liceo Bicentenario de Talca",
  "Servicio de Salud Aconcagua", "I. Municipalidad de Osorno", "SLEP Andalién Sur", "INJUV Biobío",
];
const REGIONES_SIM = ["Metropolitana", "Valparaíso", "Biobío", "O'Higgins", "Maule", "Los Lagos"];
const RAZONES_SIM = [
  "Parecido a procesos que guardaste o te gustaron", "Mismo rubro que tu perfil, en otra región",
  "Organismo que compra seguido en tu categoría", "Rubro vecino al tuyo: podría calzar con tu oferta",
];

let contadorSim = 0;
function generarSimilares(cantidad) {
  const lote = [];
  for (let k = 0; k < cantidad; k++) {
    const n = contadorSim++;
    const esAgil = n % 3 === 0;
    lote.push({
      id: `${3000 + n * 7}-${10 + (n % 40)}-${esAgil ? "COT26" : n % 2 ? "LE26" : "L126"}`,
      titulo: TITULOS_SIM[n % TITULOS_SIM.length],
      organismo: ORGANISMOS_SIM[n % ORGANISMOS_SIM.length],
      tipo: esAgil ? "Compra Ágil" : n % 2 ? "LE" : "L1",
      monto: esAgil ? "Hasta 100 UTM" : `$${(6 + ((n * 13) % 40)).toLocaleString("es-CL")}.${(100 + n) % 900}00.000`.slice(0, 11),
      cierre: `En ${3 + (n % 10)} días`,
      match: Math.max(42, 68 - n * 2),
      region: REGIONES_SIM[n % REGIONES_SIM.length],
      razon: RAZONES_SIM[n % RAZONES_SIM.length],
      tags: ["Proceso similar", esAgil ? "Sin garantías" : "Revisa las bases"],
      similar: true,
    });
  }
  return lote;
}

// ── Demo por rubro elegido ──
const ORGANISMOS_DEMO_RUBRO = [
  "I. Municipalidad de Providencia", "Servicio de Salud Metropolitano Sur", "SLEP Costa Araucanía",
  "Dirección Regional de Vialidad", "I. Municipalidad de Temuco", "JUNJI Los Ríos",
];
function generarDemoPorRubro(palabras) {
  const plantillas = [
    { t: (p) => `Compra Ágil: adquisición de ${p} para dependencias`, tipo: "Compra Ágil", sufijo: "COT26" },
    { t: (p) => `Suministro de ${p} para programas institucionales`, tipo: "LE", sufijo: "LE26" },
  ];
  const lote = [];
  palabras.slice(0, 5).forEach((p, i) => {
    plantillas.forEach((tpl, j) => {
      const n = i * 2 + j;
      lote.push({
        id: `${5100 + n * 11}-${20 + n}-${tpl.sufijo}`,
        titulo: tpl.t(p),
        organismo: ORGANISMOS_DEMO_RUBRO[n % ORGANISMOS_DEMO_RUBRO.length],
        tipo: tpl.tipo,
        monto: tpl.tipo === "Compra Ágil" ? "Hasta 100 UTM" : `$${12 + n * 3}.400.000`,
        cierre: `En ${2 + (n % 8)} días`,
        region: "Metropolitana",
        tags: ["Ejemplo demo", tpl.tipo === "Compra Ágil" ? "Sin garantías" : "Revisa las bases"],
      });
    });
  });
  return lote;
}

// ── Calce ──
function normalizar(t) {
  return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function puntuarCalce(nombre, palabras) {
  const texto = normalizar(nombre);
  const aciertos = (palabras || []).filter((p) => {
    const clave = normalizar(p);
    const raiz = clave.endsWith("s") ? clave.slice(0, -1) : clave;
    return texto.includes(clave) || texto.includes(raiz);
  }).length;
  if (aciertos === 0) return 40;
  return Math.min(95, 55 + aciertos * 17);
}
function diasParaCierre(fechaCierre) {
  if (!fechaCierre) return { texto: "Por confirmar", urgente: false };
  const dias = Math.ceil((new Date(fechaCierre) - new Date()) / 86400000);
  if (dias <= 0) return { texto: "Cierra hoy", urgente: true };
  if (dias === 1) return { texto: "Cierra mañana", urgente: true };
  return { texto: `En ${dias} días`, urgente: false };
}
function transformarLicitaciones(listado, palabras) {
  const tarjetas = (listado || []).map((l) => {
    const match = puntuarCalce(l.Nombre, palabras);
    return {
      id: l.CodigoExterno,
      titulo: l.Nombre,
      organismo: l.Comprador?.NombreOrganismo || "Organismo por confirmar",
      tipo: l.Tipo === "Compra Ágil" || l.CodigoExterno?.includes("COT") ? "Compra Ágil" : l.Tipo || "LE",
      monto: l.MontoEstimado ? `$${Number(l.MontoEstimado).toLocaleString("es-CL")}` : "Ver en ficha",
      cierre: diasParaCierre(l.FechaCierre).texto,
      match,
      region: l.Comprador?.RegionUnidad?.replace("Región ", "") || "Por confirmar",
      razon: match >= 70 ? "Coincide con lo que vende tu pyme" : "Proceso del día en Mercado Público",
      tags: [l.CodigoEstado === 5 ? "Publicada" : "Activa", "Dato en vivo"],
      similar: match < 70,
    };
  });
  return tarjetas.sort((a, b) => b.match - a.match);
}

const MOTIVOS_REPORTE = [
  "Plazos de publicación demasiado cortos",
  "Las bases parecen dirigidas a un proveedor",
  "El monto no calza con lo solicitado",
  "Criterios de evaluación poco claros",
  "Historial de adjudicaciones al mismo proveedor",
  "Otro motivo",
];

// ── Iconos de línea (estilo del diseño v2) ──
const RUTAS_ICONO = {
  feed: ["M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z", "M9 21.5v-7h6v7"],
  clock: ["M12 7v5l3 2"],
  cart: ["M2 3h3l2.4 12.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 7H6"],
  user: ["M4 21c0-4 3.6-6 8-6s8 2 8 6", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  chart: ["M4 20v-7", "M11 20V5", "M18 20v-10", "M2 20h20"],
  heart: ["M12 20.5S4.5 15.8 2.8 11C1.5 7.4 3.8 4.2 7 4.2c2 0 3.8 1.1 5 2.8 1.2-1.7 3-2.8 5-2.8 3.2 0 5.5 3.2 4.2 6.8-1.7 4.8-9.2 9.5-9.2 9.5z"],
  share: ["M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7", "M16 6l-4-4-4 4", "M12 2v13"],
  flag: ["M5 22V4", "M5 4c4-2 7 2 11 0v9c-4 2-7-2-11 0"],
  send: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4z"],
  bolt: ["M13 2 4 14h6l-1 8 9-12h-6z"],
  chevUp: ["m6 14 6-6 6 6"],
  chevDown: ["m6 10 6 6 6-6"],
  x: ["M6 6l12 12", "M18 6 6 18"],
  check: ["M4 12.5 9.5 18 20 6"],
  shield: ["M12 2 20 5.5V11c0 5.2-3.4 8.9-8 11-4.6-2.1-8-5.8-8-11V5.5z", "m8.5 11.5 2.5 2.5 4.5-5"],
  red: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
};
function Icono({ name, size = 20, fill = false, w = 2 }) {
  const rutas = RUTAS_ICONO[name] || [];
  const circles = name === "clock" ? [[12, 12, 9]] : name === "cart" ? [[9.5, 20.5, 1.3], [17.5, 20.5, 1.3]] : name === "red" ? [[9, 7, 4]] : [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={fill ? 0 : w} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      {rutas.map((d, i) => <path key={i} d={d} />)}
      {circles.map((c, i) => <circle key={"c" + i} cx={c[0]} cy={c[1]} r={c[2]} fill={fill ? "currentColor" : "none"} />)}
    </svg>
  );
}

// ── Calce animado: el % sube desde 0 al entrar la tarjeta (la Joya, más lento y con suspenso) ──
function CalceAnimado({ o }) {
  const [val, setVal] = useState(0);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    let raf;
    const reducido = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducido) { setVal(o.match); setFlash(false); return; }
    const dur = o.joya ? 1500 : 650;
    const t0 = performance.now() + (o.joya ? 400 : 0);
    setVal(0);
    setFlash(false);
    const paso = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0) / dur));
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(o.match * e));
      if (p < 1) raf = requestAnimationFrame(paso);
      else if (o.match >= 85) setFlash(true);
    };
    raf = requestAnimationFrame(paso);
    // Respaldo: si la pestaña no está pintando (rAF detenido), asegurar el valor final.
    const tope = setTimeout(() => {
      setVal(o.match);
      if (o.match >= 85) setFlash(true);
    }, (o.joya ? 400 : 0) + dur + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(tope); };
  }, [o.id]);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 6, fontFamily: "'Manrope', sans-serif" }}>
        <span style={{ color: MUTED }}>{o.joya ? "💎 Calce con tu pyme" : "Calce con tu pyme"}</span>
        <span style={{
          color: o.similar ? "#c9c6bf" : o.match >= 85 ? "#ffd479" : o.match >= 60 ? GOLD_DEEP : "#6d6d76",
          textShadow: !o.similar && o.match >= 85 ? "0 0 14px rgba(239,183,0,.55)" : "none",
          fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", display: "inline-block",
          animation: flash ? "flashOro .7s ease" : "none",
        }}>{val}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "#242833", overflow: "hidden" }}>
        <div style={{
          width: `${val}%`, height: "100%", borderRadius: 999,
          background: o.similar ? "#4a4a55" : o.match >= 85 ? "linear-gradient(90deg, #e9b44c, #ffd479)" : o.match >= 60 ? GOLD_DEEP : "#4a4a55",
          boxShadow: !o.similar && o.match >= 85 ? GLOW_ORO : "none",
        }} />
      </div>
      <div style={{ fontSize: 12.5, color: "#c9c6bf", marginTop: 8, lineHeight: 1.5, fontFamily: "'Manrope', sans-serif" }}>{o.razon}</div>
    </div>
  );
}

export default function GPProveedoresFeed() {
  const [entrada, setEntrada] = useState(false);
  const [tabLanding, setTabLanding] = useState("alertas");
  const [reservado, setReservado] = useState(false);
  const [feed, setFeed] = useState(() => ordenarRonda(SEMILLA));
  const [fuente, setFuente] = useState("demo");
  const [filtro, setFiltro] = useState("todas"); // "todas" | "urgentes"
  const [perfil, setPerfil] = useState(PALABRAS_INICIALES);
  const [nuevaPalabra, setNuevaPalabra] = useState("");
  const [indice, setIndice] = useState(0);
  const [guardadas, setGuardadas] = useState([]);
  const [gustadas, setGustadas] = useState([]);
  const [latiendo, setLatiendo] = useState(false);
  const [carroPop, setCarroPop] = useState(false);
  const [descartadas, setDescartadas] = useState(0);
  const [saliendo, setSaliendo] = useState(null);
  const [dy, setDy] = useState(0);
  const [toast, setToast] = useState(null);
  const [panel, setPanel] = useState(null);
  const [motivo, setMotivo] = useState(null);
  const [marcadas, setMarcadas] = useState([]);
  const [vistas, setVistas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [postuladas, setPostuladas] = useState([]);
  const [rut, setRut] = useState("");
  const [movil, setMovil] = useState(typeof window !== "undefined" && window.innerWidth < 820);
  const [rachaDias, setRachaDias] = useState(0);
  const [rachaHoy, setRachaHoy] = useState(false);
  const [rachaRota, setRachaRota] = useState(0);
  const [celebrar, setCelebrar] = useState(false);
  const [sesion, setSesion] = useState(null);
  const [nombrePyme, setNombrePyme] = useState("");
  const [cuentaEmail, setCuentaEmail] = useState("");
  const [cuentaClave, setCuentaClave] = useState("");
  const [cuentaOcupada, setCuentaOcupada] = useState(false);
  const [conteos, setConteos] = useState({}); // proceso_id → {likes, carro} reales de la red
  const [redPymes, setRedPymes] = useState(null); // null = aún no cargada
  const [pymeVista, setPymeVista] = useState(null); // perfil público abierto
  const [seguidos, setSeguidos] = useState([]); // organismos que la pyme sigue
  const avisoSeguidos = useRef(false); // el aviso 🔔 se muestra una vez por sesión
  const accionesListas = useRef(false); // recién tras cargar la nube se permite sincronizar de vuelta
  const sincroTimer = useRef(null);
  const crudo = useRef(null);
  const drag = useRef({ activo: false, y0: 0 });
  const toastTimer = useRef(null);
  const avisoSimilares = useRef(false);
  const device = useRef("gp-" + Math.random().toString(36).slice(2, 10));

  const esUrgente = (c) => (c.cierre || "").includes("hoy") || (c.cierre || "").includes("mañana");
  const visible = useMemo(() => (filtro === "urgentes" ? feed.filter(esUrgente) : feed), [feed, filtro]);
  const actual = visible[indice];
  const siguiente = visible[indice + 1];
  const anterior = visible[indice - 1];
  const calzadas = visible.filter((c) => !c.similar).length;
  const metaRonda = Math.min(RONDA_META, feed.filter((c) => !c.similar).length) || RONDA_META;
  const enRonda = filtro === "todas" && indice < metaRonda;

  // ── Racha real: se lee de localStorage al entrar; ayer la mantiene, más de un día la corta ──
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem("gp_racha_v1") || "{}");
      if (!g.ultima) return;
      if (g.ultima === hoyChile()) { setRachaDias(g.racha || 0); setRachaHoy(true); }
      else if (esAyer(g.ultima)) setRachaDias(g.racha || 0);
      else if (g.racha > 0) { setRachaDias(0); setRachaRota(g.racha); }
    } catch { /* sin almacenamiento: la racha vive solo en la sesión */ }
  }, []);

  // ── Completar la ronda diaria: pasa la Nº10 → racha +1, se persiste y se celebra ──
  useEffect(() => {
    if (rachaHoy || filtro !== "todas" || indice < metaRonda) return;
    const nueva = rachaDias + 1;
    setRachaDias(nueva);
    setRachaHoy(true);
    setRachaRota(0);
    setCelebrar(true);
    try { localStorage.setItem("gp_racha_v1", JSON.stringify({ racha: nueva, ultima: hoyChile() })); } catch {}
    if (supabase && sesion) {
      supabase.from("perfiles").upsert({ id: sesion.user.id, racha_dias: nueva, racha_ultima: hoyChile() }).then(() => {});
    }
    registrarAccion("ronda-diaria", "completa");
  }, [indice, rachaHoy, filtro, metaRonda, rachaDias, sesion]);

  // ── Cuenta (Supabase): sesión viva y perfil en la nube ──
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSesion(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => setSesion(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Al entrar con una cuenta: el perfil de la nube manda; si no existe, se crea con lo local.
  useEffect(() => {
    if (!supabase || !sesion) return;
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase.from("perfiles").select("*").eq("id", sesion.user.id).maybeSingle();
      if (cancelado || error) return;
      if (!data) {
        await supabase.from("perfiles").insert({
          id: sesion.user.id, nombre_pyme: nombrePyme || null, rut: rut || null,
          palabras: perfil, racha_dias: rachaDias, racha_ultima: rachaHoy ? hoyChile() : null,
        });
        return;
      }
      if (Array.isArray(data.palabras) && data.palabras.length) setPerfil(data.palabras);
      if (data.rut) setRut(data.rut);
      if (data.nombre_pyme) setNombrePyme(data.nombre_pyme);
      if ((data.racha_dias || 0) > 0 && (data.racha_ultima === hoyChile() || esAyer(data.racha_ultima))) {
        setRachaDias((d) => Math.max(d, data.racha_dias));
        if (data.racha_ultima === hoyChile()) setRachaHoy(true);
      }
    })();
    return () => { cancelado = true; };
    // Solo al cambiar la sesión: lo local del momento sirve de semilla si el perfil no existe.
  }, [sesion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al entrar: bajar likes/carro/postuladas de la nube y fusionar con lo local.
  useEffect(() => {
    if (!supabase || !sesion) { accionesListas.current = false; return; }
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from("acciones_pyme").select("proceso_id,tipo,datos").eq("user_id", sesion.user.id);
      if (cancelado) return;
      if (error) { accionesListas.current = true; return; } // sin tabla o sin red: sigue local
      const likes = data.filter((a) => a.tipo === "like").map((a) => a.proceso_id);
      const carro = data.filter((a) => a.tipo === "carro").map((a) => a.datos).filter(Boolean);
      const postu = data.filter((a) => a.tipo === "postulada").map((a) => a.datos).filter(Boolean);
      setGustadas((g) => [...new Set([...g, ...likes])]);
      setGuardadas((g) => { const ids = new Set(g.map((x) => x.id)); return [...g, ...carro.filter((c) => !ids.has(c.id))]; });
      setPostuladas((p) => { const ids = new Set(p.map((x) => x.id)); return [...p, ...postu.filter((c) => !ids.has(c.id))]; });
      accionesListas.current = true;
      const { data: seg } = await supabase.from("seguimientos").select("valor").eq("user_id", sesion.user.id).eq("tipo", "organismo");
      if (!cancelado && seg) setSeguidos(seg.map((s) => s.valor));
    })();
    return () => { cancelado = true; };
  }, [sesion]);

  // ── Seguir organismos: toggle con escritura inmediata a la nube ──
  const toggleSeguir = (organismo) => {
    if (!organismo) return;
    const siguiendo = seguidos.includes(organismo);
    setSeguidos((s) => (siguiendo ? s.filter((x) => x !== organismo) : [...s, organismo]));
    avisar(siguiendo ? "Dejaste de seguir a este organismo" : `★ Siguiendo a ${organismo}: destacaremos sus procesos`);
    if (supabase && sesion) {
      if (siguiendo) {
        supabase.from("seguimientos").delete().match({ user_id: sesion.user.id, tipo: "organismo", valor: organismo }).then(() => {});
      } else {
        supabase.from("seguimientos").upsert({ user_id: sesion.user.id, tipo: "organismo", valor: organismo }).then(() => {});
      }
    }
  };

  // Aviso al entrar: cuántas oportunidades del reparto vienen de organismos seguidos.
  useEffect(() => {
    if (avisoSeguidos.current || !seguidos.length || !feed.length || entrada) return;
    const n = feed.filter((c) => seguidos.includes(c.organismo)).length;
    if (n > 0) {
      avisoSeguidos.current = true;
      const t = setTimeout(() => avisar(`🔔 ${n} ${n === 1 ? "oportunidad" : "oportunidades"} de organismos que sigues en tu reparto de hoy`), 5000);
      return () => clearTimeout(t);
    }
  }, [seguidos, feed, entrada]);

  // Cada cambio local (con sesión) se sube completo, con debounce: es la
  // forma simple de cubrir los 6 puntos que mutan carro/likes/postuladas.
  useEffect(() => {
    if (!supabase || !sesion || !accionesListas.current) return;
    clearTimeout(sincroTimer.current);
    sincroTimer.current = setTimeout(async () => {
      const uid = sesion.user.id;
      const filas = [
        ...gustadas.map((id) => ({ user_id: uid, proceso_id: id, tipo: "like" })),
        ...guardadas.map((g) => ({ user_id: uid, proceso_id: g.id, tipo: "carro", datos: g })),
        ...postuladas.map((g) => ({ user_id: uid, proceso_id: g.id, tipo: "postulada", datos: g })),
      ];
      const { error } = await supabase.from("acciones_pyme").delete().eq("user_id", uid);
      if (!error && filas.length) await supabase.from("acciones_pyme").insert(filas);
    }, 900);
    return () => clearTimeout(sincroTimer.current);
  }, [gustadas, guardadas, postuladas, sesion]);

  const guardarPerfilNube = (extra = {}) => {
    if (!supabase || !sesion) return;
    supabase.from("perfiles").upsert({
      id: sesion.user.id, nombre_pyme: nombrePyme.trim() || null, rut: rut.trim() || null,
      palabras: perfil, ...extra,
    }).then(({ error }) => { if (error) avisar("No se pudo sincronizar tu perfil en la nube"); });
  };

  // Acceso cerrado: las cuentas las crea el administrador en Supabase y
  // entrega correo + clave. Aquí solo se inicia sesión, nunca se registra.
  const entrarCuenta = async () => {
    if (!supabase) return;
    const email = cuentaEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { avisar("Escribe un correo válido"); return; }
    if (cuentaClave.length < 6) { avisar("La clave necesita al menos 6 caracteres"); return; }
    setCuentaOcupada(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: cuentaClave });
      if (error) {
        avisar(error.message.includes("Invalid login")
          ? "Correo o clave incorrectos"
          : error.message.includes("not confirmed")
            ? "Tu cuenta aún no está habilitada: avísanos para activarla"
            : "No se pudo entrar: " + error.message);
        return;
      }
      avisar("¡Bienvenido! Cargando tu reparto…");
      setCuentaClave("");
      setPanel(null);
    } finally { setCuentaOcupada(false); }
  };

  const salirCuenta = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    avisar("Sesión cerrada: sigues navegando como invitado");
  };

  useEffect(() => {
    const onResize = () => setMovil(window.innerWidth < 820);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const registrarAccion = (proceso, tipo) => {
    if (!ENDPOINT_BACKEND) return;
    fetch(`${ENDPOINT_BACKEND}/api/acciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: device.current, proceso, tipo }),
    }).catch(() => {});
  };

  // ── Carga en tiempo real: backend → n8n → demo ──
  useEffect(() => {
    const candidatos = [ENDPOINT_BACKEND && `${ENDPOINT_BACKEND}/api/oportunidades`, ENDPOINT_DATOS].filter(Boolean);
    if (candidatos.length === 0) return;
    let cancelado = false;
    (async () => {
      for (const url of candidatos) {
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error("HTTP " + r.status);
          const datos = await r.json();
          const listado = datos.Listado || datos.listado || datos;
          const tarjetas = transformarLicitaciones(listado, perfil);
          if (!cancelado && tarjetas.length > 0) {
            crudo.current = listado;
            setFeed(ordenarRonda(tarjetas));
            setIndice(0);
            setFuente(datos.fuente ? (datos.fuente === "demo" ? "error" : "vivo") : "vivo");
            return;
          }
        } catch (e) { /* siguiente candidato */ }
      }
      if (!cancelado) {
        setFuente("error");
        avisar("Sin conexión al API: mostrando datos de demostración");
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // ── Contadores sociales reales: agregados de la red por proceso ──
  const idsConteo = useMemo(() => feed.slice(0, 40).map((c) => c.id).join(","), [feed]);
  useEffect(() => {
    if (!supabase || !idsConteo) return;
    let cancelado = false;
    supabase.from("conteos_publicos").select("proceso_id,tipo,total").in("proceso_id", idsConteo.split(","))
      .then(({ data, error }) => {
        if (cancelado || error || !data) return;
        const m = {};
        data.forEach((r) => { (m[r.proceso_id] ??= { likes: 0, carro: 0 })[r.tipo === "like" ? "likes" : "carro"] = r.total; });
        setConteos(m);
      });
    return () => { cancelado = true; };
  }, [idsConteo]);
  // Con datos reales manda la red (mi acción ya viene contada tras el sync);
  // sin ellos, semilla demo de la tarjeta + mi acción local de forma optimista.
  const conteoDe = (o, miGusto, miCarro) => {
    const real = conteos[o.id];
    return {
      likes: real ? real.likes : (o.social?.likes ?? 0) + (miGusto ? 1 : 0),
      carro: real ? real.carro : (o.social?.carro ?? 0) + (miCarro ? 1 : 0),
    };
  };

  // ── Red de pymes: perfiles públicos, ordenados por racha ──
  useEffect(() => {
    if (panel !== "red" || !supabase || redPymes !== null) return;
    supabase.from("perfiles")
      .select("id,nombre_pyme,palabras,region,racha_dias,racha_ultima,creado")
      .order("racha_dias", { ascending: false }).limit(50)
      .then(({ data, error }) => { if (!error) setRedPymes(data || []); });
  }, [panel, redPymes]);

  // ── Scroll infinito ──
  useEffect(() => {
    if (filtro === "todas" && indice >= feed.length - 3) {
      setFeed((f) => [...f, ...generarSimilares(6)]);
    }
  }, [indice, feed.length, filtro]);

  useEffect(() => {
    if (actual?.similar && !avisoSimilares.current) {
      avisoSimilares.current = true;
      avisar("Fin de tu reparto calzado: ahora procesos similares");
    }
  }, [actual]);

  // ── Doble check ──
  useEffect(() => {
    if (!actual || vistas.includes(actual.id)) return;
    const t = setTimeout(() => {
      setVistas((v) => (v.includes(actual.id) ? v : [...v, actual.id]));
      registrarAccion(actual.id, "vista");
    }, 1200);
    return () => clearTimeout(t);
  }, [actual, vistas]);

  const avisar = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // ── Saludo según la hora de Chile ──
  const saludo = useMemo(() => {
    let hora = new Date().getHours();
    try {
      hora = Number(new Intl.DateTimeFormat("es-CL", { hour: "numeric", hour12: false, timeZone: "America/Santiago" }).format(new Date()));
    } catch (e) { /* usa hora local */ }
    const momento = hora >= 6 && hora < 12 ? "buen día" : hora >= 12 && hora < 20 ? "buenas tardes" : "buenas noches";
    return `Hola, ¡${momento} proveedor! ¿A qué vamos a postular hoy?`;
  }, []);

  useEffect(() => {
    if (entrada) return;
    const t = setTimeout(() => avisar(saludo), 500);
    return () => clearTimeout(t);
  }, [saludo, entrada]);

  // ── Anticipación: anunciar la Joya escondida al fondo de la ronda ──
  useEffect(() => {
    if (entrada || rachaHoy) return;
    const t = setTimeout(() => avisar(`💎 La joya de hoy está escondida al final de tu ronda: revisa las ${metaRonda}`), 3200);
    return () => clearTimeout(t);
  }, [entrada, rachaHoy, metaRonda]);

  // ── Rueda del mouse: navegación estilo TikTok en escritorio ──
  const wheelLock = useRef(0);
  const onWheel = (e) => {
    if (panel || celebrar || !actual) return;
    const ahora = Date.now();
    if (ahora - wheelLock.current < 550 || Math.abs(e.deltaY) < 24) return;
    wheelLock.current = ahora;
    if (e.deltaY > 0) pasar("up");
    else volver();
  };

  const pasar = useCallback(
    (modo) => {
      if (!actual || saliendo || panel || celebrar) return;
      setSaliendo(modo);
      setTimeout(() => {
        if (modo === "save") {
          setGuardadas((g) => [...g, actual]);
          setCarroPop(true);
          setTimeout(() => setCarroPop(false), 450);
          avisar("Al carro 🛒 Venta potencial sumada");
          registrarAccion(actual.id, "guardar");
        } else {
          setDescartadas((d) => d + 1);
          registrarAccion(actual.id, "descartar");
        }
        setHistorial((h) => [...h, modo]);
        setIndice((i) => i + 1);
        setSaliendo(null);
        setDy(0);
      }, 260);
    },
    [actual, saliendo, panel, celebrar]
  );

  const volver = useCallback(() => {
    if (saliendo || panel || celebrar) return;
    if (indice === 0) { avisar("Estás en la primera del reparto"); setDy(0); return; }
    setSaliendo("back");
    setTimeout(() => {
      const ultima = historial[historial.length - 1];
      if (ultima === "save") {
        setGuardadas((g) => g.slice(0, -1));
        avisar("Volviste: se quitó del carro para que decidas de nuevo");
      } else {
        setDescartadas((d) => Math.max(0, d - 1));
        avisar("Volviste a la anterior");
      }
      setHistorial((h) => h.slice(0, -1));
      setIndice((i) => i - 1);
      setSaliendo(null);
      setDy(0);
    }, 240);
  }, [indice, saliendo, panel, celebrar, historial]);

  // ── Me gusta ──
  const gustada = actual ? gustadas.includes(actual.id) : false;
  const toggleGusta = () => {
    if (!actual) return;
    if (gustada) {
      setGustadas((g) => g.filter((id) => id !== actual.id));
    } else {
      setGustadas((g) => [...g, actual.id]);
      setLatiendo(true);
      setTimeout(() => setLatiendo(false), 450);
      avisar("Nos gusta: afinaremos tu calce con procesos así");
      registrarAccion(actual.id, "like");
    }
  };

  const enCarro = actual ? guardadas.some((g) => g.id === actual.id) : false;
  const toggleCarro = () => {
    if (!actual) return;
    if (enCarro) {
      setGuardadas((g) => g.filter((x) => x.id !== actual.id));
      avisar("Quitada del carro");
    } else {
      pasar("save");
    }
  };

  // ── Ciclo de postulación: carro → postulada → adjudicada/no resultó ──
  const marcarPostulada = (g) => {
    setGuardadas((gs) => gs.filter((x) => x.id !== g.id));
    setPostuladas((p) => [...p, { ...g, resultado: null }]);
    avisar("Marcada como postulada. ¡Éxito en la apertura! 🤞");
  };
  const resolverPostulacion = (id, res) => {
    setPostuladas((p) => p.map((x) => (x.id === id ? { ...x, resultado: res } : x)));
    if (res === "adjudicada") avisar("🏆 ¡Adjudicada! Publícala en LinkedIn con el botón dorado");
    else avisar("No resultó esta vez: la próxima apertura es tuya");
  };

  // ── Arrastre ──
  const onPointerDown = (e) => {
    if (!actual || saliendo || panel) return;
    drag.current = { activo: true, y0: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.activo) return;
    setDy(e.clientY - drag.current.y0);
  };
  const onPointerUp = () => {
    if (!drag.current.activo) return;
    drag.current.activo = false;
    if (dy < -110) pasar("up");
    else if (dy > 110) volver();
    else setDy(0);
  };

  // ── Teclado ──
  useEffect(() => {
    const onKey = (e) => {
      if (celebrar) { if (e.key === "Escape") setCelebrar(false); return; }
      if (panel) { if (e.key === "Escape") setPanel(null); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); pasar("up"); }
      if (e.key === "ArrowDown") { e.preventDefault(); volver(); }
      if (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "c") pasar("save");
      if (e.key.toLowerCase() === "l") toggleGusta();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pasar, volver, panel, celebrar, gustada, actual]);

  // ── Compartir ──
  const urlOportunidad = (o) => URL_DEMO + o.id;
  const urlFicha = (o) =>
    o.tipo === "Compra Ágil"
      ? "https://www.mercadopublico.cl/CompraAgil"
      : "https://www.mercadopublico.cl/fichaLicitacion.html?idLicitacion=" + encodeURIComponent(o.id);

  const copiar = async (texto, msg) => {
    try { await navigator.clipboard.writeText(texto); avisar(msg); }
    catch { avisar("No se pudo copiar en este navegador"); }
  };
  const compartirWhatsApp = (o) => {
    const texto = `Mira esta oportunidad en Mercado Público: ${o.titulo} (ID ${o.id}, ${o.organismo}, cierra ${o.cierre.toLowerCase()}). La encontré en GP Proveedores: ${urlOportunidad(o)}`;
    window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank");
    setPanel(null);
  };
  const compartirLinkedIn = (o) => {
    window.open("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(urlOportunidad(o)), "_blank");
    setPanel(null);
  };
  const publicarAdjudicacion = async (o) => {
    const post = [
      "Tenemos una buena noticia que compartir.",
      "",
      `Nuestra empresa se adjudicó el proceso ID ${o.id} de ${o.organismo}: ${o.titulo.toLowerCase()}.`,
      "",
      "Detrás de cada adjudicación hay un equipo que leyó las bases con calma, preparó una oferta seria y cumplió cada requisito. Gracias a quienes lo hicieron posible.",
      "",
      "Seguimos creciendo como proveedores del Estado de Chile.",
      "",
      "#MercadoPublico #ComprasPublicas #Pymes",
    ].join("\n");
    await copiar(post, "Post copiado: pégalo en LinkedIn");
    window.open("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(urlOportunidad(o)), "_blank");
    setPanel(null);
  };

  // ── Perfil ──
  const agregarPalabra = (p) => {
    const limpia = (p || "").trim().toLowerCase();
    if (!limpia) return;
    if (perfil.includes(limpia)) { avisar("Esa palabra ya está en tu perfil"); return; }
    setPerfil((pf) => [...pf, limpia]);
    setNuevaPalabra("");
  };
  const quitarPalabra = (p) => setPerfil((pf) => pf.filter((x) => x !== p));
  const guardarPerfil = () => {
    if (perfil.length === 0) { avisar("Agrega al menos una palabra de tu rubro"); return; }
    if (crudo.current) {
      setFeed(transformarLicitaciones(crudo.current, perfil));
    } else {
      const base = [...SEMILLA, ...generarDemoPorRubro(perfil)];
      const reordenadas = base.map((c) => {
        const m = puntuarCalce(c.titulo, perfil);
        return { ...c, match: m, similar: m < 70, razon: m >= 70 ? "Coincide con lo que vende tu pyme" : "Proceso del día en Mercado Público" };
      }).sort((a, b) => b.match - a.match);
      setFeed(reordenadas);
    }
    setFiltro("todas");
    setIndice(0);
    setPanel(null);
    guardarPerfilNube();
    avisar(rut.trim()
      ? "Perfil guardado. Con tu RUT activaremos tus ventas reales en el panel"
      : "Perfil guardado: tu reparto se reordenó según tu rubro");
  };

  // ── Reporte ──
  const enviarReporte = (o) => {
    if (!motivo) { avisar("Elige un motivo primero"); return; }
    setMarcadas((m) => [...m, { id: o.id, motivo }]);
    if (ENDPOINT_BACKEND) {
      fetch(`${ENDPOINT_BACKEND}/api/reportes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: device.current, proceso: o.id, motivo }),
      }).catch(() => {});
    }
    setMotivo(null);
    setPanel(null);
    avisar("Proceso marcado. Revisa los canales oficiales");
  };

  const cambiarFiltro = (f) => {
    if (f === filtro) return;
    setFiltro(f);
    setIndice(0);
    setDy(0);
  };

  const progreso = dy < 0 ? Math.min(1, -dy / 110) : 0;
  const progresoAbajo = dy > 0 ? Math.min(1, dy / 110) : 0;
  const cardStyle = {
    transform: saliendo
      ? saliendo === "up" ? "translateY(-120%) rotate(-2deg)"
      : saliendo === "back" ? "translateY(120%) rotate(2deg)"
      : "translateX(110%) rotate(6deg)"
      : `translateY(${dy}px) rotate(${dy * 0.012}deg)`,
    opacity: saliendo ? 0 : 1 - progreso * 0.25 - progresoAbajo * 0.15,
    transition: drag.current.activo ? "none" : "transform .26s ease, opacity .26s ease",
  };
  const yaMarcada = actual && marcadas.some((m) => m.id === actual.id);
  const vistaActual = actual && vistas.includes(actual.id);

  const NAVS = [
    { id: "reparto", icono: "feed", label: "Para tu pyme", badge: String(calzadas), onClick: () => cambiarFiltro("todas") },
    { id: "urgentes", icono: "clock", label: "Cierran hoy", badge: String(feed.filter(esUrgente).length), onClick: () => cambiarFiltro("urgentes") },
    { id: "carro", icono: "cart", label: "Mi carro", badge: String(guardadas.length), onClick: () => setPanel("carro") },
    { id: "pyme", icono: "user", label: "Mi pyme", badge: "", onClick: () => setPanel("perfil") },
    { id: "panel", icono: "chart", label: "Panel BI", badge: "", onClick: () => setPanel("negocio") },
    { id: "red", icono: "red", label: "Red de pymes", badge: "", onClick: () => setPanel("red") },
    { id: "cuenta", icono: "shield", label: "Mi cuenta", badge: "", onClick: () => setPanel("cuenta") },
  ];
  const navActiva = panel === "carro" ? "carro" : panel === "perfil" ? "pyme" : panel === "negocio" ? "panel" : panel === "cuenta" ? "cuenta" : panel === "red" || panel === "pymePublica" ? "red" : filtro === "urgentes" ? "urgentes" : "reparto";

  // ── Botón del rail circular ──
  const RailBtn = ({ icono, activo, sub, onClick, aria, pop, colorActivo = GOLD, anillo }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ position: "relative" }}>
        {anillo && (
          <span aria-hidden="true" style={{
            position: "absolute", inset: -5, borderRadius: "50%",
            border: "2px solid rgba(239,183,0,.15)", borderTopColor: GOLD,
            animation: "orbitSpin 1.3s linear infinite", pointerEvents: "none", zIndex: 1,
          }} />
        )}
        <button
          onClick={onClick}
          aria-label={aria}
          style={{
            width: 52, height: 52, borderRadius: "50%",
            background: activo ? GOLD_BG : CARD,
            border: `1px solid ${activo ? colorActivo : BORDE}`,
            color: activo ? colorActivo : "#c9c6bf",
            display: "grid", placeItems: "center", cursor: "pointer",
            animation: pop ? "likePop .3s ease" : "none",
            position: "relative", zIndex: 2,
          }}
        >
          <Icono name={icono} size={22} fill={activo && (icono === "heart" || icono === "cart")} />
        </button>
      </div>
      {sub !== undefined && (
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: activo ? colorActivo : MUTED, whiteSpace: "nowrap" }}>{sub}</span>
      )}
    </div>
  );

  const chipEstado = (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "4px 9px", borderRadius: 999,
      fontFamily: "'IBM Plex Mono', monospace",
      border: `1px solid ${fuente === "vivo" ? VERDE : BORDE}`,
      color: fuente === "vivo" ? VERDE : MUTED,
    }}>
      {fuente === "vivo" ? "● EN VIVO" : "◌ DEMO"}
    </span>
  );

  const horasRacha = horasRestantesHoy();
  const msgRacha = rachaHoy
    ? `Racha de ${rachaDias} ${rachaDias === 1 ? "día" : "días"} asegurada hoy ✓ Vuelve mañana por tu próxima ronda.`
    : rachaDias > 0
      ? `⚠ Tu racha de ${rachaDias} ${rachaDias === 1 ? "día" : "días"} se apaga en ${horasRacha} h: completa la ronda de hoy.`
      : rachaRota > 0
        ? `Se apagó tu racha de ${rachaRota} días 🥲 Completa la ronda de hoy y enciende una nueva.`
        : "Completa tu primera ronda de 10 para encender la racha 🔥";
  const racha = (
    <button
      onClick={() => avisar(msgRacha)}
      title="Días seguidos completando tu ronda"
      aria-label={msgRacha}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 12, background: GOLD_BG, border: `1px solid ${rachaHoy ? GOLD_DEEP : "#5a3d2a"}`, cursor: "pointer" }}>
      <span style={{ fontSize: 15, animation: rachaHoy ? "brasa 1.8s ease-in-out infinite" : "apagandose 1.5s ease-in-out infinite" }}>🔥</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: "#ffd479" }}>{rachaDias}</span>
      <span style={{ fontSize: 9, letterSpacing: "0.05em", color: rachaHoy ? "#f3ca7c" : "#ff8a3d", textTransform: "uppercase", fontWeight: 700 }}>
        {rachaHoy ? "racha asegurada hoy ✓" : rachaDias > 0 ? `se apaga en ${horasRacha} h` : "enciende tu racha"}
      </span>
    </button>
  );

  // Tarjeta de racha con los días de la semana (barra lateral)
  const letrasDias = ["D", "L", "M", "M", "J", "V", "S"];
  const hoyIdx = new Date().getDay();
  const diasRacha = Array.from({ length: 7 }, (_, i) => letrasDias[(hoyIdx - 6 + i + 7) % 7]);
  const previosRacha = rachaHoy ? rachaDias - 1 : rachaDias; // días ya asegurados antes de hoy
  const rachaCard = (
    <button
      onClick={() => avisar(msgRacha)}
      aria-label={msgRacha}
      style={{ textAlign: "left", width: "100%", background: GOLD_BG, border: `1px solid ${rachaHoy ? GOLD_DEEP : "#5a3d2a"}55`, borderRadius: 16, padding: "14px 14px 12px", cursor: "pointer" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: rachaHoy ? GOLD : "#3a2c14", color: rachaHoy ? SOBRE_GOLD : GOLD_DEEP, display: "grid", placeItems: "center" }}>
          <Icono name="bolt" size={18} fill />
        </span>
        <span>
          <span style={{ display: "block", fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 16, color: "#ffd479", lineHeight: 1 }}>{rachaDias} {rachaDias === 1 ? "día" : "días"}</span>
          <span style={{ display: "block", fontSize: 9, letterSpacing: "0.12em", color: MUTED, fontFamily: "'IBM Plex Mono', monospace", marginTop: 3 }}>DE RACHA</span>
        </span>
        {!rachaHoy && rachaDias > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: "#ff8a3d", background: "#3a1210", border: "1px solid #ff8a3d55", borderRadius: 999, padding: "3px 8px", animation: "apagandose 1.5s ease-in-out infinite" }}>
            {horasRacha} h
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        {diasRacha.map((l, i) => {
          const encendido = i === 6 ? rachaHoy : 6 - i <= previosRacha;
          return (
            <span key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ width: 15, height: 15, borderRadius: "50%", background: encendido ? GOLD : "#2a2e3a", opacity: i === 6 ? 1 : encendido ? 0.55 : 1, border: i === 6 && rachaHoy ? `2px solid #ffd479` : "none", boxShadow: i === 6 && rachaHoy ? "0 0 8px rgba(255,212,121,.5)" : "none" }} />
              <span style={{ fontSize: 8.5, color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>{l}</span>
            </span>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: rachaHoy ? "#c9c6bf" : "#f3ca7c", lineHeight: 1.5 }}>
        {rachaHoy
          ? "Ronda de hoy completa ✓ Mañana a las 08:00 llega la próxima."
          : `Completa tu ronda (${Math.min(indice, metaRonda)}/${metaRonda}) para ${rachaDias > 0 ? "no perder la racha." : "encender la racha."}`}
      </div>
    </button>
  );

  // ── Tarjeta principal ──
  const tarjeta = actual ? (
    <article
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onDoubleClick={() => { if (!gustada) toggleGusta(); }}
      role="group" aria-label={`Oportunidad: ${actual.titulo}`}
      style={{
        position: "relative",
        width: movil ? "100%" : "min(560px, 44vw)",
        height: movil ? "100%" : "calc(100vh - 96px)",
        maxHeight: movil ? "none" : 880,
        background: CARD_GRAD,
        borderRadius: movil ? 0 : 26,
        border: movil ? "none" : `1px solid ${actual.joya ? GOLD : BORDE}`,
        padding: movil ? "72px 22px 128px" : "30px 32px",
        display: "flex", flexDirection: "column",
        cursor: "grab",
        boxShadow: actual.joya
          ? (movil ? "inset 0 0 60px rgba(239,183,0,.08)" : `${SOMBRA_CARD}, 0 0 46px rgba(239,183,0,.28)`)
          : movil ? "none" : SOMBRA_CARD,
        zIndex: 2,
        ...cardStyle,
      }}
    >
      {/* Sellos de gesto */}
      <div style={{ position: "absolute", top: movil ? 60 : 20, right: 20, padding: "6px 12px", borderRadius: 8, border: `2px solid ${PAPER}`, fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", transform: "rotate(8deg)", opacity: progreso, transition: "opacity .1s", pointerEvents: "none", zIndex: 3 }}>
        DESCARTAR ↑
      </div>
      <div style={{ position: "absolute", bottom: movil ? 136 : 18, left: "50%", transform: "translateX(-50%) rotate(-4deg)", padding: "6px 12px", borderRadius: 8, border: `2px solid ${GOLD}`, color: GOLD, fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", opacity: progresoAbajo, transition: "opacity .1s", pointerEvents: "none", zIndex: 3 }}>
        ↓ VOLVER
      </div>

      {/* Franja superior */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: GOLD, letterSpacing: "0.02em" }}>ID {actual.id}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999, fontFamily: "'IBM Plex Mono', monospace", background: actual.tipo === "Compra Ágil" ? GOLD_BG : CARD2, color: actual.tipo === "Compra Ágil" ? GOLD : "#c9c6bf", border: `1px solid ${actual.tipo === "Compra Ágil" ? GOLD_DEEP : BORDE}` }}>
          {actual.tipo}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999, fontFamily: "'IBM Plex Mono', monospace", background: esUrgente(actual) ? "#3a1210" : "#12251d", color: esUrgente(actual) ? "#ff8a3d" : VERDE, border: `1px solid ${esUrgente(actual) ? "#ff8a3d55" : "#2b4a3a"}` }}>
          {esUrgente(actual) ? "Cierra ya" : "Esta semana"}
        </span>
        {actual.joya && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 999, fontFamily: "'IBM Plex Mono', monospace", background: GOLD, color: SOBRE_GOLD, border: `1px solid ${GOLD}`, animation: "brasa 1.6s ease-in-out infinite" }}>
            💎 LA JOYA DEL DÍA
          </span>
        )}
        {actual.similar && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999, fontFamily: "'IBM Plex Mono', monospace", color: MUTED, border: `1px solid ${BORDE}` }}>◈ SIMILAR</span>}
        {yaMarcada && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999, fontFamily: "'IBM Plex Mono', monospace", background: "#3a1210", color: ROJO, border: `1px solid ${ROJO}66` }}>⚑ MARCADA</span>}
        {seguidos.includes(actual.organismo) && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999, fontFamily: "'IBM Plex Mono', monospace", background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_DEEP}` }}>★ ORGANISMO SEGUIDO</span>
        )}
        <span aria-label={vistaActual ? "Vista" : "Recibida"} style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: vistaActual ? "#7fc7e8" : "#4a4a55", transition: "color .3s ease" }}>
          {vistaActual ? "✓✓" : "✓"}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {enRonda && !actual.joya && !rachaHoy && (
            <span title="La mejor oportunidad de hoy espera al final de la ronda" style={{ fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: GOLD_DEEP, border: `1px solid rgba(239,183,0,.18)`, borderRadius: 999, padding: "3px 8px" }}>
              💎 en la Nº{metaRonda}
            </span>
          )}
          <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: enRonda ? GOLD : MUTED, fontWeight: enRonda ? 700 : 500 }}>
            {enRonda
              ? `RONDA ${Math.min(indice + 1, metaRonda)}/${metaRonda}`
              : `${Math.min(indice + 1, visible.length)} / ${visible.length > 99 ? "99+" : visible.length}`}
          </span>
        </span>
      </div>

      {/* Título */}
      <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: movil ? 24 : 27, lineHeight: 1.2, margin: "0 0 6px", color: PAPER, letterSpacing: "-0.01em" }}>
        {actual.titulo}
      </h2>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ fontSize: 13.5, color: MUTED, fontFamily: "'Manrope', sans-serif" }}>
          {actual.organismo} · {actual.region}
        </span>
        {(() => {
          const sigue = seguidos.includes(actual.organismo);
          return (
            <button onClick={() => toggleSeguir(actual.organismo)}
              aria-label={sigue ? `Dejar de seguir a ${actual.organismo}` : `Seguir a ${actual.organismo}`}
              style={{ fontSize: 10.5, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 10px", borderRadius: 999, cursor: "pointer", background: sigue ? GOLD_BG : "transparent", border: `1.5px solid ${sigue ? GOLD : BORDE}`, color: sigue ? GOLD : MUTED }}>
              {sigue ? "★ SIGUIENDO" : "+ SEGUIR"}
            </button>
          );
        })()}
      </div>

      {/* Datos duros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Dato etiqueta="Monto" valor={actual.monto} tono="verde" grande />
        <Dato etiqueta="Cierra" valor={actual.cierre.replace("En ", "")} tono="oro" urgente={esUrgente(actual)} grande />
      </div>

      {/* Calce (animado: recompensa variable en cada tarjeta) */}
      <CalceAnimado o={actual} />

      {/* Insight del comprador */}
      {actual.insight && (
        <div style={{ background: GOLD_BG, border: `1px solid rgba(239,183,0,.18)`, borderRadius: 14, padding: "11px 13px", marginBottom: 14 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "#96825c", textTransform: "uppercase", marginBottom: 4, fontFamily: "'IBM Plex Mono', monospace" }}>✦ Dato del comprador</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#d8c8a4", fontFamily: "'Manrope', sans-serif" }}>{actual.insight}</div>
        </div>
      )}

      {/* Tags + prueba social */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: "auto" }}>
        {actual.tags.map((t) => (
          <span key={t} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: CARD2, border: `1px solid ${BORDE}`, color: "#c9c6bf", fontFamily: "'Manrope', sans-serif" }}>{t}</span>
        ))}
        {(actual.social || conteos[actual.id]) && (
          <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace" }}>
            ♥ {conteoDe(actual, gustada, enCarro).likes} · 🛒 {conteoDe(actual, gustada, enCarro).carro} pymes
          </span>
        )}
      </div>

      {/* Acciones principales */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={() => setPanel("ficha")}
          style={{ flex: 2.2, padding: "15px 10px", borderRadius: 14, border: `1.5px solid ${GOLD}`, background: GOLD, color: SOBRE_GOLD, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "'Manrope', sans-serif", boxShadow: "0 0 10px rgba(239,183,0,.5)" }}>
          Ver ficha completa
        </button>
        <button onClick={() => pasar("up")}
          style={{ flex: 1, padding: "15px 10px", borderRadius: 14, border: `1.5px solid ${BORDE}`, background: CARD2, color: "#c9c6bf", fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>
          Pasar
        </button>
      </div>
    </article>
  ) : (
    <div style={{ textAlign: "center", padding: 32, maxWidth: 340, zIndex: 2 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{filtro === "urgentes" ? "⏱" : "📬"}</div>
      <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 22, color: GOLD, margin: "0 0 10px" }}>
        {filtro === "urgentes" ? "Sin más urgentes por hoy" : "Reparto al día"}
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: MUTED, margin: "0 0 18px", fontFamily: "'Manrope', sans-serif" }}>
        {filtro === "urgentes" ? "Revisaste todo lo que cierra hoy y mañana." : "Mañana llega el próximo pedido."}
      </p>
      {filtro === "urgentes" && (
        <button onClick={() => cambiarFiltro("todas")} style={{ ...btn({ fondo: GOLD, borde: GOLD, color: SOBRE_GOLD, peso: 800 }), width: "auto", padding: "12px 22px" }}>
          Volver al reparto
        </button>
      )}
    </div>
  );

  // ── Rail de acciones ──
  const rail = actual && (
    <div style={movil
      ? { position: "absolute", left: 0, right: 0, bottom: 12, zIndex: 8, display: "flex", flexDirection: "row", gap: 20, alignItems: "flex-start", justifyContent: "center" }
      : { display: "flex", flexDirection: "column", gap: 16, alignItems: "center", zIndex: 3 }}>
      <RailBtn icono="heart" activo={gustada} pop={latiendo}
        sub={String((actual.social || conteos[actual.id] ? conteoDe(actual, gustada, enCarro).likes : gustadas.length))}
        onClick={toggleGusta} aria={gustada ? "Quitar me gusta" : "Me gusta"} />
      <RailBtn icono="cart" activo={enCarro} pop={carroPop} anillo
        sub={String((actual.social || conteos[actual.id] ? conteoDe(actual, gustada, enCarro).carro : guardadas.length))}
        onClick={toggleCarro} aria={enCarro ? "Quitar del carro" : "Agregar al carro"} />
      <RailBtn icono="send" activo={false} sub="Enviar" onClick={() => setPanel("compartir")} aria="Compartir" />
      <RailBtn icono="flag" activo={!!yaMarcada} colorActivo={ROJO} sub="No calza" onClick={() => setPanel("reporte")} aria="Marcar: algo no calza" />
      {!movil && (
        <>
          <div style={{ width: 1, height: 24, background: BORDE }} />
          <button onClick={volver} aria-label="Volver a la anterior"
            style={{ width: 48, height: 48, borderRadius: "50%", background: CARD, border: `1px solid ${BORDE}`, color: "#c9c6bf", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Icono name="chevUp" size={20} />
          </button>
          <button onClick={() => pasar("up")} aria-label="Pasar a la siguiente"
            style={{ width: 56, height: 56, borderRadius: "50%", background: PAPER, border: `1px solid ${PAPER}`, color: "#080a10", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Icono name="chevDown" size={24} w={2.4} />
          </button>
        </>
      )}
    </div>
  );

  // ── Peek de tarjetas vecinas (solo escritorio) ──
  const peek = (f, arriba) => f && !movil && (
    <div aria-hidden="true" style={{
      position: "absolute", left: "50%", transform: "translateX(-58%)",
      [arriba ? "top" : "bottom"]: -8,
      width: "min(520px, 40vw)",
      background: "#080a10", border: `1px solid #1b1d26`, borderRadius: 18,
      padding: arriba ? "26px 26px 14px" : "14px 26px 26px",
      fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 700, color: "#5d5d66",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: 0.85, zIndex: 0,
    }}>
      {f.titulo} · {f.organismo}
    </div>
  );

  // ── Pantalla de entrada: pestaña Proveedores (diseño landing claro) ──
  if (entrada) {
    const T = { fondo: "#faf9f5", tinta: "#141311", cuerpo: "#46443f", suave: "#6e6b65", borde: "#e2e0d8", teal: "#a97f00", tealOsc: "#8a6800", tealTinte: "#faf1d4", ambarBg: "#f4ede1", ambarFg: "#8a5410" };
    const heroAlerts = [
      { tag: "ASEO", title: "Servicio de aseo y jardines 2026", meta: "SERVIU Metropolitano · $46.900.000", time: "9 días" },
      { tag: "ÁGIL", title: "Compra ágil: notebooks i5", meta: "DAEM Puente Alto · < 37 UTM", time: "Hoy" },
      { tag: "ELEC", title: "Mantención eléctrica municipal", meta: "Municipalidad de Ñuñoa · $18.400.000", time: "4 días" },
    ];
    const dolores = [
      { n: "01", title: "Te enteras cuando ya cerró", body: "Revisar Mercado Público a mano no escala: entre 3.000 publicaciones semanales, la tuya se pierde." },
      { n: "02", title: "Postulas a lo que no ibas a ganar", body: "Sin saber cuántas veces adjudica ese comprador ni a qué precio, se van horas en bases imposibles." },
      { n: "03", title: "Compra ágil y Convenio Marco pasan de largo", body: "Cierran en horas y son el camino más corto para una pyme. Casi nadie los mira a tiempo." },
    ];
    const pasos = [
      { n: "1", title: "Cuéntanos tu giro", body: "Rubro, montos que te acomodan, regiones donde operas y si puedes o no rendir garantías." },
      { n: "2", title: "Nosotros filtramos", body: "Cruzamos las publicaciones oficiales de Mercado Público con tu perfil y descartamos el ruido." },
      { n: "3", title: "Recibes y postulas", body: "Una alerta diaria con lo que sí puedes ganar, con el historial del comprador al lado." },
    ];
    const testimonios = [
      { quote: "Postulábamos a lo que alcanzábamos a ver. Ahora reviso tres alertas en la mañana y decido en cinco minutos.", name: "Ana Rojas", role: "Servicios Rojas SpA · aseo y mantención, RM" },
      { quote: "Nunca habíamos usado compra ágil. En dos meses cerramos cuatro por ese camino.", name: "Marco Elgueta", role: "Imprenta Sur Ltda. · Biobío" },
      { quote: "Ver cuántas veces adjudica cada comprador nos hizo dejar de perder horas en bases que no íbamos a ganar.", name: "Carolina Díaz", role: "TecnoAndes SpA · TI, Valparaíso" },
    ];
    const beneficios = [
      "Precio preferente de lanzamiento congelado por 12 meses.",
      "Acceso al curso de Compras Públicas de Gestor Público mientras dure la beta.",
      "Configuramos contigo tus primeros filtros, uno a uno.",
    ];
    const vistasTabs = {
      alertas: { title: "Alertas por rubro", sub: "Lo publicado hoy que calza con tu giro", badge: "3 nuevas hoy", rows: [
        ["Mantención eléctrica edificio consistorial", "Municipalidad de Ñuñoa", "$18.400.000", "Cierra en 4 días"],
        ["Servicio de aseo y jardines 2026", "SERVIU Metropolitano", "$46.900.000", "Cierra en 9 días"],
        ["Suministro de artículos de oficina", "Hospital El Pino", "$7.250.000", "Cierra en 2 días"]] },
      filtros: { title: "Filtros inteligentes", sub: "Monto, región y comprador en una sola vista", badge: "37 resultados", filtros: true },
      agiles: { title: "Convenio Marco y compras ágiles", sub: "Las oportunidades rápidas que casi nadie mira", badge: "Cierre en horas", rows: [
        ["Compra ágil · Notebooks i5", "DAEM Puente Alto", "< $37 UTM", "Responder hoy"],
        ["Convenio Marco · Mobiliario", "JUNAEB", "Tienda activa", "Actualizar precio"],
        ["Compra ágil · Servicio de imprenta", "Municipalidad de Maipú", "< $37 UTM", "Cierra mañana"]] },
      compradores: { title: "Panel del comprador", sub: "Con quién vale la pena competir", badge: "Datos históricos", rows: [
        ["Municipalidad de Ñuñoa", "38 procesos / año", "Adjudica en 21 días", "Tu tasa: 33%"],
        ["SERVIU Metropolitano", "112 procesos / año", "Adjudica en 34 días", "Tu tasa: 12%"],
        ["Hospital El Pino", "64 procesos / año", "Adjudica en 18 días", "Tu tasa: 0%"]] },
    };
    const tabDefs = [
      ["alertas", "Alertas por rubro", "Lo tuyo, cada mañana"],
      ["filtros", "Filtros inteligentes", "Monto, región, comprador"],
      ["agiles", "Convenio Marco y ágiles", "Oportunidades rápidas"],
      ["compradores", "Panel del comprador", "Historial y competencia"],
    ];
    const vista = vistasTabs[tabLanding];
    const Seccion = ({ children, fondo, borde }) => (
      <section style={{ background: fondo || "transparent", borderTop: borde ? `1px solid ${T.borde}` : "none" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: movil ? "48px 20px" : "72px 32px" }}>{children}</div>
      </section>
    );
    const Kicker = ({ children }) => (
      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: T.teal, marginBottom: 12 }}>{children}</div>
    );
    return (
      <div style={{ fontFamily: "'Manrope', system-ui, sans-serif", background: T.fondo, minHeight: "100vh", color: T.tinta, overflowY: "auto", height: "100vh" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap');
          * { box-sizing: border-box; }
          @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        `}</style>

        {/* Nav */}
        <nav style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(251,252,250,.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${T.borde}` }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Gestor Público</div>
            {!movil && <div style={{ display: "flex", gap: 18, fontSize: 14, color: T.cuerpo, fontWeight: 600 }}>
              <span>Nosotros</span><span>Comunidad</span><span style={{ color: T.teal }}>Proveedores</span>
            </div>}
            <button onClick={() => setEntrada(false)}
              style={{ marginLeft: "auto", background: T.teal, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>
              Entrar a la app
            </button>
          </div>
        </nav>

        {/* Hero */}
        <Seccion>
          <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1.1fr .9fr", gap: 40, alignItems: "center" }}>
            <div>
              <span style={{ display: "inline-block", background: T.tealTinte, color: T.teal, borderRadius: 999, padding: "7px 14px", fontSize: 13, fontWeight: 700, marginBottom: 18 }}>
                GP Proveedores · beta próximamente
              </span>
              <h1 style={{ fontSize: movil ? 34 : 46, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.025em", margin: "0 0 14px" }}>
                Hola, ¿a qué vas a <span style={{ color: T.teal }}>postular hoy?</span>
              </h1>
              <p style={{ fontSize: 17, color: T.cuerpo, lineHeight: 1.6, margin: "0 0 26px", maxWidth: 480 }}>
                Ya vendes al Estado. Deja de enterarte tarde: te traemos cada mañana lo que calza con tu pyme, con el historial del comprador al lado.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 30 }}>
                <button onClick={() => { setReservado(true); }}
                  style={{ background: reservado ? "#0d8a5f" : T.teal, color: "#fff", border: "none", borderRadius: 13, padding: "14px 24px", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>
                  {reservado ? "¡Listo! Te escribiremos pronto ✓" : "Reservar mi cupo en la beta"}
                </button>
                <button onClick={() => setEntrada(false)}
                  style={{ background: "transparent", color: T.teal, border: `1.5px solid ${T.teal}`, borderRadius: 13, padding: "14px 24px", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>
                  Ver la app por dentro →
                </button>
              </div>
              <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
                {[["3.000+", "procesos publicados cada semana"], ["5 min", "para configurar tus alertas"], ["100%", "datos oficiales de Mercado Público"]].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{s[0]}</div>
                    <div style={{ fontSize: 12.5, color: T.suave, marginTop: 2, maxWidth: 140 }}>{s[1]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bandeja "Hoy para ti" */}
            <div style={{ background: "#fff", border: `1px solid ${T.borde}`, borderRadius: 18, padding: 20, boxShadow: "0 14px 40px rgba(16,28,38,.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Hoy para ti</div>
                <span style={{ background: T.ambarBg, color: T.ambarFg, borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: 700 }}>3 nuevas</span>
              </div>
              {heroAlerts.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderTop: i ? `1px solid #edefea` : "none" }}>
                  <span style={{ background: T.tealTinte, color: T.teal, borderRadius: 8, padding: "6px 8px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em" }}>{a.tag}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: T.suave, marginTop: 2 }}>{a.meta}</div>
                  </div>
                  <span style={{ background: T.ambarBg, color: T.ambarFg, borderRadius: 999, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{a.time}</span>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: T.suave, marginTop: 10 }}>Ejemplo de la bandeja diaria de GP Proveedores.</div>
            </div>
          </div>
        </Seccion>

        {/* El problema */}
        <Seccion fondo="#fff" borde>
          <Kicker>El problema</Kicker>
          <h2 style={{ fontSize: movil ? 26 : 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 26px", maxWidth: 560 }}>
            Perder una licitación duele. Ni enterarse duele más.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "repeat(3,1fr)", gap: 16 }}>
            {dolores.map((d) => (
              <div key={d.n} style={{ border: `1px solid ${T.borde}`, borderRadius: 16, padding: 22, background: T.fondo }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.teal, marginBottom: 10 }}>{d.n}</div>
                <div style={{ fontWeight: 800, fontSize: 16.5, marginBottom: 8 }}>{d.title}</div>
                <div style={{ fontSize: 14, color: T.cuerpo, lineHeight: 1.6 }}>{d.body}</div>
              </div>
            ))}
          </div>
        </Seccion>

        {/* Cómo funciona */}
        <Seccion>
          <Kicker>Cómo funciona</Kicker>
          <h2 style={{ fontSize: movil ? 26 : 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 26px", maxWidth: 620 }}>
            Tres pasos y la próxima oportunidad te llega sola
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "repeat(3,1fr)", gap: 16 }}>
            {pasos.map((p) => (
              <div key={p.n} style={{ borderLeft: `3px solid ${T.teal}`, paddingLeft: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.teal, marginBottom: 8 }}>Paso {p.n}</div>
                <div style={{ fontWeight: 800, fontSize: 16.5, marginBottom: 8 }}>{p.title}</div>
                <div style={{ fontSize: 14, color: T.cuerpo, lineHeight: 1.6 }}>{p.body}</div>
              </div>
            ))}
          </div>
        </Seccion>

        {/* Recorre la app: tabs */}
        <section style={{ background: "#101c26" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: movil ? "48px 20px" : "72px 32px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7fb8c0", marginBottom: 12 }}>Recorre GP Proveedores</div>
            <h2 style={{ fontSize: movil ? 26 : 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 8px", color: "#fff" }}>Haz clic en cada módulo para ver qué muestra</h2>
            <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "260px 1fr", gap: 20, marginTop: 26 }}>
              <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                {tabDefs.map(([id, label, hint]) => (
                  <button key={id} onClick={() => setTabLanding(id)}
                    style={{ textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "13px 15px", border: `1px solid ${tabLanding === id ? T.teal : "#283742"}`, background: tabLanding === id ? T.teal : "transparent", color: tabLanding === id ? "#fff" : "#c3ccd2", fontFamily: "'Manrope', sans-serif" }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{label}</div>
                    <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>{hint}</div>
                  </button>
                ))}
              </div>
              <div style={{ background: "#fff", borderRadius: 16, padding: movil ? 18 : 26, color: T.tinta }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{vista.title}</div>
                    <div style={{ fontSize: 13.5, color: T.suave, marginTop: 2 }}>{vista.sub}</div>
                  </div>
                  <span style={{ background: T.ambarBg, color: T.ambarFg, borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700 }}>{vista.badge}</span>
                </div>
                {vista.rows && (
                  <div style={{ marginTop: 6 }}>
                    {vista.rows.map((r, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1fr 160px 140px", gap: movil ? 6 : 14, alignItems: "center", padding: "13px 0", borderBottom: "1px solid #edefea", fontSize: 14 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#101c26" }}>{r[0]}</div>
                          <div style={{ fontSize: 13, color: "#6c7880", marginTop: 3 }}>{r[1]}</div>
                        </div>
                        <div style={{ color: "#2c3a44" }}>{r[2]}</div>
                        <div style={{ justifySelf: movil ? "start" : "end" }}>
                          <span style={{ background: T.ambarBg, color: T.ambarFg, borderRadius: 999, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{r[3]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {vista.filtros && (
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "18px 0 8px" }}>
                      {["Rubro: Servicios generales", "Monto: $5M – $60M", "Región: RM + V", "Comprador: municipios", "Sin garantía de seriedad"].map((t, i) => (
                        <span key={i} style={{ border: "1px solid #cfe0e0", background: "#eef6f6", color: T.teal, borderRadius: 999, padding: "8px 14px", fontSize: 13.5, fontWeight: 600 }}>{t}</span>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "repeat(3,1fr)", gap: 12, marginTop: 18 }}>
                      {[["1.412", "procesos publicados esta semana"], ["37", "calzan con tus filtros"], ["6", "cierran en menos de 72 h"]].map((s, i) => (
                        <div key={i} style={{ border: "1px solid #e6e9e3", borderRadius: 14, padding: 18, background: "#fff" }}>
                          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>{s[0]}</div>
                          <div style={{ fontSize: 13, color: "#6c7880", marginTop: 4 }}>{s[1]}</div>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 14.5, color: "#56626b", lineHeight: 1.6, marginTop: 18 }}>
                      Guarda cada combinación como un filtro con nombre. Cada mañana solo ves lo que pasó ese filtro — no las 3.000 publicaciones del día.
                    </p>
                  </div>
                )}
                <button onClick={() => setEntrada(false)}
                  style={{ marginTop: 18, background: T.teal, color: "#fff", border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>
                  Probar la app en vivo →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonios */}
        <Seccion fondo="#fff" borde>
          <Kicker>Quiénes están adentro</Kicker>
          <h2 style={{ fontSize: movil ? 26 : 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 26px" }}>Probado con proveedores reales</h2>
          <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "repeat(3,1fr)", gap: 16 }}>
            {testimonios.map((t, i) => (
              <div key={i} style={{ border: `1px solid ${T.borde}`, borderRadius: 16, padding: 22, background: T.fondo }}>
                <div style={{ fontSize: 14.5, lineHeight: 1.65, color: "#2c3a44", marginBottom: 14 }}>"{t.quote}"</div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: T.suave, marginTop: 2 }}>{t.role}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: T.suave, marginTop: 14 }}>Testimonios de la beta privada. Reemplazables por los tuyos al lanzar.</div>
        </Seccion>

        {/* Beta */}
        <Seccion>
          <div style={{ background: "#101c26", borderRadius: 20, padding: movil ? "34px 22px" : "48px 44px", color: "#fff", display: "grid", gridTemplateColumns: movil ? "1fr" : "1.2fr .8fr", gap: 30, alignItems: "center" }}>
            <div>
              <span style={{ display: "inline-block", background: "rgba(11,111,125,.25)", color: "#7fb8c0", borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 700, marginBottom: 14 }}>Beta cerrada</span>
              <h2 style={{ fontSize: movil ? 25 : 30, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Los primeros en entrar definen el producto</h2>
              <ul style={{ margin: 0, padding: "0 0 0 18px", color: "#c3ccd2", fontSize: 14.5, lineHeight: 1.9 }}>
                {beneficios.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
            <div style={{ textAlign: movil ? "left" : "center" }}>
              <button onClick={() => setReservado(true)}
                style={{ background: reservado ? "#0d8a5f" : T.teal, color: "#fff", border: "none", borderRadius: 13, padding: "16px 28px", fontWeight: 800, fontSize: 15.5, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>
                {reservado ? "¡Listo! Te escribiremos pronto ✓" : "Reservar mi cupo"}
              </button>
              <div style={{ fontSize: 12, color: "#8b959b", marginTop: 12 }}>Sin tarjeta. Cupos limitados de la cohorte fundadora.</div>
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 12.5, color: T.suave, padding: "34px 0 10px" }}>
            Gestor Público SpA · Mercado Público, a domicilio
          </div>
        </Seccion>
      </div>
    );
  }

  // ── Puerta de acceso: la app es privada, con cuentas asignadas por GP ──
  if (supabase && !sesion) {
    return (
      <div style={{ fontFamily: "'Manrope', system-ui, sans-serif", background: INK, height: "100vh", display: "grid", placeItems: "center", color: PAPER, padding: 20 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap');
          * { box-sizing: border-box; }
          input::placeholder { color: #6d6d76; }
          button:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        `}</style>
        <div style={{ width: "min(430px, 94vw)", background: CARD_GRAD, border: `1px solid ${BORDE}`, borderRadius: 26, padding: "36px 32px", boxShadow: SOMBRA_CARD }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 6 }}>
            <img src="/logo-gestor-publico.png" alt="Gestor Público" style={{ width: 52, height: 52, borderRadius: 13, display: "block" }} />
            <div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 24, color: GOLD, letterSpacing: "-0.01em", lineHeight: 1.1 }}>GP Proveedores</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Mercado Público, a domicilio</div>
            </div>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD_DEEP, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 18 }}>
            ⬖ Acceso privado · beta
          </div>
          <p style={{ fontSize: 13, color: "#c9c6bf", lineHeight: 1.6, margin: "0 0 18px" }}>
            Entra con la cuenta y clave que te asignamos. ¿Aún no tienes acceso?
            Pídelo desde la página y te contactamos.
          </p>
          <div style={{ marginBottom: 10 }}>
            <input value={cuentaEmail} onChange={(e) => setCuentaEmail(e.target.value)} type="email" placeholder="correo@tupyme.cl" aria-label="Correo" autoComplete="username"
              style={{ width: "100%", padding: "13px 14px", borderRadius: 13, border: `1.5px solid ${BORDE}`, background: CARD2, color: PAPER, fontSize: 14, fontFamily: "'Manrope', sans-serif", outline: "none" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input value={cuentaClave} onChange={(e) => setCuentaClave(e.target.value)} type="password" placeholder="Clave asignada" aria-label="Clave" autoComplete="current-password"
              onKeyDown={(e) => { if (e.key === "Enter") entrarCuenta(); }}
              style={{ width: "100%", padding: "13px 14px", borderRadius: 13, border: `1.5px solid ${BORDE}`, background: CARD2, color: PAPER, fontSize: 14, fontFamily: "'Manrope', sans-serif", outline: "none" }} />
          </div>
          <button onClick={entrarCuenta} disabled={cuentaOcupada}
            style={{ ...btn({ fondo: GOLD, borde: GOLD, color: SOBRE_GOLD, peso: 800 }), width: "100%", padding: "14px 10px", fontSize: 15, opacity: cuentaOcupada ? 0.6 : 1, boxShadow: "0 0 12px rgba(239,183,0,.35)" }}>
            {cuentaOcupada ? "Un momento…" : "Entrar a mi reparto"}
          </button>
          <button onClick={() => (window.__gpSalir ? window.__gpSalir() : null)}
            style={{ ...btn({ fondo: "transparent", borde: "transparent", color: MUTED }), width: "100%", marginTop: 10, fontSize: 12.5 }}>
            ← Volver a la página
          </button>
          {toast && (
            <div role="status" style={{ marginTop: 14, fontSize: 12.5, color: "#ffd479", background: GOLD_BG, border: `1px solid rgba(239,183,0,.25)`, borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
              {toast}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "'Manrope', system-ui, sans-serif",
      background: INK, height: "100vh", overflow: "hidden",
      display: "grid", gridTemplateColumns: movil ? "1fr" : "230px 1fr",
      color: PAPER, userSelect: "none", touchAction: "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: 'Manrope', sans-serif; }
        button:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        input::placeholder { color: #6d6d76; }
        @keyframes latido { 0% { transform: scale(1); } 35% { transform: scale(1.45); } 60% { transform: scale(.9); } 100% { transform: scale(1); } }
        @keyframes likePop { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
        @keyframes orbitSpin { to { transform: rotate(360deg); } }
        @keyframes brasa { 0%, 100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.12); filter: brightness(1.25); } }
        @keyframes apagandose { 0%, 100% { opacity: .4; filter: grayscale(.5); } 50% { opacity: .85; filter: grayscale(.1); } }
        @keyframes flashOro { 0% { transform: scale(1); text-shadow: none; } 35% { transform: scale(1.45); text-shadow: 0 0 18px rgba(239,183,0,.95); } 100% { transform: scale(1); text-shadow: none; } }
        @keyframes confetiCae { 0% { transform: translateY(-8vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(108vh) rotate(560deg); opacity: .85; } }
        @keyframes zoomEntra { 0% { transform: scale(.82); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      {/* ── Sidebar (escritorio) ── */}
      {!movil && (
        <aside style={{ borderRight: `1px solid #1b1d26`, padding: "26px 16px 18px", display: "flex", flexDirection: "column", gap: 6, background: "#080a10", overflowY: "auto" }}>
          <div style={{ padding: "0 10px", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/logo-gestor-publico.png" alt="Gestor Público" style={{ width: 34, height: 34, borderRadius: 9, display: "block" }} />
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", color: GOLD }}>GP Proveedores</div>
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 5 }}>Mercado Público, a domicilio</div>
            <div style={{ fontSize: 12.5, color: "#c9c6bf", marginTop: 12, lineHeight: 1.5, fontWeight: 700 }}>{saludo}</div>
          </div>
          {NAVS.map((n) => (
            <button key={n.id} onClick={n.onClick}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                padding: "12px 13px", borderRadius: 13, cursor: "pointer",
                background: navActiva === n.id ? "#1b1d26" : "transparent",
                border: `1px solid ${navActiva === n.id ? "#242833" : "transparent"}`,
                color: navActiva === n.id ? PAPER : "#c9c6bf",
                fontSize: 14.5, fontWeight: 700,
              }}>
              <span style={{ color: navActiva === n.id ? GOLD : "inherit", display: "grid", placeItems: "center" }}><Icono name={n.icono} size={19} /></span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badge && n.badge !== "0" && (
                <span style={{ minWidth: 22, height: 22, borderRadius: 999, background: navActiva === n.id ? GOLD : "#242833", color: navActiva === n.id ? SOBRE_GOLD : MUTED, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", padding: "0 7px" }}>{n.badge}</span>
              )}
            </button>
          ))}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "12px 4px 0" }}>
            {rachaCard}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {chipEstado}
              <button onClick={() => (window.__gpSalir ? window.__gpSalir() : setEntrada(true))} aria-label="Salir a la página"
                style={{ background: "transparent", border: `1px solid ${BORDE}`, borderRadius: 10, color: MUTED, fontSize: 10.5, fontWeight: 700, padding: "5px 10px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                ← SALIR
              </button>
            </div>
            <button onClick={() => setPanel("cuenta")} aria-label={sesion ? "Mi cuenta" : "Crear cuenta o entrar"}
              style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 12, borderTop: "1px solid #1b1d26", background: "transparent", border: "none", borderRadius: 0, cursor: "pointer", textAlign: "left", width: "100%" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: sesion ? GOLD : "#242833", color: sesion ? SOBRE_GOLD : GOLD, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12.5, flexShrink: 0 }}>
                {sesion ? (nombrePyme.trim() || sesion.user.email || "GP").slice(0, 2).toUpperCase() : "?"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: PAPER, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sesion ? (nombrePyme.trim() || "Tu pyme") : "Modo demo"}
                </div>
                <div style={{ fontSize: 11.5, color: sesion ? MUTED : GOLD, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sesion ? perfil.slice(0, 2).join(" · ") || sesion.user.email : "Sin conexión a cuentas"}
                </div>
              </div>
            </button>
          </div>
        </aside>
      )}

      {/* ── Escenario ── */}
      <main onWheel={onWheel} style={movil
        ? { position: "relative", height: "100%", width: "100%", display: "grid", placeItems: "center", overflow: "hidden" }
        : { display: "flex", alignItems: "center", justifyContent: "center", gap: 20, height: "100vh", padding: "24px 0", position: "relative", overflow: "hidden" }}>

        {/* Cabecera flotante (móvil) */}
        {movil && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 9, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "linear-gradient(180deg, rgba(8,10,16,.92), transparent)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <img src="/logo-gestor-publico.png" alt="Gestor Público" style={{ width: 22, height: 22, borderRadius: 6, display: "block" }} />
                <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15, color: GOLD }}>GP PROVEEDORES</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                {NAVS.map((n) => (
                  <button key={n.id} onClick={n.onClick} aria-label={n.label}
                    style={{ background: navActiva === n.id ? GOLD_BG : "transparent", border: `1px solid ${navActiva === n.id ? GOLD_DEEP : BORDE}`, color: navActiva === n.id ? GOLD : "#c9c6bf", borderRadius: 10, padding: "5px 8px", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <Icono name={n.icono} size={15} />
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              {racha}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {chipEstado}
                <button onClick={() => (window.__gpSalir ? window.__gpSalir() : setEntrada(true))} aria-label="Salir a la página"
                  style={{ background: "transparent", border: `1px solid ${BORDE}`, borderRadius: 10, color: MUTED, fontSize: 10.5, fontWeight: 700, padding: "4px 9px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  ← SALIR
                </button>
              </div>
            </div>
          </div>
        )}

        {peek(anterior, true)}
        {peek(siguiente, false)}
        {!movil && actual && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "center", zIndex: 3 }}>
            {enRonda
              ? Array.from({ length: metaRonda }).map((_, i) => {
                  const act = i === indice;
                  if (i === metaRonda - 1) {
                    return <span key={i} style={{ fontSize: act ? 15 : 11, lineHeight: 1, filter: act ? "none" : "grayscale(.6)", transition: "all .25s" }} aria-label="La Joya del día">💎</span>;
                  }
                  return <span key={i} style={{ width: 5, height: act ? 26 : 5, borderRadius: 999, background: act ? GOLD : i < indice ? GOLD_DEEP : "#33333b", transition: "all .25s" }} />;
                })
              : Array.from({ length: Math.min(visible.length, 7) }).map((_, i) => {
                  const act = i === Math.min(indice, 6);
                  return <span key={i} style={{ width: 5, height: act ? 26 : 5, borderRadius: 999, background: act ? GOLD : "#33333b", transition: "all .25s" }} />;
                })}
          </div>
        )}
        {tarjeta}
        {rail}

        {/* Píldora de atajos (escritorio) */}
        {!movil && actual && (
          <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", fontSize: 11.5, fontFamily: "'IBM Plex Mono', monospace", color: MUTED, zIndex: 4, background: "rgba(6,6,8,.85)", border: `1px solid ${BORDE}`, borderRadius: 999, padding: "8px 18px", whiteSpace: "nowrap" }}>
            {actual.similar && <span style={{ color: GOLD }}>◈ similares · </span>}
            Rueda o ↑ ↓ para navegar · doble clic = me gusta · <strong style={{ color: "#c9c6bf" }}>L</strong> like · <strong style={{ color: "#c9c6bf" }}>C</strong> carro
          </div>
        )}

        {/* ═══ Celebración: ronda diaria completa ═══ */}
        {celebrar && (() => {
          const potencial = guardadas
            .filter((g) => (g.monto || "").trim().startsWith("$"))
            .reduce((s, g) => s + (Number((g.monto || "").replace(/\D/g, "")) || 0), 0);
          const colores = [GOLD, PAPER, VERDE, "#7fc7e8", ROJO];
          return (
            <div role="dialog" aria-label="Ronda diaria completa" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,10,16,.9)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", overflow: "hidden" }}>
              {Array.from({ length: 36 }).map((_, i) => (
                <span key={i} aria-hidden="true" style={{
                  position: "absolute", top: 0, left: `${(i * 53) % 100}%`,
                  width: 6 + (i % 3) * 3, height: 10 + (i % 4) * 3,
                  background: colores[i % colores.length],
                  borderRadius: i % 2 ? 2 : 999,
                  animation: `confetiCae ${2.6 + (i % 5) * 0.4}s linear ${(i % 9) * 0.22}s infinite`,
                  pointerEvents: "none",
                }} />
              ))}
              <div style={{ background: CARD_GRAD, border: `1px solid ${GOLD_DEEP}`, borderRadius: 24, padding: movil ? "34px 24px" : "40px 44px", maxWidth: 420, width: "calc(100% - 40px)", textAlign: "center", boxShadow: `${SOMBRA_CARD}, 0 0 60px rgba(239,183,0,.18)`, animation: "zoomEntra .45s cubic-bezier(.2,1.4,.4,1)", position: "relative", zIndex: 2 }}>
                <div style={{ fontSize: 46, marginBottom: 6 }}>🎉</div>
                <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 24, color: PAPER, margin: "0 0 6px" }}>¡Ronda de hoy completa!</h2>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: GOLD_BG, border: `1px solid ${GOLD_DEEP}`, borderRadius: 999, padding: "8px 16px", margin: "8px 0 18px" }}>
                  <span style={{ fontSize: 18, animation: "brasa 1.6s ease-in-out infinite" }}>🔥</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: "#ffd479" }}>
                    {rachaDias === 1 ? "¡Racha encendida!" : `${rachaDias} días de racha`}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18 }}>
                  {[
                    { v: String(metaRonda), l: "revisadas ✓✓" },
                    { v: String(guardadas.length), l: "al carro 🛒" },
                    { v: potencial > 0 ? `$${(potencial / 1000000).toFixed(1)}M` : "—", l: "venta potencial" },
                  ].map((s) => (
                    <div key={s.l} style={{ flex: 1, background: CARD2, border: `1px solid ${BORDE}`, borderRadius: 14, padding: "12px 6px" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 17, color: GOLD }}>{s.v}</div>
                      <div style={{ fontSize: 9.5, color: MUTED, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12.5, color: "#c9c6bf", lineHeight: 1.6, margin: "0 0 18px", fontFamily: "'Manrope', sans-serif" }}>
                  Tu próxima ronda llega <strong style={{ color: GOLD }}>mañana a las 08:00</strong>. Vuelve para mantener la racha 🔥
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {guardadas.length > 0 && (
                    <button onClick={() => { setCelebrar(false); setPanel("carro"); }}
                      style={{ padding: "14px 10px", borderRadius: 14, border: `1.5px solid ${GOLD}`, background: GOLD, color: SOBRE_GOLD, fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>
                      Ver mi carro ({guardadas.length}) → postular
                    </button>
                  )}
                  <button onClick={() => setCelebrar(false)}
                    style={{ padding: "12px 10px", borderRadius: 14, border: `1px solid ${BORDE}`, background: "transparent", color: "#c9c6bf", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "'Manrope', sans-serif" }}>
                    Seguir explorando similares
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ Paneles ═══ */}
        {panel === "compartir" && actual && (
          <Hoja titulo="Compartir oportunidad" cerrar={() => setPanel(null)} movil={movil}>
            <p style={{ fontSize: 12, color: MUTED, margin: "0 0 14px", lineHeight: 1.5, fontFamily: "'IBM Plex Mono', monospace" }}>ID {actual.id} · {actual.organismo}</p>
            <BotonHoja onClick={() => compartirWhatsApp(actual)} icono="💬" texto="Enviar por WhatsApp" sub="Con resumen y enlace directo" />
            <BotonHoja onClick={() => compartirLinkedIn(actual)} icono="💼" texto="Compartir en LinkedIn" sub="Publica el enlace de la oportunidad" />
            <BotonHoja onClick={() => copiar(urlOportunidad(actual), "Enlace copiado")} icono="🔗" texto="Copiar enlace" sub="Pégalo donde quieras" />
            <div style={{ height: 1, background: BORDE, margin: "12px 0" }} />
            <BotonHoja onClick={() => publicarAdjudicacion(actual)} icono="🏆" texto="¿Se la adjudicaron? Publica el logro" sub="Copia un post listo para LinkedIn y abre la publicación" dorado />
          </Hoja>
        )}

        {panel === "reporte" && actual && (
          <Hoja titulo="¿Algo no calza en este proceso?" cerrar={() => { setPanel(null); setMotivo(null); }} movil={movil}>
            <p style={{ fontSize: 12.5, color: "#c9c6bf", margin: "0 0 12px", lineHeight: 1.55 }}>
              Marca el proceso ID {actual.id} si observas señales de posible irregularidad. La marca es interna y anónima: sirve para que la comunidad detecte patrones.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {MOTIVOS_REPORTE.map((m) => (
                <button key={m} onClick={() => setMotivo(m)}
                  style={{ fontSize: 12, padding: "8px 12px", borderRadius: 999, border: `1.5px solid ${motivo === m ? GOLD : BORDE}`, background: motivo === m ? GOLD_BG : "transparent", color: motivo === m ? GOLD : "#c9c6bf", cursor: "pointer" }}>
                  {m}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.55, background: CARD2, border: `1px solid ${BORDE}`, borderRadius: 12, padding: "10px 12px", marginBottom: 14, color: MUTED }}>
              Para una denuncia formal usa los canales oficiales: reclamos en mercadopublico.cl, el Observatorio de ChileCompra, la Contraloría General de la República o el Tribunal de Contratación Pública. Marcar aquí no reemplaza esa vía.
            </div>
            <button onClick={() => enviarReporte(actual)} style={btn({ fondo: "#3a1210", borde: ROJO, color: ROJO, peso: 800 })}>⚑ Marcar este proceso</button>
          </Hoja>
        )}

        {panel === "ficha" && actual && (
          <Hoja titulo={`Ficha · ID ${actual.id}`} cerrar={() => setPanel(null)} movil={movil}>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 14px", color: "#c9c6bf" }}>
              <strong style={{ color: GOLD }}>{actual.organismo}</strong> busca contratar <strong style={{ color: PAPER }}>{actual.titulo.toLowerCase()}</strong> mediante {actual.tipo === "Compra Ágil" ? "Compra Ágil" : `licitación ${actual.tipo}`}.
              El proceso {actual.cierre.toLowerCase().startsWith("cierra") ? actual.cierre.toLowerCase() : `cierra ${actual.cierre.toLowerCase()}`} y calza un {actual.match}% con tu perfil: {actual.razon.toLowerCase()}.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <Dato etiqueta="Tipo" valor={actual.tipo} />
              <Dato etiqueta="Monto" valor={actual.monto} />
              <Dato etiqueta="Cierre" valor={actual.cierre} urgente={esUrgente(actual)} />
              <Dato etiqueta="Región" valor={actual.region} />
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.55, background: CARD2, border: `1px solid ${BORDE}`, borderRadius: 12, padding: "10px 12px", marginBottom: 14, color: MUTED }}>
              {actual.tipo === "Compra Ágil"
                ? `Las Compras Ágiles se buscan por código dentro del portal: copia el ID ${actual.id} y pégalo en el buscador de Compra Ágil.`
                : "El detalle completo (bases, anexos, cronograma) está en la ficha oficial de Mercado Público."}
              {actual.tags?.includes("Ejemplo demo") && " Ojo: este proceso es de demostración, por lo que el enlace no encontrará una ficha real."}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => copiar(actual.id, "Código copiado")} style={btn({ fondo: "transparent", borde: BORDE, color: "#c9c6bf" })}>Copiar código</button>
              <button onClick={() => window.open(urlFicha(actual), "_blank")} style={btn({ fondo: GOLD, borde: GOLD, color: SOBRE_GOLD, peso: 800 })}>Abrir en Mercado Público ↗</button>
            </div>
          </Hoja>
        )}

        {panel === "perfil" && (
          <Hoja titulo="Mi pyme: ¿qué vendes?" cerrar={() => setPanel(null)} movil={movil}>
            <p style={{ fontSize: 12.5, color: "#c9c6bf", margin: "0 0 12px", lineHeight: 1.55 }}>
              Estas palabras definen tu reparto: buscamos en Mercado Público los procesos que las mencionan y los ponemos primero, con su porcentaje de calce.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {perfil.length === 0 && <span style={{ fontSize: 12, color: MUTED }}>Aún no agregas palabras…</span>}
              {perfil.map((p) => (
                <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, padding: "7px 11px", borderRadius: 999, background: GOLD_BG, border: `1.5px solid ${GOLD}`, color: GOLD }}>
                  {p}
                  <button onClick={() => quitarPalabra(p)} aria-label={`Quitar ${p}`} style={{ background: "none", border: "none", color: GOLD, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Organismos que sigues (desde la tarjeta de cada oportunidad):</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {seguidos.length === 0 && <span style={{ fontSize: 12, color: MUTED }}>Aún no sigues organismos: toca «+ SEGUIR» en una tarjeta.</span>}
              {seguidos.map((o) => (
                <span key={o} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 999, background: "transparent", border: `1.5px solid ${GOLD_DEEP}`, color: "#d8c8a4" }}>
                  ★ {o}
                  <button onClick={() => toggleSeguir(o)} aria-label={`Dejar de seguir ${o}`} style={{ background: "none", border: "none", color: "#d8c8a4", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>RUT de tu empresa (opcional): con él cruzaremos tus órdenes de compra reales para el panel.</div>
              <input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="76.123.456-7" aria-label="RUT de tu empresa"
                style={{ width: "100%", padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${BORDE}`, background: CARD2, color: PAPER, fontSize: 13.5, fontFamily: "'IBM Plex Mono', monospace", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={nuevaPalabra} onChange={(e) => setNuevaPalabra(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") agregarPalabra(nuevaPalabra); }}
                placeholder="Ej: notebooks, uniformes, áridos…" aria-label="Agregar palabra de tu rubro"
                style={{ flex: 1, padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${BORDE}`, background: CARD2, color: PAPER, fontSize: 13.5, fontFamily: "'Manrope', sans-serif", outline: "none" }} />
              <button onClick={() => agregarPalabra(nuevaPalabra)} style={{ ...btn({ fondo: "transparent", borde: GOLD, color: GOLD }), flex: "0 0 auto", padding: "11px 16px" }}>Agregar</button>
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Rubros frecuentes en Mercado Público:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {RUBROS_SUGERIDOS.filter((r) => !perfil.includes(r)).map((r) => (
                <button key={r} onClick={() => agregarPalabra(r)}
                  style={{ fontSize: 11.5, padding: "6px 11px", borderRadius: 999, border: `1.5px solid ${BORDE}`, background: "transparent", color: "#c9c6bf", cursor: "pointer" }}>
                  + {r}
                </button>
              ))}
            </div>
            <button onClick={guardarPerfil} style={btn({ fondo: GOLD, borde: GOLD, color: SOBRE_GOLD, peso: 800 })}>Guardar y reordenar mi reparto</button>
          </Hoja>
        )}

        {panel === "red" && (
          <Hoja titulo="Red de pymes" cerrar={() => setPanel(null)} movil={movil}>
            <p style={{ fontSize: 12.5, color: "#c9c6bf", lineHeight: 1.55, margin: "0 0 14px" }}>
              Las pymes que ya compiten con GP Proveedores. Toca una para ver su perfil público.
            </p>
            {!supabase ? (
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>La red necesita conexión a cuentas (no disponible en este entorno).</p>
            ) : redPymes === null ? (
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Cargando la red…</p>
            ) : redPymes.length === 0 ? (
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Aún no hay pymes visibles en la red.</p>
            ) : (
              redPymes.map((p) => (
                <button key={p.id} onClick={() => { setPymeVista(p); setPanel("pymePublica"); }}
                  style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", textAlign: "left", background: CARD2, border: `1px solid ${BORDE}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
                  <span style={{ width: 38, height: 38, borderRadius: "50%", background: p.id === sesion?.user?.id ? GOLD : "#242833", color: p.id === sesion?.user?.id ? SOBRE_GOLD : GOLD, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                    {(p.nombre_pyme || "GP").trim().slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: PAPER, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.nombre_pyme || "Pyme sin nombre"} {p.id === sesion?.user?.id && <span style={{ color: GOLD, fontSize: 10.5 }}>(tú)</span>}
                    </span>
                    <span style={{ display: "block", fontSize: 11.5, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(p.palabras || []).slice(0, 3).join(" · ") || "Sin rubros aún"}
                    </span>
                  </span>
                  {p.racha_dias > 0 && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: "#ffd479", flexShrink: 0 }}>🔥 {p.racha_dias}</span>
                  )}
                </button>
              ))
            )}
          </Hoja>
        )}

        {panel === "pymePublica" && pymeVista && (
          <Hoja titulo="Perfil de pyme" cerrar={() => { setPanel("red"); setPymeVista(null); }} movil={movil}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", background: GOLD_BG, border: `1px solid rgba(239,183,0,.18)`, borderRadius: 16, padding: "16px 18px", marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: GOLD, color: SOBRE_GOLD, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 17 }}>
                {(pymeVista.nombre_pyme || "GP").trim().slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: PAPER }}>{pymeVista.nombre_pyme || "Pyme sin nombre"}</div>
                <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>
                  {pymeVista.region ? `${pymeVista.region} · ` : ""}en la red desde {new Date(pymeVista.creado).toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, background: CARD2, border: `1px solid ${BORDE}`, borderRadius: 14, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 20, color: "#ffd479" }}>🔥 {pymeVista.racha_dias}</div>
                <div style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>días de racha</div>
              </div>
              <div style={{ flex: 1, background: CARD2, border: `1px solid ${BORDE}`, borderRadius: 14, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 20, color: VERDE }}>{(pymeVista.palabras || []).length}</div>
                <div style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>rubros declarados</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Qué vende:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(pymeVista.palabras || []).length === 0 && <span style={{ fontSize: 12.5, color: MUTED }}>Esta pyme aún no declara rubros.</span>}
              {(pymeVista.palabras || []).map((p) => (
                <span key={p} style={{ fontSize: 12.5, fontWeight: 700, padding: "7px 12px", borderRadius: 999, background: GOLD_BG, border: `1.5px solid ${GOLD}`, color: GOLD }}>{p}</span>
              ))}
            </div>
          </Hoja>
        )}

        {panel === "cuenta" && (
          <Hoja titulo={sesion ? "Mi cuenta" : "Acceso"} cerrar={() => setPanel(null)} movil={movil}>
            {!supabase ? (
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, margin: 0 }}>
                Las cuentas en la nube aún no están activadas en este entorno (faltan las
                variables <code style={{ color: GOLD }}>VITE_SUPABASE_URL</code> y <code style={{ color: GOLD }}>VITE_SUPABASE_ANON_KEY</code>).
                Mientras tanto todo funciona en modo invitado: tu perfil y tu racha viven solo en este navegador.
              </p>
            ) : sesion ? (
              <>
                <div style={{ display: "flex", gap: 12, alignItems: "center", background: GOLD_BG, border: `1px solid rgba(239,183,0,.18)`, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: GOLD, color: SOBRE_GOLD, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>
                    {(nombrePyme.trim() || sesion.user.email || "GP").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: PAPER, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombrePyme.trim() || "Tu pyme sin nombre aún"}</div>
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sesion.user.email}</div>
                  </div>
                </div>
                <p style={{ fontSize: 12.5, color: "#c9c6bf", lineHeight: 1.55, margin: "0 0 12px" }}>
                  Tu perfil (rubros, RUT y racha) se guarda en la nube: entra desde cualquier
                  dispositivo y tu reparto te sigue. El nombre y los rubros son visibles para
                  otras pymes de la red.
                </p>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Nombre público de tu pyme</div>
                  <input value={nombrePyme} onChange={(e) => setNombrePyme(e.target.value)} placeholder="Ej: Servicios Rojas SpA" aria-label="Nombre público de tu pyme"
                    style={{ width: "100%", padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${BORDE}`, background: CARD2, color: PAPER, fontSize: 13.5, fontFamily: "'Manrope', sans-serif", outline: "none" }} />
                </div>
                <button onClick={() => { guardarPerfilNube(); avisar("Cuenta actualizada ✓"); }} style={{ ...btn({ fondo: GOLD, borde: GOLD, color: SOBRE_GOLD, peso: 800 }), width: "100%", marginBottom: 10 }}>
                  Guardar cambios
                </button>
                <button onClick={salirCuenta} style={{ ...btn({ fondo: "transparent", borde: BORDE, color: MUTED }), width: "100%" }}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, margin: 0 }}>
                El acceso es con cuenta asignada: entra desde la pantalla de acceso.
              </p>
            )}
          </Hoja>
        )}

        {panel === "carro" && (
          <Hoja titulo="Tu carro de ventas" cerrar={() => setPanel(null)} movil={movil}>
            {guardadas.length === 0 ? (
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, margin: 0 }}>
                Tu carro está vacío. Desliza el feed y toca el carrito en las oportunidades donde tu pyme puede vender: aquí se va sumando tu venta potencial.
              </p>
            ) : (
              <>
                {(() => {
                  const enPesos = guardadas.filter((g) => (g.monto || "").startsWith("$"));
                  const total = enPesos.reduce((s, g) => s + (Number((g.monto || "").replace(/\D/g, "")) || 0), 0);
                  const otras = guardadas.length - enPesos.length;
                  return (
                    <div style={{ background: `linear-gradient(180deg, ${GOLD_BG}, transparent)`, border: `1.5px solid ${GOLD_DEEP}`, borderRadius: 16, padding: "14px 16px", marginBottom: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD_DEEP, fontFamily: "'IBM Plex Mono', monospace" }}>Venta potencial en tu carro</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 27, color: "#ffd479", margin: "4px 0 2px" }}>${total.toLocaleString("es-CL")}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>
                        {guardadas.length} {guardadas.length === 1 ? "oportunidad" : "oportunidades"}
                        {otras > 0 && ` · ${otras} adicional${otras > 1 ? "es" : ""} en UTM o por confirmar`}
                      </div>
                    </div>
                  );
                })()}
                {guardadas.map((g) => (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 13, border: `1px solid ${BORDE}`, background: CARD2, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: PAPER }}>{g.titulo}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                        <span style={{ color: GOLD }}>{g.monto}</span> · {g.cierre} · {g.id}
                      </div>
                    </div>
                    <button onClick={() => marcarPostulada(g)} aria-label={`Marcar ${g.id} como postulada`}
                      style={{ background: "#12251d", border: `1.5px solid ${VERDE}`, borderRadius: 9, color: VERDE, cursor: "pointer", fontSize: 11, padding: "6px 8px", fontWeight: 700 }}>Postulé ✓</button>
                    <button onClick={() => window.open(urlFicha(g), "_blank")} aria-label={`Abrir ficha de ${g.id}`}
                      style={{ background: "none", border: `1.5px solid ${GOLD}`, borderRadius: 9, color: GOLD, cursor: "pointer", fontSize: 12, padding: "6px 9px", fontWeight: 700 }}>↗</button>
                    <button onClick={() => { setGuardadas((gs) => gs.filter((x) => x.id !== g.id)); avisar("Quitada del carro"); }} aria-label={`Quitar ${g.id}`}
                      style={{ background: "none", border: `1.5px solid ${BORDE}`, borderRadius: 9, color: "#c9c6bf", cursor: "pointer", fontSize: 12, padding: "6px 9px" }}>✕</button>
                  </div>
                ))}
                <button onClick={() => { setPanel(null); avisar("A postular: cada ficha se abre con ↗"); }} style={{ ...btn({ fondo: GOLD, borde: GOLD, color: SOBRE_GOLD, peso: 800 }), width: "100%", marginTop: 6 }}>
                  Ir a postular mi carro →
                </button>
                <p style={{ fontSize: 10.5, color: "#6d6d76", textAlign: "center", margin: "10px 0 0", lineHeight: 1.5 }}>
                  Compra invertida: aquí no gastas, sumas venta potencial. Postular es tu checkout.
                </p>
              </>
            )}
            {postuladas.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10.5, color: GOLD, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>TUS POSTULACIONES</div>
                {postuladas.map((g) => (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 13, border: `1px solid ${g.resultado === "adjudicada" ? GOLD_DEEP : BORDE}`, background: g.resultado === "adjudicada" ? GOLD_BG : CARD2, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: PAPER }}>{g.titulo}</div>
                      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                        <span style={{ color: GOLD }}>{g.monto}</span> · {g.id}
                      </div>
                    </div>
                    {g.resultado === null && (
                      <>
                        <button onClick={() => resolverPostulacion(g.id, "adjudicada")} aria-label="Marcar adjudicada"
                          style={{ background: GOLD_BG, border: `1.5px solid ${GOLD}`, borderRadius: 9, color: GOLD, cursor: "pointer", fontSize: 12, padding: "6px 9px", fontWeight: 700 }}>🏆</button>
                        <button onClick={() => resolverPostulacion(g.id, "no")} aria-label="No resultó"
                          style={{ background: "none", border: `1.5px solid ${BORDE}`, borderRadius: 9, color: MUTED, cursor: "pointer", fontSize: 12, padding: "6px 9px" }}>✕</button>
                      </>
                    )}
                    {g.resultado === "adjudicada" && (
                      <button onClick={() => publicarAdjudicacion(g)}
                        style={{ background: GOLD, border: `1.5px solid ${GOLD}`, borderRadius: 9, color: SOBRE_GOLD, cursor: "pointer", fontSize: 11, padding: "6px 9px", fontWeight: 800 }}>🏆 Publicar</button>
                    )}
                    {g.resultado === "no" && <span style={{ fontSize: 10.5, color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>No resultó</span>}
                  </div>
                ))}
              </div>
            )}
          </Hoja>
        )}

        {panel === "negocio" && (
          <Hoja titulo="Panel de mi negocio" cerrar={() => setPanel(null)} movil={movil}>
            {(() => {
              const enPesos = guardadas.filter((g) => (g.monto || "").startsWith("$"));
              const potencial = enPesos.reduce((s, g) => s + (Number((g.monto || "").replace(/\D/g, "")) || 0), 0);
              const mes = {
                postuladas: 8, adjudicadas: 3,
                ventas: [
                  { mecanismo: "Compra Ágil", monto: 18400000 },
                  { mecanismo: "Licitación LE", monto: 15600000 },
                  { mecanismo: "Licitación L1", monto: 7200000 },
                  { mecanismo: "Convenio Marco", monto: 0 },
                ],
              };
              const totalVentas = mes.ventas.reduce((s, v) => s + v.monto, 0);
              const maxVenta = Math.max(...mes.ventas.map((v) => v.monto), 1);
              const tasa = Math.round((mes.adjudicadas / mes.postuladas) * 100);
              const Kpi = ({ etiqueta, valor, sub, dorado }) => (
                <div style={{ background: CARD2, border: `1px solid ${dorado ? GOLD_DEEP : BORDE}`, borderRadius: 13, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>{etiqueta}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 19, color: dorado ? "#ffd479" : PAPER, marginTop: 3 }}>{valor}</div>
                  {sub && <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{sub}</div>}
                </div>
              );
              return (
                <>
                  <div style={{ fontSize: 10.5, color: GOLD, fontWeight: 700, marginBottom: 8, letterSpacing: "0.08em", fontFamily: "'IBM Plex Mono', monospace" }}>HOY EN TU REPARTO</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                    <Kpi etiqueta="Oportunidades" valor={feed.length} sub={`${feed.filter((c) => !c.similar).length} calzan con tu rubro`} />
                    <Kpi etiqueta="Revisadas ✓✓" valor={vistas.length} sub={`${descartadas} descartadas a tiempo`} />
                    <Kpi etiqueta="En tu carro" valor={guardadas.length} sub="para postular" />
                    <Kpi etiqueta="Venta potencial" valor={`$${(potencial / 1000000).toFixed(1)}M`} dorado sub="suma de tu carro" />
                    <Kpi etiqueta="Postuladas" valor={postuladas.length} sub="marcadas por ti" />
                    <Kpi etiqueta="Adjudicadas" valor={postuladas.filter((x) => x.resultado === "adjudicada").length} dorado sub="de tus postulaciones" />
                  </div>
                  <div style={{ fontSize: 10.5, color: GOLD, fontWeight: 700, marginBottom: 8, letterSpacing: "0.08em", fontFamily: "'IBM Plex Mono', monospace" }}>TU MES EN MERCADO PÚBLICO</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <Kpi etiqueta="Ofertadas" valor={mes.postuladas} />
                    <Kpi etiqueta="Adjudicadas" valor={mes.adjudicadas} />
                    <Kpi etiqueta="Conversión" valor={`${tasa}%`} dorado />
                  </div>
                  <div style={{ background: CARD2, border: `1px solid ${BORDE}`, borderRadius: 13, padding: "12px 14px", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>Ventas por mecanismo</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: "#ffd479" }}>${totalVentas.toLocaleString("es-CL")}</span>
                    </div>
                    {mes.ventas.map((v) => (
                      <div key={v.mecanismo} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                          <span style={{ color: "#c9c6bf" }}>{v.mecanismo}</span>
                          <span style={{ color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>{v.monto > 0 ? `$${(v.monto / 1000000).toFixed(1)}M` : "—"}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: "#242833" }}>
                          <div style={{ width: `${(v.monto / maxVenta) * 100}%`, height: "100%", borderRadius: 999, background: v.monto > 0 ? `linear-gradient(90deg, ${GOLD_DEEP}, ${GOLD})` : "transparent" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10.5, color: "#6d6d76", lineHeight: 1.5, margin: 0 }}>
                    {rut.trim()
                      ? `Los datos de "tu mes" son de ejemplo: con el RUT ${rut.trim()} el panel se calculará automáticamente desde tus órdenes de compra reales en Mercado Público.`
                      : 'Los datos de "tu mes" son de ejemplo: en la versión con cuenta se calculan de tus postulaciones reales y del cruce automático con tus órdenes de compra en Mercado Público.'}
                  </p>
                </>
              );
            })()}
          </Hoja>
        )}

        {toast && (
          <div style={{ position: "absolute", bottom: movil ? 118 : 44, left: "50%", transform: "translateX(-50%)", background: PAPER, color: "#080a10", fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 999, boxShadow: "0 6px 20px rgba(0,0,0,.4)", zIndex: 40, maxWidth: "90%", textAlign: "center" }}>
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}

function Hoja({ titulo, cerrar, children, movil }) {
  return (
    <div onClick={cerrar} style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.66)", display: "flex", alignItems: movil ? "flex-end" : "center", justifyContent: "center", zIndex: 30 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: movil ? "100%" : "min(560px, 92%)",
          background: "#12141c",
          borderRadius: movil ? "22px 22px 0 0" : 22,
          border: "1px solid #2c2c34",
          padding: "20px 20px 22px",
          maxHeight: movil ? "84%" : "88vh",
          overflowY: "auto",
          fontFamily: "'Manrope', sans-serif",
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 16, margin: 0, color: "#f2efe9" }}>{titulo}</h3>
          <button onClick={cerrar} aria-label="Cerrar" style={{ background: "#1b1d26", border: "1px solid #2c2c34", borderRadius: 9, color: "#c9c6bf", fontSize: 14, cursor: "pointer", padding: "5px 9px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BotonHoja({ onClick, icono, texto, sub, dorado }) {
  return (
    <button onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: dorado ? SOBRE_GOLD : "transparent", border: `1.5px solid ${dorado ? "#e9b44c" : "#2a2e3a"}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer", color: "#f2efe9" }}>
      <span style={{ fontSize: 20 }}>{icono}</span>
      <span>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: dorado ? "#e9b44c" : "#f2efe9" }}>{texto}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "#9a9aa4", marginTop: 2 }}>{sub}</span>
      </span>
    </button>
  );
}

function Dato({ etiqueta, valor, urgente, tono, grande }) {
  const color = urgente ? "#ff6b5a" : tono === "verde" ? VERDE_MONTO : tono === "oro" ? "#e9b44c" : "#f2efe9";
  return (
    <div style={{ flex: 1, background: "rgba(255,255,255,.04)", border: urgente ? "1px solid #ff6b5a66" : "none", borderRadius: 15, padding: grande ? "14px 16px" : "10px 12px" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7e7e88", fontFamily: "'IBM Plex Mono', monospace" }}>{etiqueta}</div>
      <div style={{ fontSize: grande ? 21 : 15, fontWeight: 600, marginTop: grande ? 5 : 3, color, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "-0.01em" }}>{valor}</div>
    </div>
  );
}

function btn({ fondo, borde, color, peso = 700 }) {
  return {
    flex: 1, padding: "12px 10px", borderRadius: 13, border: `1.5px solid ${borde}`,
    background: fondo, color, fontWeight: peso, fontSize: 13.5, cursor: "pointer",
    fontFamily: "'Manrope', sans-serif",
  };
}
