// Datos de demostración con la MISMA forma que responde la API de Mercado Público.
// Se usan cuando la API no está disponible o mientras no hay ticket configurado.

function enDias(n) {
  const f = new Date(Date.now() + n * 86400000);
  return f.toISOString();
}

const SEMILLA = {
  Cantidad: 6,
  Listado: [
    {
      CodigoExterno: "1057-45-LE26",
      Nombre: "Servicio de aseo y sanitización de dependencias",
      CodigoEstado: 5,
      FechaCierre: enDias(6),
      Tipo: "LE",
      MontoEstimado: 38500000,
      Comprador: { NombreOrganismo: "SERVIU Región Metropolitana", RegionUnidad: "Región Metropolitana" },
    },
    {
      CodigoExterno: "2239-18-COT26",
      Nombre: "Compra Ágil: insumos de ferretería y herramientas menores",
      CodigoEstado: 5,
      FechaCierre: enDias(1),
      Tipo: "COT",
      MontoEstimado: null,
      Comprador: { NombreOrganismo: "I. Municipalidad de Maipú", RegionUnidad: "Región Metropolitana" },
    },
    {
      CodigoExterno: "894-12-LE26",
      Nombre: "Suministro de alimentos no perecibles para programas sociales",
      CodigoEstado: 5,
      FechaCierre: enDias(9),
      Tipo: "LE",
      MontoEstimado: 52900000,
      Comprador: { NombreOrganismo: "JUNAEB Valparaíso", RegionUnidad: "Región de Valparaíso" },
    },
    {
      CodigoExterno: "3411-7-L126",
      Nombre: "Mantención de áreas verdes y sistemas de riego",
      CodigoEstado: 5,
      FechaCierre: enDias(4),
      Tipo: "L1",
      MontoEstimado: 9800000,
      Comprador: { NombreOrganismo: "I. Municipalidad de La Florida", RegionUnidad: "Región Metropolitana" },
    },
    {
      CodigoExterno: "1660-33-LE26",
      Nombre: "Arriendo de equipos computacionales para establecimientos",
      CodigoEstado: 5,
      FechaCierre: enDias(11),
      Tipo: "LE",
      MontoEstimado: 47200000,
      Comprador: { NombreOrganismo: "SLEP Barrancas", RegionUnidad: "Región Metropolitana" },
    },
    {
      CodigoExterno: "782-51-COT26",
      Nombre: "Compra Ágil: servicio de coffee break para jornadas",
      CodigoEstado: 5,
      FechaCierre: enDias(0),
      Tipo: "COT",
      MontoEstimado: null,
      Comprador: { NombreOrganismo: "Servicio de Salud Concepción", RegionUnidad: "Región del Biobío" },
    },
  ],
};

module.exports = { SEMILLA };
