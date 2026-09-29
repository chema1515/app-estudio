# PlanUp

*Si todos pueden, tú también.*

Web para organizar tu plan de estudio en tus horas libres. Está hecha con HTML, CSS y JavaScript, sin dependencias ni proceso de compilación, así que funciona tal cual en GitHub Pages.

## Cómo funciona

1. Eliges los días de la semana en los que quieres estudiar.
2. Eliges tu sesión dentro de las horas libres. Ocupado: de 8:00 a 15:00 y de 22:00 a 6:30.
3. Añades tus asignaturas, con apuntes escritos o fotos, y marcas las que quieres reforzar.
4. Añades tus próximos exámenes.
5. PlanUp reparte la sesión entre las asignaturas y da más tiempo a las de refuerzo y a las que tienen un examen cerca. Cada sesión termina con un repaso de todo lo visto ese día.

Los datos se guardan solo en el navegador (`localStorage`). La opción de pasar fotos a texto carga Tesseract.js desde una CDN cuando se usa, así que necesita conexión.

## Publicar en GitHub Pages

1. Crea un repositorio y sube `index.html`, `style.css` y `app.js` a la raíz.
2. En el repositorio, entra en Settings, luego Pages.
3. En Source elige "Deploy from a branch", la rama `main` y la carpeta `/ (root)`.
4. Guarda. En uno o dos minutos la web estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.
