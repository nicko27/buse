<?php
require_once __DIR__ . '/../../../commun/init.php';

use Commun\Config\Config;
use Commun\Logger\Logger;
use Commun\Utils\UploadManager;

$config = Config::getInstance();
$logger = Logger::getInstance()->getLogger();

$result = [
    'success' => false,
    'message' => '',
    'file'    => null,
];

try {
    if (empty($_FILES['file'])) {
        throw new Exception('Aucun fichier reçu');
    }

    $allowedTypes = [
        'text/html',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    ];
    $maxSize = 10 * 1024 * 1024; // 10 MB

    $uploadResult = UploadManager::getInstance()->handleUpload(
        $_FILES['file'],
        $config->get("UPLOAD_DIR"),
        $allowedTypes,
        $maxSize,
        $normalizeFilename = true
    );

    if ($uploadResult['error'] !== 0) {
        throw new Exception($uploadResult['msgError']);
    }

    $result['success'] = true;
    $result['message'] = 'Fichier uploadé avec succès';
    $result['file']    = basename($uploadResult['uploadedFile']);

} catch (Exception $e) {
    $result['message'] = $e->getMessage();
    $logger->error('Erreur lors de l\'upload', [
        'error'     => $e->getMessage(),
        'file'      => $_FILES['file']['name'] ?? 'unknown',
        'uploadDir' => $uploadDir,
    ]);
}

header('Content-Type: application/json');
echo json_encode($result);
