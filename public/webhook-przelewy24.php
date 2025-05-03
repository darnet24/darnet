<?php
// Konfiguracja - tutaj później wkleisz swoje dane
$posId = 'TWOJE_POS_ID';
$crcKey = 'TWOJ_KLUCZ_CRC';

// Wczytaj dane przesłane od Przelewy24
$data = file_get_contents('php://input');
parse_str($data, $params);

// Weryfikacja podpisu
$receivedSignature = $params['sign'] ?? '';
unset($params['sign']);

ksort($params);
$signatureBase = implode('|', array_values($params)) . '|' . $crcKey;
$calculatedSignature = hash('sha384', $signatureBase);

if (hash_equals($calculatedSignature, $receivedSignature)) {
    // Podpis poprawny, transakcja zweryfikowana

    // Zapisz dane do pliku logu
    file_put_contents('webhook-log.txt', date('Y-m-d H:i:s') . ' | Płatność OK | ' . json_encode($params) . PHP_EOL, FILE_APPEND);

    // Wysłanie odpowiedzi do Przelewy24
    echo "TRUE";
} else {
    // Błąd weryfikacji
    file_put_contents('webhook-log.txt', date('Y-m-d H:i:s') . ' | BŁĄD podpisu | ' . json_encode($params) . PHP_EOL, FILE_APPEND);

    echo "FALSE";
}
?>
