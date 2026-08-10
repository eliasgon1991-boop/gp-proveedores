// ═══ GP Proveedores · Backend ═══
// "Mercado Público, a domicilio"
// API propia que independiza la app: consulta Mercado Público con caché,
// registra acciones (vistas, me gusta, guardadas, descartes), calcula la
// racha de conexión y recibe las marcas de "algo no calza".

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const { SEMILLA } = require("./semilla");

const PORT = process.env.PORT || 4000;
const MP_TICKET = process.env.MP_TICKET || ""; // ticket de api.mercadopublico.cl (NUNCA en el frontend)
const CACHE_MINUTOS = Number(process.env.CACHE_MINUTOS || 60);
const MP_URL = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json";

// ── Nueva API de Compra Ágil (Beta, ChileCompra mayo 2026) ──
// Requiere su propio ticket (tutorial en chilecompra.cl/api). Cuando lo tengas,
// configura CA_URL con el endpoint de procesos publicados y CA_TICKET con tu llave.
const CA_URL = process.env.CA_URL || "";       // ej: endpoint de la API Compra Ágil Beta
const CA_TICKET = process.env.CA_TICKET || "";

// ── Base de datos (SQLite: cero configuración; migrable a Postgres/Supabase) ──
const db = new Database(process.env.DB_PATH || "gp.db");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS cache_mp (
    clave TEXT PRIMARY KEY,
    json  TEXT NOT NULL,
    ts    INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS acciones (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    device   TEXT NOT NULL,
    proceso  TEXT NOT NULL,
    tipo     TEXT NOT NULL CHECK (tipo IN ('vista','like','guardar','descartar')),
    dia      TEXT NOT NULL,             -- YYYY-MM-DD para calcular racha
    ts       INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_acciones_device_dia ON acciones(device, dia);
  CREATE TABLE IF NOT EXISTS reportes (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    device   TEXT NOT NULL,
    proceso  TEXT NOT NULL,
    motivo   TEXT NOT NULL,
    ts       INTEGER NOT NULL
  );
`);

const app = express();
app.use(cors()); // en producción: cors({ origin: "https://app.gestorpublico.cl" })
app.use(express.json());

const hoy = () => new Date().toISOString().slice(0, 10);

// ── Compra Ágil: normaliza la respuesta de la API Beta al formato de Listado ──
// La API Beta es nueva y su esquema puede ajustarse; este normalizador es tolerante
// a los nombres de campo más probables y descarta lo que no pueda interpretar.
function normalizarCompraAgil(items) {
  return (items || []).map((c) => ({
    CodigoExterno: c.codigo || c.Codigo || c.id || c.CodigoExterno || "",
    Nombre: c.nombre || c.Nombre || c.titulo || c.descripcion || "",
    CodigoEstado: 5,
    FechaCierre: c.fechaCierre || c.FechaCierre || c.fecha_cierre || null,
    Tipo: "Compra Ágil",
    MontoEstimado: c.montoEstimado || c.MontoEstimado || c.monto || null,
    Comprador: {
      NombreOrganismo: c.organismo || c.Organismo || c.comprador || "Organismo por confirmar",
      RegionUnidad: c.region || c.Region || "",
    },
  })).filter((c) => c.CodigoExterno && c.Nombre);
}

async function consultarCompraAgil() {
  if (!CA_URL || !CA_TICKET) return [];
  try {
    const sep = CA_URL.includes("?") ? "&" : "?";
    const r = await fetch(`${CA_URL}${sep}ticket=${encodeURIComponent(CA_TICKET)}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const datos = await r.json();
    return normalizarCompraAgil(datos.Listado || datos.listado || datos.items || datos.data || datos);
  } catch (e) {
    console.error("[CA] Error consultando API Compra Ágil:", e.message);
    return [];
  }
}

