<?php
require_once __DIR__ . '/../../../commun/init.php';
use Commun\Config\Config;
use Commun\Logger\Logger;

$config = Config::getInstance();
$logger = Logger::getInstance()->getLogger();

require_once __DIR__ . '/includes.php';
require_once $config->get('ASSETS_DIR') . '/libs/updateFlow/src/php/autoload.php';

use UpdateFlow\UpdateFlow;

try {
    // Vérification de la méthode
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Méthode non autorisée', 405);
    }

    // Récupération et validation des données
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['message']) || !isset($data['type'])) {
        throw new Exception('Données invalides', 400);
    }

    // Vérification du fichier version
    $versionFile = $config->get('VERSION_FILE');
    $logger->debug('Version file checks:', [
        'path'     => $versionFile,
        'exists'   => file_exists($versionFile) ? 'yes' : 'no',
        'readable' => is_readable($versionFile) ? 'yes' : 'no',
        'writable' => is_writable($versionFile) ? 'yes' : 'no',
        'content'  => file_exists($versionFile) ? file_get_contents($versionFile) : 'N/A',
    ]);

    $gitConfig = [
        'repoPath'      => $config->get('ROOT'),
        'versionPath'   => $config->get('VERSION_FILE'),
        'logger'        => $logger,
        'debug'         => true,
        'versionFormat' => 'text',
        'gitConfig'     => [
            'userName'  => $config->get('GIT_USER_NAME'),
            'userEmail' => $config->get('GIT_USER_MAIL'),
            'token'     => "",
            'remote'    => "",
        ],
        'requireAuth'   => false,
        'gitOptions'    => [
            'addAll'    => true,    // Ajouter tous les nouveaux fichiers
            'addMoved'  => true,    // Gérer les fichiers déplacés
            'force'     => false    // Ne pas forcer le push
        ]
    ];

    // Log des configurations
    $logger->debug('UpdateFlow configuration', $gitConfig);

    $updateFlow = new UpdateFlow($gitConfig);
    
    // Effectuer le push
    $result = $updateFlow->push($data['message'], $data['type']);
    
    // Log du résultat du push
    $logger->debug('Push result', (array) $result);

    // Récupère la version actuelle après le push
    $version = file_get_contents($config->get('ROOT') . '/version');
    $logger->debug('Version after push: ' . $version);
    $returnValue = [
        'status'  => $result['status'],
        'version' => $version,
        'message' => $result['message'],
    ];
    echo json_encode($returnValue);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => $e->getMessage(),
        'file'    => basename($e->getFile()),
        'line'    => $e->getLine(),
    ]);
}
