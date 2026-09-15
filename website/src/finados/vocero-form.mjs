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
<button class="vocero-primary vocero-photo-save" type="submit">Guardar registro</button>
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
<p id="social-help">Llena al menos uno. Sin el enlace de tu perfil no podemos verificar tus vistas en el termómetro. Usa enlaces que comiencen con https://.</p>
<div class="vocero-fields">
${['tiktok', 'instagram', 'facebook'].map(name => field(name, `Enlace de tu perfil de ${name === 'tiktok' ? 'TikTok' : name[0].toUpperCase() + name.slice(1)}`, 'type="url" maxlength="300" pattern="https://.*" aria-describedby="social-help"', true)).join('')}
${select('red_principal', '¿En cuál red publicas más?', ['TikTok', 'Instagram', 'Facebook'])}
${select('vocero_previo', '¿Ya has sido vocero de la feria antes?', ['No, es mi primera vez', 'Sí, en Finados 2025', 'Sí, en Carnaval 2026', 'Sí, en otra edición'])}
${select('fuente_comunidad', '¿Cómo te enteraste de la comunidad?', ['Facebook', 'Instagram', 'TikTok', 'Un amigo o familiar me invitó', 'Un vocero me contó', 'WhatsApp', 'Otro'])}
${select('retiro_kit', '¿Cómo prefieres retirar tu kit si subes de nivel?', ['En la oficina', 'En la feria, en la Zona de Creadores'])}
</div></section>
<section data-vocero-minor hidden aria-labelledby="minor-title"><h2 id="minor-title">Datos de tu representante legal</h2><p>Si tienes 16 o 17 años, tu registro queda pendiente hasta recibir la autorización escrita firmada.</p><div class="vocero-fields">
${field('representante_nombre', 'Nombre completo del representante', 'maxlength="160"', true)}
${field('representante_cedula', 'Cédula del representante', 'inputmode="numeric" pattern="[0-9]{10}" maxlength="10"', true)}
${field('representante_telefono', 'WhatsApp del representante', 'type="tel" inputmode="numeric" pattern="09[0-9]{8}" maxlength="10"', true)}
${field('representante_correo', 'Correo del representante', 'type="email" maxlength="180"', true)}
</div></section>
<section class="vocero-consents" aria-labelledby="consents-title"><p class="vocero-eyebrow">04 · Consentimientos</p><h2 id="consents-title">Revisa y confirma</h2>
${[['policies', 'consentimiento_politicas'], ['image', 'autorizacion_imagen'], ['data', 'consentimiento_datos']].map(([key, name]) => `<label class="vocero-check"><input type="checkbox" name="${name}" value="Sí" required><span>${esc(consents[key].text)}</span></label>`).join('')}
<nav class="vocero-legal-links" aria-label="Documentos de consentimiento"><a href="/finados/voceros/politicas-del-vocero/" target="_blank" rel="noopener noreferrer">Políticas del Vocero</a><a href="/finados/voceros/bases-del-termometro/" target="_blank" rel="noopener noreferrer">Bases del Termómetro</a><a href="/finados/voceros/autorizacion-de-imagen/" target="_blank" rel="noopener noreferrer">Autorización de uso de imagen</a><a href="/finados/voceros/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Política de Privacidad</a></nav>
</section><div class="vocero-save"><p data-save-help>Revisa tus datos y guarda tu registro.</p><button class="vocero-primary" type="submit">Guardar registro</button></div>
</div></div></fieldset></form>`;
}
