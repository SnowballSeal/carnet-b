# Carnet B — web de estudio

Web para preparar el examen teórico del carnet tipo B: el temario completo por
temas, un banco de tests con corrección y ayuda en cada pregunta, simulacro
con criterio DGT y práctica aleatoria. Los datos viven en la carpeta hermana
`dataset/` (~200 MB) y **no se copian** dentro de la web: el servidor de Vite
los sirve por referencia (ver `vite.config.ts`). En GitHub Pages los sirve el
workflow de despliegue, que copia el dataset dentro de la web compilada.

## Uso

```
cd web
npm install
npm run dev        # abre http://localhost:5173
```

- **Temario** — visor de láminas de los 18 temas (flechas del teclado o
  deslizar en móvil; tocar la lámina la amplía a pantalla completa). Los
  epígrafes de vídeo se reproducen embebidos desde YouTube (requieren
  conexión); el resto es 100 % local. `#/tema/5/23` abre el tema 5 por la
  lámina 23.
- **Tests** — los 121 tests del catálogo, con navegación libre, ayuda por
  pregunta y corrección con revisión. En PC, también con el teclado: flechas
  para cambiar de pregunta y la letra (A/B/C) o el número (1/2/3) de la
  opción para responder; en móvil se desliza para cambiar de pregunta. Con
  «Corrección inmediata (estudio)» cada pregunta se corrige al responderla
  (`?modo=estudio` en la URL). Al revelar una pregunta se indica cuántas
  veces se había fallado antes.
- **Simulacro** — 30 preguntas al azar, 30 minutos, criterio DGT (apto con
  máximo 3 errores). Durante el simulacro la ayuda queda oculta.
- **Aleatorio** — tandas de 10/20/30 preguntas sin cronómetro, de todo el
  banco o solo de una categoría, con modo estudio opcional.
- **Preguntas falladas** (`#/falladas`) — la lista de preguntas falladas y un
  test aleatorio montado con las pendientes. Una pregunta se da por
  «dominada» (y sale del repaso) al acertarla 2 veces seguidas desde el
  último fallo.
- **Buscar** (`#/buscar`) — busca en las 3630 preguntas del banco y en el
  texto del temario, sin distinguir mayúsculas ni tildes; los resultados del
  temario llevan a su lámina.
- **Progreso** (`#/progreso`) — panel de estadísticas del estudio (incluida
  la constancia: preguntas por día y racha), con exportación e importación
  del progreso como archivo. Todo se guarda anónimamente en el navegador
  (localStorage), sin cuentas.
- **Tema oscuro** — sigue al sistema; el botón ☾/☀ del lateral (o de la barra
  superior en móvil) lo fija a mano.
- **Sin conexión** — la web compilada registra un service worker que cachea lo
  que se va usando (páginas, banco, tests, láminas vistas): tras la primera
  visita funciona offline salvo los vídeos de YouTube. Requiere HTTPS o
  localhost (en GitHub Pages, sí; abierta por IP de red local, no).

## Copia local

Desde el índice, «Descargar copia local (.zip)» genera un paquete con la web
compilada y todos los datos, para usarla en cualquier ordenador sin este
servidor: basta un servidor estático en la carpeta descomprimida (en Windows,
doble clic en `Iniciar web.bat`; el `LEEME.txt` del paquete tiene el detalle).
En iPhone/iPad no puede arrancarse el servidor (iOS no ejecuta Python); desde
ellos se abre por red local la copia arrancada en otro dispositivo — el
servidor imprime la dirección al arrancar.
El progreso no viaja solo — se lleva con «Exportar/Importar progreso» en el
panel de progreso. El botón necesita la web compilada (`npm run build`).

## Dataset

```
dataset/
  catalogo.json                    # categorías y tests (id, nombre, archivo)
  tests/<categoria>/<test>.json    # preguntas, opciones, corrección y ayuda
  tests/<categoria>/<test>_images/ # ilustración de cada pregunta (si la hay)
  temario/<tema>/NNN.webp          # láminas del tema
  temario/<tema>/epigrafes.json    # título, texto y vídeo de cada epígrafe
```

Tras cambiar cualquier dato, regenerar los índices de la web:

```
npm run gen
```

Esto reconstruye `src/data/catalogo.json` (índice de categorías/tests/temas)
y `public/banco.json` (banco completo para simulacro y aleatorio).

## Notas

- Las fuentes se cargan de Google Fonts; sin conexión, la web funciona igual
  con las fuentes de reserva del sistema (los datos son locales, salvo los
  vídeos embebidos del temario).
- `npm run build` + `npm run preview` también sirven los datos (el mismo
  middleware está registrado para `vite preview`).
