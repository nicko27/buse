<?php
require_once __DIR__ . '/../../../commun/init.php';
require_once __DIR__ . '/includes.php';

use UpdateFlow\UpdateFlow;
use UpdateFlow\Utils\Response;
use Commun\Logger\Logger;
use Commun\Security\CsrfManager;

try {
    // Debug
    $logger = Logger::getInstance()->getLogger();
    $logger->debug('Headers reçus:', $_SERVER);
    

    // Configuration
    $config = [
        'repoPath' => ROOT,
        'versionPath' => ROOT . '/version',
        'debug' => false,
        'logger' => Logger::getInstance()->getLogger()
    ];

    // Initialisation
    $updateFlow = new UpdateFlow($config);
    
    // Récupération de la version
    $response = $updateFlow->getVersion();
    $logger->debug('Réponse de la version:', ['response' => $response]);
    
    // Envoi de la réponse JSON
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
} catch (Exception $e) {
    $logger->error('Erreur:', ['message' => $e->getMessage()]);
    
    // Envoi de l'erreur en JSON
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
    exit;
}
