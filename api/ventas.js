// ═══ GP Proveedores · Ventas reales por RUT (Vercel Serverless) ═══
// Cruza el RUT de la pyme con la API oficial de órdenes de compra de
// Mercado Público (parámetro rutproveedor, verificado). Enriquecemos las
// más recientes con su detalle para obtener montos y compradores.

export const config = { maxDuration: 60 };

const OC_URL = "https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json";
const DURACION_CACHE = 15 * 60 * 1000;
const MAX_DETALLE = 8;

const cache = new Map(); // rut → { t, data }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");

  const ticket = process.env.MP_TICKET || "F8537A18-6766-4DEF-9E59-426B4FEE2844";
  const rut = String(req.query.rut || "").trim().toUpperCase().replace(/\./g, "");
  if (!/^\d{7,9}-[\dK]$/.test(rut)) {
    return res.status(400).json({ error: "RUT inválido: usa el formato 12345678-9" });
  }

  const previo = cache.get(rut);
  if (previo && Date.now() - previo.t < DURACION_CACHE) {
    res.setHeader("X-GP-Cache", "hit");
    return res.status(200).json(previo.data);
  }

  try {
    const r = await fetch(`${OC_URL}?rutproveedor=${encodeURIComponent(rut)}&ticket=${encodeURIComponent(ticket)}`);
    if (!r.ok) throw new Error("Mercado Público respondió HTTP " + r.status);
    const bruto = await r.json();
    if (bruto.Codigo && bruto.Mensaje) throw new Error(bruto.Mensaje);

    const listado = bruto.Listado || [];
    const porEstado = {};
    for (const oc of listado) porEstado[oc.CodigoEstado] = (porEstado[oc.CodigoEstado] || 0) + 1;

    // La API entrega las más antiguas primero: las últimas son las recientes.
    const recientes = listado.slice(-14).reverse();
    for (let i = 0; i < Math.min(MAX_DETALLE, recientes.length); i++) {
      try {
        const rd = await fetch(`${OC_URL}?codigo=${encodeURIComponent(recientes[i].Codigo)}&ticket=${encodeURIComponent(ticket)}`);
        if (rd.ok) {
          const dd = await rd.json();
          if (dd.Listado && dd.Listado[0]) recientes[i] = dd.Listado[0];
        }
      } catch { /* siguiente */ }
      await new Promise((s) => setTimeout(s, 250));
    }

    const data = {
      fuente: "mercado-publico",
      rut,
      actualizado: new Date().toISOString(),
      total: bruto.Cantidad ?? listado.length,
      porEstado,
      recientes: recientes.slice(0, 12),
    };
    cache.set(rut, { t: Date.now(), data });
    if (cache.size > 50) cache.delete(cache.keys().next().value);
    return res.status(200).json(data);
  } catch (e) {
    if (previo) {
      res.setHeader("X-GP-Cache", "stale");
      return res.status(200).json(previo.data);
    }
    return res.status(502).json({ error: String((e && e.message) || e) });
  }
}
