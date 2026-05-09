<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Configuración de base de datos
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', 'web1');
if (!defined('DB_USER')) define('DB_USER', 'root');
if (!defined('DB_PASS')) define('DB_PASS', 'ascent');

function getDB() {
    try {
        return new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
    } catch (PDOException $e) {
        return null;
    }
}

function generate_user_hwid($username, $server_hwid) {
    // Combinar username + server HWID + salt para crear HWID único por usuario
    $salt = 'Olympus_Core_Salt_2024';
    $combined = $username . $server_hwid . $salt;
    return hash('sha256', $combined);
}

// Obtener HWID del servidor (máquina)
$serverHwidData = @file_get_contents('http://' . $_SERVER['HTTP_HOST'] . '/web_servicios/api/get_hwid.php');
$serverHwidResult = json_decode($serverHwidData, true);
$serverHwid = $serverHwidResult['hwid'] ?? 'SERVER_' . time();

// Obtener usuario desde POST o GET
$username = $_POST['username'] ?? $_GET['username'] ?? '';

if (empty($username)) {
    // Intentar obtener de sesión
    session_start();
    $username = $_SESSION['username'] ?? '';
}

if (empty($username)) {
    echo json_encode(['success' => false, 'result' => 'Usuario no especificado']);
    exit;
}

// Generar HWID único para este usuario
$user_hwid = generate_user_hwid($username, $serverHwid);

// Guardar en base de datos
$pdo = getDB();
if ($pdo) {
    try {
        $stmt = $pdo->prepare("UPDATE users SET user_hwid = ? WHERE username = ?");
        $stmt->execute([$user_hwid, $username]);
    } catch (PDOException $e) {
        // Error al guardar, pero continuar
    }
}

echo json_encode([
    'success' => true,
    'hwid' => $user_hwid,
    'username' => $username,
    'server_hwid' => $serverHwid
]);
?>