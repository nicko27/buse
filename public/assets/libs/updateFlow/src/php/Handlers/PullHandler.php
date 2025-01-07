<?php
declare(strict_types=1);

namespace UpdateFlow\Handlers;

use UpdateFlow\Managers\{GitManager, VersionManager};
use UpdateFlow\Utils\Logger;
use UpdateFlow\Exceptions\{GitException, UpdateFlowException};

/**
 * Gestionnaire des opérations de pull
 */
class PullHandler
{
    private GitManager $gitManager;
    private VersionManager $versionManager;
    private Logger $logger;

    public function __construct(
        GitManager $gitManager,
        VersionManager $versionManager,
        Logger $logger
    ) {
        $this->gitManager = $gitManager;
        $this->versionManager = $versionManager;
        $this->logger = $logger;
    }

    /**
     * Exécute l'opération de pull
     * 
     * @return array
     * @throws UpdateFlowException
     */
    public function execute(): array
    {
        try {
            // Vérifie si le répertoire de travail est propre
            if (!$this->gitManager->isWorkingTreeClean()) {
                throw new UpdateFlowException('Working directory is not clean');
            }

            // Vérifie s'il y a des mises à jour disponibles
            if (!$this->gitManager->hasUpdates()) {
                return [
                    'status' => 'success',
                    'message' => 'Already up to date',
                    'version' => $this->versionManager->getVersion()
                ];
            }

            // Effectue le pull
            $this->gitManager->pull();

            // Récupère les informations du dernier commit
            $lastCommit = $this->gitManager->getLastCommit();

            // Log l'opération
            $this->logger->info('Pull successful', [
                'commit' => $lastCommit['hash'],
                'message' => $lastCommit['message']
            ]);

            return [
                'status' => 'success',
                'message' => 'Pull successful',
                'version' => $this->versionManager->getVersion(),
                'commit' => $lastCommit
            ];
        } catch (GitException $e) {
            throw new UpdateFlowException('Pull failed: ' . $e->getMessage());
        }
    }
}
