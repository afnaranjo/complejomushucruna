<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;

require_once __DIR__ . '/Audit.php';
require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/VocerosRepository.php';

/**
 * Usuarios del panel y sus roles. Cada persona entra con su cuenta y solo ve los módulos que su rol
 * tiene activados; así la bitácora y la auditoría dicen quién hizo cada cambio. El rol del sistema
 * «Administración» ve todo, también los módulos que se creen después.
 */
final class AdminUsers
{
    /**
     * Los módulos que se pueden activar en un rol. Un módulo nuevo del panel se agrega aquí (con su
     * portada y sus rutas de API en ROUTES) y aparece como una casilla más en la sección Usuarios.
     */
    public const MODULES = [
        'panel' => ['label' => 'Panel', 'description' => 'Resumen de todo y redes sociales', 'home' => '/admin/panel/'],
        'noticias' => ['label' => 'Noticias', 'description' => 'Editar el tema central y los avisos', 'home' => '/admin/noticias/'],
        'voceros' => ['label' => 'Voceros', 'description' => 'Registros y seguimiento', 'home' => '/admin/voceros/'],
        'medios' => ['label' => 'Medios', 'description' => 'Seguimiento, eventos, calendario y gira', 'home' => '/admin/medios/'],
        'produccion' => ['label' => 'Producción', 'description' => 'Activaciones y cronogramas', 'home' => '/admin/produccion/activaciones/'],
        'emprendedores' => ['label' => 'Emprendedores', 'description' => 'De emprendedor a influencer', 'home' => '/admin/emprendedores/'],
        'creadoras' => ['label' => 'Creadoras', 'description' => 'Calendario y edición', 'home' => '/admin/creadoras/'],
        'mfs' => ['label' => 'Mushuc Freestyle', 'description' => 'Inscripciones y audiciones', 'home' => '/admin/mfs/'],
        'usuarios' => ['label' => 'Usuarios', 'description' => 'Cuentas, roles y actividad', 'home' => '/admin/usuarios/'],
    ];
    /** Qué módulo protege cada ruta administrativa de la API (por prefijo). */
    private const ROUTES = [
        '/api/panel' => 'panel', '/api/redes-sociales' => 'panel',
        '/api/noticias' => 'noticias',
        '/api/voceros' => 'voceros', '/api/vocero-accounts' => 'voceros', '/api/vocero-video-schedule' => 'voceros', '/api/dashboard' => 'voceros',
        '/api/medios' => 'medios', '/api/media-accounts' => 'medios', '/api/media-claims' => 'medios', '/api/media-events' => 'medios', '/api/media-plan' => 'medios', '/api/media-tour' => 'medios',
        '/api/produccion' => 'produccion',
        '/api/emprendedores' => 'emprendedores', '/api/emprendedor-accounts' => 'emprendedores', '/api/emprendedor-dashboard' => 'emprendedores', '/api/emprendedor-video-schedule' => 'emprendedores',
        '/api/creadoras' => 'creadoras',
        '/api/mfs-participants' => 'mfs', '/api/mfs-accounts' => 'mfs', '/api/mfs-dashboard' => 'mfs',
        '/api/admin-users' => 'usuarios', '/api/admin-roles' => 'usuarios', '/api/admin-activity' => 'usuarios',
    ];
    public const ADMIN_ROLE = 'a0000000000000000000000000000001';
    private const SETUP_HOURS = 72;
    public const MIN_PASSWORD = 10;

    public function __construct(private readonly PDO $pdo, private readonly Audit $audit) {}

