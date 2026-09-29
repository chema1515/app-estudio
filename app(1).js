(() => {
  'use strict';

  /* ---------- Constantes ---------- */
  const CLAVE = 'planup.v1';
  const DIAS = [
    { n: 1, c: 'L', l: 'Lunes' }, { n: 2, c: 'M', l: 'Martes' }, { n: 3, c: 'X', l: 'Miércoles' },
    { n: 4, c: 'J', l: 'Jueves' }, { n: 5, c: 'V', l: 'Viernes' }, { n: 6, c: 'S', l: 'Sábado' },
    { n: 0, c: 'D', l: 'Domingo' }
  ];
  // Horas libres en minutos: 6:30 a 8:00 y 15:00 a 22:00 (ocupado: 8:00 a 15:00 y 22:00 a 6:30)
  const LIBRES = [[390, 480], [900, 1320]];
  const PASOS = ['Días', 'Horario', 'Asignaturas', 'Exámenes', 'Tu plan'];
  const COLORES = ['#2f5bff', '#d6336c', '#12876a', '#e8710a', '#7b5cfa', '#2f9e44', '#b8860b', '#0b7285'];
  const SUGERIDAS = ['Matemáticas', 'Lengua', 'Inglés', 'Historia', 'Biología', 'Física', 'Química', 'Filosofía'];

  /* ---------- Utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const enMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const hora = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const dur = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`; };
  const isoDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const deIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const hoyFecha = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const difDias = (a, b) => Math.round((b - a) / 86400000);
  const fechaLarga = d => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const redondea5 = m => Math.round(m / 5) * 5;

  /* ---------- Estado ---------- */
  const defecto = () => ({
    paso: 0, max: 0,
    dias: [1, 2, 3, 4, 5],
    hueco: { ini: '16:00', fin: '20:00' },
    asig: [], examenes: [], hechos: {}
  });

  function cargar() {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE));
      return { ...defecto(), ...(g || {}) };
    } catch { return defecto(); }
  }
  let est = cargar();

  const nuevoBorrador = () => ({ id: null, nombre: '', notas: '', fotos: [], reforzar: false });
  let borrador = nuevoBorrador();

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(est)); }
    catch { aviso('No se pudo guardar: las fotos ocupan demasiado. Prueba con menos fotos.'); }
  }

  let temporizador;
  function aviso(msg) {
    const a = $('#aviso');
    a.textContent = msg;
    a.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(() => a.classList.remove('visible'), 3800);
  }

  /* ---------- Navegación ---------- */
  function pintarPasos() {
    $('#pasos').innerHTML = `<ol>${PASOS.map((n, i) => `
      <li><button class="paso ${i === est.paso ? 'activo' : ''} ${i < est.paso ? 'hecho' : ''}" data-acc="ir" data-i="${i}"
        ${i > est.max ? 'disabled' : ''} ${i === est.paso ? 'aria-current="step"' : ''}>
        <span class="num">${i < est.paso ? '✓' : i + 1}</span><span class="nom">${n}</span>
      </button></li>`).join('')}</ol>`;
  }

  function pintar() {
    pintarPasos();
    const vista = [vDias, vHorario, vAsig, vExam, vPlan][est.paso];
    $('#app').innerHTML = vista();
    if (est.paso === 1) actualizarHueco();
  }

  function irA(i) {
    est.paso = Math.max(0, Math.min(PASOS.length - 1, i));
    est.max = Math.max(est.max, est.paso);
    guardar();
    pintar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#app').focus({ preventScroll: true });
  }

  function pie() {
    const ultimo = est.paso === PASOS.length - 1;
    return `<div class="pie">
      ${est.paso > 0 ? '<button class="ghost" data-acc="atras">Atrás</button>' : '<span></span>'}
      ${ultimo ? '' : `<button class="primario" data-acc="sig">${est.paso === 3 ? 'Crear mi plan' : 'Continuar'}</button>`}
    </div><p class="error" id="err" role="alert"></p>`;
  }

  function validar(p) {
    if (p === 0 && !est.dias.length) return 'Elige al menos un día de estudio.';
    if (p === 1) return valHueco();
    if (p === 2) {
      if (borrador.nombre.trim()) return 'Guarda la asignatura que estás escribiendo antes de continuar.';
      if (!est.asig.length) return 'Añade al menos una asignatura.';
    }
    return '';
  }

  /* ---------- Paso 1: días ---------- */
  function resumenDias() {
    const nombres = DIAS.filter(d => est.dias.includes(d.n)).map(d => d.l.toLowerCase());
    if (!nombres.length) return 'Todavía no has elegido ningún día.';
    return `Estudiarás ${nombres.length} ${nombres.length === 1 ? 'día' : 'días'} a la semana: ${nombres.join(', ')}.`;
  }

  function vDias() {
    return `<section class="panel">
      <h2>¿Qué días quieres estudiar?</h2>
      <p class="sub">Marca los días de la semana en los que tendrás sesión de estudio.</p>
      <div class="dias" role="group" aria-label="Días de estudio">
        ${DIAS.map(d => `<button class="dia" data-acc="dia" data-n="${d.n}" aria-pressed="${est.dias.includes(d.n)}">
          <b>${d.c}</b><span>${d.l}</span></button>`).join('')}
      </div>
      <div class="atajos">
        <button class="chip" data-acc="dias-set" data-v="1,2,3,4,5">Entre semana</button>
        <button class="chip" data-acc="dias-set" data-v="1,2,3,4,5,6,0">Todos los días</button>
        <button class="chip" data-acc="dias-set" data-v="6,0">Fin de semana</button>
      </div>
      <p class="estado">${resumenDias()}</p>
      ${pie()}
    </section>`;
  }

  /* ---------- Paso 2: horario libre ---------- */
  function valHueco() {
    const { ini: a, fin: b } = est.hueco;
    if (!a || !b) return 'Indica la hora de inicio y la de fin.';
    const i = enMin(a), f = enMin(b);
    if (f - i < 30) return 'La sesión debe durar al menos 30 minutos.';
    if (!LIBRES.some(([x, y]) => i >= x && f <= y)) {
      return 'La sesión debe caber en tus horas libres: de 6:30 a 8:00 o de 15:00 a 22:00.';
    }
    return '';
  }

  function vHorario() {
    const presets = [['15:00', '18:00'], ['16:00', '20:00'], ['17:00', '21:00'], ['06:30', '08:00']];
    return `<section class="panel">
      <h2>¿En qué hueco libre estudias?</h2>
      <p class="sub">Tu tiempo ocupado va de 8:00 a 15:00 y de 22:00 a 6:30 del día siguiente. Elige tu sesión dentro de las horas libres.</p>
      <div class="reloj" id="reloj"></div>
      <div class="horas">
        <label>Empiezo a las <input type="time" id="hIni" step="300" value="${est.hueco.ini}" data-campo="hueco"></label>
        <label>Termino a las <input type="time" id="hFin" step="300" value="${est.hueco.fin}" data-campo="hueco"></label>
      </div>
      <div class="atajos">
        ${presets.map(([a, b]) => `<button class="chip" data-acc="hueco-set" data-a="${a}" data-b="${b}">${hora(enMin(a))} a ${hora(enMin(b))}</button>`).join('')}
      </div>
      <p class="estado" id="resHueco"></p>
      ${pie()}
    </section>`;
  }

  function actualizarHueco() {
    const reloj = $('#reloj');
    if (!reloj) return;
    const seg = (a, b, cls, txt) => `<div class="seg ${cls}" style="left:${a / 14.4}%;width:${(b - a) / 14.4}%" title="${txt}"></div>`;
    const err = valHueco();
    const i = est.hueco.ini ? redondea5(enMin(est.hueco.ini)) : NaN;
    const f = est.hueco.fin ? redondea5(enMin(est.hueco.fin)) : NaN;
    const sesion = (f > i) ? `<div class="sesion ${err ? 'mala' : ''}" style="left:${i / 14.4}%;width:${(f - i) / 14.4}%">
      <span>${hora(i)} a ${hora(f)}</span></div>` : '';
    reloj.innerHTML = `
      <div class="barra" role="img" aria-label="Día de 24 horas con tus horas ocupadas, libres y tu sesión de estudio">
        ${seg(0, 390, 'oc', 'Ocupado')}${seg(390, 480, 'lib', 'Libre')}${seg(480, 900, 'oc', 'Ocupado')}${seg(900, 1320, 'lib', 'Libre')}${seg(1320, 1440, 'oc', 'Ocupado')}
        ${sesion}
      </div>
      <div class="marcas" aria-hidden="true">${[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => `<span style="left:${h / 24 * 100}%">${h}</span>`).join('')}</div>
      <ul class="leyenda"><li><i class="k oc"></i>Ocupado</li><li><i class="k lib"></i>Libre</li><li><i class="k ses"></i>Tu sesión</li></ul>`;
    const res = $('#resHueco');
    if (err) { res.textContent = err; res.style.color = 'var(--coral)'; return; }
    const total = f - i;
    const rep = total >= 90 ? 30 : total >= 45 ? 15 : 0;
    res.style.color = '';
    res.textContent = `${dur(total)} de sesión` + (rep ? `, con ${rep} min de repaso final de lo visto ese día.` : '.');
  }

  /* ---------- Paso 3: asignaturas ---------- */
  function vAsig() {
    const editando = !!borrador.id;
    const sugeridas = SUGERIDAS.filter(n => !est.asig.some(a => a.nombre === n));
    return `<section class="panel">
      <h2>Elige tus asignaturas</h2>
      <p class="sub">Añade cada asignatura con lo que vas a estudiar: escríbelo o sube fotos de tus apuntes. Marca las que quieras reforzar.</p>
      ${sugeridas.length && !editando ? `<div class="atajos" aria-label="Asignaturas frecuentes">${sugeridas.map(n => `<button class="chip" data-acc="sug" data-n="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>` : ''}
      <form class="form" id="fAsig" novalidate>
        <label>Nombre de la asignatura
          <input type="text" id="bNombre" data-campo="b-nombre" value="${esc(borrador.nombre)}" maxlength="40" placeholder="Por ejemplo, Matemáticas" autocomplete="off">
        </label>
        <label>Qué vas a estudiar
          <textarea id="bNotas" data-campo="b-notas" placeholder="Temas, apartados o ejercicios pendientes">${esc(borrador.notas)}</textarea>
        </label>
        <div class="subir">
          <label>Fotos de tus apuntes
            <input type="file" id="bFotos" accept="image/*" multiple>
          </label>
        </div>
        ${borrador.fotos.length ? `<div class="minis">${borrador.fotos.map((f, i) => `
          <figure class="mini"><img src="${f}" alt="Foto ${i + 1} de apuntes">
          <button type="button" data-acc="quitar-foto" data-i="${i}" aria-label="Quitar foto ${i + 1}">×</button></figure>`).join('')}</div>
          <div class="acciones-form"><button type="button" class="ghost peq" data-acc="ocr">Pasar las fotos a texto</button><span class="estado" id="ocrEstado"></span></div>` : ''}
        <label class="check"><input type="checkbox" id="bRef" data-campo="b-ref" ${borrador.reforzar ? 'checked' : ''}> Quiero reforzar esta asignatura</label>
        <div class="acciones-form">
          <button type="submit" class="primario">${editando ? 'Actualizar asignatura' : 'Guardar asignatura'}</button>
          ${editando ? '<button type="button" class="ghost" data-acc="cancelar-edicion">Cancelar</button>' : ''}
        </div>
      </form>
      ${est.asig.length ? `<ul class="lista">${est.asig.map(a => {
        const meta = [a.fotos.length ? `${a.fotos.length} ${a.fotos.length === 1 ? 'foto' : 'fotos'}` : '', a.notas.trim() ? 'apuntes escritos' : ''].filter(Boolean).join(', ') || 'Sin apuntes todavía';
        return `<li class="asig" style="--c:${a.color}">
          <div><strong>${esc(a.nombre)}</strong>${a.reforzar ? '<span class="etq ref">Refuerzo</span>' : ''}<p class="meta">${meta}</p></div>
          <div class="acc"><button class="ghost peq" data-acc="editar" data-id="${a.id}">Editar</button>
          <button class="ghost peq" data-acc="borrar" data-id="${a.id}">Eliminar</button></div></li>`;
      }).join('')}</ul>` : '<p class="vacio">Aún no has añadido asignaturas. Empieza por la primera que quieras estudiar.</p>'}
      ${pie()}
    </section>`;
  }

  function guardarAsig() {
    const nombre = borrador.nombre.trim();
    if (!nombre) { aviso('Escribe el nombre de la asignatura.'); $('#bNombre')?.focus(); return; }
    const datos = { nombre, notas: borrador.notas, fotos: borrador.fotos, reforzar: borrador.reforzar };
    if (borrador.id) {
      const a = est.asig.find(x => x.id === borrador.id);
      if (a) Object.assign(a, datos);
    } else {
      est.asig.push({ id: uid(), color: COLORES[est.asig.length % COLORES.length], ...datos });
    }
    borrador = nuevoBorrador();
    guardar();
    pintar();
    aviso('Asignatura guardada.');
  }

  function reducir(file) {
    return new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, 1200 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = ko;
        img.src = r.result;
      };
      r.onerror = ko;
      r.readAsDataURL(file);
    });
  }

  async function subirFotos(files) {
    const libres = 8 - borrador.fotos.length;
    if (libres <= 0) { aviso('Cada asignatura admite hasta 8 fotos.'); return; }
    let fallo = false;
    for (const f of [...files].slice(0, libres)) {
      try { borrador.fotos.push(await reducir(f)); } catch { fallo = true; }
    }
    if (fallo) aviso('Alguna foto no se pudo leer. Prueba con JPG o PNG.');
    pintar();
  }

  function cargarScript(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }

  async function leerFotos() {
    const estado = $('#ocrEstado');
    const msg = t => { if (estado) estado.textContent = t; };
    try {
      msg('Preparando el lector de texto…');
      if (!window.Tesseract) await cargarScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      let texto = '';
      for (let i = 0; i < borrador.fotos.length; i++) {
        msg(`Leyendo la foto ${i + 1} de ${borrador.fotos.length}…`);
        const r = await window.Tesseract.recognize(borrador.fotos[i], 'spa');
        texto += r.data.text.trim() + '\n\n';
      }
      texto = texto.trim();
      if (texto) {
        borrador.notas = borrador.notas ? `${borrador.notas}\n\n${texto}` : texto;
        pintar();
        aviso('Texto añadido a tus apuntes. Revísalo y corrige lo que haga falta.');
      } else {
        msg('No se encontró texto en las fotos.');
      }
    } catch {
      msg('No se pudo leer el texto. Comprueba tu conexión e inténtalo de nuevo.');
    }
  }

  /* ---------- Paso 4: exámenes ---------- */
  function cuenta(fecha) {
    const d = difDias(hoyFecha(), deIso(fecha));
    if (d < 0) return 'Ya pasó';
    if (d === 0) return 'Hoy';
    if (d === 1) return 'Mañana';
    return `En ${d} días`;
  }

  function vExam() {
    const lista = [...est.examenes].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return `<section class="panel">
      <h2>¿Qué exámenes tienes cerca?</h2>
      <p class="sub">Los exámenes próximos pasan por delante en tu plan. Puedes dejarlo vacío si todavía no tienes fechas.</p>
      <form class="form" id="fEx" novalidate>
        <div class="fila">
          <label>Asignatura
            <select id="exAsig">${est.asig.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')}</select>
          </label>
          <label>Fecha del examen
            <input type="date" id="exFecha" min="${isoDe(hoyFecha())}">
          </label>
        </div>
        <label>Temas que entran (opcional)
          <input type="text" id="exTema" maxlength="80" placeholder="Por ejemplo, temas 3 a 5">
        </label>
        <div class="acciones-form"><button type="submit" class="primario">Añadir examen</button></div>
        <p class="error" id="errEx" role="alert"></p>
      </form>
      ${lista.length ? `<ul class="lista">${lista.map(x => {
        const a = est.asig.find(s => s.id === x.asigId);
        if (!a) return '';
        return `<li class="examen" style="--c:${a.color}">
          <div><strong>${esc(a.nombre)}</strong><span class="etq exa">${cuenta(x.fecha)}</span>
          <p class="meta">${fechaLarga(deIso(x.fecha))}${x.tema ? `. ${esc(x.tema)}` : ''}</p></div>
          <button class="ghost peq" data-acc="borrar-ex" data-id="${x.id}">Eliminar</button></li>`;
      }).join('')}</ul>` : '<p class="vacio">Sin exámenes por ahora. Añade el próximo para que el plan le dé prioridad.</p>'}
      ${pie()}
    </section>`;
  }

  function guardarEx() {
    const asigId = $('#exAsig').value, fecha = $('#exFecha').value, tema = $('#exTema').value.trim();
    const err = $('#errEx');
    if (!asigId) { err.textContent = 'Elige una asignatura.'; return; }
    if (!fecha) { err.textContent = 'Elige la fecha del examen.'; return; }
    if (difDias(hoyFecha(), deIso(fecha)) < 0) { err.textContent = 'La fecha ya pasó. Elige una fecha desde hoy.'; return; }
    est.examenes.push({ id: uid(), asigId, fecha, tema });
    guardar();
    pintar();
    aviso('Examen añadido.');
  }

  /* ---------- Paso 5: plan ---------- */
  function repartir(total, pesos) {
    const suma = pesos.reduce((a, b) => a + b, 0);
    const m = pesos.map(p => Math.max(15, redondea5(total * p / suma)));
    let dif = total - m.reduce((a, b) => a + b, 0), g = 0;
    while (dif !== 0 && g++ < 400) {
      if (dif > 0) { m[m.indexOf(Math.min(...m))] += 5; dif -= 5; }
      else {
        const mx = Math.max(...m);
        if (mx <= 15) break;
        m[m.indexOf(mx)] -= 5; dif += 5;
      }
    }
    return m;
  }

  function generarPlan() {
    const n = est.asig.length;
    if (!n) return [];
    const base = hoyFecha();
    const i = redondea5(enMin(est.hueco.ini)), f = redondea5(enMin(est.hueco.fin));
    const total = f - i;
    const rep = total >= 90 ? 30 : total >= 45 ? 15 : 0;
    const estudio = total - rep;
    const salida = [];

    for (let k = 0; k < 7; k++) {
      const fecha = new Date(base.getFullYear(), base.getMonth(), base.getDate() + k);
      if (!est.dias.includes(fecha.getDay())) continue;
      const iso = isoDe(fecha);

      const info = est.asig.map((a, idx) => {
        const prox = est.examenes.filter(x => x.asigId === a.id)
          .map(x => difDias(fecha, deIso(x.fecha))).filter(d => d >= 0).sort((p, q) => p - q)[0];
        let peso = 1;
        const motivos = [];
        if (a.reforzar) { peso += 1; motivos.push({ t: 'Refuerzo', c: 'ref' }); }
        if (prox !== undefined && prox <= 14) {
          peso += prox <= 2 ? 3 : prox <= 7 ? 2 : 1;
          motivos.push({ t: prox === 0 ? 'Examen hoy' : prox === 1 ? 'Examen mañana' : `Examen en ${prox} días`, c: 'exa' });
        }
        return { a, peso, motivos, orden: peso - ((idx + k) % n) / 1000 };
      }).sort((p, q) => q.orden - p.orden);

      const cuantas = Math.max(1, Math.min(n, Math.floor(estudio / 20)));
      const elegidas = info.slice(0, cuantas);
      const mins = repartir(estudio, elegidas.map(x => x.peso));

      let t = i;
      const bloques = [];
      elegidas.forEach((x, j) => {
        bloques.push({ tipo: 'estudio', asigId: x.a.id, ini: t, fin: t + mins[j], motivos: x.motivos, clave: `${iso}|e|${x.a.id}` });
        t += mins[j];
      });
      if (rep) bloques.push({ tipo: 'repaso', asigIds: elegidas.map(x => x.a.id), ini: t, fin: t + rep, motivos: [], clave: `${iso}|r` });
      salida.push({ fecha, iso, esHoy: k === 0, bloques });
    }
    return salida;
  }

  function vPlan() {
    const plan = generarPlan();
    const todos = plan.flatMap(d => d.bloques);
    const hechos = todos.filter(b => est.hechos[b.clave]).length;
    const pct = todos.length ? Math.round(hechos / todos.length * 100) : 0;
    const minutos = todos.reduce((s, b) => s + (b.fin - b.ini), 0);
    const proximos = est.examenes.filter(x => difDias(hoyFecha(), deIso(x.fecha)) >= 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 4);
    const libres = DIAS.filter(d => !est.dias.includes(d.n)).map(d => d.l.toLowerCase());

    return `<section class="panel">
      <h2>Tu plan de la semana</h2>
      <p class="sub">Sesión de ${hora(enMin(est.hueco.ini))} a ${hora(enMin(est.hueco.fin))}. Marca cada bloque cuando lo termines.</p>
      <div class="resumen">
        <div class="cifras">
          <div><b>${plan.length}</b><span>${plan.length === 1 ? 'sesión' : 'sesiones'}</span></div>
          <div><b>${dur(minutos)}</b><span>de estudio</span></div>
          <div><b>${pct}%</b><span>completado</span></div>
        </div>
        <div class="progreso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progreso del plan"><i style="width:${pct}%"></i></div>
        <div class="examenes-mini">${proximos.length
          ? proximos.map(x => { const a = est.asig.find(s => s.id === x.asigId); return a ? `<span class="etq exa">${esc(a.nombre)}: ${cuenta(x.fecha).toLowerCase()}</span>` : ''; }).join('')
          : '<span class="meta">Sin exámenes a la vista. Puedes añadirlos desde Exámenes.</span>'}</div>
      </div>
      ${plan.map(d => `
        <article class="dia-plan">
          <h3>${fechaLarga(d.fecha)} ${d.esHoy ? '<span class="etq hoy">Hoy</span>' : ''}</h3>
          <ul class="bloques">${d.bloques.map(b => bloqueHtml(b)).join('')}</ul>
        </article>`).join('')}
      ${libres.length ? `<p class="libres">Días sin estudio: ${libres.join(', ')}.</p>` : ''}
      <div class="acciones-plan">
        <button class="ghost peq" data-acc="ir" data-i="0">Cambiar días</button>
        <button class="ghost peq" data-acc="ir" data-i="1">Cambiar horario</button>
        <button class="ghost peq" data-acc="ir" data-i="2">Asignaturas</button>
        <button class="ghost peq" data-acc="ir" data-i="3">Exámenes</button>
        <button class="ghost peq" data-acc="imprimir">Imprimir</button>
        <button class="ghost peq" data-acc="reiniciar">Empezar de cero</button>
      </div>
      <p class="estado">Si todos pueden, tú también.</p>
    </section>`;
  }

  function bloqueHtml(b) {
    const hecho = !!est.hechos[b.clave];
    const ok = `<button class="ok" data-acc="hecho" data-k="${esc(b.clave)}" aria-pressed="${hecho}" aria-label="Marcar como hecho">${hecho ? '✓' : ''}</button>`;
    const horaTxt = `<span class="hora">${hora(b.ini)} a ${hora(b.fin)}</span>`;
    if (b.tipo === 'repaso') {
      const nombres = b.asigIds.map(id => est.asig.find(a => a.id === id)?.nombre).filter(Boolean).map(esc).join(', ');
      return `<li class="bloque repaso ${hecho ? 'hecho' : ''}">${ok}${horaTxt}
        <div class="cuerpo"><strong>Repaso del día</strong><small>Repasa lo visto hoy: ${nombres}.</small></div><span></span></li>`;
    }
    const a = est.asig.find(x => x.id === b.asigId);
    if (!a) return '';
    const tieneApuntes = a.notas.trim() || a.fotos.length;
    return `<li class="bloque ${hecho ? 'hecho' : ''}" style="--c:${a.color}">${ok}${horaTxt}
      <div class="cuerpo"><strong>${esc(a.nombre)}</strong>
        <span class="mot"><small>${dur(b.fin - b.ini)}</small>${b.motivos.map(m => `<span class="etq ${m.c}">${m.t}</span>`).join('')}</span></div>
      ${tieneApuntes ? `<button class="ghost peq" data-acc="notas" data-id="${a.id}">Apuntes</button>` : '<span></span>'}</li>`;
  }

  function verNotas(id) {
    const a = est.asig.find(x => x.id === id);
    if (!a) return;
    $('#dlg').innerHTML = `<div class="dlg-in"><h3>${esc(a.nombre)}</h3>
      ${a.notas.trim() ? `<p class="notas">${esc(a.notas)}</p>` : ''}
      ${a.fotos.map((f, i) => `<img src="${f}" alt="Apuntes de ${esc(a.nombre)}, foto ${i + 1}">`).join('')}
      <button class="primario" data-acc="cerrar">Cerrar</button></div>`;
    $('#dlg').showModal();
  }

  /* ---------- Acciones ---------- */
  const acciones = {
    ir: b => { const i = +b.dataset.i; if (i <= est.max) irA(i); },
    atras: () => irA(est.paso - 1),
    sig: () => {
      const err = validar(est.paso);
      if (err) { $('#err').textContent = err; return; }
      irA(est.paso + 1);
    },
    dia: b => {
      const n = +b.dataset.n;
      est.dias = est.dias.includes(n) ? est.dias.filter(x => x !== n) : [...est.dias, n];
      guardar(); pintar();
    },
    'dias-set': b => { est.dias = b.dataset.v.split(',').map(Number); guardar(); pintar(); },
    'hueco-set': b => { est.hueco = { ini: b.dataset.a, fin: b.dataset.b }; guardar(); pintar(); },
    sug: b => {
      est.asig.push({ id: uid(), color: COLORES[est.asig.length % COLORES.length], nombre: b.dataset.n, notas: '', fotos: [], reforzar: false });
      guardar(); pintar();
    },
    editar: b => {
      const a = est.asig.find(x => x.id === b.dataset.id);
      if (!a) return;
      borrador = { id: a.id, nombre: a.nombre, notas: a.notas, fotos: [...a.fotos], reforzar: a.reforzar };
      pintar();
      $('#fAsig').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    'cancelar-edicion': () => { borrador = nuevoBorrador(); pintar(); },
    borrar: b => {
      const a = est.asig.find(x => x.id === b.dataset.id);
      if (!a || !confirm(`¿Eliminar ${a.nombre}? También se borrarán sus exámenes.`)) return;
      est.asig = est.asig.filter(x => x.id !== a.id);
      est.examenes = est.examenes.filter(x => x.asigId !== a.id);
      if (borrador.id === a.id) borrador = nuevoBorrador();
      guardar(); pintar();
    },
    'quitar-foto': b => { borrador.fotos.splice(+b.dataset.i, 1); pintar(); },
    ocr: () => leerFotos(),
    'borrar-ex': b => { est.examenes = est.examenes.filter(x => x.id !== b.dataset.id); guardar(); pintar(); },
    hecho: b => {
      const k = b.dataset.k;
      if (est.hechos[k]) delete est.hechos[k]; else est.hechos[k] = true;
      guardar(); pintar();
    },
    notas: b => verNotas(b.dataset.id),
    cerrar: () => $('#dlg').close(),
    imprimir: () => window.print(),
    reiniciar: () => {
      if (!confirm('¿Empezar de cero? Se borrarán tus asignaturas, exámenes y progreso.')) return;
      try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
      est = defecto(); borrador = nuevoBorrador(); pintar();
    }
  };

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-acc]');
    if (b && acciones[b.dataset.acc]) acciones[b.dataset.acc](b, ev);
    if (ev.target === $('#dlg')) $('#dlg').close();
  });

  document.addEventListener('input', ev => {
    const t = ev.target, c = t.dataset.campo;
    if (!c) return;
    if (c === 'b-nombre') borrador.nombre = t.value;
    else if (c === 'b-notas') borrador.notas = t.value;
    else if (c === 'b-ref') borrador.reforzar = t.checked;
    else if (c === 'hueco') {
      est.hueco = { ini: $('#hIni').value, fin: $('#hFin').value };
      guardar(); actualizarHueco();
    }
  });

  document.addEventListener('change', ev => {
    if (ev.target.id === 'bFotos' && ev.target.files.length) subirFotos(ev.target.files);
  });

  document.addEventListener('submit', ev => {
    ev.preventDefault();
    if (ev.target.id === 'fAsig') guardarAsig();
    if (ev.target.id === 'fEx') guardarEx();
  });

  pintar();
})();
