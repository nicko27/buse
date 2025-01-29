<?php
require_once __DIR__ . '/../../../commun/init.php';
require_once __DIR__ . '/includes.php';

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
    if (!isset($data['branch'])) {
        throw new Exception('Branch requise', 400);
    }

    // Configuration
    $config = [
        'repoPath' => __DIR__ . '/../../../../',
        'versionPath' => __DIR__ . '/../../../../version.json',
        'logPath' => __DIR__ . '/../../../../logs/updateflow.log',
        'debug' => false,
        'allowedBranches' => ['main', 'master', 'develop'],
        'logger' => LOGGER
    ];

    // Initialisation
    $updateFlow = new UpdateFlow($config);
    
    // Vérification de la branche
    if (!$updateFlow->isBranchAllowed($data['branch'])) {
        throw new Exception('Branche non autorisée', 403);
    }

    // Initialisation de GitManager avec le logger existant
    $gitManager = new GitManager($config['repoPath'], LOGGER);
    
    // Changement de branche
    $gitManager->checkout($data['branch']);
    
    Response::success([
        'message' => 'Branche changée avec succès',
        'branch' => $data['branch']
    ])->send();
} catch (Exception $e) {
    Response::error($e->getMessage(), $e->getCode() ?: 500)->send();
}