    /** El módulo que protege una ruta; null si la ruta no pertenece a ningún módulo (salir, sesión). */
    public static function moduleFor(string $path, string $method): ?string
    {
        // Todos leen la banda del tema central arriba de cada panel; editarla es del módulo Noticias.
        if ($path === '/api/noticias' && $method === 'GET') return null;
        foreach (self::ROUTES as $prefix => $module) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/') || str_starts_with($path, $prefix . '?')) return $module;
        }
        return null;
    }

    public static function allows(array $user, ?string $module): bool
    {
        if ($module === null) return true;
        $modules = $user['modules'] ?? [];
        return in_array('*', $modules, true) || in_array($module, $modules, true);
    }

    /** Lo que se sabe de la persona en sesión: su rol, sus módulos y a dónde entra primero. */
    public static function describe(array $row, ?array $role): array
    {
        $modules = $role === null ? [] : self::decodeModules((string) $role['modules']);
        // La cuenta dueña «admin» siempre ve todo, aunque todavía no tenga rol asignado.
        if ($role === null && $row['username'] === 'admin') $modules = ['*'];
        $all = in_array('*', $modules, true);
        $home = '/admin/';
        foreach (self::MODULES as $key => $module) {
            if ($all || in_array($key, $modules, true)) { $home = $module['home']; break; }
        }
        return [
            'id' => (int) $row['id'],
            'public_id' => $row['public_id'],
            'username' => $row['username'],
            'full_name' => (string) ($row['full_name'] ?? '') !== '' ? (string) $row['full_name'] : $row['username'],
            'role' => $role === null ? ($all ? 'Administración' : 'Sin rol') : $role['name'],
            'modules' => $all ? ['*'] : array_values(array_intersect(array_keys(self::MODULES), $modules)),
            'home' => $home,
        ];
    }

    private static function decodeModules(string $json): array
    {
        $decoded = json_decode($json, true);
        return is_array($decoded) ? array_values(array_filter($decoded, 'is_string')) : [];
    }

    // --- Roles -------------------------------------------------------------------------------

    public function roles(): array
    {
        $rows = $this->pdo->query('SELECT r.*, (SELECT COUNT(*) FROM admin_users u WHERE u.role_id = r.id AND u.active = 1) AS users FROM admin_roles r ORDER BY r.is_system DESC, r.name')->fetchAll(PDO::FETCH_ASSOC);
        return array_map(fn (array $row): array => $this->projectRole($row), $rows);
    }

    public function saveRole(?string $publicId, array $input, int $adminId, string $ip): array
    {
        $name = $this->text($input['name'] ?? '', 80);
        if ($name === '') throw new InvalidArgumentException('Ponle un nombre al rol.');
        $description = $this->text($input['description'] ?? '', 240);
        $modules = $input['modules'] ?? [];
        if (!is_array($modules) || !array_is_list($modules)) throw new InvalidArgumentException('Elige los módulos del rol.');
        foreach ($modules as $module) if (!is_string($module) || !array_key_exists($module, self::MODULES)) throw new InvalidArgumentException('Ese módulo no existe.');
        $modules = array_values(array_intersect(array_keys(self::MODULES), $modules));
        $now = gmdate('Y-m-d H:i:s');
        $clash = $this->pdo->prepare('SELECT public_id FROM admin_roles WHERE LOWER(name) = LOWER(?)');
        $clash->execute([$name]);
        $existing = $clash->fetchColumn();
        if ($existing !== false && $existing !== $publicId) throw new DuplicateRegistration();
        if ($publicId === null) {
            $publicId = bin2hex(random_bytes(16));
            $this->pdo->prepare('INSERT INTO admin_roles (public_id, name, description, modules, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
                ->execute([$publicId, $name, $description, json_encode($modules, JSON_THROW_ON_ERROR), $now, $now]);
            $this->audit->log('admin_role.created', $adminId, 'admin_role', $publicId, [], $ip);
        } else {
            $role = $this->roleRow($publicId);
            // El rol del sistema ve todo siempre: solo cambia su descripción.
            if ((int) $role['is_system'] === 1) {
                $this->pdo->prepare('UPDATE admin_roles SET description = ?, updated_at = ? WHERE id = ?')->execute([$description, $now, $role['id']]);
            } else {
                $this->pdo->prepare('UPDATE admin_roles SET name = ?, description = ?, modules = ?, updated_at = ? WHERE id = ?')
                    ->execute([$name, $description, json_encode($modules, JSON_THROW_ON_ERROR), $now, $role['id']]);
            }
            $this->audit->log('admin_role.updated', $adminId, 'admin_role', $publicId, [], $ip);
        }
        $this->assertSomeoneManagesUsers();
        return $this->projectRole($this->roleRow($publicId) + ['users' => 0]);
    }

    private function projectRole(array $row): array
    {
        $modules = self::decodeModules((string) $row['modules']);
        return [
            'public_id' => $row['public_id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'modules' => $modules,
            'all' => in_array('*', $modules, true),
            'system' => (int) $row['is_system'] === 1,
            'users' => (int) ($row['users'] ?? 0),
        ];
    }

    private function roleRow(string $publicId): array
    {
        if (preg_match('~^[a-f0-9]{32}$~D', $publicId) !== 1) throw new OutOfBoundsException();
        $statement = $this->pdo->prepare('SELECT * FROM admin_roles WHERE public_id = ?');
        $statement->execute([$publicId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new OutOfBoundsException();
        return $row;
    }

    // --- Usuarios ----------------------------------------------------------------------------

    public function users(): array
    {
        $rows = $this->pdo->prepare('SELECT u.id, u.public_id, u.username, u.full_name, u.active, u.last_login_at, u.created_at, r.public_id AS role, r.name AS role_name, r.modules AS role_modules,'
            . " (SELECT COUNT(*) FROM admin_setup_tokens t WHERE t.admin_user_id = u.id AND t.used_at IS NULL AND t.expires_at > ?) AS pending_links,"
            . ' (SELECT COUNT(*) FROM admin_setup_tokens t WHERE t.admin_user_id = u.id AND t.used_at IS NOT NULL) AS used_links'
            . ' FROM admin_users u LEFT JOIN admin_roles r ON r.id = u.role_id ORDER BY u.active DESC, u.full_name, u.username');
        $rows->execute([gmdate('Y-m-d H:i:s')]);
        return array_map(static fn (array $row): array => [
            'public_id' => $row['public_id'],
            'username' => $row['username'],
            'full_name' => $row['full_name'] !== '' ? $row['full_name'] : $row['username'],
            'active' => (int) $row['active'] === 1,
            'role' => $row['role'] ?? ($row['username'] === 'admin' ? self::ADMIN_ROLE : ''),
            'role_name' => $row['role_name'] ?? ($row['username'] === 'admin' ? 'Administración' : 'Sin rol'),
            'last_login_at' => $row['last_login_at'],
            'created_at' => $row['created_at'],
            'owner' => $row['username'] === 'admin',
            'pending_link' => (int) $row['pending_links'] > 0,
            // Quien nunca usó un enlace ni entró todavía no tiene contraseña propia.
            'has_password' => $row['username'] === 'admin' || (int) $row['used_links'] > 0,
        ], $rows->fetchAll(PDO::FETCH_ASSOC));
    }

    /** Crea la cuenta sin contraseña conocida: la persona la elige con el enlace que se genera. */
    public function createUser(array $input, int $adminId, string $ip): array
    {
        $username = $this->username($input['username'] ?? '');
        $fullName = $this->text($input['full_name'] ?? '', 160);
        if ($fullName === '') throw new InvalidArgumentException('Escribe el nombre de la persona.');
        $role = $this->roleRow((string) ($input['role'] ?? ''));
        $clash = $this->pdo->prepare('SELECT 1 FROM admin_users WHERE username = ?');
        $clash->execute([$username]);
        if ($clash->fetchColumn() !== false) throw new DuplicateRegistration();
        $now = gmdate('Y-m-d H:i:s');
        $publicId = bin2hex(random_bytes(16));
        // Contraseña aleatoria que nadie conoce: hasta usar el enlace, la cuenta no puede entrar.
        $this->pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, active, created_at, updated_at, role_id, full_name, created_by_admin_id) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)')
            ->execute([$publicId, $username, Auth::hashPassword(bin2hex(random_bytes(32))), $now, $now, $role['id'], $fullName, $adminId]);
        $this->audit->log('admin_user.created', $adminId, 'admin_user', $publicId, [], $ip);
        return ['user' => $this->userByPublicId($publicId), 'link' => $this->createSetupLink($publicId, $adminId, $ip)];
    }

    public function updateUser(string $publicId, array $input, int $adminId, string $ip): array
    {
        $row = $this->userRow($publicId);
        $now = gmdate('Y-m-d H:i:s');
        if (array_key_exists('full_name', $input)) {
            $fullName = $this->text($input['full_name'], 160);
            if ($fullName === '') throw new InvalidArgumentException('Escribe el nombre de la persona.');
            $this->pdo->prepare('UPDATE admin_users SET full_name = ?, updated_at = ? WHERE id = ?')->execute([$fullName, $now, $row['id']]);
        }
        if (array_key_exists('role', $input)) {
            $role = $this->roleRow((string) $input['role']);
            // La cuenta dueña «admin» se queda siempre en Administración.
            if ($row['username'] === 'admin' && $role['public_id'] !== self::ADMIN_ROLE) throw new InvalidArgumentException('La cuenta admin siempre es de Administración.');
            $this->pdo->prepare('UPDATE admin_users SET role_id = ?, updated_at = ? WHERE id = ?')->execute([$role['id'], $now, $row['id']]);
            $this->audit->log('admin_user.role_changed', $adminId, 'admin_user', $publicId, [], $ip);
        }
        if (array_key_exists('active', $input)) {
            if (!is_bool($input['active'])) throw new InvalidArgumentException();
            if (!$input['active'] && ($row['username'] === 'admin' || (int) $row['id'] === $adminId)) throw new InvalidArgumentException('No puedes desactivar esta cuenta.');
            $this->pdo->prepare('UPDATE admin_users SET active = ?, updated_at = ? WHERE id = ?')->execute([(int) $input['active'], $now, $row['id']]);
            // Desactivar corta sus sesiones: requireUser revisa «active» en cada petición.
            $this->audit->log($input['active'] ? 'admin_user.activated' : 'admin_user.deactivated', $adminId, 'admin_user', $publicId, [], $ip);
        }
        $this->assertSomeoneManagesUsers();
        return $this->userByPublicId($publicId);
    }

    /** Un enlace de un solo uso, válido 72 horas, para que la persona elija su contraseña. */
    public function createSetupLink(string $publicId, int $adminId, string $ip): array
    {
        $row = $this->userRow($publicId);
        if ((int) $row['active'] !== 1) throw new InvalidArgumentException('La cuenta está desactivada.');
        $now = time();
        // Solo vale el último enlace: los anteriores quedan anulados.
        $this->pdo->prepare('UPDATE admin_setup_tokens SET used_at = ? WHERE admin_user_id = ? AND used_at IS NULL')->execute([gmdate('Y-m-d H:i:s', $now), $row['id']]);
        $token = bin2hex(random_bytes(32));
        $expires = gmdate('Y-m-d H:i:s', $now + self::SETUP_HOURS * 3600);
        $this->pdo->prepare('INSERT INTO admin_setup_tokens (admin_user_id, token_hash, expires_at, created_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$row['id'], hash('sha256', $token), $expires, $adminId, gmdate('Y-m-d H:i:s', $now)]);
        $this->audit->log('admin_user.setup_link_created', $adminId, 'admin_user', $publicId, [], $ip);
        return ['token' => $token, 'expires_at' => $expires];
    }

    /** Para la página del enlace: a quién pertenece, sin revelar nada más. */
    public function setupPreview(string $token): array
    {
        $row = $this->setupRow($token);
        return ['username' => $row['username'], 'full_name' => $row['full_name'] !== '' ? $row['full_name'] : $row['username'], 'expires_at' => $row['expires_at']];
    }

    public function completeSetup(string $token, #[\SensitiveParameter] string $password, string $ip): void
    {
        $row = $this->setupRow($token);
        if (mb_strlen($password) < self::MIN_PASSWORD || strlen($password) > 1024) throw new InvalidArgumentException('La contraseña debe tener al menos ' . self::MIN_PASSWORD . ' caracteres.');
        $now = gmdate('Y-m-d H:i:s');
        $used = $this->pdo->prepare('UPDATE admin_setup_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL');
        $used->execute([$now, $row['token_id']]);
        if ($used->rowCount() !== 1) throw new OutOfBoundsException();
        // Cambiar el hash cierra también cualquier sesión abierta con la contraseña anterior.
        $this->pdo->prepare('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?')->execute([Auth::hashPassword($password), $now, $row['id']]);
        $this->audit->log('admin_user.password_set', (int) $row['id'], 'admin_user', $row['public_id'], [], $ip);
    }

    private function setupRow(string $token): array
    {
        if (preg_match('~^[a-f0-9]{64}$~D', $token) !== 1) throw new OutOfBoundsException();
        $statement = $this->pdo->prepare('SELECT t.id AS token_id, t.expires_at, u.id, u.public_id, u.username, u.full_name, u.active FROM admin_setup_tokens t JOIN admin_users u ON u.id = t.admin_user_id'
            . ' WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > ?');
        $statement->execute([hash('sha256', $token), gmdate('Y-m-d H:i:s')]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false || (int) $row['active'] !== 1) throw new OutOfBoundsException();
        return $row;
    }

    // --- Actividad ---------------------------------------------------------------------------

    /** Quién hizo qué y cuándo, desde la auditoría. Sin datos personales: solo el tipo de acción. */
    public function activity(int $limit = 150, string $userPublicId = ''): array
    {
        $limit = min(max($limit, 1), 300);
        $sql = 'SELECT a.event_type, a.subject_type, a.created_at, u.username, u.full_name FROM audit_log a LEFT JOIN admin_users u ON u.id = a.actor_id';
        $params = [];
        if ($userPublicId !== '') {
            $user = $this->userRow($userPublicId);
            $sql .= ' WHERE a.actor_id = ?';
            $params[] = $user['id'];
        } else {
            $sql .= ' WHERE a.actor_id IS NOT NULL';
        }
        $statement = $this->pdo->prepare($sql . ' ORDER BY a.created_at DESC, a.id DESC LIMIT ' . $limit);
        $statement->execute($params);
        return array_map(static fn (array $row): array => [
            'event' => $row['event_type'],
            'subject' => $row['subject_type'],
            'at' => $row['created_at'],
            'username' => $row['username'] ?? '',
            'full_name' => ($row['full_name'] ?? '') !== '' ? $row['full_name'] : ($row['username'] ?? ''),
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    // --- Interno -----------------------------------------------------------------------------

    /** Siempre debe quedar al menos una cuenta activa que pueda administrar usuarios. */
    private function assertSomeoneManagesUsers(): void
    {
        foreach ($this->users() as $user) {
            if (!$user['active']) continue;
            if ($user['owner']) return;
            $role = $this->pdo->prepare('SELECT modules FROM admin_roles WHERE public_id = ?');
            $role->execute([$user['role']]);
            $modules = self::decodeModules((string) $role->fetchColumn());
            if (in_array('*', $modules, true) || in_array('usuarios', $modules, true)) return;
        }
        throw new InvalidArgumentException('Debe quedar al menos una cuenta que administre usuarios.');
    }

    private function userByPublicId(string $publicId): array
    {
        foreach ($this->users() as $user) if ($user['public_id'] === $publicId) return $user;
        throw new OutOfBoundsException();
    }

    private function userRow(string $publicId): array
    {
        if (preg_match('~^[a-f0-9]{32}$~D', $publicId) !== 1) throw new OutOfBoundsException();
        $statement = $this->pdo->prepare('SELECT * FROM admin_users WHERE public_id = ?');
        $statement->execute([$publicId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new OutOfBoundsException();
        return $row;
    }

    /** Usuario en minúsculas, sin espacios: letras, números, punto, guion y guion bajo. */
    private function username(mixed $value): string
    {
        $username = strtolower(trim(is_string($value) ? $value : ''));
        if (preg_match('~^[a-z0-9][a-z0-9._-]{2,39}$~D', $username) !== 1) throw new InvalidArgumentException('El usuario debe tener de 3 a 40 letras o números, sin espacios.');
        return $username;
    }

    private function text(mixed $value, int $max): string
    {
        if (!is_string($value)) return '';
        $text = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
        return mb_substr($text, 0, $max);
    }
}
