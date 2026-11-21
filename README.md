# FitDash · Personal Fitness Dashboard

Aplicación web para el seguimiento de entrenamiento, nutrición y recomposición corporal.

- Funciona solo en el navegador: no hay servidor, ni claves API, ni servicios de pago.
- Los datos se guardan en IndexedDB y se pueden exportar e importar en JSON.
- Se puede instalar en Android como app (PWA).

> Las calorías y los macros de los alimentos son **estimaciones editables**. La app no hace diagnósticos ni da recomendaciones médicas.

---

## 1. Arquitectura y decisiones técnicas

| Decisión | Motivo |
|---|---|
| **React 19 + TypeScript 7 + Vite 8** | El stack que pediste, en sus versiones actuales. |
| **Tailwind CSS 4** (`@tailwindcss/vite`) | Configuración en CSS, sin `tailwind.config.js`. Modo oscuro por clase, sin destello al cargar. |
| **Recharts 3** + **lucide-react** | Gráficos interactivos e iconos. |
| **Dexie 4** (IndexedDB) + `useLiveQuery` | Persistencia real: la interfaz se actualiza sola al cambiar los datos. `localStorage` solo guarda el tema. |
| **Rutas con hash** (`#/hoy`, `#/entreno`…) | GitHub Pages no reescribe rutas: con hash, recargar o abrir un enlace directo siempre funciona. |
| **Fechas como `YYYY-MM-DD` locales** (date-fns) | Nunca se usa `toISOString()` para los días, porque en horario de Madrid puede guardar el registro en el día anterior. La semana empieza en lunes. |
| **Macros siempre calculados** | Las recetas guardan solo ingredientes y gramos. Al registrar una receta se crea **una sola entrada** con una copia de sus ingredientes: no se duplican alimentos y el histórico no cambia si luego editas la receta. |
| **Carbohidratos sin fibra** | Siguen la convención de las etiquetas UE. La fibra va en un campo aparte y se muestra para que puedas ajustarla a tu tolerancia. |
| **Copia JSON validada con zod** | Al importar puedes reemplazar todo o combinar. Las fotos van en base64 y puedes exportar sin ellas si quieres un archivo más ligero. |
| **vite-plugin-pwa** | Permite instalar la app en Android y usarla sin conexión. |

### Estructura de carpetas

```
PersonalFitDash/
├── .github/workflows/deploy.yml   # despliegue automático a GitHub Pages
├── public/                        # favicon e iconos de la PWA
├── src/
│   ├── App.tsx                    # rutas, carga inicial y control de errores
│   ├── index.css                  # Tailwind 4, tema y componentes base
│   ├── components/
│   │   ├── Layout.tsx             # barra lateral (escritorio) y navegación inferior (móvil)
│   │   ├── charts.tsx             # gráficos de líneas y barras (Recharts)
│   │   └── ui.tsx                 # tarjetas, barras, modales, inputs con coma decimal, avisos
│   ├── db/
│   │   ├── db.ts                  # esquema Dexie, datos iniciales y almacenamiento persistente
│   │   ├── seed.ts                # alimentos, recetas, ejercicios, programa y lista de compra
│   │   └── types.ts               # modelo de datos
│   ├── lib/
│   │   ├── actions.ts             # registrar comidas y recetas, copiar días, agua
│   │   ├── backup.ts              # exportar e importar JSON
│   │   ├── date.ts                # utilidades de fecha (hora local)
│   │   ├── hooks.ts / router.ts
│   │   ├── nutrition.ts           # cálculo de macros, metabolismo y avisos de ingesta baja
│   │   ├── sample.ts              # datos de ejemplo (marcados y eliminables)
│   │   ├── stats.ts               # media de 7 días, ritmo de pérdida y racha
│   │   ├── summary.ts             # resumen semanal automático
│   │   └── training.ts            # 1RM estimado, récords, doble progresión y volumen
│   └── pages/
│       ├── Today.tsx              # HOY
│       ├── Training.tsx + training/   # sesión, historial, ejercicios y récords, programa
│       ├── Nutrition.tsx + nutrition/ # diario, recetas, alimentos, registro digestivo
│       ├── Progress.tsx           # medidas, análisis y fotos
│       ├── Calendar.tsx           # vista mensual y semanal, detalle de cada día
│       ├── Shopping.tsx           # lista de la compra y presupuesto
│       └── Settings.tsx           # perfil, objetivos, copias, almacenamiento, datos de ejemplo
└── tests/                         # pruebas de la lógica (Vitest)
```

