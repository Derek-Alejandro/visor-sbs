# StereoLab — Visor estereoscópico SBS

Proyecto educativo para la materia **Desarrollo de Soluciones en Ambientes Virtuales**. Es una aplicación web estática, responsiva, construida con **HTML, CSS, Bootstrap 5, Three.js (ES Modules) y lil-gui**. Visualiza fotografías estereoscópicas lado a lado (Side by Side, SBS) en gafas para teléfono tipo Google Cardboard.

## 1. Estructura del proyecto

```text
visor-sbs/
├── index.html                 # Interfaz principal y dependencias CDN
├── css/
│   └── styles.css             # Diseño responsivo y modo inmersivo
├── js/
│   ├── main.js                # Inicialización y eventos
│   ├── scene.js               # WebGLRenderer, cámaras y dos vistas
│   ├── viewer.js              # Mapeo UV SBS y calibración de planos
│   ├── controls.js            # Panel lil-gui
│   ├── fileLoader.js          # Lectura de archivos locales
│   ├── ui.js                  # Pantalla completa, Cardboard y avisos
│   ├── touchControls.js       # Arrastre y pellizco (Pointer Events)
│   ├── autoCalibration.js     # Estimación de disparidad L/R
│   └── profiles.js            # Guardado local de calibraciones
├── assets/
│   ├── images/
│   │   ├── demo-sbs-1.jpg     # Muestra: montaña y bote
│   │   └── demo-sbs-2.jpg     # Muestra: galería y cubo
│   └── icons/
│       └── cardboard.svg
└── README.md
```

## 2. Cómo iniciar la aplicación

No hace falta Node.js, npm, framework de servidor ni clave API. Las bibliotecas se descargan de jsDelivr al abrir la página, por lo que **se requiere Internet** al menos para cargar los CDN.

**En VS Code:** abre la carpeta `visor-sbs` y ejecuta `index.html` con la extensión **Live Server** (opción *Open with Live Server*).

**Alternativa con Python:** en una terminal situada en la carpeta `visor-sbs`, ejecuta:

```bash
python -m http.server 5500
```

Abre `http://localhost:5500/`. **No abras `index.html` con doble clic y `file://`**: los módulos ES y otras funcionalidades requieren un servidor HTTP/HTTPS.

## 3. Cómo usar el visor

1. La app carga **DEMO 01** automáticamente. Comprueba el efecto estereoscópico o abre **DEMO 02**.
2. Haz clic en **Cargar SBS** y selecciona una fotografía SBS (`.jpg`, `.png`, `.webp`, `.avif`, hasta 30 MB). También puedes arrastrarla al visor en computadora.
3. La fotografía debe incluir **la vista izquierda en la mitad izquierda y la derecha en la mitad derecha**. Si están invertidas, utiliza la opción **Intercambiar L/R**.
4. Ajusta parámetros con **lil-gui** o directamente sobre el visor: **un dedo** (o ratón) desplaza las dos vistas, **dos dedos deslizándose** cambian el paralaje horizontal y el desnivel vertical, y **pellizcar** cambia la escala. Es preferible comenzar con *Paralaje 0 px, Escala 100%, Alineación 0 px*.
5. Cuando termines de ajustar, pulsa **🔓 Bloquear imagen** desde el panel principal: cambiará a **🔒 Desbloquear imagen** y todos los gestos y controles de calibración quedarán temporalmente deshabilitados, incluso en pantalla completa y Cardboard. Puedes seguir viendo fotografías y guardar/exportar perfiles sin desbloquear. Pulsa **Desbloquear imagen** para editar otra vez. Si abres otra fotografía mientras está bloqueada, conservará la calibración actual (sin aplicar automáticamente el perfil seleccionado hasta que la desbloquees). El bloqueo se reinicia al recargar la página y no se incluye en los perfiles/JSON.
6. Pulsa **Entrar en modo Cardboard**. En móviles compatibles, el navegador solicitará pantalla completa y orientación horizontal; algunas versiones de iOS Safari no permiten estas funciones para elementos HTML arbitrarios. En ese caso el proyecto usa un modo inmersivo CSS y hay que girar manualmente el teléfono.
7. Coloca el teléfono horizontal en las gafas. **Para salir**, pulsa `Esc` en computadora; en el teléfono, toca dos veces rápidamente la pantalla o usa el botón/gesto del sistema para salir de pantalla completa. Puedes sacar primero el teléfono de las gafas para acceder a la pantalla.
8. Si la imagen resulta incómoda, retira el visor y reduce la escala o el paralaje. No fuerces la fusión de fotografías con disparidad excesiva.
9. **Probar ajuste automático** estima la diferencia de alineación horizontal y vertical entre varias zonas de las dos vistas. Puedes revisar la confianza orientativa, afinar los valores y **Deshacer ajuste automático**.
10. Para reutilizar una calibración, escribe un nombre en **Mis perfiles de calibración** y pulsa **Guardar perfil**. Selecciona un perfil y pulsa **Aplicar perfil** para usarlo sobre la imagen actual. Activa **Aplicar el perfil seleccionado al cargar otra imagen** para que se active automáticamente en próximas fotografías. Al seleccionar otra imagen sin esta opción, se mantienen los ajustes que tengas en pantalla.
11. **Exportar ajustes JSON** descarga un archivo con parámetros y metadatos de la fotografía (sin píxeles); **Importar ajustes JSON** permite restaurarlo desde un archivo en otro dispositivo. Restablecer calibración devuelve los controles a sus valores iniciales.

