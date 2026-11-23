# Nuevo Pacto Apopa: sitio web

El sitio de la Iglesia Cristiana Nuevo Pacto Apopa. Funciona gratis en **GitHub Pages** y trae un panel de administración en `/admin/` para cambiar las fotos, los eventos, el contacto, los horarios y el mensaje reciente sin tocar código.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página principal |
| `css/styles.css` | Los estilos del sitio y del panel |
| `js/site.js` | Arma la página con los datos de `data/site.json` |
| `data/site.json` | Todo el contenido que se puede editar (contacto, horarios, eventos, mensaje, fotos) |
| `images/` | Las fotos que se suben desde el panel |
| `admin/` | El panel de administración |
| `.nojekyll` | Hace que GitHub Pages publique los archivos tal como están |

## 1. Publicar el sitio en GitHub Pages

1. Crea una cuenta gratis en <https://github.com> (si todavía no tienes).
2. Pulsa **New repository**. Ponle un nombre, por ejemplo `nuevo-pacto-apopa`, déjalo como **Public** y pulsa **Create repository**.
3. En el repositorio nuevo pulsa **uploading an existing file** (o **Add file → Upload files**).
4. Arrastra **todo lo que hay dentro de esta carpeta**: `index.html`, `.nojekyll`, `README.md` y las carpetas `css`, `js`, `data`, `images` y `admin`. Pulsa **Commit changes**.
   - En Windows, `.nojekyll` puede no verse porque empieza con punto. Si no se sube, créalo en GitHub con **Add file → Create new file**, nombre `.nojekyll`, vacío.
5. Entra a **Settings → Pages**. En **Source** elige **Deploy from a branch**, rama **main**, carpeta **/ (root)**, y pulsa **Save**.
6. Espera 1 o 2 minutos. El sitio queda en:

   `https://TU-USUARIO.github.io/nuevo-pacto-apopa/`

   Ese es el link que se comparte.

## 2. Entrar al panel de administración

El panel está en:

`https://TU-USUARIO.github.io/nuevo-pacto-apopa/admin/`

Cualquiera puede ver esa página, pero solo puede guardar cambios quien tenga una **llave de acceso (token)** de GitHub para el repositorio. Para crear la tuya:

1. Abre <https://github.com/settings/personal-access-tokens/new>.
2. **Token name**: por ejemplo `Panel Nuevo Pacto`. En **Expiration** elige la duración (por ejemplo 1 año).
3. **Repository access** → **Only select repositories** → elige `nuevo-pacto-apopa`.
4. **Permissions** → **Repository permissions** → **Contents** → **Read and write**.
5. Pulsa **Generate token** y copia el token (empieza con `github_pat_`). GitHub lo muestra una sola vez.
6. En el panel, revisa que el usuario y el repositorio estén bien (se llenan solos), pega el token y pulsa **Entrar**.
   Marca **Recordar en este dispositivo** solo en tu propia computadora o teléfono.

Cuando pulses **Guardar y publicar**, el sitio se actualiza en 1 a 2 minutos.

### Para que otra persona administre

Agrégala como colaboradora en **Settings → Collaborators** y que cree su propio token con los mismos pasos. No compartas tu token: quien lo tenga puede cambiar el sitio.

## 3. Cambiar el contenido a mano (opcional)

Todo el contenido vive en `data/site.json`. Se puede editar en GitHub con el ícono del lápiz. Las fechas de los eventos van en formato `AAAA-MM-DD` (por ejemplo `2026-12-24`). Los eventos que ya pasaron se ocultan solos.

## Ver el sitio en tu computadora

Al abrir `index.html` con doble clic, el navegador bloquea la lectura de `data/site.json` y la página sale incompleta. Para verlo en tu computadora usa un servidor local, por ejemplo con Python:

```
python -m http.server 8000
```

y abre <http://localhost:8000>.
