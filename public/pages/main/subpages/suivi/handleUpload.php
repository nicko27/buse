<?php
require_once __DIR__ . '/../../../commun/init.php';

use Commun\Utils\UploadManager;
use Commun\Config\Config;

$result = [
    'success' => false,
    'message' => '',
    'file' => null
];

try {
    if (empty($_FILES['file'])) {
        throw new Exception('Aucun fichier reçu');
    }

    $allowedTypes = [
        'text/html',
        'application/vnd.oasis.opendocument.spreadsheet'
    ];
    $maxSize = 10 * 1024 * 1024; // 10 MB

    $uploadResult = UploadManager::getInstance()->handleUpload(
        $_FILES['file'],
        UPLOAD_DIR,
        $allowedTypes,
        $maxSize
    );

    if ($uploadResult['error'] !== 0) {
        throw new Exception($uploadResult['msgError']);
    }

    $result['success'] = true;
    $result['message'] = 'Fichier uploadé avec succès';
    $result['file'] = basename($uploadResult['uploadedFile']);

} catch (Exception $e) {
    $result['message'] = $e->getMessage();
    LOGGER->error('Erreur lors de l\'upload', [
        'error' => $e->getMessage(),
        'file' => $_FILES['file']['name'] ?? 'unknown',
        'uploadDir' => $uploadDir
    ]);
}

header('Content-Type: application/json');
echo json_encode($result);