---

## 2. Ejecutar en local

Requisitos: **Node.js 22.12 o superior** (también sirve 20.19 o superior).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de la lógica
npm run build      # genera dist/
npm run preview    # sirve la versión compilada
```

## 3. Crear el repositorio en GitHub

```bash
git init
git add .
git commit -m "FitDash: primera versión"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/PersonalFitDash.git
git push -u origin main
```

Antes, crea el repositorio vacío en GitHub (**New repository**, sin README).

- **Nombre:** puede ser cualquiera, porque el workflow calcula la ruta base a partir de él.
- **Visibilidad:** con un plan gratuito, GitHub Pages solo funciona si el repositorio es público.

## 4. Activar GitHub Pages

1. En el repositorio, ve a **Settings → Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Haz un push a `main`, o ve a **Actions → Deploy to GitHub Pages → Run workflow**.
4. Cuando termine, la app estará en `https://<tu-usuario>.github.io/<nombre-del-repo>/`.

## 5. Despliegue automático

`.github/workflows/deploy.yml` se ejecuta en cada push a `main`. Hace lo siguiente:

1. Instala las dependencias con `npm ci`.
2. Pasa las pruebas.
3. Compila con `BASE_PATH=/<nombre-del-repo>/`.
4. Publica `dist/` con `actions/deploy-pages`.

Versiones de las acciones: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5 y deploy-pages v5.

> Haz commit de `package-lock.json`: `npm ci` lo necesita.

### Instalar en Android

1. Abre la URL en Chrome.
2. Menú ⋮ → **Añadir a pantalla de inicio** (o **Instalar aplicación**).
3. Ve a Configuración → Almacenamiento y pulsa **Solicitar almacenamiento persistente**.

## 6. Exportar e importar tus datos

Tus datos **solo están en el navegador donde los registras**.

- **Exportar:** Configuración → Copia de seguridad → **Exportar todo**. Se descarga `fitdash-backup-AAAA-MM-DD.json`. También hay **Exportar sin fotos**, que genera un archivo más ligero. Guárdalo en Drive, en tu PC o donde prefieras. Si llevas más de 7 días sin copia, la pantalla HOY te lo recuerda.
- **Importar:** Configuración → **Importar…** → elige el archivo. Verás cuántos registros trae cada tabla antes de confirmar.
  - **Reemplazar todo:** borra los datos actuales y restaura la copia. Es lo que debes usar al cambiar de navegador o de dispositivo.
  - **Combinar:** añade y actualiza registros sin borrar nada.
- La copia indica la versión de su esquema, y la app rechaza archivos que no sean copias válidas.

> Safari puede borrar los datos de una web tras 7 días sin usarla. Haz copias con regularidad.

---

## Notas de uso

- **HOY:** detecta el día de la semana y muestra el entrenamiento programado. Tiene botones para registrar tus comidas habituales con un toque, agua, peso, racha y gráficos.
- **Entrenamiento:**
  - Para cada serie registras peso, repeticiones (o segundos), RIR (RPE = 10 − RIR), descanso y si es de calentamiento. Puedes añadir, editar y borrar series sueltas.
  - Junto a cada ejercicio ves la sesión anterior y un botón para **repetir** sus valores.
  - Al marcar una serie como hecha se inicia un temporizador de descanso.
  - **Doble progresión:** si completas todas las series en el tope del rango, la app *sugiere* subir de peso. Nunca lo cambia sin que pulses "Aplicar".
  - Si un salto de peso supera el 10 % de la carga, primero te pide 2 repeticiones más.
  - Tras 3 sesiones sin mejora, sugiere bajar el peso o hacer una descarga.
- **Récords:** peso máximo, 1RM estimado (Epley, solo con series de 1 a 10 repeticiones), mejor serie, mejor sesión y récord para cada número de repeticiones.
- **Nutrición:**
  - Base de datos local en la que puedes buscar, crear y editar alimentos.
  - Recetas precargadas, favoritas y versiones personalizadas.
  - Puedes copiar una comida o un día entero de otro día, y guardar una comida como receta habitual.
  - Los avisos de ingesta baja usan la media de 7 días y necesitan al menos 4 días completos.
- **Progreso:**
  - El ritmo de pérdida se calcula por regresión sobre 14 a 21 días.
  - Una subida puntual de peso nunca se interpreta como grasa.
  - El resumen semanal solo dice lo que permiten tus datos.
- **Datos de ejemplo:** se cargan desde Configuración, llevan la etiqueta "Ejemplo" y se borran de una vez.