// ── Fuente unificada: TODAS las licitaciones activas + Compras Ágiles vigentes ──
async function obtenerLicitaciones() {
  const fila = db.prepare("SELECT json, ts FROM cache_mp WHERE clave = 'activas'").get();
  const vigente = fila && Date.now() - fila.ts < CACHE_MINUTOS * 60000;
  if (vigente) return { fuente: "vivo", datos: JSON.parse(fila.json) };

  if (!MP_TICKET) {
    return { fuente: "demo", datos: SEMILLA };
  }
  try {
    // estado=activas devuelve la TOTALIDAD de licitaciones vigentes del país (miles),
    // y en paralelo se consultan las Compras Ágiles publicadas (API Beta)
    const url = `${MP_URL}?estado=activas&ticket=${encodeURIComponent(MP_TICKET)}`;
    const [respLicitaciones, compraAgil] = await Promise.all([
      fetch(url, { signal: AbortSignal.timeout(30000) }),
      consultarCompraAgil(),
    ]);
    if (!respLicitaciones.ok) throw new Error("HTTP " + respLicitaciones.status);
    const lic = await respLicitaciones.json();
    if (!lic.Listado) throw new Error(lic.Mensaje || "Respuesta sin Listado");

    const datos = {
      Cantidad: (lic.Listado?.length || 0) + compraAgil.length,
      Licitaciones: lic.Listado?.length || 0,
      ComprasAgiles: compraAgil.length,
      Listado: [...compraAgil, ...lic.Listado],
    };
    db.prepare("INSERT OR REPLACE INTO cache_mp (clave, json, ts) VALUES ('activas', ?, ?)").run(
      JSON.stringify(datos),
      Date.now()
    );
    return { fuente: "vivo", datos };
  } catch (e) {
    console.error("[MP] Error consultando la API:", e.message);
    // Si hay caché viejo, mejor eso que nada; si no, semilla demo
    if (fila) return { fuente: "cache", datos: JSON.parse(fila.json) };
    return { fuente: "demo", datos: SEMILLA };
  }
}

// ── Rutas ──
app.get("/api/salud", (req, res) => {
  res.json({ ok: true, servicio: "GP Proveedores Backend", ticket: MP_TICKET ? "configurado" : "falta" });
});

// Feed de oportunidades: TODAS las licitaciones activas + Compras Ágiles (formato API oficial + fuente)
app.get("/api/oportunidades", async (req, res) => {
  const { fuente, datos } = await obtenerLicitaciones();
  res.json({
    fuente,
    Cantidad: datos.Cantidad,
    Licitaciones: datos.Licitaciones ?? datos.Listado?.length,
    ComprasAgiles: datos.ComprasAgiles ?? 0,
    Listado: datos.Listado,
  });
});

// Registro de acciones del feed (fire-and-forget desde la app)
app.post("/api/acciones", (req, res) => {
  const { device, proceso, tipo } = req.body || {};
  if (!device || !proceso || !["vista", "like", "guardar", "descartar"].includes(tipo)) {
    return res.status(400).json({ error: "Se requiere device, proceso y tipo válido" });
  }
  db.prepare("INSERT INTO acciones (device, proceso, tipo, dia, ts) VALUES (?, ?, ?, ?, ?)").run(
    device, proceso, tipo, hoy(), Date.now()
  );
  res.json({ ok: true });
});

// Racha: días consecutivos (hasta hoy) con al menos una acción
app.get("/api/racha/:device", (req, res) => {
  const dias = db
    .prepare("SELECT DISTINCT dia FROM acciones WHERE device = ? ORDER BY dia DESC LIMIT 366")
    .all(req.params.device)
    .map((f) => f.dia);
  let racha = 0;
  const cursor = new Date();
  for (const dia of dias) {
    if (dia === cursor.toISOString().slice(0, 10)) {
      racha++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  res.json({ device: req.params.device, racha });
});

// Resumen de contadores por dispositivo
app.get("/api/resumen/:device", (req, res) => {
  const filas = db
    .prepare("SELECT tipo, COUNT(*) n FROM acciones WHERE device = ? GROUP BY tipo")
    .all(req.params.device);
  const resumen = { vista: 0, like: 0, guardar: 0, descartar: 0 };
  filas.forEach((f) => (resumen[f.tipo] = f.n));
  res.json({ device: req.params.device, ...resumen });
});

// Marcas de "algo no calza" (anónimas por dispositivo)
app.post("/api/reportes", (req, res) => {
  const { device, proceso, motivo } = req.body || {};
  if (!device || !proceso || !motivo) {
    return res.status(400).json({ error: "Se requiere device, proceso y motivo" });
  }
  db.prepare("INSERT INTO reportes (device, proceso, motivo, ts) VALUES (?, ?, ?, ?)").run(
    device, proceso, motivo, Date.now()
  );
  res.json({ ok: true });
});

// Agregado público: procesos más marcados (futuro observatorio)
app.get("/api/reportes/resumen", (req, res) => {
  const filas = db
    .prepare("SELECT proceso, COUNT(*) marcas FROM reportes GROUP BY proceso ORDER BY marcas DESC LIMIT 20")
    .all();
  res.json({ procesos: filas });
});

app.listen(PORT, () => {
  console.log(`GP Proveedores Backend escuchando en puerto ${PORT}`);
  console.log(`Ticket Mercado Público: ${MP_TICKET ? "configurado ✓" : "NO configurado → modo demo"}`);
});
