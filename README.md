# LibreBook

LibreBook es una aplicación de escritorio desarrollada con Electron para organizar y reproducir audiolibros de manera elegante y minimalista.

## Características

- Biblioteca de audiolibros
- Reproductor integrado
- Barra de progreso
- Control de velocidad
- Vista en grilla y lista
- Sistema de géneros
- Drag & Drop de archivos
- Persistencia de progreso
- Diseño moderno inspirado en aplicaciones premium

### Soporte de capítulos (.cue)

- Al agregar un audiolibro, la app busca automáticamente un archivo .cue en la misma carpeta del archivo de audio (primero intenta basename.cue, si no encuentra busca cualquier .cue en la carpeta).
- Si existe un .cue válido, la aplicación divide el libro en capítulos y muestra una lista de capítulos en la zona "Escuchando ahora".
- Cada capítulo muestra título y tiempo; al hacer clic sobre un capítulo la reproducción salta a ese tiempo y comienza a reproducir.
- Cada capítulo tiene un toggle para marcarlo como escuchado; ese estado se guarda con el libro.
- Si no se encuentra un .cue, el libro se puede reproducir normalmente y la app muestra un mensaje que indica que para dividir en capítulos hay que colocar un .cue en la misma carpeta.
- Nota: el parser .cue incluido es simple (busca TITLE e INDEX 01) y funcionará con la mayoría de .cue generados por herramientas comunes. Si encontrás .cue que no parsean, puedo robustecer el parser.

---

## Tecnologías

- Electron
- HTML5
- CSS3
- JavaScript Vanilla

---

## Instalación

Clonar el repositorio:

```bash
git clone https://github.com/nunezValen/LibreShelves
```

Instalar dependencias:

```bash
npm install
```

Iniciar aplicación:

```bash
npm start
```

---

## Build EXE

```bash
npx electron-builder
```

---

## Estructura

```txt
src/
 ├── index.html
 ├── style.css
 └── renderer.js
```

---

## Roadmap

- Portadas reales
- Base de datos SQLite
- Modo offline
- Sincronización cloud
- Temas personalizados
- Mini reproductor
- Integración con podcasts

---

## Licencia

MIT