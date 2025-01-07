<?php
require_once __DIR__ . '/../../../commun/init.php';
require_once __DIR__ . '/includes.php';
require_once ROOT . '/public/assets/libs/updateFlow/src/php/autoload.php';

use UpdateFlow\UpdateFlow;
use UpdateFlow\Utils\Response;
use UpdateFlow\Utils\Security;

try {
    // Vérification de la méthode
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Méthode non autorisée', 405);
    }

    $config = [
        'repoPath' => ROOT,
        'versionPath' => ROOT . '/version',
        'logger' => LOGGER,
        'debug' => true,
        'versionFormat' => 'text',
        'gitConfig' => [
            'userName' => GIT_USER_NAME,
            'userEmail' => GIT_USER_MAIL,
            'token' => "",
            'remote' => ""
        ],
        'requireAuth' => false

    ];


    // Initialisation
    $updateFlow = new UpdateFlow($config);
    
    // Pull
    $response = $updateFlow->pull();
    $response->send();
} catch (Exception $e) {
    Response::error($e->getMessage(), $e->getCode() ?: 500)->send();
}
