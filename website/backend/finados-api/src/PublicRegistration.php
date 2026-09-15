<?php
declare(strict_types=1);

namespace Finados;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/** Business rules mirrored from the still-active anonymous intake; no persistence or transport. */
final class PublicRegistration
{
    public static function validate(array $fields, string $accountEmail): array
    {
        $allowed = ['submission_id', 'nombre_completo', 'cedula', 'fecha_nacimiento', 'whatsapp', 'ciudad',
            'tiktok', 'instagram', 'facebook', 'red_principal', 'vocero_previo', 'fuente_comunidad', 'retiro_kit',
            'representante_nombre', 'representante_cedula', 'representante_telefono', 'representante_correo',
            'consentimiento_politicas', 'autorizacion_imagen', 'consentimiento_datos',
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'url_origen'];
        if (array_diff(array_keys($fields), $allowed) !== []) throw new InvalidArgumentException('Invalid registration fields.');
        foreach ($fields as $value) if (!is_string($value)) throw new InvalidArgumentException('Invalid registration field.');
        $timezone = new DateTimeZone('America/Guayaquil');
        $now = new DateTimeImmutable('now', $timezone);
        $birthValue = self::text($fields, 'fecha_nacimiento', 10, 10);
        $birth = DateTimeImmutable::createFromFormat('!Y-m-d', $birthValue, $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        if ($birth === false || (is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) throw new InvalidArgumentException('Invalid birth date.');
        $age = $birth->diff($now)->y;
        if ($birth > $now || $age < 16) throw new InvalidArgumentException('Invalid age.');
        $id = strtolower(self::text($fields, 'submission_id', 32, 32));
        if (!preg_match('/^[a-f0-9]{32}$/D', $id)) throw new InvalidArgumentException('Invalid submission identifier.');
        $record = [
            'submission_id' => $id, 'full_name' => self::text($fields, 'nombre_completo', 160, 5),
            'cedula' => self::text($fields, 'cedula', 10, 10), 'birth_date' => $birthValue, 'age_at_submission' => $age,
            'whatsapp' => self::text($fields, 'whatsapp', 10, 10), 'email' => self::text(['email' => $accountEmail], 'email', 254, 1),
            'city' => self::text($fields, 'ciudad', 100, 1),
            'main_network' => self::choice($fields, 'red_principal', 20, ['TikTok', 'Instagram', 'Facebook']),
            'previous_participation' => self::choice($fields, 'vocero_previo', 60, ['No, es mi primera vez', 'Sí, en Finados 2025', 'Sí, en Carnaval 2026', 'Sí, en otra edición']),
            'community_source' => self::choice($fields, 'fuente_comunidad', 80, ['Facebook', 'Instagram', 'TikTok', 'Un amigo o familiar me invitó', 'Un vocero me contó', 'WhatsApp', 'Otro']),
            'kit_pickup' => self::choice($fields, 'retiro_kit', 80, ['En la oficina', 'En la feria, en la Zona de Creadores']),
            'status' => $age < 18 ? 'Pendiente de autorización' : 'Nuevo',
            'submitted_at' => $now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
        ];
        if (!preg_match('/^\d{10}$/D', $record['cedula']) || !preg_match('/^09\d{8}$/D', $record['whatsapp']) || !filter_var($record['email'], FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Invalid identification or contact.');
        foreach (['tiktok', 'instagram', 'facebook'] as $network) {
            $record[$network] = self::text($fields, $network, 300);
            if ($record[$network] !== '' && (!filter_var($record[$network], FILTER_VALIDATE_URL) || strtolower((string) parse_url($record[$network], PHP_URL_SCHEME)) !== 'https')) throw new InvalidArgumentException('Invalid social profile.');
        }
        if ($record['tiktok'] === '' && $record['instagram'] === '' && $record['facebook'] === '') throw new InvalidArgumentException('A social profile is required.');
        foreach (['name' => ['nombre', 160], 'cedula' => ['cedula', 10], 'phone' => ['telefono', 10], 'email' => ['correo', 180]] as $target => [$source, $limit]) {
            $record['representative_' . $target] = self::text($fields, 'representante_' . $source, $limit, $age < 18 ? 1 : 0);
        }
        if ($age < 18 && (!preg_match('/^\d{10}$/D', $record['representative_cedula']) || !preg_match('/^09\d{8}$/D', $record['representative_phone']) || !filter_var($record['representative_email'], FILTER_VALIDATE_EMAIL))) throw new InvalidArgumentException('Invalid representative.');
        foreach (['consentimiento_politicas', 'autorizacion_imagen', 'consentimiento_datos'] as $consent) self::choice($fields, $consent, 4, ['Sí']);
        foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $field) $record[$field] = self::text($fields, $field, 180);
        // Validate but never trust a client URL as the source of authenticated consent evidence.
        self::text($fields, 'url_origen', 500);
        return $record;
    }

    private static function text(array $fields, string $name, int $max, int $min = 0): string
    {
        $value = $fields[$name] ?? '';
        if (!is_string($value)) throw new InvalidArgumentException('Invalid registration field.');
        $value = preg_replace('/\s+/u', ' ', trim($value));
        if (!is_string($value) || strlen($value) < $min || strlen($value) > $max) throw new InvalidArgumentException('Invalid registration field.');
        return $value;
    }

    private static function choice(array $fields, string $name, int $max, array $allowed): string
    {
        $value = self::text($fields, $name, $max, 1);
        if (!in_array($value, $allowed, true)) throw new InvalidArgumentException('Invalid registration choice.');
        return $value;
    }
}