### Calibración lil-gui

| Control | Descripción | Valor inicial |
|---|---|---|
| Paralaje (px) | Desplaza las vistas en sentidos opuestos para ajustar su alineación/convergencia aparente | 0 |
| Escala (%) | Cambia el tamaño de ambas imágenes sin distorsionar su proporción | 100 |
| Mover X (px) | Desplazamiento horizontal común de las dos vistas | 0 |
| Mover Y (px) | Desplazamiento vertical común de las dos vistas | 0 |
| Desnivel L/R (px) | Corrige la diferencia vertical relativa entre ojos | 0 |
| Tipo de SBS | **Completo:** imágenes de ancho no comprimido. **Half-SBS:** cada mitad comprimida horizontalmente | Completo |
| Intercambiar L/R | Corrige una fotografía cuyo orden de perspectivas está invertido | No |

La calibración digital del paralaje **no cambia la distancia interpupilar física** ni repara una fotografía con disparidades o geometría estéreo erróneas. Las lentes Cardboard pueden requerir calibración óptica/distorsión específica no implementada en este visor introductorio.

## 3.1. Controles táctiles y perfiles

- **Bloqueo para VR:** usa el botón **Bloquear imagen** del panel principal antes de activar pantalla completa o Cardboard. Desactiva los gestos, los controles lil-gui y las acciones que modificarían la calibración; no agrega ningún botón sobre la imagen inmersiva. Puedes seguir cargando fotos y guardar/exportar ajustes. Para editar otra vez, vuelve al panel y pulsa **Desbloquear imagen**.
- **Arrastrar con un dedo:** mueve ambas perspectivas (Mover X y Mover Y). También puedes arrastrar con el ratón desde la computadora.
- **Deslizar con dos dedos en paralelo:** ajusta la diferencia relativa entre ambas vistas. Horizontal = **Paralaje**, vertical = **Desnivel L/R**. Los valores se actualizan también en lil-gui.
- **Separar o juntar dos dedos:** amplía o reduce la escala sin deformar la proporción. Los gestos siguen disponibles en modo Cardboard; el doble toque para salir solo cuenta toques breves, no movimientos ni gestos de dos dedos.
- **Ajuste automático (orientativo):** analiza una versión reducida de cada vista, busca coincidencias locales de bordes y estima una traslación global. Intenta modificar solo **Paralaje** y **Desnivel L/R**, respetando los demás valores. Funciona sin servidor ni red adicional; depende del contenido de la foto y puede informar que no encontró suficientes coincidencias.
- **Limitaciones del automático:** no endereza fotografías giradas, no rectifica perspectiva, no corrige cámaras con focal/escala/óptica distinta, no detecta con certeza Full-SBS frente a Half-SBS ni garantiza confort visual. Siempre verifica el resultado en las gafas. Para fotos de dos teléfonos puede ser necesaria una rectificación previa.
- **Perfiles de calibración:** se guardan en el `localStorage` del navegador actual, asociado al origen del sitio (hasta 20 perfiles). Puedes reemplazar un perfil guardando con el mismo nombre; eliminarlo no afecta las imágenes originales. Si borras los datos del navegador o usas otro teléfono, los perfiles no se trasladan solos.
- **Migrar entre dispositivos:** exporta el JSON, transfiérelo e impórtalo. Si deseas conservarlo como perfil reutilizable en ese dispositivo, guárdalo con un nombre después de importarlo. Los perfiles no incluyen archivos de imagen.
- **Reutilizar parámetros:** proporciona un punto de partida, pero diferentes cámaras, imágenes o resoluciones pueden requerir pequeños reajustes; el `localStorage` puede no estar disponible en todos los modos privados.

## 4. Arquitectura técnica

