# Carnet B — cuaderno de estudio

Web para preparar el examen teórico del permiso B por libre. La monté para
estudiar a mi ritmo y la dejo aquí por si a alguien más le sirve.

Trae:

- El temario teórico completo (18 temas, con láminas y el texto de cada
  epígrafe).
- Un banco de 121 tests con más de 3600 preguntas, cada una con su corrección
  y una explicación de ayuda.
- Simulacro de examen con las condiciones reales: 30 preguntas, 30 minutos y
  apto con un máximo de 3 errores.
- Tests aleatorios cortos para repasar entre horas, y un registro de tus
  preguntas falladas para machacarlas hasta que salgan.

El progreso se guarda en tu propio navegador, sin cuentas ni servidores de
por medio. En PC se puede usar entera con el teclado (flechas, letras de las
respuestas, H para la ayuda).

## Cómo usarla

Hace falta [Node.js](https://nodejs.org/) (versión 20 o superior).

```
git clone https://github.com/SnowballSeal/carnet-b.git
cd carnet-b/web
npm install
npm run dev
```

Y abrir http://localhost:5173 en el navegador. Nada más.

Si cambias algo de la carpeta `dataset/` (los datos de tests y temario),
regenera los índices con `npm run gen` dentro de `web/`.

## Publicarla como web

El repositorio incluye un workflow de GitHub Pages: activa Pages en los
ajustes del repo (Settings → Pages → Source: GitHub Actions) y cada push a la
rama principal publica la web automáticamente.

También se puede usar sin servidor ninguno: desde el índice de la propia web,
«Descargar copia local» genera un ZIP autocontenido que funciona en cualquier
ordenador (el LEEME del paquete explica cómo arrancarlo).

## Sobre el contenido

Esto es una recopilación de material de estudio para el examen teórico del
permiso B, hecha sin ánimo de lucro y con fines exclusivamente educativos.
