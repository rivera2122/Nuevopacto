/* Panel de administración de Nuevo Pacto Apopa.
   Lee y guarda data/site.json y las fotos de images/ usando la API de GitHub.
   Cada "Guardar y publicar" crea un commit; GitHub Pages actualiza el sitio en 1 a 2 minutos. */
(function () {
  "use strict";
  var DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  var DATA_PATH = "data/site.json";
  var STORE_KEY = "np-admin";
  var $ = function (id) { return document.getElementById(id); };

  var cfg = null;          // {owner, repo, branch, token}
  var state = null;        // contenido de site.json
  var dataSha = null;      // sha de site.json en GitHub
  var removed = [];        // fotos quitadas, se borran del repositorio al guardar
  var localUrls = {};      // vista previa de fotos recién subidas
  var dirty = false, saving = false;

  /* ---------- utilidades ---------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "class") el.className = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function b64encodeText(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64decodeText(b64) { return decodeURIComponent(escape(atob(String(b64).replace(/\s/g, "")))); }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  function photoSrc(p) { if (localUrls[p.src]) return localUrls[p.src]; return /^images\/[\w.\-]+$/.test(p.src || "") ? "../" + p.src : ""; }

  /* ---------- GitHub API ---------- */
  function api(method, path, body) {
    var url = "https://api.github.com/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) + path;
    return fetch(url, {
      method: method,
      headers: { "Authorization": "Bearer " + cfg.token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) { var err = new Error((j && j.message) || ("HTTP " + r.status)); err.status = r.status; throw err; }
        return j;
      });
    });
  }
  function contentsPath(p) { return "/contents/" + p.split("/").map(encodeURIComponent).join("/"); }
  function getFile(p) { return api("GET", contentsPath(p) + "?ref=" + encodeURIComponent(cfg.branch)); }
  function putFile(p, b64, message, sha) {
    var body = { message: message, content: b64, branch: cfg.branch };
    if (sha) body.sha = sha;
    return api("PUT", contentsPath(p), body);
  }
  function deleteFile(p, message) {
    return getFile(p).then(function (f) {
      return api("DELETE", contentsPath(p), { message: message, sha: f.sha, branch: cfg.branch });
    }).catch(function (e) { if (e.status !== 404) throw e; });
  }
  function explain(e) {
    if (!e) return "Ocurrió un error.";
    if (e.status === 401) return "El token no es válido o ya venció. Crea uno nuevo.";
    if (e.status === 403) return "El token no tiene permiso para escribir en este repositorio (Contents: Read and write).";
    if (e.status === 404) return "No se encontró el repositorio o el archivo. Revisa el usuario, el repositorio y la rama.";
    if (e.status === 409) return "Alguien más guardó cambios al mismo tiempo. Recarga la página e inténtalo otra vez.";
    if (e.status === 422) return "GitHub rechazó el archivo. Si es una foto, prueba con una más pequeña.";
    if (e instanceof TypeError) return "Sin conexión con GitHub. Revisa tu internet.";
    return "Error de GitHub: " + e.message;
  }

  /* ---------- entrada ---------- */
  function guessRepo() {
    var host = location.hostname, m = host.match(/^([\w-]+)\.github\.io$/i);
    if (!m) return null;
    var seg = location.pathname.split("/").filter(Boolean);
    var repo = seg.length && seg[0] !== "admin" ? seg[0] : m[1] + ".github.io";
    return { owner: m[1], repo: repo };
  }
  function loadSaved() {
    try { var s = localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function persist(c, remember) {
    try {
      localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY);
      (remember ? localStorage : sessionStorage).setItem(STORE_KEY, JSON.stringify(c));
    } catch (e) {}
  }
  function forget() { try { localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY); } catch (e) {} }

  function showLogin(msg) {
    $("aLogin").hidden = false; $("aMain").hidden = true;
    $("aSave").hidden = true; $("aLogout").hidden = true; $("aStatus").textContent = "";
    var g = guessRepo(), s = loadSaved();
    $("gOwner").value = (s && s.owner) || (g && g.owner) || "";
    $("gRepo").value = (s && s.repo) || (g && g.repo) || "";
    $("gBranch").value = (s && s.branch) || "main";
    var e = $("loginErr"); e.hidden = !msg; e.textContent = msg || "";
  }

  function connect(c) {
    cfg = c;
    $("aStatus").textContent = "Conectando…";
    return api("GET", "").then(function (repo) {
      if (repo && repo.permissions && repo.permissions.push === false) { var er = new Error("sin permiso"); er.status = 403; throw er; }
      return getFile(DATA_PATH);
    }).then(function (f) {
      dataSha = f.sha;
      state = JSON.parse(b64decodeText(f.content));
      ["contact", "social", "message"].forEach(function (k) { state[k] = state[k] || {}; });
      ["schedule", "events", "photos"].forEach(function (k) { state[k] = Array.isArray(state[k]) ? state[k] : []; });
      openPanel();
    });
  }

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var c = { owner: $("gOwner").value.trim(), repo: $("gRepo").value.trim(), branch: $("gBranch").value.trim() || "main", token: $("gToken").value.trim() };
    var btn = $("loginBtn"); btn.disabled = true; btn.textContent = "Entrando…";
    connect(c).then(function () { persist(c, $("gRemember").checked); $("gToken").value = ""; }, function (err) { cfg = null; showLogin(explain(err)); })
      .then(function () { btn.disabled = false; btn.textContent = "Entrar"; });
  });
  $("aLogout").addEventListener("click", function () {
    if (dirty) { $("aStatus").textContent = "Guarda o descarta tus cambios antes de salir."; $("aLogout").textContent = "Salir sin guardar"; if (!$("aLogout").dataset.armed) { $("aLogout").dataset.armed = "1"; return; } }
    forget(); location.reload();
  });

  /* ---------- panel ---------- */
  function setDirty() {
    dirty = true;
    var st = $("aStatus"); st.textContent = "Cambios sin guardar"; st.classList.add("dirty");
    $("aSave").disabled = saving;
  }
  function getK(path) { var p = path.split("."); return state[p[0]][p[1]]; }
  function setK(path, v) { var p = path.split("."); state[p[0]][p[1]] = v; }

  var uid = 0;
  function inp(val, onv, type) {
    var el = h("input", { id: "x" + (++uid), type: type || "text" }); el.value = val || "";
    el.addEventListener("input", function () { onv(el.value); setDirty(); });
    return el;
  }
  function labelFor(el, text, cls) {
    return h("div", { class: "field" + (cls ? " " + cls : "") }, [h("label", { for: el.id, text: text }), el]);
  }

  function renderSched() {
    var box = $("aSched"); box.textContent = "";
    state.schedule.forEach(function (x, i) {
      var sel = h("select", { id: "sd" + (++uid) }, DAYS.map(function (d) { return h("option", { value: d, text: d }); }));
      sel.value = x.day; sel.addEventListener("change", function () { x.day = sel.value; setDirty(); });
      box.appendChild(h("div", { class: "row sched" }, [
        labelFor(sel, "Día"),
        labelFor(inp(x.time, function (v) { x.time = v; }), "Hora"),
        labelFor(inp(x.name, function (v) { x.name = v; }), "Nombre del servicio", "name"),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Quitar servicio", title: "Quitar", onclick: function () { state.schedule.splice(i, 1); renderSched(); setDirty(); } }, ["✕"])
      ]));
    });
  }
  function renderEvents() {
    var box = $("aEvents"); box.textContent = "";
    if (!state.events.length) box.appendChild(h("p", { class: "empty", text: "No hay eventos. Agrega el primero con el botón de abajo." }));
    state.events.forEach(function (e, i) {
      var ta = h("textarea", { id: "ed" + (++uid) }); ta.value = e.desc || "";
      ta.addEventListener("input", function () { e.desc = ta.value; setDirty(); });
      var past = e.date && e.date < todayISO();
      box.appendChild(h("div", { class: "row event" }, [
        labelFor(inp(e.date, function (v) { e.date = v; }, "date"), past ? "Fecha (ya pasó)" : "Fecha"),
        labelFor(inp(e.time, function (v) { e.time = v; }), "Hora"),
        labelFor(inp(e.title, function (v) { e.title = v; }), "Título", "title"),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Eliminar evento", title: "Eliminar", onclick: function () { state.events.splice(i, 1); renderEvents(); setDirty(); } }, ["✕"]),
        labelFor(ta, "Descripción", "desc")
      ]));
    });
  }
  function renderPhotos() {
    var box = $("aPhotos"); box.textContent = "";
    if (!state.photos.length) box.appendChild(h("p", { class: "empty", text: "Todavía no hay fotos. Mientras no subas fotos, la portada muestra el amanecer sobre el volcán." }));
    state.photos.forEach(function (p, i) {
      var cb = h("input", { type: "checkbox", id: "ph" + (++uid) }); cb.checked = !!p.hero;
      cb.addEventListener("change", function () { p.hero = cb.checked; setDirty(); });
      var alt = inp(p.alt, function (v) { p.alt = v; });
      alt.setAttribute("placeholder", "Descripción (opcional)"); alt.setAttribute("aria-label", "Descripción de la foto");
      box.appendChild(h("div", { class: "photo" }, [
        h("img", { src: photoSrc(p), alt: "" }),
        h("div", { class: "pbody" }, [
          alt,
          h("div", { class: "ptools" }, [
            h("label", { class: "chk", for: cb.id }, [cb, "En portada"]),
            h("div", { class: "grp" }, [
              h("button", { type: "button", class: "icon-btn plain", "aria-label": "Mover antes", disabled: i === 0, onclick: function () { move(i, -1); } }, ["←"]),
              h("button", { type: "button", class: "icon-btn plain", "aria-label": "Mover después", disabled: i === state.photos.length - 1, onclick: function () { move(i, 1); } }, ["→"]),
              h("button", { type: "button", class: "icon-btn", "aria-label": "Quitar foto", title: "Quitar del sitio", onclick: function () { removed.push(p.src); state.photos.splice(i, 1); renderPhotos(); setDirty(); } }, ["✕"])
            ])
          ])
        ])
      ]));
    });
    function move(i, d) { var a = state.photos, t = a[i]; a[i] = a[i + d]; a[i + d] = t; renderPhotos(); setDirty(); }
  }

  function bindFields() {
    document.querySelectorAll("[data-k]").forEach(function (el) {
      el.value = getK(el.dataset.k) || "";
      el.addEventListener("input", function () { setK(el.dataset.k, el.value); setDirty(); });
    });
  }

  /* ---------- fotos ---------- */
  function shrink(file) {
    return new Promise(function (resolve) {
      if (!window.createImageBitmap) return resolve(file);
      createImageBitmap(file).then(function (bmp) {
        var max = 1920, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
        var c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        c.toBlob(function (b) { resolve(b || file); }, "image/jpeg", 0.84);
      }, function () { resolve(file); });
    });
  }
  function uploadFiles(files) {
    var list = Array.prototype.filter.call(files, function (f) { return /^image\/(jpeg|png|webp)$/.test(f.type); });
    var msg = $("aUpMsg");
    if (!list.length) { msg.hidden = false; msg.className = "err"; msg.textContent = "Elige fotos en formato JPG, PNG o WEBP."; return; }
    var done = 0, failed = 0, lastErr = null;
    msg.hidden = false; msg.className = "uploading"; msg.textContent = "Subiendo 0 de " + list.length + "…";
    list.reduce(function (chain, f) {
      return chain.then(function () {
        return shrink(f).then(function (b) {
          var ext = b.type === "image/jpeg" ? "jpg" : (b.type.split("/")[1] || "jpg");
          var path = "images/foto-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "." + ext;
          return blobToB64(b).then(function (b64) { return putFile(path, b64, "Subir foto " + path); }).then(function () {
            localUrls[path] = URL.createObjectURL(b);
            state.photos.push({ src: path, alt: "", hero: true });
            done++; renderPhotos(); setDirty();
          });
        }).catch(function (err) { failed++; lastErr = err; }).then(function () {
          msg.textContent = "Subiendo " + (done + failed) + " de " + list.length + "…";
        });
      });
    }, Promise.resolve()).then(function () {
      if (failed) { msg.className = "err"; msg.textContent = done + " fotos subidas, " + failed + " con error. " + explain(lastErr); }
      else { msg.className = "uploading"; msg.textContent = (done === 1 ? "1 foto subida." : done + " fotos subidas.") + " Pulsa “Guardar y publicar” para que aparezcan en el sitio."; }
    });
  }

  /* ---------- guardar ---------- */
  function save() {
    if (saving) return;
    saving = true; $("aSave").disabled = true;
    var st = $("aStatus"); st.textContent = "Publicando…"; st.classList.remove("dirty");
    var json = JSON.stringify(state, null, 2) + "\n";
    putFile(DATA_PATH, b64encodeText(json), "Actualizar contenido del sitio", dataSha).then(function (r) {
      dataSha = r && r.content && r.content.sha;
      var toDelete = removed.slice(); removed = [];
      return toDelete.reduce(function (ch, p) {
        return ch.then(function () { if (/^images\/[\w.\-]+$/.test(p)) return deleteFile(p, "Quitar foto " + p).catch(function () {}); });
      }, Promise.resolve());
    }).then(function () {
      dirty = false; st.textContent = "Publicado";
      var n = $("aNotice"); n.hidden = false; n.textContent = "Cambios guardados. El sitio se actualiza en 1 a 2 minutos.";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, function (err) {
      st.textContent = explain(err); st.classList.add("dirty"); $("aSave").disabled = false;
    }).then(function () { saving = false; });
  }

  var bound = false;
  function openPanel() {
    $("aLogin").hidden = true; $("aMain").hidden = false;
    $("aSave").hidden = false; $("aLogout").hidden = false;
    $("aStatus").textContent = "Sin cambios"; $("aStatus").classList.remove("dirty");
    renderSched(); renderEvents(); renderPhotos();
    if (bound) return; bound = true;
    bindFields();
    $("aAddSched").addEventListener("click", function () { state.schedule.push({ day: "Domingo", time: "", name: "" }); renderSched(); setDirty(); });
    $("aAddEvent").addEventListener("click", function () { state.events.push({ date: todayISO(), time: "", title: "", desc: "" }); renderEvents(); setDirty(); var r = $("aEvents").lastChild; if (r) r.querySelector("input").focus(); });
    $("aSave").addEventListener("click", save);
    $("aFile").addEventListener("change", function (e) { uploadFiles(e.target.files); e.target.value = ""; });
    var drop = $("aDrop");
    ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { if (e.dataTransfer) uploadFiles(e.dataTransfer.files); });
  }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- inicio ---------- */
  var saved = loadSaved();
  if (saved && saved.token) connect(saved).catch(function (err) { forget(); showLogin(explain(err)); });
  else showLogin();
})();
