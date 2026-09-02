// ═══ GP Proveedores · API de oportunidades (Vercel Serverless) ═══
// Proxy cacheado a la API oficial de Mercado Público. El ticket vive en la
// variable de entorno MP_TICKET (nunca en el frontend). Con el ticket público
// de pruebas de ChileCompra el detalle por código viene muy limitado (429):
// por eso el enriquecimiento es "mejor esfuerzo" y la caché es agresiva.

export const config = { maxDuration: 60 };

const MP_URL = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json";
const DURACION_CACHE = 15 * 60 * 1000; // 15 min
const MAX_LISTADO = 120;   // procesos que viajan al frontend
const MAX_DETALLE = 10;    // cuántos se enriquecen con organismo/monto

let cache = { t: 0, data: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");

  // Por defecto usa el ticket PÚBLICO de pruebas de ChileCompra (documentado
  // abiertamente, muy limitado en tasa). Con ticket propio: variable MP_TICKET.
  const ticket = process.env.MP_TICKET || "F8537A18-6766-4DEF-9E59-426B4FEE2844";

  if (cache.data && Date.now() - cache.t < DURACION_CACHE) {
    res.setHeader("X-GP-Cache", "hit");
    return res.status(200).json(cache.data);
  }

  try {
    const r = await fetch(`${MP_URL}?estado=activas&ticket=${encodeURIComponent(ticket)}`);
    if (!r.ok) throw new Error("Mercado Público respondió HTTP " + r.status);
    const bruto = await r.json();

    // Publicadas (estado 5), ordenadas por cierre más próximo; el frontend
    // luego reordena por calce con el perfil de cada pyme.
    let listado = (bruto.Listado || [])
      .filter((l) => l.CodigoEstado === 5 && l.FechaCierre)
      .sort((a, b) => new Date(a.FechaCierre) - new Date(b.FechaCierre))
      .slice(0, MAX_LISTADO);

    // Enriquecer los primeros con organismo/monto/región (tolera 429 sin caerse).
    for (let i = 0; i < Math.min(MAX_DETALLE, listado.length); i++) {
      try {
        const rd = await fetch(`${MP_URL}?codigo=${encodeURIComponent(listado[i].CodigoExterno)}&ticket=${encodeURIComponent(ticket)}`);
        if (rd.ok) {
          const dd = await rd.json();
          if (dd.Listado && dd.Listado[0]) listado[i] = dd.Listado[0];
        }
      } catch { /* siguiente */ }
      await new Promise((s) => setTimeout(s, 400));
    }

    const data = { fuente: "mercado-publico", actualizado: new Date().toISOString(), Cantidad: bruto.Cantidad, Listado: listado };
    cache = { t: Date.now(), data };
    return res.status(200).json(data);
  } catch (e) {
    if (cache.data) {
      res.setHeader("X-GP-Cache", "stale");
      return res.status(200).json(cache.data);
    }
    return res.status(502).json({ error: String((e && e.message) || e) });
  }
}
