<?php
// D:\Server\xampp\htdocs\web_servicios\api\get_hwid.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function get_mac_hashes() {
    $mac1 = 0;
    $mac2 = 0;

    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        $output = shell_exec('getmac /fo csv /noheader 2>nul');
        $macs = array_filter(array_map('trim', explode("\n", $output)));

        foreach ($macs as $mac_line) {
            $mac = trim(str_getcsv($mac_line)[0]);
            if (!empty($mac)) {
                $bytes = array_map(function($hex) { return hexdec($hex); }, explode('-', $mac));
                $hash = 0;
                for ($i = 0; $i < count($bytes); $i++) {
                    $hash += ($bytes[$i] << (($i & 1) * 8)) & 0xFFFF;
                }

                if ($mac1 == 0) {
                    $mac1 = $hash;
                } else {
                    $mac2 = $hash;
                    break;
                }
            }
        }
    } else {
        $output = shell_exec('ifconfig 2>/dev/null');
        $interfaces = preg_split('/^\S/m', $output, -1, PREG_SPLIT_NO_EMPTY);
        $found_count = 0;
        
        foreach ($interfaces as $interface) {
            if (preg_match('/HWaddr\s+([0-9A-Fa-f:]+)|ether\s+([0-9A-Fa-f:]+)/i', $interface, $matches)) {
                $mac = !empty($matches[1]) ? $matches[1] : $matches[2];
                $bytes = array_map(function($hex) { return hexdec($hex); }, explode(':', $mac));
                $hash = 0;
                for ($i = 0; $i < 6; $i++) {
                    $hash += ($bytes[$i] << (($i & 1) * 8)) & 0xFFFF;
                }
                if ($found_count == 0) {
                    $mac1 = $hash;
                } else {
                    $mac2 = $hash;
                    break;
                }
                $found_count++;
            }
        }
    }

    if ($mac1 > $mac2) {
        $temp = $mac1;
        $mac1 = $mac2;
        $mac2 = $temp;
    }

    return [$mac1, $mac2];
}

function get_cpu_hash() {
    $hash = 0;

    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        $output = shell_exec('wmic os get SerialNumber 2>nul');
        $lines = array_filter(array_map('trim', explode("\n", $output)));
        if (!empty($lines)) {
            $serial = end($lines);
            for ($i = 0; $i < strlen($serial); $i++) {
                $hash += (ord($serial[$i]) << (($i & 1) * 8)) & 0xFFFF;
            }
        }
    } else {
        $output = shell_exec('cat /proc/cpuinfo 2>/dev/null');
        $lines = array_filter(array_map('trim', explode("\n", $output)));
        for ($i = 0; $i < min(4, count($lines)); $i++) {
            if (!empty($lines[$i])) {
                $parts = explode(':', $lines[$i], 2);
                if (isset($parts[1])) {
                    $val = trim($parts[1]);
                    for ($j = 0; $j < strlen($val) && $j < 4; $j++) {
                        $hash += (ord($val[$j]) << (($j & 1) * 8)) & 0xFFFF;
                    }
                }
            }
        }
    }

    return $hash & 0xFFFF;
}

function get_machine_name() {
    return gethostname() ?: 'unknown';
}

function generate_hwid() {
    $machine_name = get_machine_name();
    list($mac1, $mac2) = get_mac_hashes();
    $cpu_hash = get_cpu_hash();

    $hashable = $machine_name . $mac1 . $mac2 . $cpu_hash;
    $chars = "0123456789ABCDEF";
    $stream = "";
    $size = strlen($hashable);

    for ($i = 0; $i < $size; $i++) {
        $sum = ord($hashable[$i]) + ord($hashable[($i + 1) % $size]) + 
               ord($hashable[($i + 2) % $size]) + ord($hashable[($i + 3) % $size]);
        $ch = (~$sum & 0xFF) * ($i + 1);
        $ch = $ch & 0xFF;
        $stream .= $chars[($ch >> 4) & 0x0F];
        $stream .= $chars[$ch & 0x0F];
    }

    return $stream;
}

$hwid = generate_hwid();

echo json_encode([
    'success' => true,
    'hwid' => $hwid
]);
?>