# GP Proveedores · "Mercado Público, a domicilio"

Proyecto completo de la app + landing + backend, construido en Claude (agosto 2026).
Convertido a **Vite + React** en Claude Code (09-08-2026): el pipeline manual de
esbuild ya no se usa; `npm run build` genera todo.

## Estructura

```
gp-proveedores/
├── index.html               ← Landing + shell de la app. ENTRADA de Vite.
├── src/
│   ├── App.jsx              ← FUENTE MAESTRA de la app React (editar SIEMPRE aquí).
│   └── main.jsx             ← Montaje + puente landing↔app (__gpAbrir/__gpSalir e
│                               interceptor de "Acceso", "Ver la app por dentro", etc.).
├── vite.config.js           ← Dev server en :5173 con proxy /api → localhost:4000.
├── .env.example             ← VITE_ENDPOINT_BACKEND / VITE_ENDPOINT_DATOS.
├── backend/                 ← API propia: Node + Express + SQLite (puerto 4000).
│   ├── server.js               /api/oportunidades (Mercado Público con caché),
│   │                           /api/acciones, /api/racha, /api/reportes, /api/resumen.
│   ├── semilla.js              Datos demo con el formato de la API oficial.
│   └── README.md               Endpoints, variables de entorno y despliegue.
├── n8n/
│   └── n8n-workflow-gp-proveedores.json  ← Workflow importable: webhook → API → respuesta.
│                                            (Contiene el ticket de la API: no compartir.)
├── web/                     ← LEGADO (respaldo, ya no se edita):
│   ├── gp-proveedores.html     entregable anterior de un solo archivo.
│   └── landing-original.html   la landing sola (origen del index.html actual).
└── app/                     ← LEGADO: fuente y compilado del pipeline esbuild anterior.
```

## Desarrollo y build

```bash
npm install
npm run dev        # http://localhost:5173 (landing; los botones abren la app)
npm run build      # genera dist/ listo para desplegar
npm run preview    # sirve dist/ localmente
```

Para probar contra el backend local: `node backend/server.js` (puerto 4000) y en `.env`
poner `VITE_ENDPOINT_BACKEND=http://localhost:4000` (o dejarlo vacío y usar el proxy
`/api` del dev server si se apunta con rutas relativas en el futuro).

**Despliegue en Vercel:** importar el repo tal cual — Vercel detecta Vite solo
(build `npm run build`, output `dist/`). Configurar `VITE_ENDPOINT_BACKEND` en
Environment Variables cuando el backend esté desplegado (ej. Railway).

Nota: desde localhost el webhook n8n rechaza CORS, así que en dev la app cae a
los datos demo (chip ◌ DEMO). Es el comportamiento esperado de la cadena de carga.

## Conexiones de datos (en src/App.jsx, arriba del archivo)

- `VITE_ENDPOINT_BACKEND` = URL base del backend desplegado (ej. Railway). Vacío = se salta.
- `VITE_ENDPOINT_DATOS`   = webhook n8n de respaldo (por defecto egonzalezm.app.n8n.cloud).
- Cadena de carga: backend → n8n → datos demo. El chip muestra ● EN VIVO / ◌ DEMO.
- El backend necesita la variable de entorno `MP_TICKET` (ticket de api.mercadopublico.cl).
  **El ticket NUNCA va en el frontend.**

## Pendientes priorizados (decididos en la conversación de Claude)

1. Cuentas de usuario (Supabase Auth) — hoy el estado vive solo en memoria del navegador.
2. Persistir perfil/carro/racha en el backend por usuario.
3. RUT → cruce automático con órdenes de compra (API oficial) para el Panel BI real.
4. Reparto diario por WhatsApp/correo (n8n como motor de envíos).
5. Match por rubros ONU (segunda llamada por ID) además del match textual.
6. Filtrado y paginación del lado del servidor (estado=activas trae miles de procesos).
7. API de Compra Ágil Beta (ChileCompra, mayo 2026): configurar CA_URL y CA_TICKET
   en el backend cuando se obtenga el ticket beta.
