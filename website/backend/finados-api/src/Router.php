<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use Throwable;

foreach (['Config', 'Database', 'Crypto', 'Audit', 'VocerosRepository', 'Auth', 'VoceroAuth', 'VoceroProfile', 'VoceroPasswordReset', 'MediaAuth', 'MediaRepository', 'MediaPasswordReset'] as $dependency) {
    require_once __DIR__ . '/' . $dependency . '.php';
}

final class Response
{
    public function __construct(public readonly int $status, public readonly array $headers, public readonly string $body) {}

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) header($name . ': ' . $value);
        echo $this->body;
    }
}

final class Router
{
    private const VOCERO_ACCOUNTS_MIGRATION = '003_vocero_accounts';
    private const PHOTO_UPLOAD_BYTES = 5 * 1024 * 1024;
    private const PROFILE_REQUEST_OVERHEAD_BYTES = 256 * 1024;
    private const PHOTO_MEMORY_BYTES = 256 * 1024 * 1024;
    private const PRIVATE_FREE_BYTES = 100 * 1024 * 1024;
    private readonly Auth $auth;
    private readonly VoceroAuth $voceroAuth;
    private ?MediaAuth $mediaAuthInstance = null;
    private readonly VocerosRepository $repository;
    private ?MediaRepository $mediaInstance = null;
    private readonly Audit $audit;
    private readonly Crypto $crypto;
    private const FILTERS = ['search', 'status', 'city', 'main_network', 'previous_participation', 'date_from', 'date_to'];
    private const MEDIA_FILTERS = ['search', 'status', 'media_type', 'province'];
    private const METHODS = ['GET', 'POST', 'PATCH', 'OPTIONS'];

    public function __construct(private readonly Config $config, private readonly PDO $pdo)
    {
        $this->crypto = new Crypto($config);
        $this->audit = new Audit($pdo, $this->crypto);
        $this->repository = new VocerosRepository($pdo, $this->crypto, $this->audit);
        $this->auth = new Auth($pdo, $config);
        $this->voceroAuth = new VoceroAuth($pdo, $config);
    }

