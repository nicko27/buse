<?php
declare(strict_types=1);

namespace UpdateFlow\Handlers;

use UpdateFlow\Managers\{GitManager, VersionManager};
use UpdateFlow\Utils\Logger;
use UpdateFlow\Exceptions\{GitException, UpdateFlowException};

/**
 * Gestionnaire des opérations de push
 */
class PushHandler
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
     * Exécute l'opération de push
     * 
     * @param string $message Message de commit
     * @param string $type Type de commit
     * @return array
     * @throws UpdateFlowException
     */
    public function execute(string $message, string $type): array
    {
        try {
            // Vérifie si le répertoire de travail est propre
            if ($this->gitManager->isWorkingTreeClean()) {
                return [
                    'status' => 'success',
                    'message' => 'Nothing to commit',
                    'version' => $this->versionManager->getVersion()
                ];
            }

            // Vérifie la branche actuelle
            $currentBranch = $this->gitManager->getCurrentBranch();

            // Génère la nouvelle version
            $currentVersion = $this->versionManager->getVersion();
            $newVersion = $this->versionManager->generateNewVersion($currentVersion, $type);

            // Met à jour le fichier de version
            $this->versionManager->updateVersion($newVersion);

            // Effectue le commit
            $commitMessage = sprintf(
                '%s: %s (v%s)',
                $type,
                $message,
                $newVersion
            );
            $this->gitManager->commit($commitMessage);

            // Effectue le push
            $this->gitManager->push($currentBranch);

            // Récupère les informations du dernier commit
            $lastCommit = $this->gitManager->getLastCommit();

            // Log l'opération
            $this->logger->info('Push successful', [
                'commit' => $lastCommit['hash'],
                'message' => $lastCommit['message'],
                'version' => $newVersion
            ]);

            return [
                'status' => 'success',
                'message' => 'Push successful',
                'version' => $newVersion,
                'commit' => $lastCommit
            ];
        } catch (GitException $e) {
            throw new UpdateFlowException('Push failed: ' . $e->getMessage());
        }
    }
}
