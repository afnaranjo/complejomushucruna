<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use Throwable;

foreach (['Config', 'Database', 'Crypto', 'Audit', 'VocerosRepository', 'FinadosNameQueue', 'Auth', 'VoceroAuth', 'VoceroProfile', 'VoceroPasswordReset', 'MediaAuth', 'MediaRepository', 'MediaPasswordReset', 'EmprendedorAuth', 'EmprendedorRepository', 'EmprendedorPasswordReset', 'CreadoraAuth', 'CreadoraRepository', 'CreadoraPasswordReset', 'NewsRepository'] as $dependency) {
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
    private ?EmprendedorAuth $emprendedorAuthInstance = null;
    private ?EmprendedorRepository $emprendedorInstance = null;
    private ?CreadoraAuth $creadoraAuthInstance = null;
    private ?MfsAuth $mfsAuthInstance = null;
    private ?MfsRepository $mfsInstance = null;
    private ?CreadoraRepository $creadoraInstance = null;
    private ?NewsRepository $newsInstance = null;
    private ?FinadosNameQueue $nameQueueInstance = null;
    private readonly Audit $audit;
    private readonly Crypto $crypto;
    private const FILTERS = ['search', 'status', 'city', 'main_network', 'previous_participation', 'date_from', 'date_to'];
    private const MEDIA_FILTERS = ['search', 'status', 'province', 'media_type', 'paid_media', 'origin'];
    private const EMPRENDEDOR_FILTERS = ['search', 'status', 'city', 'main_network'];
    private const CREADORA_FILTERS = ['search', 'status', 'origin'];
    private const MFS_FILTERS = ['search', 'status'];
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
            if ($path === '/api/finados/nombres') {
                if ($method !== 'POST' || $query !== []) return $this->error($method === 'POST' ? 422 : 405, $method === 'POST' ? 'validation_error' : 'method_not_allowed', $method === 'POST' ? 'Revisa los datos de la solicitud.' : 'Método no permitido.', $headers);
                $body = $this->body($server, $rawBody, ['name', 'consent']);
                if (!is_string($body['name'] ?? null) || !is_bool($body['consent'] ?? null)) throw new InvalidArgumentException();
                return $this->json(201, $this->nameQueue()->enqueue($body['name'], $body['consent']), $headers);
            }
            if ($path === '/api/finados/nombres/cola') {
                if ($method !== 'GET' || array_diff(array_keys($query), ['limit']) !== []) return $this->error($method === 'GET' ? 422 : 405, $method === 'GET' ? 'validation_error' : 'method_not_allowed', $method === 'GET' ? 'Revisa los datos de la solicitud.' : 'Método no permitido.', $headers);
                $limit = isset($query['limit']) ? (int) $query['limit'] : 20;
                if ($limit < 1 || $limit > 20) throw new InvalidArgumentException();
                return $this->json(200, ['items' => $this->nameQueue()->pending($limit)], $headers);
            }
            // Badge QR validation is deliberately public but returns only a minimal projection.
            if (preg_match('~^/api/voceros/verify/([a-f0-9]{32})$~D', $path, $parts)) {
                if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                if ($query !== []) throw new InvalidArgumentException();
                $verification = $this->repository->publicVerification($parts[1]);
                if ($verification === null) throw new OutOfBoundsException();
                return $this->json(200, ['ok' => true, 'verification' => $verification], $headers);
            }
            if (preg_match('~^/api/mfs/verify/([a-f0-9]{32})$~D', $path, $parts)) {
                if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                if ($query !== []) throw new InvalidArgumentException();
                $verification = $this->mfs()->publicVerification($parts[1]);
                if ($verification === null) throw new OutOfBoundsException();
                return $this->json(200, ['ok' => true, 'verification' => $verification], $headers);
            }
            if (preg_match('~^/api/emprendedores/verify/([a-f0-9]{32})$~D', $path, $parts)) {
                if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                if ($query !== []) throw new InvalidArgumentException();
                $verification = $this->emprendedor()->publicVerification($parts[1]);
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
            // El enlace con el que cada persona del panel elige su contraseña: no requiere sesión.
            if ($path === '/api/admin-setup') {
                if (!$this->config->isAllowedOrigin($origin) && $origin !== null) throw new Forbidden();
                if ($method === 'GET') {
                    if (array_diff(array_keys($query), ['token']) !== [] || !is_string($query['token'] ?? null)) throw new InvalidArgumentException();
                    return $this->json(200, ['ok' => true, 'account' => $this->adminUsers()->setupPreview($query['token'])], $headers);
                }
                if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                if ($origin === null || !is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
                $this->auth->verifyCsrf($token);
                if ($query !== []) throw new InvalidArgumentException();
                $body = $this->body($server, $rawBody, ['token', 'password']);
                if (!is_string($body['token'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                $this->adminUsers()->completeSetup($body['token'], $body['password'], $ip);
                return $this->json(200, ['ok' => true], $headers);
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
            // Content creator accounts use their own session scope, like every other public account.
            if (str_starts_with($path, '/api/creadora/')) {
                $response = $this->creadoraAccount($method, $path, $query, $server, $rawBody, $origin, $ip, $token, $headers);
                if ($response !== null) return $response;
            }
            // Mushuc Freestyle participants use their own session scope, isolated from every other programme.
            if (str_starts_with($path, '/api/mfs/')) {
                $response = $this->mfsAccount($method, $path, $query, $server, $rawBody, $post, $files, $origin, $ip, $token, $headers);
                if ($response !== null) return $response;
            }
            // Entrepreneur accounts use their own session scope, isolated from Voceros, Medios and administration.
            if (str_starts_with($path, '/api/emprendedor/')) {
                $response = $this->emprendedorAccount($method, $path, $query, $server, $rawBody, $post, $files, $origin, $ip, $token, $headers);
                if ($response !== null) return $response;
            }
            // Media accounts use their own session scope, isolated from Voceros and administration.
            if (str_starts_with($path, '/api/media/')) {
                $response = $this->mediaAccount($method, $path, $query, $server, $rawBody, $files, $origin, $ip, $token, $headers);
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
            // Cada rol solo entra a sus módulos: el servidor lo exige en cada petición, no solo el menú.
            if (!AdminUsers::allows($user, AdminUsers::moduleFor($path, $method))) {
                return $this->error(403, 'forbidden_module', 'Tu rol no tiene acceso a esta sección.', $headers);
            }
            if (in_array($path, ['/api/admin-users', '/api/admin-roles', '/api/admin-activity'], true) || str_starts_with($path, '/api/admin-users/') || str_starts_with($path, '/api/admin-roles/')) {
                return $this->adminAccess($method, $path, $query, $server, $rawBody, $ip, $user, $headers);
            }
            if ($path === '/api/panel' && $method === 'GET') {
                if ($query !== []) throw new InvalidArgumentException();
                return $this->json(200, $this->panelSummary(), $headers);
            }
            if (str_starts_with($path, '/api/produccion/')) {
                return $this->productionAdmin($method, $path, $query, $server, $rawBody, $ip, $user, $headers);
            }
            if ($path === '/api/media-tour' || str_starts_with($path, '/api/media-tour/')) {
                return $this->mediaTourAdmin($method, $path, $query, $server, $rawBody, $ip, $user, $headers);
            }
            // El calendario de medios se carga bajo demanda: sus rutas usan constantes de la clase antes de instanciarla.
            if (str_starts_with($path, '/api/media-plan')) require_once __DIR__ . '/MediaPlanStore.php';
            if ($path === '/api/media-plan/audio') {
                if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                if ($query !== []) throw new InvalidArgumentException();
                $length = $server['CONTENT_LENGTH'] ?? null;
                if ($length !== null && ((!is_string($length) && !is_int($length)) || preg_match('/^\d+$/D', (string) $length) !== 1)) throw new InvalidArgumentException();
                if ($length !== null && (float) $length > MediaPlanStore::AUDIO_BYTES + self::PROFILE_REQUEST_OVERHEAD_BYTES) throw new RequestBodyError(413, 'payload_too_large');
                if (strtolower(trim(explode(';', $server['CONTENT_TYPE'] ?? '')[0])) !== 'multipart/form-data') throw new RequestBodyError(415, 'unsupported_media_type');
                $upload = $files['audio'] ?? null;
                if (count($files) !== 1 || !is_array($upload) || ($upload['error'] ?? null) !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null)
                    || !is_int($upload['size'] ?? null) || !is_uploaded_file($upload['tmp_name'])) throw new InvalidArgumentException();
                if ($upload['size'] > MediaPlanStore::AUDIO_BYTES) throw new RequestBodyError(413, 'payload_too_large');
                return $this->json(201, ['ok' => true, 'audio' => $this->mediaPlan()->saveAudio($upload['tmp_name'], $upload['size'], $upload['name'] ?? null, $user['id'], $ip)], $headers);
            }
            if (preg_match('~^/api/media-plan/audio/([a-f0-9]{32})$~D', $path, $parts)) {
                if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                if ($query !== []) throw new InvalidArgumentException();
                [$meta, $bytes] = $this->mediaPlan()->audio($parts[1]);
                $name = MediaPlanStore::fileName((string) ($meta['name'] ?? 'audio'));
                $ascii = preg_replace('/[^A-Za-z0-9._ -]/', '_', $name) ?: 'audio';
                $headers['Content-Type'] = (string) $meta['type'];
                $headers['Cache-Control'] = 'private, no-store';
                $headers['Content-Disposition'] = 'attachment; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($name);
                return new Response(200, $headers, $bytes);
            }
            if ($path === '/api/media-plan') {
                if ($query !== []) throw new InvalidArgumentException();
                if ($method === 'GET') return $this->json(200, $this->mediaPlan()->get(), $headers);
                if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                // El calendario completo puede superar el límite general de 16 KB: tiene su propio tope.
                if (strlen($rawBody) > MediaPlanStore::MAX_BYTES || (int) ($server['CONTENT_LENGTH'] ?? 0) > MediaPlanStore::MAX_BYTES) throw new RequestBodyError(413, 'payload_too_large');
                if (strtolower(trim(explode(';', $server['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') throw new RequestBodyError(415, 'unsupported_media_type');
                $body = json_decode($rawBody, true, 64, JSON_THROW_ON_ERROR);
                if (!is_array($body) || array_is_list($body) || array_diff(array_keys($body), ['data', 'version']) !== []) throw new InvalidArgumentException();
                try { return $this->json(200, $this->mediaPlan()->save($body['data'] ?? null, $body['version'] ?? null, $user['id'], $ip), $headers); }
                catch (MediaPlanConflict) { return $this->error(409, 'plan_conflict', 'Alguien guardó cambios antes. Recarga para ver la versión actual.', $headers); }
            }
            if ($path === '/api/redes-sociales') {
                if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
                if (array_diff(array_keys($query), ['from', 'to', 'refresh']) !== [] || !is_string($query['from'] ?? null) || !is_string($query['to'] ?? null)
                    || (isset($query['refresh']) && $query['refresh'] !== '1')) throw new InvalidArgumentException();
                try { $report = $this->socialMetrics()->report($query['from'], $query['to'], isset($query['refresh'])); }
                catch (InvalidArgumentException $error) { throw $error; }
                catch (Throwable) { return $this->error(503, 'social_unavailable', 'No se pudieron leer las redes sociales en este momento.', $headers); }
                return $this->json(200, $report, $headers);
            }
            if ($path === '/api/noticias' || str_starts_with($path, '/api/noticias/')) {
                return $this->news($method, $path, $query, $server, $rawBody, $ip, $user, $headers);
            }
            if ($path === '/api/creadoras' || str_starts_with($path, '/api/creadoras/')) {
                return $this->creadoraAdmin($method, $path, $query, $server, $rawBody, $ip, $user, $headers);
            }
            if ($path === '/api/mfs-participants' || str_starts_with($path, '/api/mfs-participants/') || $path === '/api/mfs-accounts' || str_starts_with($path, '/api/mfs-accounts/') || $path === '/api/mfs-dashboard') {
                return $this->mfsAdmin($method, $path, $query, $server, $rawBody, $origin, $refererOrigin, $ip, $user, $headers);
            }
            if ($path === '/api/emprendedores' || str_starts_with($path, '/api/emprendedores/') || $path === '/api/emprendedor-accounts' || str_starts_with($path, '/api/emprendedor-accounts/') || in_array($path, ['/api/emprendedor-dashboard', '/api/emprendedor-video-schedule'], true)) {
                return $this->emprendedorAdmin($method, $path, $query, $server, $rawBody, $origin, $refererOrigin, $ip, $user, $headers);
            }
            if ($path === '/api/medios' || str_starts_with($path, '/api/medios/') || $path === '/api/media-accounts' || str_starts_with($path, '/api/media-accounts/') || $path === '/api/media-claims' || $path === '/api/media-events' || str_starts_with($path, '/api/media-events/')) {
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
                return $this->json(200, ['total' => array_sum($statuses), 'byStatus' => $statuses, 'byDate' => (object) $dates, 'lastSevenDays' => (int) $recent->fetchColumn(), 'topFollowers' => $topFollowers, 'topVideos' => $this->repository->topVideos(20)], $headers);
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
        } catch (RateLimitException) {
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

    private ?AdminUsers $adminUsersInstance = null;

    private function adminUsers(): AdminUsers
    {
        return $this->adminUsersInstance ??= new AdminUsers($this->pdo, $this->audit);
    }

    /** Usuarios del panel, roles y actividad: solo quien tiene el módulo Usuarios llega aquí. */
    private function adminAccess(string $method, string $path, array $query, array $server, string $rawBody, mixed $ip, array $user, array $headers): Response
    {
        $users = $this->adminUsers();
        $ip = (string) $ip;
        $modules = array_map(static fn (string $key, array $module): array => ['key' => $key, 'label' => $module['label'], 'description' => $module['description']], array_keys(AdminUsers::MODULES), AdminUsers::MODULES);
        if ($path === '/api/admin-users') {
            if ($method === 'GET') {
                if ($query !== []) throw new InvalidArgumentException();
                return $this->json(200, ['users' => $users->users(), 'roles' => $users->roles(), 'modules' => $modules, 'me' => $user['public_id']], $headers);
            }
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            $body = $this->body($server, $rawBody, ['username', 'full_name', 'role']);
            return $this->json(201, ['ok' => true, ...$users->createUser($body, $user['id'], $ip)], $headers);
        }
        if (preg_match('~^/api/admin-users/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($method !== 'PATCH') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            $body = $this->body($server, $rawBody, ['full_name', 'role', 'active']);
            return $this->json(200, ['ok' => true, 'user' => $users->updateUser($parts[1], $body, $user['id'], $ip)], $headers);
        }
        if (preg_match('~^/api/admin-users/([a-f0-9]{32})/enlace$~D', $path, $parts)) {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            $this->body($server, $rawBody, []);
            return $this->json(201, ['ok' => true, 'link' => $users->createSetupLink($parts[1], $user['id'], $ip)], $headers);
        }
        if ($path === '/api/admin-roles') {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            $body = $this->body($server, $rawBody, ['name', 'description', 'modules']);
            return $this->json(201, ['ok' => true, 'role' => $users->saveRole(null, $body, $user['id'], $ip)], $headers);
        }
        if (preg_match('~^/api/admin-roles/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($method !== 'PATCH') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            $body = $this->body($server, $rawBody, ['name', 'description', 'modules']);
            return $this->json(200, ['ok' => true, 'role' => $users->saveRole($parts[1], $body, $user['id'], $ip)], $headers);
        }
        if ($path === '/api/admin-activity') {
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (array_diff(array_keys($query), ['user']) !== [] || (isset($query['user']) && !is_string($query['user']))) throw new InvalidArgumentException();
            return $this->json(200, ['activity' => $users->activity(150, (string) ($query['user'] ?? ''))], $headers);
        }
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    // Mushuc Freestyle loads its classes only when one of its routes is used, so a fault there
    // can never take down Voceros, Medios, Emprendedores or Creadoras.
    private function mfsAuth(): MfsAuth
    {
        require_once __DIR__ . '/MfsAuth.php';
        return $this->mfsAuthInstance ??= new MfsAuth($this->pdo, $this->config);
    }

    /** Producción → Activaciones, Cronograma Sol y Cronograma Luna: biblioteca de piezas y bloques en el calendario. */
    private function productionAdmin(string $method, string $path, array $query, array $server, string $rawBody, mixed $ip, array $user, array $headers): Response
    {
        require_once __DIR__ . '/ProductionRepository.php';
        $production = new ProductionRepository($this->pdo, $this->audit);
        $notAllowed = fn (): Response => $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        if (!preg_match('~^/api/produccion/([a-z]+)(?:/(items|entries)(?:/([a-f0-9]{32})(/archivar|/cancelar)?)?)?$~D', $path, $parts)) return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
        $board = ProductionRepository::board($parts[1]);
        $kind = $parts[2] ?? ''; $id = $parts[3] ?? ''; $action = $parts[4] ?? '';
        $itemFields = ['name', 'description', 'color', 'duration_minutes'];
        $entryFields = ['item', 'title', 'color', 'starts_at', 'ends_at', 'status', 'owner', 'place', 'note'];
        if ($kind === '') {
            if ($method !== 'GET') return $notAllowed();
            if (array_diff(array_keys($query), ['from', 'to']) !== [] || !is_string($query['from'] ?? null) || !is_string($query['to'] ?? null)) throw new InvalidArgumentException();
            return $this->json(200, $production->calendar($board, $query['from'], $query['to']), $headers);
        }
        if ($query !== []) throw new InvalidArgumentException();
        if ($kind === 'items') {
            if ($id === '') { if ($method !== 'POST') return $notAllowed(); return $this->json(201, ['item' => $production->createItem($board, $this->body($server, $rawBody, $itemFields), $user['id'], $ip)], $headers); }
            if ($action === '/archivar') { if ($method !== 'POST') return $notAllowed(); $production->archiveItem($board, $id, $user['id'], $ip); return $this->json(200, ['ok' => true], $headers); }
            if ($action !== '' || $method !== 'PATCH') return $notAllowed();
            return $this->json(200, ['item' => $production->updateItem($board, $id, $this->body($server, $rawBody, $itemFields), $user['id'], $ip)], $headers);
        }
        if ($id === '') { if ($method !== 'POST') return $notAllowed(); return $this->json(201, ['entry' => $production->createEntry($board, $this->body($server, $rawBody, $entryFields), $user['id'], $ip)], $headers); }
        if ($action === '/cancelar') { if ($method !== 'POST') return $notAllowed(); $production->cancelEntry($board, $id, $user['id'], $ip); return $this->json(200, ['ok' => true], $headers); }
        if ($action !== '' || $method !== 'PATCH') return $notAllowed();
        return $this->json(200, ['entry' => $production->updateEntry($board, $id, $this->body($server, $rawBody, $entryFields), $user['id'], $ip)], $headers);
    }

    /** Medios → Gira de medios: personas y citas en los medios de Seguimiento. */
    private function mediaTourAdmin(string $method, string $path, array $query, array $server, string $rawBody, mixed $ip, array $user, array $headers): Response
    {
        require_once __DIR__ . '/MediaTourRepository.php';
        $tour = new MediaTourRepository($this->pdo, $this->crypto, $this->audit);
        $notAllowed = fn (): Response => $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        $personFields = ['name', 'role', 'phone', 'note'];
        $visitFields = ['media', 'people', 'starts_at', 'ends_at', 'kind', 'status', 'place', 'note'];
        try {
            if ($path === '/api/media-tour') {
                if ($method !== 'GET') return $notAllowed();
                if (array_diff(array_keys($query), ['from', 'to']) !== [] || !is_string($query['from'] ?? null) || !is_string($query['to'] ?? null)) throw new InvalidArgumentException();
                return $this->json(200, $tour->calendar($query['from'], $query['to']), $headers);
            }
            if ($query !== []) throw new InvalidArgumentException();
            if ($path === '/api/media-tour/people') {
                if ($method !== 'POST') return $notAllowed();
                return $this->json(201, ['person' => $tour->createPerson($this->body($server, $rawBody, $personFields), $user['id'], $ip)], $headers);
            }
            if (preg_match('~^/api/media-tour/people/([a-f0-9]{32})(/retirar)?$~D', $path, $parts)) {
                if (($parts[2] ?? '') === '/retirar') {
                    if ($method !== 'POST') return $notAllowed();
                    $tour->retirePerson($parts[1], $user['id'], $ip);
                    return $this->json(200, ['ok' => true], $headers);
                }
                if ($method !== 'PATCH') return $notAllowed();
                return $this->json(200, ['person' => $tour->updatePerson($parts[1], $this->body($server, $rawBody, $personFields), $user['id'], $ip)], $headers);
            }
            if ($path === '/api/media-tour/visits') {
                if ($method !== 'POST') return $notAllowed();
                return $this->json(201, ['visit' => $tour->createVisit($this->body($server, $rawBody, $visitFields), $user['id'], $ip)], $headers);
            }
            if (preg_match('~^/api/media-tour/visits/([a-f0-9]{32})(/cancelar)?$~D', $path, $parts)) {
                if (($parts[2] ?? '') === '/cancelar') {
                    if ($method !== 'POST') return $notAllowed();
                    $tour->cancelVisit($parts[1], $user['id'], $ip);
                    return $this->json(200, ['ok' => true], $headers);
                }
                if ($method === 'GET') return $this->json(200, ['visit' => $tour->visit($parts[1])], $headers);
                if ($method !== 'PATCH') return $notAllowed();
                return $this->json(200, ['visit' => $tour->updateVisit($parts[1], $this->body($server, $rawBody, $visitFields), $user['id'], $ip)], $headers);
            }
        } catch (MediaTourConflict) {
            return $this->error(409, 'tour_conflict', 'Esa persona ya tiene otra cita a esa hora.', $headers);
        }
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    private function mediaPlan(): MediaPlanStore
    {
        require_once __DIR__ . '/MediaPlanStore.php';
        return new MediaPlanStore($this->pdo, $this->audit, $this->config->privateDirectory());
    }

    private function socialMetrics(): SocialMetrics
    {
        require_once __DIR__ . '/SocialMetrics.php';
        return new SocialMetrics($this->config->privateDirectory());
    }

    private function mfs(): MfsRepository
    {
        require_once __DIR__ . '/MfsRepository.php';
        return $this->mfsInstance ??= new MfsRepository($this->pdo, $this->crypto, $this->audit);
    }

    private function mfsReset(): MfsPasswordReset
    {
        require_once __DIR__ . '/MfsPasswordReset.php';
        return new MfsPasswordReset($this->pdo, $this->config);
    }

    private function mfsPhotos(): MfsPhotoStorage
    {
        require_once __DIR__ . '/MfsPhotoStorage.php';
        return new MfsPhotoStorage($this->config, $this->crypto);
    }

    private function mfsAccount(string $method, string $path, array $query, array $server, string $rawBody, array $post, array $files, ?string $origin, mixed $ip, string $token, array $headers): ?Response
    {
        $validIp = is_string($ip) && inet_pton($ip) !== false;
        $auth = $this->mfsAuth();
        if ($path === '/api/mfs/auth/session') {
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            try { $user = $auth->requireUser(); } catch (Unauthorized) { $user = null; }
            return $this->json(200, ['authenticated' => $user !== null, 'user' => $user, 'csrf' => $auth->csrfToken()], $headers);
        }
        if (in_array($path, ['/api/mfs/auth/register', '/api/mfs/auth/login', '/api/mfs/auth/logout', '/api/mfs/auth/reset'], true)) {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp) throw new Forbidden();
            $auth->verifyCsrf($token);
            if ($query !== []) throw new InvalidArgumentException();
            if ($path === '/api/mfs/auth/reset') {
                $body = $this->body($server, $rawBody, ['token', 'password']);
                if (!is_string($body['token'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                $this->mfsReset()->consume($body['token'], $body['password'], $ip);
                $auth->logout();
                return $this->json(200, ['ok' => true, 'csrf' => $auth->csrfToken()], $headers);
            }
            if ($path === '/api/mfs/auth/register') {
                $body = $this->body($server, $rawBody, ['email', 'password', 'privacyAcknowledged']);
                if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null) || !is_bool($body['privacyAcknowledged'] ?? null)) throw new InvalidArgumentException();
                $auth->register($body['email'], $body['password'], $body['privacyAcknowledged'], $ip);
                return $this->json(202, ['ok' => true, 'message' => 'Cuenta creada; inicia sesión.'], $headers);
            }
            if ($path === '/api/mfs/auth/login') {
                $body = $this->body($server, $rawBody, ['email', 'password']);
                if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                $result = $auth->login($body['email'], $body['password'], $ip);
                try { $this->audit->log('mfs_account.login', null, 'mfs_account', $result['user']['public_id'], [], $ip); }
                catch (Throwable $error) { $auth->logout(); throw $error; }
                return $this->json(200, ['authenticated' => true, ...$result], $headers);
            }
            $user = $auth->requireUser();
            $this->audit->log('mfs_account.logout', null, 'mfs_account', $user['public_id'], [], $ip);
            $auth->logout();
            return $this->json(200, ['ok' => true], $headers);
        }
        if (in_array($path, ['/api/mfs/profile', '/api/mfs/photo'], true)) {
            $user = $auth->requireUser();
            if (!in_array($method, $path === '/api/mfs/profile' ? ['GET', 'POST'] : ['GET'], true)) return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'POST') {
                // Mismo contrato multipart que los demás programas: campos de texto más la fotografía.
                if (!$this->config->isAllowedOrigin($origin) || !$validIp) throw new Forbidden();
                $auth->verifyCsrf($token);
                $length = $server['CONTENT_LENGTH'] ?? null;
                if ($length !== null && ((!is_string($length) && !is_int($length)) || preg_match('/^\d+$/D', (string) $length) !== 1)) throw new InvalidArgumentException();
                if (($length !== null && (float) $length > self::PHOTO_UPLOAD_BYTES + self::PROFILE_REQUEST_OVERHEAD_BYTES) || strlen($rawBody) > self::PHOTO_UPLOAD_BYTES + self::PROFILE_REQUEST_OVERHEAD_BYTES) throw new RequestBodyError(413, 'payload_too_large');
                if (strtolower(trim(explode(';', $server['CONTENT_TYPE'] ?? '')[0])) !== 'multipart/form-data') throw new RequestBodyError(415, 'unsupported_media_type');
                $fieldBytes = 0;
                foreach ($post as $field => $value) {
                    if (!is_string($value)) throw new InvalidArgumentException();
                    $fieldBytes += strlen((string) $field) + strlen($value);
                }
                if ($fieldBytes > self::PROFILE_REQUEST_OVERHEAD_BYTES) throw new RequestBodyError(413, 'payload_too_large');
                $upload = null;
                if ($files !== []) {
                    $upload = $files['fotografia'] ?? null;
                    if (count($files) !== 1 || !is_array($upload)) throw new InvalidArgumentException();
                    if (($upload['error'] ?? null) === UPLOAD_ERR_NO_FILE) $upload = null;
                    elseif (($upload['error'] ?? null) !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null) || !is_int($upload['size'] ?? null) || !is_uploaded_file($upload['tmp_name'])) throw new InvalidArgumentException();
                    elseif ($upload['size'] > self::PHOTO_UPLOAD_BYTES) throw new RequestBodyError(413, 'payload_too_large');
                }
                $saved = $this->mfs()->saveForAccount($user['id'], $post, $upload, $this->mfsPhotos(), $ip);
                return $this->json(200, ['registered' => true, 'email' => $user['email'], ...$saved], $headers);
            }
            if ($path === '/api/mfs/photo') {
                $headers['Content-Type'] = 'image/jpeg'; $headers['Cache-Control'] = 'private, no-store';
                return new Response(200, $headers, $this->mfs()->photoForAccount($user['id'], $this->mfsPhotos()));
            }
            $own = $this->mfs()->forAccount($user['id']);
            return $this->json(200, $own === null
                ? ['registered' => false, 'email' => $user['email'], 'status' => null, 'editable' => true, 'photo' => ['available' => false, 'width' => null, 'height' => null, 'created_at' => null]]
                : ['registered' => true, 'email' => $user['email'], ...$own], $headers);
        }
        if ($path === '/api/mfs/cedula') {
            $user = $auth->requireUser();
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp || $query !== []) throw new Forbidden();
            $auth->verifyCsrf($token);
            $body = $this->body($server, $rawBody, ['cedula']);
            $saved = $this->mfs()->addCedulaForAccount($user['id'], $body['cedula'] ?? null, $ip);
            return $this->json(200, ['registered' => true, 'email' => $user['email'], ...$saved], $headers);
        }
        // Nada más bajo este prefijo pertenece a un programa: nunca cae en la guardia administrativa.
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    /** Rutas administrativas de Mushuc Freestyle; la sesión admin y el CSRF de escritura ya se comprobaron. */
    private function mfsAdmin(string $method, string $path, array $query, array $server, string $rawBody, ?string $origin, ?string $refererOrigin, mixed $ip, array $user, array $headers): Response
    {
        $notAllowed = fn (): Response => $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        if (!is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
        $repository = $this->mfs();
        if ($path === '/api/mfs-participants') {
            if ($method !== 'GET') return $notAllowed();
            $result = $repository->list($this->mfsFilters($query, true));
            return $this->json(200, ['items' => $result['items'], 'pagination' => [
                'page' => $result['page'], 'pageSize' => $result['per_page'], 'total' => $result['total'],
                'pages' => (int) ceil($result['total'] / $result['per_page']),
            ]], $headers);
        }
        if ($path === '/api/mfs-dashboard') {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, $repository->dashboard(), $headers);
        }
        if ($path === '/api/mfs-accounts') {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, ['items' => $repository->pendingAccounts()], $headers);
        }
        if ($path === '/api/mfs-participants/export') {
            if ($method !== 'POST') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->mfsExport($this->mfsFilters($this->body($server, $rawBody, self::MFS_FILTERS)), $user['id'], $ip, $headers);
        }
        if (preg_match('~^/api/mfs-accounts/([a-f0-9]{32})/delete$~D', $path, $parts)) {
            if ($method !== 'POST') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $this->body($server, $rawBody, []);
            $repository->archiveAccount($parts[1], $user['id'], $ip);
            return $this->json(200, ['ok' => true], $headers);
        }
        if (preg_match('~^/api/mfs-participants/([a-f0-9]{32})/photo$~D', $path, $parts)) {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $jpeg = $repository->photoForAdmin($parts[1], $this->mfsPhotos(), $user['id'], $ip);
            $headers['Content-Type'] = 'image/jpeg'; $headers['Cache-Control'] = 'private, no-store';
            return new Response(200, $headers, $jpeg);
        }
        if (preg_match('~^/api/mfs-participants/([a-f0-9]{32})(?:/(delete|restore|notes|audition|password-reset))?$~D', $path, $parts)) {
            $id = $parts[1]; $action = $parts[2] ?? '';
            if ($query !== []) throw new InvalidArgumentException();
            if ($action === '' && $method === 'GET') {
                $detail = $repository->find($id, true);
                if ($detail === null) throw new OutOfBoundsException();
                $this->audit->log('mfs.viewed', $user['id'], 'mfs_profile', $id, [], $ip);
                return $this->json(200, $detail, $headers);
            }
            if ($action === '' && $method === 'PATCH') {
                $body = $this->body($server, $rawBody, ['status']);
                if (!is_string($body['status'] ?? null)) throw new InvalidArgumentException();
                $repository->changeStatus($id, $body['status'], $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($action !== '' && $method !== 'POST') return $notAllowed();
            if ($action === 'notes') {
                $body = $this->body($server, $rawBody, ['body']);
                if (!is_string($body['body'] ?? null)) throw new InvalidArgumentException();
                $repository->addNote($id, $body['body'], $user['id'], $ip);
                return $this->json(201, ['ok' => true], $headers);
            }
            if ($action === 'audition') {
                $body = $this->body($server, $rawBody, ['url']);
                $repository->correctAudition($id, $body['url'] ?? null, $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($action === 'delete') {
                $this->body($server, $rawBody, []);
                $repository->archive($id, $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($action === 'restore') {
                $this->body($server, $rawBody, []);
                $repository->restore($id, $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($action === 'password-reset') {
                if (!$this->config->isAllowedOrigin($origin)) throw new Forbidden();
                $this->body($server, $rawBody, []);
                $raw = $this->mfsReset()->create($id, $user['id'], $ip);
                $resetOrigin = $origin ?? $refererOrigin ?? $this->config->allowedOrigin();
                return $this->json(201, ['resetUrl' => $resetOrigin . '/finados/mfs/restablecer/?token=' . $raw], $headers);
            }
            return $notAllowed();
        }
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    private function mfsFilters(array $input, bool $pagination = false): array
    {
        $allowed = $pagination ? [...self::MFS_FILTERS, 'page', 'pageSize'] : self::MFS_FILTERS;
        if (array_diff(array_keys($input), $allowed) !== []) throw new InvalidArgumentException();
        foreach ($input as $value) if (!is_string($value)) throw new InvalidArgumentException();
        if (isset($input['pageSize'])) { $input['per_page'] = $input['pageSize']; unset($input['pageSize']); }
        return $input;
    }

    private function mfsExport(array $filters, int $actorId, string $ip, array $headers): Response
    {
        $columns = ['public_id', 'status', 'submitted_at', 'full_name', 'stage_name', 'cedula', 'whatsapp', 'email', 'audition_url', 'audition_submitted_at', 'has_photo'];
        $stream = fopen('php://temp/maxmemory:2097152', 'w+');
        if ($stream === false) throw new \RuntimeException();
        try {
            fwrite($stream, "\xEF\xBB\xBF");
            fputcsv($stream, $columns, ',', '"', '', "\r\n");
            $rows = $this->mfs()->exportRows($filters);
            foreach ($rows as $detail) {
                $detail = [...$detail, 'has_photo' => ($detail['photo']['available'] ?? false) ? 'Sí' : 'No'];
                fputcsv($stream, array_map(static function (string $column) use ($detail): string {
                    $value = (string) ($detail[$column] ?? '');
                    return preg_match('/^[\x00-\x20]*[=+@-]/', $value) ? "'" . $value : $value;
                }, $columns), ',', '"', '', "\r\n");
            }
            $this->audit->log('mfs.exported', $actorId, 'mfs_profile', null, ['count' => count($rows)], $ip);
            rewind($stream);
            $csv = stream_get_contents($stream);
            if ($csv === false) throw new \RuntimeException();
            $headers['Content-Type'] = 'text/csv; charset=utf-8';
            $headers['Content-Disposition'] = 'attachment; filename="mushuc-freestyle-' . gmdate('Y-m-d') . '.csv"';
            return new Response(200, $headers, $csv);
        } finally {
            fclose($stream);
        }
    }

    // Entrepreneur services load on first use, like Medios, so a fault there never takes down the other programmes.
    private function emprendedorAuth(): EmprendedorAuth
    {
        return $this->emprendedorAuthInstance ??= new EmprendedorAuth($this->pdo, $this->config);
    }

    private function nameQueue(): FinadosNameQueue
    {
        return $this->nameQueueInstance ??= new FinadosNameQueue($this->pdo);
    }

    private function emprendedor(): EmprendedorRepository
    {
        return $this->emprendedorInstance ??= new EmprendedorRepository($this->pdo, $this->crypto, $this->audit);
    }

    private function emprendedorAccount(string $method, string $path, array $query, array $server, string $rawBody, array $post, array $files, ?string $origin, mixed $ip, string $token, array $headers): ?Response
    {
        $validIp = is_string($ip) && inet_pton($ip) !== false;
        $auth = $this->emprendedorAuth();
        if ($path === '/api/emprendedor/auth/session') {
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            try { $user = $auth->requireUser(); } catch (Unauthorized) { $user = null; }
            return $this->json(200, ['authenticated' => $user !== null, 'user' => $user, 'csrf' => $auth->csrfToken()], $headers);
        }
        if (in_array($path, ['/api/emprendedor/auth/register', '/api/emprendedor/auth/login', '/api/emprendedor/auth/logout', '/api/emprendedor/auth/reset'], true)) {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp) throw new Forbidden();
            $auth->verifyCsrf($token);
            if ($query !== []) throw new InvalidArgumentException();
            if ($path === '/api/emprendedor/auth/reset') {
                $body = $this->body($server, $rawBody, ['token', 'password']);
                if (!is_string($body['token'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                (new EmprendedorPasswordReset($this->pdo, $this->config))->consume($body['token'], $body['password'], $ip);
                $auth->logout();
                return $this->json(200, ['ok' => true, 'csrf' => $auth->csrfToken()], $headers);
            }
            if ($path === '/api/emprendedor/auth/register') {
                $body = $this->body($server, $rawBody, ['email', 'password', 'privacyAcknowledged']);
                if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null) || !is_bool($body['privacyAcknowledged'] ?? null)) throw new InvalidArgumentException();
                $auth->register($body['email'], $body['password'], $body['privacyAcknowledged'], $ip);
                return $this->json(202, ['ok' => true, 'message' => 'Cuenta creada; inicia sesión.'], $headers);
            }
            if ($path === '/api/emprendedor/auth/login') {
                $body = $this->body($server, $rawBody, ['email', 'password']);
                if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                $result = $auth->login($body['email'], $body['password'], $ip);
                try { $this->audit->log('emprendedor_account.login', null, 'emprendedor_account', $result['user']['public_id'], [], $ip); }
                catch (Throwable $error) { $auth->logout(); throw $error; }
                return $this->json(200, ['authenticated' => true, ...$result], $headers);
            }
            $user = $auth->requireUser();
            $this->audit->log('emprendedor_account.logout', null, 'emprendedor_account', $user['public_id'], [], $ip);
            $auth->logout();
            return $this->json(200, ['ok' => true], $headers);
        }
        if (in_array($path, ['/api/emprendedor/profile', '/api/emprendedor/photo'], true)) {
            $user = $auth->requireUser();
            if (!in_array($method, $path === '/api/emprendedor/profile' ? ['GET', 'POST'] : ['GET'], true)) return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'POST') {
                // Same multipart contract as the Voceros form: text fields plus an optional photo.
                if (!$this->config->isAllowedOrigin($origin) || !$validIp) throw new Forbidden();
                $auth->verifyCsrf($token);
                $length = $server['CONTENT_LENGTH'] ?? null;
                if ($length !== null && ((!is_string($length) && !is_int($length)) || preg_match('/^\d+$/D', (string) $length) !== 1)) throw new InvalidArgumentException();
                if (($length !== null && (float) $length > self::PHOTO_UPLOAD_BYTES + self::PROFILE_REQUEST_OVERHEAD_BYTES) || strlen($rawBody) > self::PHOTO_UPLOAD_BYTES + self::PROFILE_REQUEST_OVERHEAD_BYTES) throw new RequestBodyError(413, 'payload_too_large');
                if (strtolower(trim(explode(';', $server['CONTENT_TYPE'] ?? '')[0])) !== 'multipart/form-data') throw new RequestBodyError(415, 'unsupported_media_type');
                $fieldBytes = 0;
                foreach ($post as $field => $value) {
                    if (!is_string($value)) throw new InvalidArgumentException();
                    $fieldBytes += strlen((string) $field) + strlen($value);
                }
                if ($fieldBytes > self::PROFILE_REQUEST_OVERHEAD_BYTES) throw new RequestBodyError(413, 'payload_too_large');
                $upload = null;
                if ($files !== []) {
                    $upload = $files['fotografia'] ?? null;
                    if (count($files) !== 1 || !is_array($upload)) throw new InvalidArgumentException();
                    if (($upload['error'] ?? null) === UPLOAD_ERR_NO_FILE) $upload = null;
                    elseif (($upload['error'] ?? null) !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null) || !is_int($upload['size'] ?? null) || !is_uploaded_file($upload['tmp_name'])) throw new InvalidArgumentException();
                    elseif ($upload['size'] > self::PHOTO_UPLOAD_BYTES) throw new RequestBodyError(413, 'payload_too_large');
                }
                $saved = $this->emprendedor()->saveForAccount($user['id'], $post, $upload, new EmprendedorPhotoStorage($this->config, $this->crypto), $ip);
                return $this->json(200, ['registered' => true, 'email' => $user['email'], ...$saved], $headers);
            }
            if ($path === '/api/emprendedor/photo') {
                $headers['Content-Type'] = 'image/jpeg'; $headers['Cache-Control'] = 'private, no-store';
                return new Response(200, $headers, $this->emprendedor()->photoForAccount($user['id'], new EmprendedorPhotoStorage($this->config, $this->crypto)));
            }
            $own = $this->emprendedor()->forAccount($user['id']);
            return $this->json(200, $own === null
                ? ['registered' => false, 'email' => $user['email'], 'status' => null, 'editable' => true, 'photo' => ['available' => false, 'width' => null, 'height' => null, 'created_at' => null]]
                : ['registered' => true, 'email' => $user['email'], ...$own], $headers);
        }
        if (preg_match('~^/api/emprendedor/videos/([1-5])$~D', $path, $parts)) {
            $user = $auth->requireUser();
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp || $query !== []) throw new Forbidden();
            $auth->verifyCsrf($token);
            $body = $this->body($server, $rawBody, ['url']);
            $saved = $this->emprendedor()->saveVideoForAccount($user['id'], (int) $parts[1], $body['url'] ?? null, $ip);
            return $this->json(200, ['ok' => true, 'registered' => true, 'email' => $user['email'], ...$saved], $headers);
        }
        // Anything else under this prefix belongs to no programme; never fall through to the administrative guard.
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    /** Administrative entrepreneur routes; the caller already enforced the admin session and CSRF for writes. */
    private function emprendedorAdmin(string $method, string $path, array $query, array $server, string $rawBody, ?string $origin, ?string $refererOrigin, mixed $ip, array $user, array $headers): Response
    {
        $notAllowed = fn (): Response => $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        if (!is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
        $repository = $this->emprendedor();
        if ($path === '/api/emprendedores') {
            if ($method !== 'GET') return $notAllowed();
            $result = $repository->list($this->emprendedorFilters($query, true));
            return $this->json(200, ['items' => $result['items'], 'pagination' => [
                'page' => $result['page'], 'pageSize' => $result['per_page'], 'total' => $result['total'],
                'pages' => (int) ceil($result['total'] / $result['per_page']),
            ]], $headers);
        }
        if ($path === '/api/emprendedor-dashboard') {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, $repository->dashboard(), $headers);
        }
        if ($path === '/api/emprendedor-accounts') {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, ['items' => $repository->pendingAccounts()], $headers);
        }
        if ($path === '/api/emprendedor-video-schedule') {
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'GET') return $this->json(200, ['video_slots' => $repository->videoSchedule()], $headers);
            if ($method !== 'PATCH') return $notAllowed();
            $body = $this->body($server, $rawBody, ['video_slots']);
            $repository->updateVideoSchedule($body['video_slots'] ?? null, $user['id'], $ip);
            return $this->json(200, ['ok' => true, 'video_slots' => $repository->videoSchedule()], $headers);
        }
        if ($path === '/api/emprendedores/export') {
            if ($method !== 'POST') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->emprendedorExport($this->emprendedorFilters($this->body($server, $rawBody, self::EMPRENDEDOR_FILTERS)), $user['id'], $ip, $headers);
        }
        if (preg_match('~^/api/emprendedor-accounts/([a-f0-9]{32})/delete$~D', $path, $parts)) {
            if ($method !== 'POST') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $this->body($server, $rawBody, []);
            $repository->archiveAccount($parts[1], $user['id'], $ip);
            return $this->json(200, ['ok' => true], $headers);
        }
        if (preg_match('~^/api/emprendedores/([a-f0-9]{32})/photo$~D', $path, $parts)) {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $jpeg = $repository->photoForAdmin($parts[1], new EmprendedorPhotoStorage($this->config, $this->crypto), $user['id'], $ip);
            $headers['Content-Type'] = 'image/jpeg'; $headers['Cache-Control'] = 'private, no-store';
            return new Response(200, $headers, $jpeg);
        }
        if (preg_match('~^/api/emprendedores/([a-f0-9]{32})/progress$~D', $path, $parts)) {
            if ($method !== 'PATCH') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $body = $this->body($server, $rawBody, ['followers_count', 'level', 'traffic_light', 'video_views']);
            $repository->updateProgress($parts[1], $body, $user['id'], $ip);
            return $this->json(200, ['ok' => true], $headers);
        }
        if (preg_match('~^/api/emprendedores/([a-f0-9]{32})(?:/(delete|notes|password-reset))?$~D', $path, $parts)) {
            $id = $parts[1]; $action = $parts[2] ?? '';
            if ($query !== []) throw new InvalidArgumentException();
            if ($action === '' && $method === 'GET') {
                $detail = $repository->find($id);
                if ($detail === null) throw new OutOfBoundsException();
                $this->audit->log('emprendedor.viewed', $user['id'], 'emprendedor_profile', $id, [], $ip);
                return $this->json(200, $detail, $headers);
            }
            if ($action === '' && $method === 'PATCH') {
                $body = $this->body($server, $rawBody, ['status']);
                if (!is_string($body['status'] ?? null)) throw new InvalidArgumentException();
                $repository->changeStatus($id, $body['status'], $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($action !== '' && $method !== 'POST') return $notAllowed();
            if ($action === 'notes') {
                $body = $this->body($server, $rawBody, ['body']);
                if (!is_string($body['body'] ?? null)) throw new InvalidArgumentException();
                $repository->addNote($id, $body['body'], $user['id'], $ip);
                return $this->json(201, ['ok' => true], $headers);
            }
            if ($action === 'delete') {
                $this->body($server, $rawBody, []);
                $repository->archive($id, $user['id'], $ip);
                return $this->json(200, ['ok' => true], $headers);
            }
            if ($action === 'password-reset') {
                if (!$this->config->isAllowedOrigin($origin)) throw new Forbidden();
                $this->body($server, $rawBody, []);
                $raw = (new EmprendedorPasswordReset($this->pdo, $this->config))->create($id, $user['id'], $ip);
                $resetOrigin = $origin ?? $refererOrigin ?? $this->config->allowedOrigin();
                return $this->json(201, ['resetUrl' => $resetOrigin . '/finados/emprendedores/restablecer/?token=' . $raw], $headers);
            }
            return $notAllowed();
        }
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    /** El tema central de la campaña, que todos los paneles muestran arriba. */
    private function news(string $method, string $path, array $query, array $server, string $rawBody, mixed $ip, array $user, array $headers): Response
    {
        $repository = $this->newsInstance ??= new NewsRepository($this->pdo, $this->audit);
        if ($path === '/api/noticias') {
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, $repository->overview(), $headers);
        }
        if ($query !== []) throw new InvalidArgumentException();
        if ($path === '/api/noticias/fases') {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            $body = $this->body($server, $rawBody, ['title', 'detail', 'starts_on', 'ends_on', 'accent']);
            return $this->json(201, ['ok' => true, ...$repository->createPhase($body, $user['id'], $ip)], $headers);
        }
        if (preg_match('~^/api/noticias/fases/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($method === 'PATCH') {
                $body = $this->body($server, $rawBody, ['title', 'detail', 'starts_on', 'ends_on', 'accent']);
                return $this->json(200, ['ok' => true, ...$repository->updatePhase($parts[1], $body, $user['id'], $ip)], $headers);
            }
            if ($method === 'POST') return $this->json(200, ['ok' => true, ...$repository->deletePhase($parts[1], $user['id'], $ip)], $headers);
            return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        }
        if ($path === '/api/noticias/avisos') {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            $body = $this->body($server, $rawBody, ['body', 'starts_on', 'ends_on']);
            return $this->json(201, ['ok' => true, ...$repository->createNotice($body, $user['id'], $ip)], $headers);
        }
        if (preg_match('~^/api/noticias/avisos/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            return $this->json(200, ['ok' => true, ...$repository->deleteNotice($parts[1], $user['id'], $ip)], $headers);
        }
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    private function creadoraAuth(): CreadoraAuth
    {
        return $this->creadoraAuthInstance ??= new CreadoraAuth($this->pdo, $this->config);
    }

    private function creadoras(): CreadoraRepository
    {
        return $this->creadoraInstance ??= new CreadoraRepository($this->pdo, $this->crypto, $this->audit);
    }

    private function creadoraAccount(string $method, string $path, array $query, array $server, string $rawBody, ?string $origin, mixed $ip, string $token, array $headers): ?Response
    {
        $validIp = is_string($ip) && inet_pton($ip) !== false;
        $auth = $this->creadoraAuth();
        if ($path === '/api/creadora/auth/session') {
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            try { $user = $auth->requireUser(); } catch (Unauthorized) { $user = null; }
            return $this->json(200, ['authenticated' => $user !== null, 'user' => $user, 'csrf' => $auth->csrfToken()], $headers);
        }
        if (in_array($path, ['/api/creadora/auth/register', '/api/creadora/auth/login', '/api/creadora/auth/logout', '/api/creadora/auth/reset'], true)) {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp) throw new Forbidden();
            $auth->verifyCsrf($token);
            if ($query !== []) throw new InvalidArgumentException();
            if ($path === '/api/creadora/auth/reset') {
                $body = $this->body($server, $rawBody, ['token', 'password']);
                if (!is_string($body['token'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                (new CreadoraPasswordReset($this->pdo, $this->config))->consume($body['token'], $body['password'], $ip);
                $auth->logout();
                return $this->json(200, ['ok' => true, 'csrf' => $auth->csrfToken()], $headers);
            }
            if ($path === '/api/creadora/auth/register') {
                $body = $this->body($server, $rawBody, ['email', 'password', 'privacyAcknowledged']);
                if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null) || !is_bool($body['privacyAcknowledged'] ?? null)) throw new InvalidArgumentException();
                $auth->register($body['email'], $body['password'], $body['privacyAcknowledged'], $ip);
                return $this->json(202, ['ok' => true, 'message' => 'Cuenta creada; inicia sesión.'], $headers);
            }
            if ($path === '/api/creadora/auth/login') {
                $body = $this->body($server, $rawBody, ['email', 'password']);
                if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null)) throw new InvalidArgumentException();
                $result = $auth->login($body['email'], $body['password'], $ip);
                try { $this->audit->log('creadora_account.login', null, 'creadora_account', $result['user']['public_id'], [], $ip); }
                catch (Throwable $error) { $auth->logout(); throw $error; }
                return $this->json(200, ['authenticated' => true, ...$result], $headers);
            }
            $user = $auth->requireUser();
            $this->audit->log('creadora_account.logout', null, 'creadora_account', $user['public_id'], [], $ip);
            $auth->logout();
            return $this->json(200, ['ok' => true], $headers);
        }
        if ($path === '/api/creadora/profile') {
            $user = $auth->requireUser();
            if (!in_array($method, ['GET', 'POST'], true)) return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'POST') {
                if (!$this->config->isAllowedOrigin($origin) || !$validIp) throw new Forbidden();
                $auth->verifyCsrf($token);
                $body = $this->body($server, $rawBody, ['full_name', 'whatsapp', 'city', 'main_network', 'social_link', 'policies_accepted', 'privacy_accepted', 'cedula', 'birth_date', 'contact_email', 'tiktok', 'instagram', 'facebook', 'followers_count']);
                $saved = $this->creadoras()->saveForAccount($user['id'], $body, $ip);
                return $this->json(200, ['ok' => true, 'profile' => $saved, ...$this->creadoras()->shiftsForAccount($user['id'])], $headers);
            }
            $own = $this->creadoras()->forAccount($user['id']);
            return $this->json(200, ['profile' => $own, 'consents' => $this->creadoras()->consentCatalogue(), ...$this->creadoras()->shiftsForAccount($user['id'])], $headers);
        }
        if ($path === '/api/creadora/turnos') {
            $user = $auth->requireUser();
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, $this->creadoras()->shiftsForAccount($user['id']), $headers);
        }
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    /** El calendario y la lista de creadoras: solo administración escribe aquí. */
    private function creadoraAdmin(string $method, string $path, array $query, array $server, string $rawBody, mixed $ip, array $user, array $headers): Response
    {
        $repository = $this->creadoras();
        $actor = (string) ($user['username'] ?? 'coordinación');
        if ($path === '/api/creadoras') {
            if ($method === 'GET') {
                foreach (array_keys($query) as $key) if (!in_array($key, self::CREADORA_FILTERS, true)) throw new InvalidArgumentException();
                return $this->json(200, $repository->list($query) + ['statuses' => CreadoraRepository::STATUSES, 'networks' => CreadoraRepository::NETWORKS, 'content_kinds' => CreadoraRepository::CONTENT_KINDS], $headers);
            }
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            $body = $this->body($server, $rawBody, ['full_name', 'status', 'whatsapp', 'city', 'main_network', 'social_link', 'note', 'cedula', 'birth_date', 'contact_email', 'tiktok', 'instagram', 'facebook', 'followers_count']);
            return $this->json(201, ['ok' => true, 'creadora' => $repository->createByAdmin($body, $user['id'], $ip)], $headers);
        }
        if ($path === '/api/creadoras/calendario') {
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            foreach (array_keys($query) as $key) if (!in_array($key, ['from', 'to'], true)) throw new InvalidArgumentException();
            return $this->json(200, $repository->calendar($query['from'] ?? '', $query['to'] ?? ''), $headers);
        }
        if ($path === '/api/creadoras/bitacora') {
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, $repository->logEntries(), $headers);
        }
        if ($path === '/api/creadoras/edicion') {
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, $repository->editingQueue(), $headers);
        }
        if (preg_match('~^/api/creadoras/edicion/(contenido|guion)/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($method !== 'PATCH') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            $body = $this->body($server, $rawBody, ['edited', 'edited_url', 'edit_note', 'script']);
            if ($parts[1] === 'guion' && array_key_exists('script', $body)) throw new InvalidArgumentException();
            return $this->json(200, ['ok' => true, ...$repository->updateEditing($parts[1], $parts[2], $body, $user['id'], $actor, $ip)], $headers);
        }
        if ($path === '/api/creadoras/turnos') {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            $body = $this->body($server, $rawBody, ['creadora', 'creadoras', 'starts_at', 'ends_at', 'place', 'note']);
            return $this->json(201, ['ok' => true, ...$repository->createShift($body, $user['id'], $actor, $ip)], $headers);
        }
        if (preg_match('~^/api/creadoras/turnos/([a-f0-9]{32})/guiones$~D', $path, $parts)) {
            if ($query !== []) throw new InvalidArgumentException();
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            $body = $this->body($server, $rawBody, ['title', 'body', 'reference_url', 'creadora', 'recorded']);
            return $this->json(201, ['ok' => true, ...$repository->addScript($parts[1], $body, $user['id'], $actor, $ip)], $headers);
        }
        if (preg_match('~^/api/creadoras/turnos/([a-f0-9]{32})/guiones/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'PATCH') {
                $body = $this->body($server, $rawBody, ['title', 'body', 'reference_url', 'creadora', 'recorded']);
                return $this->json(200, ['ok' => true, ...$repository->updateScript($parts[1], $parts[2], $body, $user['id'], $actor, $ip)], $headers);
            }
            if ($method === 'POST') return $this->json(200, ['ok' => true, ...$repository->removeScript($parts[1], $parts[2], $user['id'], $actor, $ip)], $headers);
            return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        }
        if (preg_match('~^/api/creadoras/turnos/([a-f0-9]{32})/contenido$~D', $path, $parts)) {
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'POST') {
                $body = $this->body($server, $rawBody, ['kind', 'title', 'url', 'note', 'creadora', 'script']);
                return $this->json(201, ['ok' => true, ...$repository->addContent($parts[1], $body, $user['id'], $actor, $ip)], $headers);
            }
            if ($method === 'PATCH') {
                $body = $this->body($server, $rawBody, ['content']);
                return $this->json(200, ['ok' => true, ...$repository->removeContent($parts[1], (string) ($body['content'] ?? ''), $user['id'], $actor, $ip)], $headers);
            }
            return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        }
        if (preg_match('~^/api/creadoras/turnos/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'GET') return $this->json(200, $repository->shift($parts[1]), $headers);
            if ($method === 'PATCH') {
                $body = $this->body($server, $rawBody, ['creadora', 'creadoras', 'starts_at', 'ends_at', 'place', 'note', 'attended', 'attendance_for']);
                return $this->json(200, ['ok' => true, ...$repository->updateShift($parts[1], $body, $user['id'], $actor, $ip)], $headers);
            }
            if ($method === 'POST') return $this->json(200, ['ok' => true, ...$repository->cancelShift($parts[1], $user['id'], $actor, $ip)], $headers);
            return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        }
        if (preg_match('~^/api/creadoras/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'GET') return $this->json(200, ['creadora' => $repository->byPublicId($parts[1])], $headers);
            if ($method === 'PATCH') {
                $body = $this->body($server, $rawBody, ['full_name', 'status', 'whatsapp', 'city', 'main_network', 'social_link', 'note', 'cedula', 'birth_date', 'contact_email', 'tiktok', 'instagram', 'facebook', 'followers_count']);
                return $this->json(200, ['ok' => true, 'creadora' => $repository->updateByAdmin($parts[1], $body, $user['id'], $ip)], $headers);
            }
            return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        }
        if (preg_match('~^/api/creadoras/([a-f0-9]{32})/retirar$~D', $path, $parts)) {
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, ['ok' => true, 'creadora' => $repository->retire($parts[1], $user['id'], $actor, $ip)], $headers);
        }
        return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
    }

    private function emprendedorFilters(array $input, bool $pagination = false): array
    {
        $allowed = $pagination ? [...self::EMPRENDEDOR_FILTERS, 'page', 'pageSize'] : self::EMPRENDEDOR_FILTERS;
        if (array_diff(array_keys($input), $allowed) !== []) throw new InvalidArgumentException();
        foreach ($input as $value) if (!is_string($value)) throw new InvalidArgumentException();
        if (isset($input['pageSize'])) { $input['per_page'] = $input['pageSize']; unset($input['pageSize']); }
        return $input;
    }

    private function emprendedorExport(array $filters, int $actorId, string $ip, array $headers): Response
    {
        $columns = ['public_id', 'status', 'traffic_light', 'submitted_at', 'full_name', 'cedula', 'birth_date', 'age_at_submission', 'whatsapp', 'email', 'city', 'business_name', 'product', 'stand_code', 'main_network', 'tiktok', 'instagram', 'facebook', 'previous_participation', 'followers_count', 'level', 'level_label', 'has_photo', 'videos_submitted', 'views_total', 'video_links'];
        $stream = fopen('php://temp/maxmemory:2097152', 'w+');
        if ($stream === false) throw new \RuntimeException();
        try {
            fwrite($stream, "\xEF\xBB\xBF");
            fputcsv($stream, $columns, ',', '"', '', "\r\n");
            $rows = $this->emprendedor()->exportRows($filters);
            foreach ($rows as $detail) {
                $videos = array_filter($detail['progress']['videos'] ?? [], static fn (array $video): bool => $video['url'] !== '');
                $detail = [...$detail, 'followers_count' => $detail['progress']['followers_count'], 'level' => $detail['progress']['level'], 'level_label' => $detail['progress']['level_label'],
                    'has_photo' => ($detail['photo']['available'] ?? false) ? 'Sí' : 'No', 'videos_submitted' => count($videos), 'views_total' => array_sum(array_column($videos, 'views_count')),
                    'video_links' => implode(' | ', array_map(static fn (array $video): string => 'Video ' . $video['slot'] . ': ' . $video['url'] . ' (' . $video['views_count'] . ' views)', $videos))];
                fputcsv($stream, array_map(static function (string $column) use ($detail): string {
                    $value = (string) ($detail[$column] ?? '');
                    // Also protect formulas hidden behind whitespace/control characters.
                    return preg_match('/^[\x00-\x20]*[=+@-]/', $value) ? "'" . $value : $value;
                }, $columns), ',', '"', '', "\r\n");
            }
            $this->audit->log('emprendedor.exported', $actorId, 'emprendedor_profile', null, ['count' => count($rows)], $ip);
            rewind($stream);
            $csv = stream_get_contents($stream);
            if ($csv === false) throw new \RuntimeException();
            $headers['Content-Type'] = 'text/csv; charset=utf-8';
            $headers['Content-Disposition'] = 'attachment; filename="emprendedores-' . gmdate('Y-m-d') . '.csv"';
            return new Response(200, $headers, $csv);
        } finally {
            fclose($stream);
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

    private function mediaAccount(string $method, string $path, array $query, array $server, string $rawBody, array $files, ?string $origin, mixed $ip, string $token, array $headers): ?Response
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
                $body = $this->body($server, $rawBody, ['email', 'password', 'privacyAcknowledged', 'invitation']);
                if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null) || !is_bool($body['privacyAcknowledged'] ?? null)) throw new InvalidArgumentException();
                $invitation = $body['invitation'] ?? null;
                if ($invitation !== null && (!is_string($invitation) || $this->media()->invitationPreview($invitation) === null)) throw new OutOfBoundsException();
                $this->mediaAuth()->register($body['email'], $body['password'], $body['privacyAcknowledged'], $ip);
                // An invited account is linked to the record coordination prepared for it before the first login.
                if ($invitation !== null) $this->media()->consumeInvitation($invitation, $body['email'], $ip);
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
        if ($path === '/api/media/event') {
            // Público: la página de acreditación a la que lleva el QR necesita el nombre, la fecha y el lugar.
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (array_keys($query) !== ['id']) throw new InvalidArgumentException();
            $event = $this->media()->publicEvent($query['id']);
            if ($event === null) throw new OutOfBoundsException();
            return $this->json(200, ['ok' => true, 'event' => $event], $headers);
        }
        if ($path === '/api/media/checkin') {
            $user = $this->mediaAuth()->requireUser();
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp || $query !== []) throw new Forbidden();
            $this->mediaAuth()->verifyCsrf($token);
            $body = $this->body($server, $rawBody, ['event']);
            if (!is_string($body['event'] ?? null)) throw new InvalidArgumentException();
            return $this->json(200, ['ok' => true, 'events' => $this->media()->checkIn($user['id'], $body['event'], $ip)], $headers);
        }
        if ($path === '/api/media/invitation') {
            // Public preview: tells the access page which record an invitation link opens, nothing more.
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (array_keys($query) !== ['token']) throw new InvalidArgumentException();
            $preview = $this->media()->invitationPreview($query['token']);
            if ($preview === null) throw new OutOfBoundsException();
            return $this->json(200, ['ok' => true, 'invitation' => $preview], $headers);
        }
        if ($path === '/api/media/lookup') {
            $this->mediaAuth()->requireUser();
            if ($method !== 'GET') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (array_keys($query) !== ['name']) throw new InvalidArgumentException();
            return $this->json(200, ['items' => $this->media()->lookupUnlinked($query['name'])], $headers);
        }
        if ($path === '/api/media/attendance') {
            $user = $this->mediaAuth()->requireUser();
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp || $query !== []) throw new Forbidden();
            $this->mediaAuth()->verifyCsrf($token);
            $body = $this->body($server, $rawBody, ['event', 'answer']);
            if (!is_string($body['event'] ?? null)) throw new InvalidArgumentException();
            return $this->json(200, ['ok' => true, 'events' => $this->media()->confirmAttendance($user['id'], $body['event'], $body['answer'] ?? null, $ip)], $headers);
        }
        if ($path === '/api/media/claim') {
            $user = $this->mediaAuth()->requireUser();
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp || $query !== []) throw new Forbidden();
            $this->mediaAuth()->verifyCsrf($token);
            $body = $this->body($server, $rawBody, ['public_id']);
            if (!is_string($body['public_id'] ?? null)) throw new InvalidArgumentException();
            return $this->json(202, ['ok' => true, 'claim' => $this->media()->requestClaim($user['id'], $body['public_id'], $ip)], $headers);
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
            if ($own === null) {
                $claim = $this->media()->claimForAccount($user['id']);
                return $this->json(200, ['registered' => false, 'email' => $user['email'], 'status' => null, 'editable' => $claim === null, 'claim' => $claim], $headers);
            }
            return $this->json(200, ['registered' => true, 'email' => $user['email'], ...$own], $headers);
        }
        if ($path === '/api/media/photo') {
            $user = $this->mediaAuth()->requireUser();
            if (!in_array($method, ['GET', 'POST'], true)) return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if ($query !== []) throw new InvalidArgumentException();
            $storage = new MediaPhotoStorage($this->config, $this->crypto);
            if ($method === 'GET') {
                $headers['Content-Type'] = 'image/jpeg'; $headers['Cache-Control'] = 'private, no-store';
                return new Response(200, $headers, $this->media()->photoForAccount($user['id'], $storage));
            }
            if (!$this->config->isAllowedOrigin($origin) || !$validIp) throw new Forbidden();
            $this->mediaAuth()->verifyCsrf($token);
            $length = $server['CONTENT_LENGTH'] ?? null;
            if ($length !== null && ((!is_string($length) && !is_int($length)) || preg_match('/^\d+$/D', (string) $length) !== 1)) throw new InvalidArgumentException();
            if ($length !== null && (float) $length > self::PHOTO_UPLOAD_BYTES + self::PROFILE_REQUEST_OVERHEAD_BYTES) throw new RequestBodyError(413, 'payload_too_large');
            if (strtolower(trim(explode(';', $server['CONTENT_TYPE'] ?? '')[0])) !== 'multipart/form-data') throw new RequestBodyError(415, 'unsupported_media_type');
            $upload = $files['photo'] ?? null;
            if (count($files) !== 1 || !is_array($upload) || ($upload['error'] ?? null) !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null)
                || !is_int($upload['size'] ?? null) || !is_uploaded_file($upload['tmp_name'])) throw new InvalidArgumentException();
            if ($upload['size'] > self::PHOTO_UPLOAD_BYTES) throw new RequestBodyError(413, 'payload_too_large');
            return $this->json(200, ['ok' => true, 'photo' => $this->media()->savePhotoForAccount($user['id'], $storage, $upload['tmp_name'], $upload['size'], $ip)], $headers);
        }
        if ($path === '/api/media/videos') {
            $user = $this->mediaAuth()->requireUser();
            if ($method !== 'POST') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            if (!$this->config->isAllowedOrigin($origin) || !$validIp || $query !== []) throw new Forbidden();
            $this->mediaAuth()->verifyCsrf($token);
            $body = $this->body($server, $rawBody, ['url']);
            return $this->json(201, ['ok' => true, 'videos' => $this->media()->addVideoForAccount($user['id'], $body['url'] ?? null, $ip)], $headers);
        }
        return null;
    }

    /** Administrative media routes; the caller already enforced the admin session and CSRF for writes. */
    private function mediaAdmin(string $method, string $path, array $query, array $server, string $rawBody, ?string $origin, ?string $refererOrigin, mixed $ip, array $user, array $headers): Response
    {
        $notAllowed = fn (): Response => $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
        if (!is_string($ip) || inet_pton($ip) === false) throw new Forbidden();
        if ($path === '/api/medios') {
            if ($method === 'POST') {
                if ($query !== []) throw new InvalidArgumentException();
                $detail = $this->media()->createByAdmin($this->body($server, $rawBody, MediaRepository::ADMIN_FIELDS), $user['id'], $ip);
                return $this->json(201, $detail, $headers);
            }
            if ($method !== 'GET') return $notAllowed();
            $result = $this->media()->list($this->mediaFilters($query, true));
            return $this->json(200, ['items' => $result['items'], 'summary' => $this->media()->summary(), 'topViews' => $this->media()->topByViews(20), 'topFollowers' => $this->media()->topByFollowers(20), 'pagination' => [
                'page' => $result['page'], 'pageSize' => $result['per_page'], 'total' => $result['total'],
                'pages' => (int) ceil($result['total'] / $result['per_page']),
            ]], $headers);
        }
        if ($path === '/api/media-accounts') {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, ['items' => $this->media()->pendingAccounts()], $headers);
        }
        if ($path === '/api/media-claims') {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, ['items' => $this->media()->pendingClaims()], $headers);
        }
        if ($path === '/api/media-events') {
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'GET') return $this->json(200, ['items' => $this->media()->listEvents()], $headers);
            if ($method !== 'POST') return $notAllowed();
            return $this->json(201, ['ok' => true, 'event' => $this->media()->createEvent($this->body($server, $rawBody, ['name', 'event_date', 'place', 'details']), $user['id'], $ip)], $headers);
        }
        if (preg_match('~^/api/media-events/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            return $this->json(200, $this->media()->coverageForEvent($parts[1]), $headers);
        }
        if (preg_match('~^/api/media-events/([a-f0-9]{32})/coverage/([a-f0-9]{32})$~D', $path, $parts)) {
            if ($method !== 'PATCH') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $this->media()->upsertCoverage($parts[1], $parts[2], $this->body($server, $rawBody, ['contracted', 'result', 'people_count', 'links', 'note', 'attended', 'confirmation']), $user['id'], $ip);
            return $this->json(200, ['ok' => true], $headers);
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
        if (preg_match('~^/api/medios/([a-f0-9]{32})/photo$~D', $path, $parts)) {
            if ($method !== 'GET') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $jpeg = $this->media()->photoForAdmin($parts[1], new MediaPhotoStorage($this->config, $this->crypto), $user['id'], $ip);
            $headers['Content-Type'] = 'image/jpeg'; $headers['Cache-Control'] = 'private, no-store';
            return new Response(200, $headers, $jpeg);
        }
        if (preg_match('~^/api/medios/([a-f0-9]{32})/videos$~D', $path, $parts)) {
            if ($query !== []) throw new InvalidArgumentException();
            if ($method === 'POST') {
                $body = $this->body($server, $rawBody, ['url']);
                $this->media()->addVideoByAdmin($parts[1], $body['url'] ?? null, $user['id'], $ip);
                return $this->json(201, ['ok' => true], $headers);
            }
            if ($method !== 'PATCH') return $notAllowed();
            $body = $this->body($server, $rawBody, ['video_id']);
            $this->media()->removeVideoByAdmin($parts[1], $body['video_id'] ?? null, $user['id'], $ip);
            return $this->json(200, ['ok' => true], $headers);
        }
        if (preg_match('~^/api/medios/([a-f0-9]{32})/video-views$~D', $path, $parts)) {
            if ($method !== 'PATCH') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $body = $this->body($server, $rawBody, ['video_views']);
            $this->media()->updateVideoViews($parts[1], $body['video_views'] ?? null, $user['id'], $ip);
            return $this->json(200, ['ok' => true], $headers);
        }
        if (preg_match('~^/api/medios/([a-f0-9]{32})/details$~D', $path, $parts)) {
            if ($method !== 'PATCH') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $this->media()->updateByAdmin($parts[1], $this->body($server, $rawBody, MediaRepository::ADMIN_FIELDS), $user['id'], $ip);
            return $this->json(200, ['ok' => true], $headers);
        }
        if (preg_match('~^/api/medios/([a-f0-9]{32})/claim/(approve|reject)$~D', $path, $parts)) {
            if ($method !== 'POST') return $notAllowed();
            if ($query !== []) throw new InvalidArgumentException();
            $this->body($server, $rawBody, []);
            $this->media()->resolveClaim($parts[1], $parts[2] === 'approve', $user['id'], $ip);
            return $this->json(200, ['ok' => true], $headers);
        }
        if (preg_match('~^/api/medios/([a-f0-9]{32})/invite$~D', $path, $parts)) {
            if ($method !== 'POST') return $notAllowed();
            if ($query !== [] || !$this->config->isAllowedOrigin($origin)) throw new Forbidden();
            $this->body($server, $rawBody, []);
            $raw = $this->media()->createInvitation($parts[1], $user['id'], $ip);
            $inviteOrigin = $origin ?? $refererOrigin ?? $this->config->allowedOrigin();
            return $this->json(201, ['invitationUrl' => $inviteOrigin . '/finados/medios/acceso/?invitacion=' . $raw], $headers);
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
                $body = $this->body($server, $rawBody, ['status', 'traffic_light', 'paid_media']);
                if ($body === []) throw new InvalidArgumentException();
                foreach ($body as $value) if (!is_string($value)) throw new InvalidArgumentException();
                if (isset($body['status'])) $this->media()->changeStatus($id, $body['status'], $user['id'], $ip);
                if (isset($body['traffic_light'])) $this->media()->changeTrafficLight($id, $body['traffic_light'], $user['id'], $ip);
                if (isset($body['paid_media'])) $this->media()->changePaidMedia($id, $body['paid_media'], $user['id'], $ip);
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

    /** Opening panel: Medios, its events and Voceros, each figure carrying the list behind it. */
    private function panelSummary(): array
    {
        $media = $this->media()->panel();
        $voceros = $this->pdo->prepare("SELECT public_id, full_name, city, status, main_network FROM voceros WHERE status <> 'Eliminado' ORDER BY full_name");
        $voceros->execute();
        $rows = $voceros->fetchAll(PDO::FETCH_ASSOC);
        $entry = static fn (array $row): array => ['public_id' => $row['public_id'], 'name' => $row['full_name'], 'detail' => trim(implode(' · ', array_filter([$row['city'], $row['main_network'], $row['status']])))];
        $group = static function (callable $test) use ($rows, $entry): array {
            $items = [];
            foreach ($rows as $row) if ($test($row)) $items[] = $entry($row);
            return $items;
        };
        $videos = $this->pdo->prepare("SELECT v.public_id, v.full_name, v.city, vv.slot, vv.status, vv.views_count FROM vocero_videos vv JOIN voceros v ON v.id = vv.vocero_id WHERE v.status <> 'Eliminado' AND vv.status = 'submitted' AND TRIM(COALESCE(vv.url, '')) <> '' ORDER BY vv.updated_at DESC, vv.id DESC LIMIT 300");
        $videos->execute();
        $videoRows = $videos->fetchAll(PDO::FETCH_ASSOC);
        $videoEntry = static fn (array $row): array => ['public_id' => $row['public_id'], 'name' => $row['full_name'], 'detail' => trim(implode(' · ', array_filter([$row['city'], 'Video ' . (int) $row['slot'], (int) $row['views_count'] > 0 ? (int) $row['views_count'] . ' views' : ''])))];
        // Creadoras es de solo lectura aquí; si su módulo falla, el resto del panel sigue en pie.
        try { $creadoras = $this->creadoras()->panel(); } catch (Throwable) { $creadoras = null; }
        return [
            'media' => $media,
            'creadoras' => $creadoras,
            'voceros' => ['cards' => [
                ['key' => 'voceros_registrados', 'label' => 'Voceros registrados', 'items' => $group(static fn (): bool => true)],
                ['key' => 'voceros_aprobados', 'label' => 'Voceros aprobados', 'items' => $group(static fn (array $row): bool => $row['status'] === 'Aprobado')],
                ['key' => 'voceros_videos', 'label' => 'Videos subidos', 'items' => array_map($videoEntry, $videoRows)],
                ['key' => 'voceros_con_video', 'label' => 'Voceros con al menos un video', 'items' => array_values(array_map($entry, array_values(array_column(array_filter($rows, static function (array $row) use ($videoRows): bool {
                    foreach ($videoRows as $video) if ($video['public_id'] === $row['public_id']) return true;
                    return false;
                }), null, 'public_id'))))],
            ]],
        ];
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
        $columns = ['public_id', 'status', 'traffic_light', 'paid_media', 'origin', 'linked', 'submitted_at', 'media_name', 'program_name', 'representatives_label', 'followers_validated', 'media_types_label', 'radio_stations_label', 'audience_count', 'radio_genre', 'tv_channels_label', 'contact_name', 'phone', 'contact_email', 'account_email', 'province', 'city', 'channels_label', 'followers_total', 'has_photo', 'image_authorized', 'videos_count', 'views_total', 'video_links'];
        $stream = fopen('php://temp/maxmemory:2097152', 'w+');
        if ($stream === false) throw new \RuntimeException();
        try {
            fwrite($stream, "\xEF\xBB\xBF");
            fputcsv($stream, $columns, ',', '"', '', "\r\n");
            $rows = $this->media()->exportRows($filters);
            foreach ($rows as $detail) {
                $links = array_column($detail['videos'] ?? [], 'url');
                $detail['media_types_label'] = implode(' | ', array_map(static fn (string $key): string => MediaRepository::MEDIA_TYPES[$key] ?? $key, $detail['media_types'] ?? []));
                $detail['tv_channels_label'] = implode(' | ', $detail['tv_channels'] ?? []);
                $detail['channels_label'] = implode(' | ', array_map(static fn (array $channel): string => (MediaRepository::CHANNEL_TYPES[$channel['type']] ?? $channel['type']) . ': ' . $channel['url'] . (is_int($channel['followers'] ?? null) ? ' (' . $channel['followers'] . ' seguidores)' : ''), $detail['channels'] ?? []));
                $detail['has_photo'] = ($detail['photo']['available'] ?? false) ? 'Sí' : 'No';
                $detail['paid_media'] = ($detail['paid_media'] ?? 'no') === 'yes' ? 'Sí' : 'No';
                $detail['linked'] = ($detail['linked'] ?? false) ? 'Sí' : 'No';
                $detail['representatives_label'] = implode(' | ', array_map(static fn (array $person): string => $person['name'] . ($person['role'] !== '' ? ' (' . $person['role'] . ')' : ''), $detail['representatives'] ?? []));
                $detail['radio_stations_label'] = implode(' | ', array_map(static fn (array $station): string => $station['name'] . ' (' . $station['frequency'] . ')', $detail['radio_stations'] ?? []));
                $detail = [...$detail, 'image_authorized' => ($detail['consents']['image']['accepted'] ?? false) ? 'Sí' : 'No', 'videos_count' => count($links), 'views_total' => array_sum(array_column($detail['videos'] ?? [], 'views_count')),
                    'video_links' => implode(' | ', array_map(static fn (array $video): string => $video['url'] . ' (' . $video['views_count'] . ' views)', $detail['videos'] ?? []))];
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
