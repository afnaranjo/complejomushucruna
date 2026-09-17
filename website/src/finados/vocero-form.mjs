import { escapeHtml as esc } from '../render/html.mjs';

const field = (name, label, attrs = '', optional = false) => `<label class="vocero-field" for="${name}"><span>${label}${optional ? ' <small>Opcional</small>' : ' <span aria-hidden="true">*</span>'}</span><input id="${name}" name="${name}" ${attrs}${optional ? '' : ' required'}></label>`;
const select = (name, label, values) => `<label class="vocero-field" for="${name}"><span>${label} <span aria-hidden="true">*</span></span><select id="${name}" name="${name}" required><option value="">Selecciona una opción</option>${values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>`;

export function renderVoceroForm(consents) {
  return `<form data-vocero-profile class="vocero-profile-form" novalidate>
<fieldset data-profile-fields disabled>
<legend class="sr-only">Mi registro de Vocero</legend>
<div class="vocero-profile-layout">
<section class="vocero-photo" aria-labelledby="photo-title">
<p class="vocero-eyebrow">01 · Tu fotografía</p><h2 id="photo-title">Fotografía para identificación y gafete</h2>
<div class="vocero-photo-frame"><img data-photo-preview alt="Vista previa de tu fotografía para identificación" hidden><span data-photo-placeholder>Tu fotografía<br><small>De frente · Sin filtros</small></span></div>
<p id="photo-help">Sube una foto reciente, de frente, con el rostro visible y sin filtros. Se usará para verificar tu identidad y, si corresponde, elaborar y entregar tu credencial o gafete. Su carga no autoriza por sí sola la publicación en canales oficiales. JPG, PNG o WebP; máximo 5 MB.</p>
<label class="vocero-field" for="fotografia"><span data-photo-label>Seleccionar fotografía</span><input id="fotografia" name="fotografia" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="photo-help"></label>
<button class="vocero-quiet" data-photo-replace type="button" hidden>Reemplazar fotografía</button>
</section>
<div class="vocero-profile-details">
<section aria-labelledby="personal-title"><p class="vocero-eyebrow">02 · Tus datos</p><h2 id="personal-title">Información personal</h2><p>Los campos con * son obligatorios.</p>
<div class="vocero-fields">
${field('nombre_completo', 'Nombre y apellido completos', 'autocomplete="name" minlength="5" maxlength="160"')}
${field('cedula', 'Cédula', 'inputmode="numeric" pattern="[0-9]{10}" minlength="10" maxlength="10" placeholder="Ej.: 1808743587"')}
${field('fecha_nacimiento', 'Fecha de nacimiento', 'type="date"')}
${field('whatsapp', 'Número de WhatsApp', 'type="tel" autocomplete="tel" inputmode="numeric" pattern="09[0-9]{8}" maxlength="10" placeholder="Ej.: 0995874566"')}
<label class="vocero-field" for="account-email"><span>Correo de tu cuenta</span><input id="account-email" type="email" data-account-email readonly aria-describedby="email-help"><small id="email-help">Este correo está vinculado a tu cuenta.</small></label>
${field('ciudad', 'Ciudad', 'autocomplete="address-level2" maxlength="100"')}
</div></section>
<section aria-labelledby="social-title"><p class="vocero-eyebrow">03 · Tu comunidad</p><h2 id="social-title">Redes y participación</h2>
<p id="social-help">Los enlaces son opcionales. Si los compartes, podremos verificar tus vistas en el termómetro. Usa enlaces que comiencen con https://.</p>
<div class="vocero-fields">
${['tiktok', 'instagram', 'facebook'].map(name => field(name, `Enlace de tu perfil de ${name === 'tiktok' ? 'TikTok' : name[0].toUpperCase() + name.slice(1)}`, 'type="url" maxlength="300" pattern="https://.*" aria-describedby="social-help"', true)).join('')}
${select('red_principal', '¿En cuál red publicas más?', ['TikTok', 'Instagram', 'Facebook'])}
${select('vocero_previo', '¿Ya has sido vocero de la feria antes?', ['No, es mi primera vez', 'Sí, en Finados 2025', 'Sí, en Carnaval 2026', 'Sí, en otra edición'])}
${select('fuente_comunidad', '¿Cómo te enteraste de la comunidad?', ['Facebook', 'Instagram', 'TikTok', 'Un amigo o familiar me invitó', 'Un vocero me contó', 'WhatsApp', 'Otro'])}
${select('retiro_kit', '¿Cómo prefieres retirar tu kit si subes de nivel?', ['En la oficina', 'En la feria, en la Zona de Creadores'])}
</div></section>
<section data-vocero-minor hidden aria-labelledby="minor-title"><h2 id="minor-title">Datos de tu representante legal</h2><p>Si tienes 16 o 17 años, tu registro queda pendiente hasta recibir la autorización escrita firmada.</p><div class="vocero-fields">
${field('representante_nombre', 'Nombre completo del representante', 'maxlength="160"')}
${field('representante_cedula', 'Cédula del representante', 'inputmode="numeric" pattern="[0-9]{10}" maxlength="10"')}
${field('representante_telefono', 'WhatsApp del representante', 'type="tel" inputmode="numeric" pattern="09[0-9]{8}" maxlength="10"')}
${field('representante_correo', 'Correo del representante', 'type="email" maxlength="180"')}
</div></section>
<section class="vocero-consents" aria-labelledby="consents-title"><p class="vocero-eyebrow">04 · Consentimientos</p><h2 id="consents-title">Revisa y confirma</h2>
${[['policies', 'consentimiento_politicas'], ['image', 'autorizacion_imagen'], ['data', 'consentimiento_datos']].map(([key, name]) => `<label class="vocero-check"><input type="checkbox" name="${name}" value="Sí" required><span>${esc(consents[key].text)}</span></label>`).join('')}
<nav class="vocero-legal-links" aria-label="Documentos de consentimiento"><a href="/finados/voceros/politicas-del-vocero/" target="_blank" rel="noopener noreferrer">Políticas del Vocero</a><a href="/finados/voceros/bases-del-termometro/" target="_blank" rel="noopener noreferrer">Bases del Termómetro</a><a href="/finados/voceros/autorizacion-de-imagen/" target="_blank" rel="noopener noreferrer">Autorización de uso de imagen</a><a href="/finados/voceros/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Política de Privacidad</a></nav>
</section><div class="vocero-save"><div><p data-save-help>Tus cambios se guardan automáticamente cuando el formulario está completo.</p><p class="vocero-save-status" data-auto-save-status role="status" aria-live="polite"></p></div><button class="vocero-primary" type="submit">Guardar registro</button></div>
</div></div></fieldset></form>`;
}

