<?php
require_once __DIR__ . '/../../../commun/init.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/UpdateFlow.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/Managers/GitManager.php';

use UpdateFlow\UpdateFlow;
use UpdateFlow\Managers\GitManager;
use UpdateFlow\Utils\Response;
use UpdateFlow\Utils\Security;

try {
    // Vérification de la méthode
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Méthode non autorisée', 405);
    }

    // Vérification des données
    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['commit'])) {
        throw new Exception('Commit hash requis', 400);
    }

    // Configuration
    $config = [
        'repoPath' => __DIR__ . '/../../../../',
        'versionPath' => __DIR__ . '/../../../../version.json',
        'logPath' => __DIR__ . '/../../../../logs/updateflow.log',
        'debug' => false,
        'logger' => LOGGER
    ];

    // Initialisation de GitManager avec le logger existant
    $gitManager = new GitManager($config['repoPath'], LOGGER);
    
    // Reset au commit spécifié
    $gitManager->reset($data['commit']);
    
    Response::success([
        'message' => 'Reset effectué avec succès',
        'commit' => $data['commit']
    ])->send();
} catch (Exception $e) {
    Response::error($e->getMessage(), $e->getCode() ?: 500)->send();
}
