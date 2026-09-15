<?php

declare(strict_types=1);

namespace Finados;

use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use Throwable;

foreach (['Config', 'Database', 'Crypto', 'Audit', 'VocerosRepository', 'Auth'] as $dependency) {
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
    private readonly Auth $auth;
    private readonly VocerosRepository $repository;
    private readonly Audit $audit;
    private readonly Crypto $crypto;
    private const FILTERS = ['search', 'status', 'city', 'main_network', 'previous_participation', 'date_from', 'date_to'];
    private const METHODS = ['GET', 'POST', 'PATCH', 'OPTIONS'];

    public function __construct(private readonly Config $config, private readonly PDO $pdo)
    {
        $this->crypto = new Crypto($config);
        $this->audit = new Audit($pdo, $this->crypto);
        $this->repository = new VocerosRepository($pdo, $this->crypto, $this->audit);
        $this->auth = new Auth($pdo, $config);
    }

    public function handle(string $method, string $uri, array $server = [], string $rawBody = ''): Response
    {
        $headers = [
            'Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store', 'Vary' => 'Origin',
            'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
            'Referrer-Policy' => 'no-referrer',
        ];
        try {
            $origin = $server['HTTP_ORIGIN'] ?? null;
            if ($origin !== null && $origin !== $this->config->allowedOrigin()) throw new Forbidden();
            if ($origin !== null) {
                $headers['Access-Control-Allow-Origin'] = $this->config->allowedOrigin();
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
                $this->pdo->query('SELECT 1');
                return $this->json(200, ['ok' => true], $headers);
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
                return $this->json(200, ['authenticated' => true, ...$result], $headers);
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
            if ($path === '/api/voceros' && $method === 'GET') {
                $filters = $this->filters($query, true);
                $result = $this->repository->list($filters);
                return $this->json(200, ['items' => $result['items'], 'pagination' => [
                    'page' => $result['page'], 'pageSize' => $result['per_page'], 'total' => $result['total'],
                    'pages' => (int) ceil($result['total'] / $result['per_page']),
                ]], $headers);
            }
            if ($path === '/api/dashboard' && $method === 'GET') {
                $statuses = array_fill_keys(VocerosRepository::STATUSES, 0);
                foreach ($this->pdo->query('SELECT status, COUNT(*) AS count FROM voceros GROUP BY status') as $row) $statuses[$row['status']] = (int) $row['count'];
                $dates = [];
                foreach ($this->pdo->query('SELECT DATE(submitted_at) AS day, COUNT(*) AS count FROM voceros GROUP BY DATE(submitted_at) ORDER BY day') as $row) $dates[$row['day']] = (int) $row['count'];
                $recent = $this->pdo->prepare('SELECT COUNT(*) FROM voceros WHERE submitted_at >= ? AND submitted_at <= ?');
                $recent->execute([gmdate('Y-m-d H:i:s', time() - 7 * 86400), gmdate('Y-m-d H:i:s')]);
                return $this->json(200, ['total' => array_sum($statuses), 'byStatus' => $statuses, 'byDate' => (object) $dates, 'lastSevenDays' => (int) $recent->fetchColumn()], $headers);
            }
            if ($path === '/api/voceros/export' && $method === 'POST') {
                $filters = $this->filters($this->body($server, $rawBody, self::FILTERS));
                return $this->export($filters, $user['id'], $ip, $headers);
            }
            if ($path === '/api/voceros/export') return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
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
                    $detail = $this->repository->find($id);
                    if ($detail === null) throw new OutOfBoundsException();
                    return $this->json(200, $detail, $headers);
                }
                return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            }
            if (in_array($path, ['/api/health', '/api/auth/login', '/api/auth/logout', '/api/auth/session', '/api/voceros', '/api/dashboard'], true)) {
                return $this->error(405, 'method_not_allowed', 'Método no permitido.', $headers);
            }
            return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
        } catch (Unauthorized) {
            return $this->error(401, 'unauthorized', 'Acceso no autorizado.', $headers);
        } catch (Forbidden) {
            return $this->error(403, 'forbidden', 'Solicitud no permitida.', $headers);
        } catch (RequestBodyError $error) {
            return $this->error($error->status, $error->errorCode, 'Formato de solicitud no válido.', $headers);
        } catch (InvalidArgumentException | \JsonException) {
            return $this->error(422, 'validation_error', 'Revisa los datos de la solicitud.', $headers);
        } catch (OutOfBoundsException) {
            return $this->error(404, 'not_found', 'Recurso no encontrado.', $headers);
        } catch (Throwable) {
            error_log('Finados API request failed.');
            return $this->error(500, 'internal_error', 'No se pudo completar la solicitud.', $headers);
        }
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