- `Texture` carga el archivo de imagen en GPU.
- Dos geometrías `PlaneGeometry` recortan las regiones izquierda (`U=0…0.5`) y derecha (`U=0.5…1`) mediante coordenadas UV, sin cortar ni alterar el archivo original.
- Cada plano se dibuja en una escena independiente, con una cámara `OrthographicCamera` compartida y un único `WebGLRenderer`, mediante `setViewport()` y `setScissor()`.
- `viewer.js` calcula la escala de ajuste que conserva el aspecto natural de la imagen en la mitad de la pantalla, y aplica los desplazamientos en píxeles CSS.
- `lil-gui` y `touchControls.js` modifican el mismo objeto compartido de configuración y actualizan las transformaciones inmediatamente.
- `autoCalibration.js` compara gradientes de 9 regiones de una muestra de 256 × 144 px por ojo: estima la mediana de los desplazamientos más coherentes y la convierte a píxeles CSS del visor. No modifica el archivo SBS.
- `profiles.js` valida los valores de calibración y los conserva con nombres en `localStorage` (o importa parámetros desde JSON).
- Las fotos locales se procesan **únicamente en el navegador**. No se suben a servidores.

## 5. Publicar con GitHub Pages

1. Crea un repositorio GitHub, por ejemplo `visor-sbs`.
2. Sube **todo el contenido** de esta carpeta, manteniendo `index.html` en la raíz del repositorio.
3. En el repositorio entra en **Settings → Pages → Build and deployment**.
4. Selecciona **Deploy from a branch**, rama `main` y carpeta `/(root)`. Guarda.
5. Abre la dirección que muestre GitHub Pages, que habitualmente tiene el formato `https://USUARIO.github.io/visor-sbs/`.
6. Desde el navegador del teléfono, visita esa dirección, carga una imagen SBS y utiliza **Modo Cardboard**.

Para crear el repositorio con Git local:

```bash
git init
git add .
git commit -m "Visor SBS con Three.js y lil-gui"
git branch -M main
git remote add origin https://github.com/USUARIO/visor-sbs.git
git push -u origin main
```

Reemplaza `USUARIO` por tu cuenta, y crea primero el repositorio vacío en GitHub. No se incluyen rutas absolutas, así que se puede publicar como *project page* sin reescribir las rutas.

## 6. Evidencias sugeridas

- Captura de la estructura del repositorio en VS Code (HTML, CSS y módulos JS separados).
- Captura del visor con una fotografía propia cargada y sus dos perspectivas visibles.
- Capturas de los controles con valores de calibración antes y después de los ajustes.
- Foto del móvil en las gafas Cardboard y prueba presencial del efecto de profundidad.
- Enlace público de GitHub Pages y archivo `calibracion-sbs.json` descargado.
- Conclusiones técnicas: diferencia entre separación física de lentes, paralaje/desplazamiento digital y formato Half-SBS.

## 7. Resolución de problemas

- **Pantalla negra o panel vacío:** comprueba acceso a Internet para Three.js y lil-gui desde jsDelivr; abre la consola del navegador. Puede estar bloqueado un CDN en la red institucional.
- **No funciona al abrir con doble clic:** usa Live Server o `python -m http.server 5500`.
- **La imagen sale deformada horizontalmente:** verifica la opción *Tipo de SBS*. Half-SBS requiere descomprimir horizontalmente cada ojo.
- **Las vistas están cruzadas:** prueba *Intercambiar L/R*; revisa el archivo original si el problema persiste.
- **Aparece imagen doble:** ajusta primero la escala y luego el paralaje en incrementos pequeños. Si la fotografía tiene un desplazamiento extremo, corrígela en el editor estereoscópico original.
- **El teléfono se mantiene vertical:** activa orientación horizontal manualmente; `screen.orientation.lock()` y pantalla completa no están admitidos en todos los dispositivos.
- **Bordes negros:** el visor preserva la relación de aspecto; esto es intencional para evitar estiramientos.
- **No hay 3D visible:** comprueba que la fotografía contenga dos perspectivas realmente distintas y no dos copias idénticas.

## 8. Referencias

- Three.js — https://threejs.org/docs/
- Instalación por CDN e import map — https://threejs.org/manual/#en/installation
- lil-gui — https://lil-gui.georgealways.com/
- Bootstrap — https://getbootstrap.com/
- GitHub Pages — https://docs.github.com/en/pages

**Licencia educativa:** El código de esta muestra se entrega para ser adaptado y utilizado en clase. Las imágenes de demostración fueron generadas para este proyecto.

## 9. Versión con mejoras

Actualización: octubre de 2026. Incluye botón para bloquear/desbloquear la edición de la fotografía antes de entrar en modo VR, sin alterar el renderizado estereoscópico. Se conservaron las rutas relativas, el visor Three.js, el panel lil-gui, las demostraciones SBS y la compatibilidad con GitHub Pages. Nuevas funciones: arrastre táctil, pellizco, ajuste automático local, deshacer ajuste automático, perfiles persistentes e importación JSON.
