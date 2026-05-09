<?php
header('Content-Type: application/json');

// Verificar si la petición viene con la cookie __test (protección del hosting)
if (!isset($_COOKIE['__test'])) {
    // Si es una petición POST desde un servidor (no navegador), permitir acceso directo
    $is_api_call = isset($_SERVER['HTTP_USER_AGENT']) && 
                   (strpos($_SERVER['HTTP_USER_AGENT'], 'curl') !== false ||
                    strpos($_SERVER['HTTP_USER_AGENT'], 'libcurl') !== false ||
                    strpos($_SERVER['HTTP_USER_AGENT'], 'Olympus') !== false);
    
    // Verificar por IP del servidor (acceso local)
    $is_local = $_SERVER['REMOTE_ADDR'] === $_SERVER['SERVER_ADDR'] ||
                $_SERVER['REMOTE_ADDR'] === '127.0.0.1' ||
                $_SERVER['REMOTE_ADDR'] === '::1';
    
    if ($is_api_call || $is_local) {
        // Para peticiones API, establecer la cookie manualmente
        setcookie('__test', 'bypass_' . time(), time() + 21600, '/');
        $_COOKIE['__test'] = 'bypass_' . time();
    }
}

// ============================================
// HEADERS CORRECTOS
// ============================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

// Responder a OPTIONS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================
// CONFIGURACIÓN
// ============================================
const ADMIN_KEY = 'olympus123';
const LICENSES_FILE = __DIR__ . '/licenses.json';
const LOG_FILE = __DIR__ . '/license_requests.log';

// Configuración de Base de Datos (OPCIONAL - si no existe, solo usa JSON)
define('DB_HOST', 'localhost');
define('DB_NAME', 'web1');  // Cambia esto
define('DB_USER', 'root');         // Cambia esto
define('DB_PASS', 'ascent');      // Cambia esto
define('USE_DB', true); // Cambia a false si no quieres usar BD

// ============================================
// FUNCIONES DE BASE DE DATOS
// ============================================
function getDB() {
    if (!USE_DB) return null;
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
        return $pdo;
    } catch (PDOException $e) {
        log_request("ERROR DB: " . $e->getMessage());
        return null;
    }
}

