export const mediaAccreditationDeadline = '2026-09-15T18:00:00-05:00';

export const ecuadorProvinces = Object.freeze([
  'Azuay',
  'Bolívar',
  'Cañar',
  'Carchi',
  'Chimborazo',
  'Cotopaxi',
  'El Oro',
  'Esmeraldas',
  'Galápagos',
  'Guayas',
  'Imbabura',
  'Loja',
  'Los Ríos',
  'Manabí',
  'Morona Santiago',
  'Napo',
  'Orellana',
  'Pastaza',
  'Pichincha',
  'Santa Elena',
  'Santo Domingo de los Tsáchilas',
  'Sucumbíos',
  'Tungurahua',
  'Zamora Chinchipe',
]);

function options(values) {
  return values.map((value) => `<option value="${value}">${value}</option>`).join('');
}

function selectField({ id, name, label, values, autocomplete = '' }) {
  const autocompleteAttribute = autocomplete ? ` autocomplete="${autocomplete}"` : '';
  return `<label class="media-field" for="${id}">
    <span>${label} <b aria-hidden="true">*</b></span>
    <select id="${id}" name="${name}" required${autocompleteAttribute}>
      <option value="" selected disabled>Selecciona una opción</option>
      ${options(values)}
    </select>
  </label>`;
}