    public function handle(string $method, string $uri, array $server = [], string $rawBody = '', array $post = [], array $files = []): Response
    {
        $headers = [
            'Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store', 'Vary' => 'Origin',
            'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
            'Referrer-Policy' => 'no-referrer',
        ];
        try {
            $origin = $server['HTTP_ORIGIN'] ?? null;
            if ($origin !== null && !$this->config->isAllowedOrigin($origin)) throw new Forbidden();
            $refererOrigin = $this->refererOrigin($server);
            if ($refererOrigin !== null && !$this->config->isAllowedOrigin($refererOrigin)) throw new Forbidden();
            if ($origin !== null) {
                $headers['Access-Control-Allow-Origin'] = $origin;
                $headers['Access-Control-Allow-Credentials'] = 'true';
            }
            if ($method === 'OPTIONS') {
                $requested = $server['HTTP_ACCESS_CONTROL_REQUEST_METHOD'] ?? 'GET';
                $requestedHeaders = array_filter(array_map('trim', explode(',', strtolower($server['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? ''))));
                if ($origin === null || !in_array($requested, self::METHODS, true)
                    || array_diff($requestedHeaders, ['content-type', 'x-csrf-token']) !== []) throw new Forbidden();
                $headers['Access-Control-Allow-Methods'] = implode(', ', self::METHODS);
                $headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token';
                return new Response(204, $headers, '');
            }
            $path = parse_url($uri, PHP_URL_PATH);
            if (!is_string($path)) throw new InvalidArgumentException();
            $query = [];
            parse_str(parse_url($uri, PHP_URL_QUERY) ?? '', $query);
            $ip = $server['REMOTE_ADDR'] ?? '';
            // Forwarded headers are untrusted until an explicit proxy trust policy exists.
            $token = $server['HTTP_X_CSRF_TOKEN'] ?? '';
            if ($path === '/api/health' && $method === 'GET') {
                return $this->health($headers);
            }
            // Badge QR validation is deliberately public but returns only a minimal projection.
            if (preg_match('~^/api/voceros/verify/([a-f0-9]{32})$~D', $path, $parts)) {
                if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                if ($query !== []) throw new InvalidArgumentException();
                $verification = $this->repository->publicVerification($parts[1]);
                if ($verification === null) throw new OutOfBoundsException();
                return $this->json(200, ['ok' => true, 'verification' => $verification], $headers);
            }
            if ($path === '/api/auth/session' && $method === 'GET') {
                try { $user = $this->auth->requireUser(); } catch (Unauthorized) { $user = null; }
                return $this->json(200, ['authenticated' => $user !== null, 'user' => $user, 'csrf' => $this->auth->csrfToken()], $headers);
            }
            if ($path === '/api/auth/login' && $method === 'POST') {
                $this->auth->verifyCsrf($token);
                $body = $this->body($server, $rawBody, ['username', 'password']);
                if (!is_string($body['username'] ?? null) || strlen($body['username']) > 100
                    || !is_string($body['password'] ?? null) || strlen($body['password']) > 1024) throw new InvalidArgumentException();
                $result = $this->auth->login($body['username'], $body['password'], $ip);
                try {
                    $this->audit->log('admin.login', $result['user']['id'], 'admin', $result['user']['public_id'], [], $ip);
                } catch (Throwable $error) {
                    // Do not leave a usable session behind when its access audit cannot be saved.
                    $this->auth->logout();
                    throw $error;
                }
                return $this->json(200, ['authenticated' => true, ...$result], $headers);
            }
            // Vocero authentication is deliberately isolated from the administrative guard and session.
            if ($path === '/api/vocero/auth/reset' && $method === 'POST') {
                if (!$this->config->isAllowedOrigin($origin) || !is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
                $this->voceroAuth->verifyCsrf($token);
                if ($query !== []) throw new InvalidArgumentException();
                $body = $this->body($server, $rawBody, ['token', 'password']);
                if (!is_string($body['token'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                (new VoceroPasswordReset($this->pdo, $this->config))->consume($body['token'], $body['password'], $ip);
                $this->voceroAuth->logout();
                return $this->json(200, ['ok' => true, 'csrf' => $this->voceroAuth->csrfToken()], $headers);
            }
            if ($path === '/api/vocero/auth/session' && $method === 'GET') {
                try { $user = $this->voceroAuth->requireUser(); } catch (Unauthorized) { $user = null; }
                return $this->json(200, ['authenticated' => $user !== null, 'user' => $user, 'csrf' => $this->voceroAuth->csrfToken()], $headers);
            }
            if (in_array($path, ['/api/vocero/auth/register', '/api/vocero/auth/login', '/api/vocero/auth/logout'], true) && $method === 'POST') {
                if (!$this->config->isAllowedOrigin($origin)) throw new Forbidden();
                if (!is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
                $this->voceroAuth->verifyCsrf($token);
                if ($path === '/api/vocero/auth/register') {
                    $body = $this->body($server, $rawBody, ['email', 'password', 'privacyAcknowledged']);
                    if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null) || !is_bool($body['privacyAcknowledged'] ?? null)) throw new InvalidArgumentException();
                    $this->voceroAuth->register($body['email'], $body['password'], $body['privacyAcknowledged'], $ip);
                    return $this->json(202, ['ok' => true, 'message' => 'Cuenta creada; inicia sesión.'], $headers);
                }
                if ($path === '/api/vocero/auth/login') {
                    $body = $this->body($server, $rawBody, ['email', 'password']);
                    if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                    $result = $this->voceroAuth->login($body['email'], $body['password'], $ip);
                    try {
                        $this->audit->log('vocero_account.login', null, 'vocero_account', $result['user']['public_id'], [], $ip);
                    } catch (Throwable $error) {
                        $this->voceroAuth->logout();
                        throw $error;
                    }
                    return $this->json(200, ['authenticated' => true, ...$result], $headers);
                }
                $user = $this->voceroAuth->requireUser();
                $this->audit->log('vocero_account.logout', null, 'vocero_account', $user['public_id'], [], $ip);
                $this->voceroAuth->logout();
                return $this->json(200, ['ok' => true], $headers);
            }
            if (in_array($path, ['/api/vocero/profile', '/api/vocero/photo'], true)) {
                $user = $this->voceroAuth->requireUser();
                if (!in_array($method, $path === '/api/vocero/profile' ? ['GET', 'POST'] : ['GET'], true)) {
                    return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                }
                if ($query !== []) throw new InvalidArgumentException();
                if ($method === 'POST') {
                    if (!$this->config->isAllowedOrigin($origin) || !is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
                    $this->voceroAuth->verifyCsrf($token);
                    $length = $server['CONTENT_LENGTH'] ?? null;
                    if ($length !== null && ((!is_string($length) && !is_int($length)) || preg_match('/^\d+$/D', (string) $length) !== 1)) throw new InvalidArgumentException();
                    if (($length !== null && (float) $length > 5 * 1024 * 1024 + 262144) || strlen($rawBody) > 5 * 1024 * 1024 + 262144) throw new RequestBodyError(413, 'payload_too_large');
                    if (strtolower(trim(explode(';', $server['CONTENT_TYPE'] ?? '')[0])) !== 'multipart/form-data') throw new RequestBodyError(415, 'unsupported_media_type');
                    $fieldBytes = 0;
                    foreach ($post as $field => $value) {
                        if (!is_string($value)) throw new InvalidArgumentException();
                        $fieldBytes += strlen((string) $field) + strlen($value);
                    }
                    if ($fieldBytes > 262144) throw new RequestBodyError(413, 'payload_too_large');
                    foreach ($files as $upload) {
                        if (!is_array($upload)) throw new InvalidArgumentException();
                        if (($upload['error'] ?? null) === UPLOAD_ERR_OK && (!is_string($upload['tmp_name'] ?? null) || !is_uploaded_file($upload['tmp_name']))) throw new InvalidArgumentException();
                    }
                    $profile = new VoceroProfile($this->pdo, $this->config);
                    $saved = $profile->save($user['id'], $post, $files, $ip, $server['HTTP_USER_AGENT'] ?? '');
                    return $this->json(200, ['registered' => true, ...$saved], $headers);
                }
                $profile = new VoceroProfile($this->pdo, $this->config);
                if ($path === '/api/vocero/photo') {
                    $jpeg = $profile->photo($user['id']);
                    $headers['Content-Type'] = 'image/jpeg';
                    $headers['Cache-Control'] = 'private, no-store';
                    return new Response(200, $headers, $jpeg);
                }
                $own = $profile->get($user['id']);
                return $this->json(200, $own === null
                    ? ['registered' => false, 'email' => $user['email'], 'status' => null, 'photo' => ['available' => false, 'width' => null, 'height' => null, 'created_at' => null]]
                    : ['registered' => true, ...$own], $headers);
            }
            if (preg_match('~^/api/vocero/videos/([1-5])$~D', $path, $parts)) {
                $user = $this->voceroAuth->requireUser();
                if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                if (!$this->config->isAllowedOrigin($origin) || !is_string($ip) || inet_pton($ip) === false || $query !== []) throw new Forbidden();
                $this->voceroAuth->verifyCsrf($token);
                $body = $this->body($server, $rawBody, ['url']);
                if (!is_string($body['url'] ?? null)) throw new InvalidArgumentException();
                $profile = new VoceroProfile($this->pdo, $this->config);
                $saved = $profile->saveVideo($user['id'], (int) $parts[1], $body['url'], $ip);
                return $this->json(200, ['ok' => true, ...$saved], $headers);
            }
            // Media accounts use their own session scope, isolated from Voceros and administration.
            if (str_starts_with($path, '/api/media/')) {
                $response = $this->mediaAccount($method, $path, $query, $server, $rawBody, $origin, $ip, $token, $headers);
                if ($response !== null) return $response;
            }
            $user = $this->auth->requireUser();
            if (!in_array($method, self::METHODS, true)) return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (in_array($method, ['POST', 'PATCH'], true)) {
                $this->auth->verifyCsrf($token);
                if (!is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
            }
            if ($path === '/api/auth/logout' && $method === 'POST') {
                $this->auth->logout();
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($path === '/api/medios' || str_starts_with($path, '/api/medios/') || $path === '/api/media-accounts' || str_starts_with($path, '/api/media-accounts/')) {
                return $this->mediaAdmin($method, $path, $query, $server, $rawBody, $origin, $refererOrigin, $ip, $user, $headers);
            }
            if ($path === '/api/voceros' && $method === 'GET') {
                $filters = $this->filters($query, true);
                $result = $this->repository->list($filters);
                return $this->json(200, ['items' => $result['items'], 'pagination' => [
                    'page' => $result['page'], 'pageSize' => $result['per_page'], 'total' => $result['total'],
                    'pages' => (int) ceil($result['total'] / $result['per_page']),
                ]], $headers);
            }
            if ($path === '/api/vocero-accounts' && $method === 'GET') {
                if ($query !== []) throw new InvalidArgumentException();
                return $this->json(200, ['items' => $this->repository->pendingAccounts()], $headers);
            }
            if ($path === '/api/vocero-accounts') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($path === '/api/vocero-video-schedule') {
                if ($query !== []) throw new InvalidArgumentException();
                if ($method === 'GET') return $this->json(200, ['video_slots' => $this->repository->videoSchedule()], $headers);
                if ($method === 'PATCH') {
                    $body = $this->body($server, $rawBody, ['video_slots']);
                    $this->repository->updateVideoSchedule($body, $user['id'], $ip);
                    return $this->json(200, ['ok' => true, 'video_slots' => $this->repository->videoSchedule()], $headers);
                }
                return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            }
            if (preg_match('~^/api/vocero-accounts/([a-f0-9]{32})/delete$~D', $path, $parts)) {
                if ($method !== 'POST' || $query !== []) return $this->error($method === 'POST' ? 422 : 405, $method === 'POST' ? 'validation_error' : 'method_not_allowed', $method === 'POST' ? 'Revisa los datos de la solicitud.' : 'Método no permitido.', $headers);
                $this->body($server, $rawBody, []);
                $this->repository->archiveAccount($parts[1], $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($path === '/api/dashboard' && $method === 'GET') {
                $statuses = array_fill_keys(VocerosRepository::STATUSES, 0);
                foreach ($this->pdo->query("SELECT status, COUNT(*) AS count FROM voceros WHERE status <> 'Eliminado' GROUP BY status") as $row) $statuses[$row['status']] = (int) $row['count'];
                $dates = [];
                foreach ($this->pdo->query("SELECT DATE(submitted_at) AS day, COUNT(*) AS count FROM voceros WHERE status <> 'Eliminado' GROUP BY DATE(submitted_at) ORDER BY day") as $row) $dates[$row['day']] = (int) $row['count'];
                $recent = $this->pdo->prepare("SELECT COUNT(*) FROM voceros WHERE status <> 'Eliminado' AND submitted_at >= ? AND submitted_at <= ?");
                $recent->execute([gmdate('Y-m-d H:i:s', time() - 7 * 86400), gmdate('Y-m-d H:i:s')]);
                $topFollowers = [];
                foreach ($this->pdo->query("SELECT v.public_id, v.full_name, v.city, v.main_network, COALESCE(p.followers_count, 0) AS followers_count FROM voceros v LEFT JOIN vocero_progress p ON p.vocero_id = v.id WHERE v.status <> 'Eliminado' AND COALESCE(p.followers_count, 0) > 0 ORDER BY COALESCE(p.followers_count, 0) DESC, v.full_name ASC LIMIT 20") as $row) {
                    $topFollowers[] = [
                        'public_id' => (string) $row['public_id'],
                        'full_name' => (string) $row['full_name'],
                        'city' => (string) ($row['city'] ?? ''),
                        'main_network' => (string) ($row['main_network'] ?? ''),
                        'followers_count' => (int) $row['followers_count'],
                    ];
                }
                return $this->json(200, ['total' => array_sum($statuses), 'byStatus' => $statuses, 'byDate' => (object) $dates, 'lastSevenDays' => (int) $recent->fetchColumn(), 'topFollowers' => $topFollowers, 'topVideos' => $this->repository->topVideos(10)], $headers);
            }
            if ($path === '/api/voceros/export' && $method === 'POST') {
                $filters = $this->filters($this->body($server, $rawBody, self::FILTERS));
                return $this->export($filters, $user['id'], $ip, $headers);
            }
            if ($path === '/api/voceros/export') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (preg_match('~^/api/voceros/([a-f0-9]{32})/delete$~D', $path, $parts)) {
                if ($method !== 'POST' || $query !== []) return $this->error($method === 'POST' ? 422 : 405, $method === 'POST' ? 'validation_error' : 'method_not_allowed', $method === 'POST' ? 'Revisa los datos de la solicitud.' : 'Método no permitido.', $headers);
                $this->body($server, $rawBody, []);
                $this->repository->archive($parts[1], $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if (preg_match('~^/api/voceros/([^/]+)/(photo|password-reset)$~D', $path, $parts)) {
                $id = $parts[1]; $action = $parts[2];
                if (preg_match('/^[a-f0-9]{32}$/D', $id) !== 1 || $query !== []) throw new InvalidArgumentException();
                if (!is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
                if ($action === 'password-reset' && $method === 'POST') {
                    if (!$this->config->isAllowedOrigin($origin)) throw new Forbidden();
                    $this->body($server, $rawBody, []);
                    $raw = (new VoceroPasswordReset($this->pdo, $this->config))->create($id, $user['id'], $ip);
                    $resetOrigin = $origin ?? $refererOrigin ?? $this->config->allowedOrigin();
                    return $this->json(201, ['resetUrl' => $resetOrigin . '/finados/voceros/restablecer/?token=' . $raw], $headers);
                }
                if ($action === 'photo' && $method === 'GET') {
                    $lock = VoceroMediaLock::acquire($this->pdo, $this->config);
                    try {
                        $row = $this->pdo->prepare('SELECT p.storage_key FROM vocero_photos p JOIN voceros v ON v.id = p.vocero_id WHERE v.public_id = ?');
                        $row->execute([$id]); $key = $row->fetchColumn();
                        if ($key === false) throw new OutOfBoundsException();
                        $jpeg = (new PhotoStorage($this->config, $this->crypto))->read($key);
                        $this->audit->log('vocero.photo_viewed', $user['id'], 'vocero', $id, [], $ip);
                    } finally { $lock->release(); }
                    $headers['Content-Type'] = 'image/jpeg'; $headers['Cache-Control'] = 'private, no-store';
                    return new Response(200, $headers, $jpeg);
                }
                return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            }
            if (preg_match('~^/api/voceros/([^/]+)/progress$~D', $path, $parts)) {
                $id = $parts[1];
                if (preg_match('/^[a-f0-9]{32}$/D', $id) !== 1 || $method !== 'PATCH' || $query !== []) {
                    return $this->error($method === 'PATCH' ? 422 : 405, $method === 'PATCH' ? 'validation_error' : 'method_not_allowed', $method === 'PATCH' ? 'Revisa los datos de progreso.' : 'Método no permitido.', $headers);
                }
                $body = $this->body($server, $rawBody, ['followers_count', 'level', 'traffic_light', 'videos_unlocked', 'video_slots', 'video_views', 'kit_status']);
                $this->repository->updateProgress($id, $body, $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if (preg_match('~^/api/voceros/([^/]+)(/notes)?$~D', $path, $parts)) {
                $id = $parts[1]; $notes = isset($parts[2]);
                if (!$notes && $method === 'PATCH') {
                    $body = $this->body($server, $rawBody, ['status']);
                    if (!is_string($body['status'] ?? null)) throw new InvalidArgumentException();
                    $this->repository->changeStatus($id, $body['status'], $user['id'], $ip);
                    return $this->json(200, ['ok' => true], $headers);
                }
                if ($notes && $method === 'POST') {
                    $body = $this->body($server, $rawBody, ['body']);
                    if (!is_string($body['body'] ?? null)) throw new InvalidArgumentException();
                    $this->repository->addNote($id, $body['body'], $user['id'], $ip);
                    return $this->json(201, ['ok' => true], $headers);
                }
                if (!$notes && $method === 'GET') {
                    if (!is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
                    $detail = $this->repository->find($id);
                    if ($detail === null) throw new OutOfBoundsException();
                    $detail = [...$detail, ...$this->repository->accessMetadata($id)];
                    $this->audit->log('vocero.viewed', $user['id'], 'vocero', $id, [], $ip);
                    return $this->json(200, $detail, $headers);
                }
                return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            }
            if (in_array($path, ['/api/health', '/api/auth/login', '/api/auth/logout', '/api/auth/session', '/api/voceros', '/api/dashboard', '/api/vocero-accounts', '/api/vocero-video-schedule', '/api/vocero/auth/session', '/api/vocero/auth/register', '/api/vocero/auth/login', '/api/vocero/auth/logout'], true)
                || preg_match('~^/api/voceros/verify/[a-f0-9]{32}$~D', $path) === 1) {
                return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            }
            return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
        } catch (Unauthorized) {
            return $this->error(401, 'unauthorized', 'Acceso no autorizado.', $headers);
        } catch (Forbidden) {
            return $this->error(403, 'forbidden', 'Solicitud no permitida.', $headers);
        } catch (RequestBodyError $error) {
            return $this->error($error->status, $error->errorCode, 'Formato de solicitud no válido.', $headers);
        } catch (PasswordResetRateLimit) {
            return $this->error(429, 'rate_limited', 'Espera antes de volver a intentar.', $headers);
        } catch (DuplicateRegistration) {
            return $this->error(409, 'duplicate_registration', 'Ya existe un registro con los datos proporcionados.', $headers);
        } catch (InvalidArgumentException | \JsonException) {
            return $this->error(422, 'validation_error', 'Revisa los datos de la solicitud.', $headers);
        } catch (OutOfBoundsException) {
            return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
        } catch (Throwable) {
            error_log('Finados API request failed.');
            return $this->error(500, 'internal_error', 'No se pudo completar la solicitud.', $headers);
        }
    }

    // Media services load on first use so a Medios fault can never take down Voceros or administration.
    private function mediaAuth(): MediaAuth
    {
        return $this->mediaAuthInstance ??= new MediaAuth($this->pdo, $this->config);
    }

    private function media(): MediaRepository
    {
        return $this->mediaInstance ??= new MediaRepository($this->pdo, $this->crypto, $this->audit);
    }

    private function mediaAccount(string $method, string $path, array $query, array $server, string $rawBody, ?string $origin, mixed $ip, string $token, array $headers): ?Response
    {
        $validIp = is_string($ip) && inet_pton($ip) !== false;
        if ($path === '/api/media/auth/session') {
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            try { $user = $this->mediaAuth()->requireUser(); } catch (Unauthorized) { $user = null; }
            return $this->json(200, ['authenticated' => $user !== null, 'user' => $user, 'csrf' => $this->mediaAuth()->csrfToken()], $headers);
        }
        if (in_array($path, ['/api/media/auth/register', '/api/media/auth/login', '/api/media/auth/logout', '/api/media/auth/reset'], true)) {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp) throw new Forbidden();
            $this->mediaAuth()->verifyCsrf($token);
            if ($query !== []) throw new InvalidArgumentException();
            if ($path === '/api/media/auth/reset') {
                $body = $this->body($server, $rawBody, ['token', 'password']);
                if (!is_string($body['token'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                (new MediaPasswordReset($this->pdo, $this->config))->consume($body['token'], $body['password'], $ip);
                $this->mediaAuth()->logout();
                return $this->json(200, ['ok' => true, 'csrf' => $this->mediaAuth()->csrfToken()], $headers);
            }
            if ($path === '/api/media/auth/register') {
                $body = $this->body($server, $rawBody, ['email', 'password', 'privacyAcknowledged']);
                if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null) || !is_bool($body['privacyAcknowledged'] ?? null)) throw new InvalidArgumentException();
                $this->mediaAuth()->register($body['email'], $body['password'], $body['privacyAcknowledged'], $ip);
                return $this->json(202, ['ok' => true, 'message' => 'Cuenta creada; inicia sesión.'], $headers);
            }
            if ($path === '/api/media/auth/login') {
                $body = $this->body($server, $rawBody, ['email', 'password']);
                if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                $result = $this->mediaAuth()->login($body['email'], $body['password'], $ip);
                try {
                    $this->audit->log('media_account.login', null, 'media_account', $result['user']['public_id'], [], $ip);
                } catch (Throwable $error) {
                    $this->mediaAuth()->logout();
                    throw $error;
                }
                return $this->json(200, ['authenticated' => true, ...$result], $headers);
            }
            $user = $this->mediaAuth()->requireUser();
            $this->audit->log('media_account.logout', null, 'media_account', $user['public_id'], [], $ip);
            $this->mediaAuth()->logout();
            return $this->json(200, ['ok' => true], $headers);
        }
        if ($path === '/api/media/profile') {
            $user = $this->mediaAuth()->requireUser();
            if (!in_array($method, ['GET', 'POST'], true)) return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'POST') {
                if (!$this->config->isAllowedOrigin($origin) || !$validIp) throw new Forbidden();
                $this->mediaAuth()->verifyCsrf($token);
                $saved = $this->media()->saveForAccount($user['id'], $this->body($server, $rawBody, MediaRepository::FIELDS), $ip);
                return $this->json(200, ['registered' => true, ...$saved], $headers);
            }
            $own = $this->media()->forAccount($user['id']);
            return $this->json(200, $own === null ? ['registered' => false, 'email' => $user['email'], 'status' => null, 'editable' => true] : ['registered' => true, 'email' => $user['email'], ...$own], $headers);
        }
        return null;
    }

    /** Administrative media routes; the caller already enforced the admin session and CSRF for writes. */
    private function mediaAdmin(string $method, string $path, array $query, array $server, string $rawBody, ?string $origin, ?string $refererOrigin, mixed $ip, array $user, array $headers): Response
    {
        $notAllowed = fn (): Response => $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        if (!is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
        if ($path === '/api/medios') {
            if ($method !== 'GET') return $notAllowed();
            $result = $this->media()->list($this->mediaFilters($query, true));
            return $this->json(200, ['items' => $result['items'], 'summary' => $this->media()->summary(), 'pagination' => [
                'page' => $result['page'], 'pageSize' => $result['per_page'], 'total' => $result['total'],
                'pages' => (int) ceil($result['total'] / $result['per_page']),
            ]], $headers);
        }
        if ($path === '/api/media-accounts') {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, ['items' => $this->media()->pendingAccounts()], $headers);
        }
        if ($path === '/api/medios/export') {
            if ($method !== 'POST') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->mediaExport($this->mediaFilters($this->body($server, $rawBody, self::MEDIA_FILTERS)), $user['id'], $ip, $headers);
        }
        if (preg_match('~^/api/media-accounts/([a-f0-9]{32})/delete$~D', $path, $parts)) {
            if ($method !== 'POST') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $this->body($server, $rawBody, []);
            $this->media()->archiveAccount($parts[1], $user['id'], $ip);
            return $this->json(200, ['ok' => true], $headers);
        }
        if (preg_match('~^/api/medios/([a-f0-9]{32})(?:/(delete|notes|password-reset))?$~D', $path, $parts)) {
            $id = $parts[1]; $action = $parts[2] ?? '';
            if ($query !== []) throw new InvalidArgumentException();
            if ($action === '' && $method === 'GET') {
                $detail = $this->media()->find($id);
                if ($detail === null) throw new OutOfBoundsException();
                $this->audit->log('media.viewed', $user['id'], 'media_profile', $id, [], $ip);
                return $this->json(200, $detail, $headers);
            }
            if ($action === '' && $method === 'PATCH') {
                $body = $this->body($server, $rawBody, ['status']);
                if (!is_string($body['status'] ?? null)) throw new InvalidArgumentException();
                $this->media()->changeStatus($id, $body['status'], $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($action !== '' && $method !== 'POST') return $notAllowed();
            if ($action === 'notes') {
                $body = $this->body($server, $rawBody, ['body']);
                if (!is_string($body['body'] ?? null)) throw new InvalidArgumentException();
                $this->media()->addNote($id, $body['body'], $user['id'], $ip);
                return $this->json(201, ['ok' => true], $headers);
            }
            if ($action === 'delete') {
                $this->body($server, $rawBody, []);
                $this->media()->archive($id, $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($action === 'password-reset') {
                if (!$this->config->isAllowedOrigin($origin)) throw new Forbidden();
                $this->body($server, $rawBody, []);
                $raw = (new MediaPasswordReset($this->pdo, $this->config))->create($id, $user['id'], $ip);
                $resetOrigin = $origin ?? $refererOrigin ?? $this->config->allowedOrigin();
                return $this->json(201, ['resetUrl' => $resetOrigin . '/finados/medios/restablecer/?token=' . $raw], $headers);
            }
            return $notAllowed();
        }
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    private function mediaFilters(array $input, bool $pagination = false): array
    {
        $allowed = $pagination ? [...self::MEDIA_FILTERS, 'page', 'pageSize'] : self::MEDIA_FILTERS;
        if (array_diff(array_keys($input), $allowed) !== []) throw new InvalidArgumentException();
        foreach ($input as $value) if (!is_string($value)) throw new InvalidArgumentException();
        if (isset($input['pageSize'])) { $input['per_page'] = $input['pageSize']; unset($input['pageSize']); }
        return $input;
    }

    private function mediaExport(array $filters, int $actorId, string $ip, array $headers): Response
    {
        $columns = ['public_id', 'status', 'submitted_at', 'media_name', 'media_type', 'frequency_channel', 'program_name', 'program_type', 'province', 'city', 'contract', 'people_count', 'team', 'phone', 'contact_email', 'account_email'];
        $stream = fopen('php://temp/maxmemory:2097152', 'w+');
        if ($stream === false) throw new \RuntimeException();
        try {
            fwrite($stream, "\xEF\xBB\xBF");
            fputcsv($stream, $columns, ',', '"', '', "\r\n");
            $rows = $this->media()->exportRows($filters);
            foreach ($rows as $detail) {
                fputcsv($stream, array_map(static function (string $column) use ($detail): string {
                    $value = (string) ($detail[$column] ?? '');
                    // Also protect formulas hidden behind whitespace/control characters.
                    return preg_match('/^[\x00-\x20]*[=+@-]/', $value) ? "'" . $value : $value;
                }, $columns), ',', '"', '', "\r\n");
            }
            $this->audit->log('media.exported', $actorId, 'media_profile', null, ['count' => count($rows)], $ip);
            rewind($stream);
            $csv = stream_get_contents($stream);
            if ($csv === false) throw new \RuntimeException();
            $headers['Content-Type'] = 'text/csv; charset=utf-8';
            $headers['Content-Disposition'] = 'attachment; filename="medios-' . gmdate('Y-m-d') . '.csv"';
            return new Response(200, $headers, $csv);
        } finally {
            fclose($stream);
        }
    }

    private function health(array $headers): Response
    {
        $this->pdo->query('SELECT 1');
        $migration = $this->pdo->prepare('SELECT version FROM schema_migrations WHERE version = ?');
        $migration->execute([self::VOCERO_ACCOUNTS_MIGRATION]);
        $migrationReady = $migration->fetchColumn() === self::VOCERO_ACCOUNTS_MIGRATION;

        $imageFunctions = [
            'finfo_open', 'getimagesizefromstring', 'imagecreatefromstring', 'imagecreatefromjpeg',
            'imagecreatefrompng', 'imagecreatefromwebp', 'imagejpeg', 'imagerotate', 'imagesx', 'imagesy',
            'imagecreatetruecolor', 'imagefill', 'imagecolorallocate', 'imagecopyresampled', 'exif_read_data',
            'ob_start', 'ob_get_clean',
        ];
        if (PHP_VERSION_ID < 80500) $imageFunctions[] = 'imagedestroy';
        $cryptoFunctions = [
            'openssl_encrypt', 'openssl_decrypt', 'openssl_get_cipher_methods', 'random_bytes',
            'base64_encode', 'base64_decode', 'hash', 'hash_hmac', 'hash_equals', 'bin2hex',
        ];
        $storageFunctions = [
            'realpath', 'is_dir', 'is_link', 'is_writable', 'fileperms', 'disk_free_space', 'mkdir', 'chmod',
            'rename', 'unlink', 'fopen', 'fclose', 'fread', 'fwrite', 'fflush', 'feof', 'flock', 'lstat',
            'fstat', 'is_uploaded_file', 'is_resource', 'clearstatcache', 'umask', 'set_error_handler',
            'restore_error_handler', 'array_reverse', 'strlen', 'substr', 'pack', 'unpack', 'ord',
            'str_starts_with', 'str_ends_with', 'round', 'max',
        ];
        $functionsReady = self::functionsAvailable([...$imageFunctions, ...$cryptoFunctions, ...$storageFunctions]);
        $fileinfo = extension_loaded('fileinfo') && class_exists(\finfo::class, false) && function_exists('finfo_open');
        $gd = extension_loaded('gd') && function_exists('gd_info');
        $gdInfo = $gd ? gd_info() : [];
        $jpeg = $gd && ($gdInfo['JPEG Support'] ?? false) === true
            && self::functionsAvailable(['imagecreatefromjpeg', 'imagecreatefromstring', 'imagejpeg']);
        $png = $gd && ($gdInfo['PNG Support'] ?? false) === true
            && self::functionsAvailable(['imagecreatefrompng', 'imagecreatefromstring']);
        $webp = $gd && ($gdInfo['WebP Support'] ?? false) === true
            && self::functionsAvailable(['imagecreatefromwebp', 'imagecreatefromstring']);
        $exif = extension_loaded('exif') && function_exists('exif_read_data');
        $openssl = extension_loaded('openssl') && self::functionsAvailable($cryptoFunctions)
            && in_array('aes-256-gcm', array_map('strtolower', openssl_get_cipher_methods()), true);

        $memorySetting = ini_get('memory_limit');
        $memoryBytes = is_string($memorySetting) && trim($memorySetting) === '-1'
            ? -1
            : (self::iniBytes($memorySetting) ?? 0);
        $memoryReady = $memoryBytes === -1 || $memoryBytes >= self::PHOTO_MEMORY_BYTES;

        $fileUploads = filter_var(ini_get('file_uploads'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) === true;
        $uploadMaxBytes = self::iniBytes(ini_get('upload_max_filesize')) ?? 0;
        $postMaxBytes = self::iniBytes(ini_get('post_max_size')) ?? 0;
        $uploadLimitsReady = $fileUploads
            && $uploadMaxBytes >= self::PHOTO_UPLOAD_BYTES
            && $postMaxBytes >= self::PHOTO_UPLOAD_BYTES + self::PROFILE_REQUEST_OVERHEAD_BYTES;

        $storageFunctionsReady = self::functionsAvailable($storageFunctions);
        $privateDirectory = $this->config->privateDirectory();
        $resolvedPrivateDirectory = $storageFunctionsReady ? realpath($privateDirectory) : false;
        $privateCanonical = is_string($resolvedPrivateDirectory) && $resolvedPrivateDirectory === $privateDirectory
            && is_dir($privateDirectory) && !is_link($privateDirectory);
        $privateWritable = $privateCanonical && is_writable($privateDirectory);
        $mode = $privateCanonical ? @fileperms($privateDirectory) : false;
        $privatePermissions = is_int($mode) && ($mode & 0077) === 0 && ($mode & 0200) !== 0;
        $free = $privateCanonical && $storageFunctionsReady ? @disk_free_space($privateDirectory) : false;
        $freeBytes = self::safeBytes($free);
        $privateRoot = $storageFunctionsReady && $privateCanonical && $privateWritable && $privatePermissions
            && $freeBytes >= self::PRIVATE_FREE_BYTES;

        $photoRuntime = $fileinfo && $gd && $jpeg && $png && $webp && $exif && $openssl && $functionsReady
            && $memoryReady && $privateRoot && $uploadLimitsReady;
        $photoReady = $migrationReady && $photoRuntime;
        $ready = $migrationReady && $photoReady;

        return $this->json($ready ? 200 : 503, [
            'ok' => $ready,
            'service' => 'finados-voceros-api',
            'contract' => 'vocero-accounts-v1',
            'migration' => ['version' => self::VOCERO_ACCOUNTS_MIGRATION, 'ready' => $migrationReady],
            'capabilities' => [
                'voceroAccounts' => $migrationReady,
                'voceroProfile' => $migrationReady,
                'privatePhoto' => $photoReady,
                'adminPasswordReset' => $migrationReady,
                'photoUpload' => $photoReady,
            ],
            'runtime' => [
                'fileinfo' => $fileinfo,
                'gd' => $gd,
                'jpeg' => $jpeg,
                'png' => $png,
                'webp' => $webp,
                'exif' => $exif,
                'openssl' => $openssl,
                'functions' => $functionsReady,
            ],
            'storage' => [
                'privateRoot' => $privateRoot,
                'canonical' => $privateCanonical,
                'writable' => $privateWritable,
                'permissions' => $privatePermissions,
                'freeBytes' => $freeBytes,
            ],
            'limits' => [
                'fileUploads' => $fileUploads,
                'uploadMaxBytes' => $uploadMaxBytes,
                'postMaxBytes' => $postMaxBytes,
                'memoryBytes' => $memoryBytes,
            ],
        ], $headers);
    }

    private static function functionsAvailable(array $functions): bool
    {
        foreach ($functions as $function) if (!function_exists($function)) return false;
        return true;
    }

    private static function safeBytes(int|float|false $value): int
    {
        if ($value === false || $value < 0 || !is_finite((float) $value)) return 0;
        return (int) min((float) PHP_INT_MAX, floor((float) $value));
    }

    private static function iniBytes(string|false $value): ?int
    {
        if (!is_string($value) || preg_match('/^([0-9]+)([KMG]?)$/iD', trim($value), $parts) !== 1) return null;
        $multiplier = ['' => 1, 'K' => 1024, 'M' => 1024 ** 2, 'G' => 1024 ** 3][strtoupper($parts[2])];
        $quantity = (int) $parts[1];
        if ($quantity > intdiv(PHP_INT_MAX, $multiplier)) return null;
        return $quantity * $multiplier;
    }

    private function refererOrigin(array $server): ?string
    {
        $referer = $server['HTTP_REFERER'] ?? null;
        if ($referer === null) return null;
        if (!is_string($referer) || $referer === '') throw new Forbidden();
        $parts = parse_url($referer);
        if ($parts === false || !isset($parts['scheme'], $parts['host']) || !in_array($parts['scheme'], ['http', 'https'], true)
            || isset($parts['user'], $parts['pass']) || ($parts['scheme'] === 'https' && isset($parts['port']) && (int) $parts['port'] !== 443)
            || ($parts['scheme'] === 'http' && isset($parts['port']) && (int) $parts['port'] !== 80)) throw new Forbidden();
        $origin = $parts['scheme'] . '://' . $parts['host'];
        if (isset($parts['port'])) $origin .= ':' . (int) $parts['port'];
        return $origin;
    }

    private function body(array $server, string $raw, array $allowed): array
    {
        if (strlen($raw) > 16384 || (int) ($server['CONTENT_LENGTH'] ?? 0) > 16384) throw new RequestBodyError(413, 'payload_too_large');
        if (strtolower(trim(explode(';', $server['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') throw new RequestBodyError(415, 'unsupported_media_type');
        $decoded = json_decode($raw, false, 32, JSON_THROW_ON_ERROR);
        if (!$decoded instanceof \stdClass) throw new InvalidArgumentException();
        $body = (array) $decoded;
        if (array_diff(array_keys($body), $allowed) !== []) throw new InvalidArgumentException();
        return $body;
    }

    private function filters(array $input, bool $pagination = false): array
    {
        $allowed = $pagination ? [...self::FILTERS, 'page', 'pageSize', 'per_page'] : self::FILTERS;
        if (array_diff(array_keys($input), $allowed) !== []) throw new InvalidArgumentException();
        foreach ($input as $key => $value) {
            if (in_array($key, self::FILTERS, true) && !is_string($value)) throw new InvalidArgumentException();
        }
        if (isset($input['pageSize'])) {
            if (isset($input['per_page'])) throw new InvalidArgumentException();
            $input['per_page'] = $input['pageSize']; unset($input['pageSize']);
        }
        return $input;
    }

    private function export(array $filters, int $actorId, string $ip, array $headers): Response
    {
        $columns = ['public_id', 'submission_id', 'status', 'submitted_at', 'full_name', 'cedula', 'birth_date', 'age_at_submission', 'whatsapp', 'email', 'city', 'main_network', 'tiktok', 'instagram', 'facebook', 'previous_participation', 'community_source', 'kit_pickup', 'representative_name', 'representative_cedula', 'representative_phone', 'representative_email'];
        $stream = fopen('php://temp/maxmemory:2097152', 'w+');
        if ($stream === false) throw new \RuntimeException();
        $snapshot = false;
        try {
            // Keep every page and decrypted detail in one view despite concurrent registrations.
            if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
                $this->pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            }
            $this->pdo->beginTransaction();
            $snapshot = true;
            fwrite($stream, "\xEF\xBB\xBF");
            fputcsv($stream, $columns, ',', '"', '', "\r\n");
            $count = 0; $page = 1;
            do {
                $result = $this->repository->list([...$filters, 'page' => $page, 'per_page' => 100]);
                foreach ($result['items'] as $item) {
                    $detail = $this->repository->find($item['public_id']);
                    $values = array_map(static function (string $column) use ($detail): string {
                        $value = (string) ($detail[$column] ?? '');
                        // Also protect formulas hidden behind whitespace/control characters.
                        return preg_match('/^[\x00-\x20]*[=+@-]/', $value) ? "'" . $value : $value;
                    }, $columns);
                    fputcsv($stream, $values, ',', '"', '', "\r\n");
                    $count++;
                }
                $page++;
            } while (($page - 1) * 100 < $result['total']);
            $this->pdo->commit();
            $snapshot = false;
            $safeFilters = [];
            foreach ($filters as $key => $value) {
                if (trim($value) === '') continue;
                if (in_array($key, ['status', 'date_from', 'date_to'], true)) $safeFilters[$key] = trim($value);
                else $safeFilters[$key . '_hash'] = $this->crypto->lookup($value);
            }
            $this->audit->log('vocero.exported', $actorId, 'vocero', null, ['count' => $count, 'filters' => $safeFilters], $ip);
            rewind($stream);
            $csv = stream_get_contents($stream);
            if ($csv === false) throw new \RuntimeException();
            $headers['Content-Type'] = 'text/csv; charset=utf-8';
            $headers['Content-Disposition'] = 'attachment; filename="voceros-' . gmdate('Y-m-d') . '.csv"';
            return new Response(200, $headers, $csv);
        } finally {
            if ($snapshot && $this->pdo->inTransaction()) $this->pdo->rollBack();
            fclose($stream);
        }
    }

    private function json(int $status, array $payload, array $headers): Response
    {
        return new Response($status, $headers, json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    }

    private function error(int $status, string $code, string $message, array $headers): Response
    {
        return $this->json($status, ['ok' => false, 'code' => $code, 'message' => $message], $headers);
    }
}

final class RequestBodyError extends \RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $errorCode) { parent::__construct(); }
}