export function renderVoceroProgressPanels() {
  const levels = ['En preparación', 'Primer paso', 'Gorra', 'Kit completo', 'Trae a los tuyos', 'Noche de concierto', 'Tope'];
  const levelCards = levels.map((label, index) => `<li data-vocero-level="${index}"><span>${String(index).padStart(2, '0')}</span><strong>${label}</strong></li>`).join('');
  return `<section class="vocero-progress-panel" data-vocero-progress aria-labelledby="progress-title"><div class="vocero-section-heading"><div><p class="vocero-eyebrow">Tu camino</p><h2 id="progress-title">Niveles y avances</h2><p>La coordinación actualiza tu avance con la métrica validada de tu comunidad. El color te muestra en qué momento estás.</p></div><div class="vocero-progress-summary"><div class="vocero-traffic-light" role="img" aria-label="Semáforo de avance"><span data-vocero-light="red"></span><span data-vocero-light="yellow"></span><span data-vocero-light="green"></span></div><strong data-vocero-level-label>En preparación</strong><small><span data-vocero-followers>0</span> seguidores validados</small></div></div><ol class="vocero-levels" data-vocero-levels>${levelCards}</ol><dl class="vocero-progress-meta"><div><dt>Kit</dt><dd data-vocero-kit-status>Pendiente de retiro</dd></div><div><dt>Videos habilitados</dt><dd><span data-vocero-videos-count>0</span> de 5</dd></div></dl></section>
<section class="vocero-badge-panel" data-vocero-badge hidden aria-labelledby="badge-title"><div><p class="vocero-eyebrow">Comparte tu logro</p><h2 id="badge-title">Tu gafete digital</h2><p>Al completar tu registro, genera una imagen lista para compartir como invitado especial de Finados Mushuc Runa 2026.</p><p class="vocero-badge-format">Formato historia 1080 × 1920 · incluye un QR único para validar tu identidad, nivel y semáforo actual. No contiene correo, cédula ni fotografía fuera del gafete.</p><p class="vocero-badge-status" data-vocero-badge-status></p><div class="vocero-badge-actions"><button class="vocero-primary" type="button" data-vocero-badge-download>Descargar gafete</button><button class="vocero-quiet" type="button" data-vocero-badge-share>Compartir</button></div></div><div class="vocero-badge-preview"><img data-vocero-badge-preview alt="Gafete digital de invitado especial Finados Mushuc Runa 2026, formato historia 1080 por 1920"></div></section>`;
}

export function renderVoceroVideosPanel() {
  const videoSlots = Array.from({ length: 5 }, (_, index) => index + 1).map(slot => `<article class="vocero-video-slot" data-video-slot="${slot}"><div class="vocero-video-slot__heading"><span class="vocero-video-number">0${slot}</span><div><h3>Video ${slot}</h3><p data-video-status>Bloqueado por coordinación</p></div></div><label class="vocero-field"><span>Enlace del video</span><input type="url" data-video-url placeholder="https://..." inputmode="url" maxlength="500" disabled></label><button class="vocero-primary vocero-video-save" type="button" data-video-save disabled>Guardar video</button></article>`).join('');
  return `<details class="vocero-videos-panel" data-vocero-videos aria-labelledby="videos-title"><summary><span><span class="vocero-eyebrow">Contenido de la comunidad</span><strong id="videos-title">Tus cinco videos</strong><small>La coordinación habilita cada espacio. Cuando se desbloquee uno, pega aquí el enlace público del video.</small></span><span class="vocero-video-counter"><span data-vocero-videos-count>0</span>/5 habilitados</span></summary><div class="vocero-video-grid">${videoSlots}</div></details>`;
}