export function renderMediaAccreditationBody() {
  return `<section class="media-hero" aria-labelledby="media-title">
    <img class="media-hero__image" src="/assets/images/acreditacion-medios-periodista.jpg?v=20260909" width="1778" height="889" alt="Periodista con cámara y micrófono durante una cobertura cultural" fetchpriority="high">
    <div class="media-hero__veil" aria-hidden="true"></div>
    <div class="shell media-hero__content">
      <p class="media-hero__eyebrow">Finados Mushuc Runa 2026</p>
      <h1 id="media-title">Acreditación<br>de medios</h1>
      <p class="media-hero__intro">Registra a tu medio y al equipo que realizará la cobertura del lanzamiento.</p>
      <div class="media-deadline" id="fecha-limite">
        <span>Fecha máxima de registro</span>
        <time datetime="${mediaAccreditationDeadline}">Martes 15 de septiembre · 18:00</time>
        <small>Hora de Ecuador</small>
      </div>
      <a class="media-hero__button" href="#registro-medios">Completar acreditación <span aria-hidden="true">↓</span></a>
    </div>
  </section>

  <section class="media-registration" id="registro-medios" aria-labelledby="media-form-title">
    <div class="shell media-registration__shell">
      <header class="media-registration__header" data-reveal>
        <p class="media-registration__eyebrow">Formulario oficial</p>
        <h2 id="media-form-title">Datos del medio y equipo</h2>
        <p>Completa todos los campos. Puedes acreditar un máximo de dos personas.</p>
      </header>

      <div class="media-registration__closed" data-registration-closed hidden role="status">
        <strong>Registro cerrado</strong>
        <p>La fecha máxima para solicitar acreditaciones ya finalizó.</p>
      </div>

      <form class="media-form" action="/api/acreditacion-medios/" method="post" data-media-accreditation data-deadline="${mediaAccreditationDeadline}" aria-describedby="fecha-limite">
        <div class="media-form__trap" aria-hidden="true">
          <label for="website">No completar este campo</label>
          <input id="website" name="website" type="text" tabindex="-1" autocomplete="off">
        </div>

        <fieldset class="media-form__fields" data-registration-fields>
          <legend class="sr-only">Información para la acreditación</legend>

          <label class="media-field" for="nombre-medio">
            <span>Nombre del medio <b aria-hidden="true">*</b></span>
            <input id="nombre-medio" name="nombre_medio" type="text" maxlength="140" autocomplete="organization" required>
          </label>

          ${selectField({
            id: 'tipo-medio',
            name: 'tipo_medio',
            label: 'Tipo de medio',
            values: ['Radio', 'TV', 'Prensa escrita', 'Digital', 'Redes sociales'],
          })}

          <label class="media-field" for="frecuencia-canal">
            <span>Frecuencia / canal <b aria-hidden="true">*</b></span>
            <input id="frecuencia-canal" name="frecuencia_canal" type="text" maxlength="120" required>
          </label>

          <label class="media-field" for="nombre-programa">
            <span>Nombre del programa o espacio <b aria-hidden="true">*</b></span>
            <input id="nombre-programa" name="nombre_programa" type="text" maxlength="160" required>
          </label>

          ${selectField({
            id: 'tipo-programa',
            name: 'tipo_programa',
            label: 'Tipo de programa',
            values: ['Noticias', 'Magazine', 'Cultural', 'Deportivo', 'Entretenimiento', 'Opinión'],
          })}

          ${selectField({
            id: 'provincia',
            name: 'provincia',
            label: 'Provincia',
            values: ecuadorProvinces,
            autocomplete: 'address-level1',
          })}

          <label class="media-field" for="ciudad">
            <span>Ciudad <b aria-hidden="true">*</b></span>
            <input id="ciudad" name="ciudad" type="text" maxlength="100" autocomplete="address-level2" required>
          </label>

          <fieldset class="media-choice">
            <legend>Mantiene contrato vigente con Mushuc Runa <b aria-hidden="true">*</b></legend>
            <div class="media-choice__options">
              <label><input type="radio" name="contrato_mushuc" value="Sí" required> <span>Sí</span></label>
              <label><input type="radio" name="contrato_mushuc" value="No" required> <span>No</span></label>
            </div>
          </fieldset>

          ${selectField({
            id: 'numero-personas',
            name: 'numero_personas',
            label: 'Número de personas a acreditar',
            values: [],
          }).replace('</select>', '<option value="1">1 persona</option><option value="2">2 personas (máximo)</option></select>')}

          <label class="media-field media-field--wide" for="equipo">
            <span>Nombres y cargos del equipo <b aria-hidden="true">*</b></span>
            <textarea id="equipo" name="equipo" rows="4" maxlength="500" placeholder="Ej.: Luis Peña — Reportero" required></textarea>
            <small>Incluye una línea por cada persona.</small>
          </label>

          <label class="media-field" for="telefono">
            <span>Teléfono / WhatsApp <b aria-hidden="true">*</b></span>
            <input id="telefono" name="telefono" type="tel" maxlength="25" autocomplete="tel" inputmode="tel" required>
          </label>

          <label class="media-field" for="correo">
            <span>Correo electrónico <b aria-hidden="true">*</b></span>
            <input id="correo" name="correo" type="email" maxlength="180" autocomplete="email" required>
          </label>

          <label class="media-consent media-field--wide" for="acepta-condiciones">
            <input id="acepta-condiciones" name="acepta_condiciones" type="checkbox" value="Sí" required>
            <span>Acepto las condiciones de acreditación del evento. <b aria-hidden="true">*</b></span>
          </label>

          <p class="media-form__privacy media-field--wide">La información se utilizará únicamente para gestionar la acreditación y el contacto del evento. Cada envío se registra en una hoja privada y se remite como respaldo al correo oficial de Finados Mushuc Runa.</p>

          <div class="media-form__footer media-field--wide">
            <p class="media-form__status" data-media-form-status aria-live="polite"></p>
            <button class="media-submit" type="submit">Enviar acreditación <span aria-hidden="true">↗</span></button>
          </div>
        </fieldset>
      </form>
    </div>
  </section>

  <dialog class="media-thanks" data-media-thanks aria-labelledby="media-thanks-title">
    <form method="dialog" class="media-thanks__art">
      <div class="media-thanks__chumbi" aria-hidden="true"></div>
      <img src="/assets/finados/logo-finados.svg?v=20260909" width="920" height="504" alt="Finados Mushuc Runa 2026">
      <p>Registro recibido</p>
      <h2 id="media-thanks-title">Gracias, bienvenido al lanzamiento de Finados Mushuc Runa 2026</h2>
      <button type="submit">Cerrar</button>
    </form>
  </dialog>`;
}
