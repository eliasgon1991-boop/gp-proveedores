# GP Proveedores · Backend

Backend propio que independiza la app **GP Proveedores** ("Mercado Público, a domicilio").

## Qué hace

- Consulta la API oficial de Mercado Público con tu ticket (guardado en secreto, nunca en el frontend) y **cachea** el resultado para no gatillar el límite de consultas de ChileCompra.
- Registra las acciones del feed por dispositivo: **vistas, me gusta, guardadas, descartes** — la materia prima del algoritmo de calce.
- Calcula la **racha** de días consecutivos de conexión (el fueguito 🔥).
- Recibe las marcas de **"algo no calza"** y expone un resumen agregado (futuro observatorio).
- Si la API falla o no hay ticket, responde datos de demostración: la app nunca queda en blanco.

## Correr en local

```bash
npm install
MP_TICKET=TU_TICKET node server.js
# → http://localhost:4000/api/salud
```

## Variables de entorno

| Variable        | Descripción                                        | Por defecto |
|-----------------|----------------------------------------------------|-------------|
| `MP_TICKET`     | Ticket de api.mercadopublico.cl (obligatorio para datos en vivo) | vacío → modo demo |
| `PORT`          | Puerto del servidor                                | 4000        |
| `CACHE_MINUTOS` | Vigencia del caché de licitaciones                 | 60          |
| `DB_PATH`       | Ruta del archivo SQLite                            | gp.db       |

## Endpoints

| Método | Ruta                       | Descripción                                  |
|--------|----------------------------|----------------------------------------------|
| GET    | `/api/salud`               | Estado del servicio                          |
| GET    | `/api/oportunidades`       | Licitaciones activas (formato API oficial + campo `fuente`) |
| POST   | `/api/acciones`            | `{device, proceso, tipo}` — vista/like/guardar/descartar |
| GET    | `/api/racha/:device`       | Días consecutivos de conexión                |
| GET    | `/api/resumen/:device`     | Contadores de acciones del dispositivo       |
| POST   | `/api/reportes`            | `{device, proceso, motivo}` — marca "algo no calza" |
| GET    | `/api/reportes/resumen`    | Procesos más marcados (agregado anónimo)     |

## Desplegar (Railway o Render, gratis para partir)

1. Sube esta carpeta a un repositorio de GitHub.
2. En [Railway](https://railway.app) o [Render](https://render.com): **New project → Deploy from GitHub** y elige el repo.
3. Agrega la variable de entorno `MP_TICKET` con tu ticket (¡solo aquí, nunca en el código!).
4. Copia la URL pública que te entrega (ej. `https://gp-backend.up.railway.app`).
5. En `gp-proveedores-feed.jsx`, pégala en la constante `ENDPOINT_BACKEND`.

La app queda: backend propio primero → webhook n8n de respaldo → demo si todo falla.

## Fuentes de datos

- **Licitaciones**: `estado=activas` de la API clásica devuelve la TOTALIDAD de licitaciones vigentes del país (miles de procesos), no solo las del día.
- **Compras Ágiles**: se integra la **nueva API de Compra Ágil (Beta, mayo 2026)** de ChileCompra. Requiere su propio ticket (tutorial en chilecompra.cl/api). Configura `CA_URL` (endpoint de procesos publicados) y `CA_TICKET` como variables de entorno; el backend fusiona ambas fuentes en un solo Listado y reporta el desglose (`Licitaciones`, `ComprasAgiles`). El normalizador es tolerante al esquema Beta; si ChileCompra ajusta nombres de campos, se adapta en `normalizarCompraAgil()`.

## Próximos pasos sugeridos

- **Login de usuarios** (reemplaza el `device` de sesión por cuentas reales; requisito para cobrar suscripción). Sugerido: Supabase Auth o Passport + JWT.
- **Postgres/Supabase** en lugar de SQLite cuando haya usuarios concurrentes (en Render el disco es efímero: agrega un volumen o migra la BD antes de producción real).
- **Detalle por proceso**: segunda llamada a la API por ID para monto y organismo completos, guardada en caché.
- **Perfil por usuario**: palabras clave de rubro en BD para calcular el calce en el servidor.
- n8n queda para lo que es bueno: correos del reparto diario, WhatsApp y sincronización con Klaviyo.