// Crear tabla si no existe
function initDatabase() {
    $pdo = getDB();
    if (!$pdo) return;
    
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `licenses` (
                `id` INT(11) NOT NULL AUTO_INCREMENT,
                `license_key` VARCHAR(50) NOT NULL,
                `uid` VARCHAR(20) NOT NULL,
                `hwid` VARCHAR(255) NOT NULL DEFAULT '',
                `expansion` INT(11) NOT NULL DEFAULT 4,
                `created_by` VARCHAR(100) NOT NULL DEFAULT '',
                `active` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `expires_at` DATETIME NOT NULL,
                `last_validation` DATETIME DEFAULT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `license_key` (`license_key`),
                KEY `hwid` (`hwid`),
                KEY `created_by` (`created_by`),
                KEY `active` (`active`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    } catch (PDOException $e) {
        log_request("Error creando tabla: " . $e->getMessage());
    }
}

// Inicializar BD
if (USE_DB) {
    initDatabase();
}

// ============================================
// FUNCIONES EXISTENTES (NO MODIFICADAS)
// ============================================
function log_request($message) {
    $log = date('Y-m-d H:i:s') . " - " . $message . "\n";
    file_put_contents(LOG_FILE, $log, FILE_APPEND);
}

function load_licenses() {
    if (!file_exists(LICENSES_FILE)) {
        return ['licenses' => []];
    }
    $data = json_decode(file_get_contents(LICENSES_FILE), true);
    return $data ?: ['licenses' => []];
}

function save_licenses($data) {
    file_put_contents(LICENSES_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function generate_license_key() {
    $parts = [];
    for ($i = 0; $i < 4; $i++) {
        $length = 4;
        $valid = false;

        while (!$valid) {
            $chars = [];
            for ($j = 0; $j < $length; $j++) {
                $chars[] = chr(ord('A') + rand(0, 25));
            }

            $sum = (ord($chars[0]) - ord($chars[1])) + (ord($chars[2]) - ord($chars[3]));

            if ($sum === 0) {
                $valid = true;
            } else {
                $chars[3] = chr(ord($chars[3]) + $sum);
                if (ord($chars[3]) >= ord('A') && ord($chars[3]) <= ord('Z')) {
                    $valid = true;
                }
            }
        }
        $parts[] = implode('', $chars);
    }
    return implode('-', $parts);
}

function validate_key_format($key) {
    $parts = explode('-', $key);
    if (count($parts) !== 4) return false;
    foreach ($parts as $part) {
        $len = strlen($part);
        if ($len !== 4 && $len !== 6) return false;
    }
    return true;
}

function generate_uid() {
    return 'USER' . str_pad(rand(1, 999999), 6, '0', STR_PAD_LEFT);
}

// ============================================
// PROCESAR ACCIÓN
// ============================================
$action = $_POST['action'] ?? null;
$admin_key = $_POST['admin_key'] ?? '';

// Detectar si es una solicitud de registro del cliente
if (!$action && isset($_POST['key']) && isset($_POST['hwid']) && isset($_POST['xpac'])) {
    $action = 'generate';
}

if (!$action) {
    $action = 'validate';
}

if (!in_array($action, ['validate', 'generate', 'list', 'renew', 'deactivate', 'sync_db'])) {
    echo json_encode(['success' => false, 'result' => 'Acción no válida']);
    exit;
}

// Validar clave admin
if (in_array($action, ['generate', 'renew', 'deactivate', 'list', 'sync_db'])) {
    if ($action === 'generate' && !isset($_POST['admin_key'])) {
        // OK - cliente registrándose
    } elseif ($admin_key !== ADMIN_KEY) {
        echo json_encode(['success' => false, 'result' => 'Clave de administrador inválida']);
        exit;
    }
}

$licenses_data = load_licenses();
$pdo = getDB();

switch ($action) {
    case 'validate':
        $key = $_POST['key'] ?? '';
        $hwid = $_POST['hwid'] ?? '';
        $xpac = $_POST['xpac'] ?? 0;

        if (empty($key) || empty($hwid)) {
            echo json_encode(['success' => false, 'result' => 'Parámetros faltantes']);
            exit;
        }

        $found = false;
        
        // Buscar en JSON primero
        foreach ($licenses_data['licenses'] as $lic) {
            if (($lic['license_key'] ?? $lic['key']) === $key && $lic['hwid'] === $hwid && $lic['active']) {
                $expires = new DateTime($lic['expires_at']);
                $now = new DateTime();
                $days_left = $expires->diff($now)->days;

                if ($expires > $now) {
                    echo json_encode([
                        'success' => true,
                        'result' => 'Licencia validada correctamente',
                        'uid' => $lic['uid'],
                        'days_left' => $days_left
                    ]);
                    log_request("Validación exitosa: $key");
                    exit;
                }
            }
        }
        
        // Si no está en JSON, buscar en BD
        if ($pdo && !$found) {
            $stmt = $pdo->prepare("SELECT * FROM licenses WHERE license_key = ? AND hwid = ? AND active = 1");
            $stmt->execute([$key, $hwid]);
            $db_license = $stmt->fetch();
            
            if ($db_license) {
                $expires = new DateTime($db_license['expires_at']);
                $now = new DateTime();
                $days_left = $expires->diff($now)->days;
                
                if ($expires > $now) {
                    // Actualizar última validación
                    $stmt = $pdo->prepare("UPDATE licenses SET last_validation = NOW() WHERE id = ?");
                    $stmt->execute([$db_license['id']]);
                    
                    echo json_encode([
                        'success' => true,
                        'result' => 'Licencia validada correctamente',
                        'uid' => $db_license['uid'],
                        'days_left' => $days_left
                    ]);
                    log_request("Validación exitosa (BD): $key");
                    exit;
                }
            }
        }

        echo json_encode(['success' => false, 'result' => 'Licencia inválida o no encontrada']);
        log_request("Validación fallida: $key");
        exit;

    case 'generate':
        $hwid = $_POST['hwid'] ?? '';
        $expansion = $_POST['expansion'] ?? 4;
        $license_key = $_POST['key'] ?? null;
        $created_by = $_POST['created_by'] ?? '';

        if (empty($hwid)) {
            echo json_encode(['success' => false, 'result' => 'HWID requerido']);
            exit;
        }

        // ============================================
        // 1. DESACTIVAR LICENCIA ANTERIOR DEL MISMO HWID (JSON)
        // ============================================
        foreach ($licenses_data['licenses'] as $index => $lic) {
            if ($lic['hwid'] === $hwid && $lic['active']) {
                $licenses_data['licenses'][$index]['active'] = false;
            }
        }
        
        // ============================================
        // 2. ELIMINAR LICENCIA ANTERIOR DEL MISMO USUARIO (JSON)
        // ============================================
        if (!empty($created_by)) {
            foreach ($licenses_data['licenses'] as $index => $lic) {
                if (isset($lic['created_by']) && $lic['created_by'] === $created_by) {
                    unset($licenses_data['licenses'][$index]);
                }
            }
            $licenses_data['licenses'] = array_values($licenses_data['licenses']);
        }

        // Generar nueva licencia
        if (!$license_key) {
            $license_key = generate_license_key();
        } else {
            if (!validate_key_format($license_key)) {
                echo json_encode(['success' => false, 'result' => 'Formato de clave inválido']);
                exit;
            }
        }

        $uid = generate_uid();
        $created_at = date('Y-m-d H:i:s');
        $expires_at = date('Y-m-d H:i:s', strtotime('+30 days'));

        $new_license = [
            'uid' => $uid,
            'license_key' => $license_key,
            'key' => $license_key,
            'hwid' => $hwid,
            'expansion' => intval($expansion),
            'active' => true,
            'created_at' => $created_at,
            'expires_at' => $expires_at,
            'created_by' => $created_by
        ];

        // Guardar en JSON
        $licenses_data['licenses'][] = $new_license;
        save_licenses($licenses_data);
        
        // ============================================
        // 3. GUARDAR EN BASE DE DATOS
        // ============================================
        if ($pdo) {
            try {
                // Desactivar licencia anterior del mismo HWID en BD
                $stmt = $pdo->prepare("UPDATE licenses SET active = 0 WHERE hwid = ? AND active = 1");
                $stmt->execute([$hwid]);
                
                // Desactivar licencia anterior del mismo usuario en BD
                if (!empty($created_by)) {
                    $stmt = $pdo->prepare("UPDATE licenses SET active = 0 WHERE created_by = ? AND active = 1");
                    $stmt->execute([$created_by]);
                }
                
                // Insertar nueva licencia en BD
                $stmt = $pdo->prepare("
                    INSERT INTO licenses (license_key, uid, hwid, expansion, created_by, expires_at) 
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([$license_key, $uid, $hwid, $expansion, $created_by, $expires_at]);
                
                log_request("Licencia guardada en BD: $license_key");
            } catch (PDOException $e) {
                log_request("ERROR guardando en BD: " . $e->getMessage());
            }
        }

        echo json_encode([
            'success' => true,
            'result' => 'Licencia generada correctamente',
            'uid' => $uid,
            'license' => $new_license
        ]);
        log_request("Licencia generada: $license_key para $hwid por usuario: $created_by");
        exit;

    case 'list':
        $all_licenses = $licenses_data['licenses'];
        
        // También obtener de BD si existe
        if ($pdo) {
            $stmt = $pdo->query("SELECT * FROM licenses ORDER BY created_at DESC");
            $db_licenses = $stmt->fetchAll();
            // Combinar (evitar duplicados por license_key)
            foreach ($db_licenses as $db_lic) {
                $exists = false;
                foreach ($all_licenses as $json_lic) {
                    if (($json_lic['license_key'] ?? $json_lic['key']) === $db_lic['license_key']) {
                        $exists = true;
                        break;
                    }
                }
                if (!$exists) {
                    $all_licenses[] = $db_lic;
                }
            }
        }
        
        echo json_encode([
            'success' => true,
            'licenses' => $all_licenses
        ]);
        exit;

    case 'renew':
        $license_key = $_POST['license_key'] ?? '';
        $hwid = $_POST['hwid'] ?? '';

        if (empty($license_key)) {
            echo json_encode(['success' => false, 'result' => 'Clave de licencia requerida']);
            exit;
        }

        $found = false;
        
        // Renovar en JSON
        foreach ($licenses_data['licenses'] as &$lic) {
            $key_to_check = $lic['license_key'] ?? $lic['key'] ?? '';
            if ($key_to_check === $license_key && $lic['hwid'] === $hwid && $lic['active']) {
                $old_expires = $lic['expires_at'];
                $new_expires = date('Y-m-d H:i:s', strtotime('+30 days', strtotime($old_expires)));
                $lic['expires_at'] = $new_expires;
                save_licenses($licenses_data);
                $found = true;
                break;
            }
        }
        
        // Renovar en BD
        if ($pdo && !$found) {
            $stmt = $pdo->prepare("UPDATE licenses SET expires_at = DATE_ADD(expires_at, INTERVAL 30 DAY), active = 1 WHERE license_key = ? AND hwid = ? AND active = 1");
            $stmt->execute([$license_key, $hwid]);
            if ($stmt->rowCount() > 0) {
                $found = true;
            }
        }

        if ($found) {
            echo json_encode([
                'success' => true,
                'result' => 'Licencia renovada exitosamente'
            ]);
            log_request("Licencia renovada: $license_key");
        } else {
            echo json_encode(['success' => false, 'result' => 'Licencia no encontrada']);
        }
        exit;

    case 'deactivate':
        $license_key = $_POST['license_key'] ?? '';

        if (empty($license_key)) {
            echo json_encode(['success' => false, 'result' => 'Clave de licencia requerida']);
            exit;
        }

        // Desactivar en JSON
        foreach ($licenses_data['licenses'] as &$lic) {
            $key_to_check = $lic['license_key'] ?? $lic['key'] ?? '';
            if ($key_to_check === $license_key) {
                $lic['active'] = false;
                save_licenses($licenses_data);
                break;
            }
        }
        
        // Desactivar en BD
        if ($pdo) {
            $stmt = $pdo->prepare("UPDATE licenses SET active = 0 WHERE license_key = ?");
            $stmt->execute([$license_key]);
        }

        echo json_encode([
            'success' => true,
            'result' => 'Licencia desactivada correctamente'
        ]);
        log_request("Licencia desactivada: $license_key");
        exit;
        
    case 'sync_db':
        // Sincronizar JSON -> BD
        if (!$pdo) {
            echo json_encode(['success' => false, 'result' => 'Base de datos no configurada']);
            exit;
        }
        
        $synced = 0;
        foreach ($licenses_data['licenses'] as $lic) {
            $key = $lic['license_key'] ?? $lic['key'] ?? '';
            if (empty($key)) continue;
            
            // Verificar si ya existe
            $stmt = $pdo->prepare("SELECT id FROM licenses WHERE license_key = ?");
            $stmt->execute([$key]);
            if (!$stmt->fetch()) {
                $stmt = $pdo->prepare("
                    INSERT INTO licenses (license_key, uid, hwid, expansion, created_by, active, created_at, expires_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $key,
                    $lic['uid'] ?? generate_uid(),
                    $lic['hwid'] ?? '',
                    $lic['expansion'] ?? 4,
                    $lic['created_by'] ?? '',
                    $lic['active'] ?? 1,
                    $lic['created_at'] ?? date('Y-m-d H:i:s'),
                    $lic['expires_at'] ?? date('Y-m-d H:i:s', strtotime('+30 days'))
                ]);
                $synced++;
            }
        }
        
        echo json_encode([
            'success' => true,
            'result' => "Sincronización completada",
            'synced' => $synced
        ]);
        exit;
}

echo json_encode(['success' => false, 'result' => 'Error desconocido']);
?>