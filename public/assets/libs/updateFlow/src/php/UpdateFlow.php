<?php
declare(strict_types=1);

namespace UpdateFlow;

use UpdateFlow\Handlers\{PullHandler, PushHandler};
use UpdateFlow\Managers\{GitManager, VersionManager};
use UpdateFlow\Utils\{Logger, Response, Security};
use UpdateFlow\Exceptions\{UpdateFlowException, GitException, VersionException};

/**
 * Classe principale UpdateFlow
 */
class UpdateFlow
{
    private GitManager $gitManager;
    private VersionManager $versionManager;
    private Logger $logger;
    private Security $security;
    private array $config;
    private array $defaultConfig = [
        'versionFormat' => 'text',
        'maxRetries' => 3,
        'retryDelay' => 1000,
        'timeout' => 30000,
        'debug' => false,
        'allowedBranches' => ['main', 'master', 'develop'],
        'requireAuth' => true,
        'autoBackup' => true,
        'backupPath' => null,
        'lockFile' => null,
        'hooks' => [
            'prePull' => null,
            'postPull' => null,
            'prePush' => null,
            'postPush' => null
        ]
    ];

    /**
     * Constructeur
     * 
     * @param array $config Configuration
     * @throws UpdateFlowException
     */
    public function __construct(array $config)
    {
        $this->validateConfig($config);
        $this->config = $this->initConfig($config);
        
        $this->logger = new Logger($this->config['logger']);
        $this->security = new Security($this->config);
        
        $this->gitManager = new GitManager(
            $this->config['repoPath'],
            $this->logger,
            $this->config
        );
        
        $this->versionManager = new VersionManager(
            $this->config['versionPath'],
            $this->config['versionFormat'],
            $this->logger
        );

        if ($this->config['debug']) {
            $this->logger->debug('UpdateFlow initialisé avec la configuration:', $this->config);
        }
    }

    /**
     * Valide la configuration
     * 
     * @param array $config
     * @throws UpdateFlowException
     */
    private function validateConfig(array $config): void
    {
        $requiredFields = ['repoPath', 'versionPath', 'logger'];
        
        foreach ($requiredFields as $field) {
            if (!isset($config[$field])) {
                throw new UpdateFlowException("Champ de configuration manquant: $field");
            }
        }

        // Validation des chemins
        foreach (['repoPath', 'versionPath'] as $path) {
            if (!is_readable($config[$path])) {
                throw new UpdateFlowException("Chemin non accessible en lecture: $path");
            }
        }

        // Validation du format de version
        if (isset($config['versionFormat']) && !in_array($config['versionFormat'], ['text', 'json'])) {
            throw new UpdateFlowException("Format de version invalide: {$config['versionFormat']}");
        }
    }

    /**
     * Initialise la configuration avec les valeurs par défaut
     */
    private function initConfig(array $config): array
    {
        $mergedConfig = array_merge($this->defaultConfig, $config);

        // Configuration du chemin de backup par défaut
        if ($mergedConfig['autoBackup'] && !$mergedConfig['backupPath']) {
            $mergedConfig['backupPath'] = $mergedConfig['repoPath'] . '/backups';
        }

        // Configuration du fichier de lock par défaut
        if (!$mergedConfig['lockFile']) {
            $mergedConfig['lockFile'] = $mergedConfig['repoPath'] . '/.updateflow.lock';
        }

        return $mergedConfig;
    }

    /**
     * Exécute un hook s'il existe
     * 
     * @param string $hook Nom du hook
     * @param array $context Contexte d'exécution
     * @throws UpdateFlowException
     */
    private function executeHook(string $hook, array $context = []): void
    {
        if (isset($this->config['hooks'][$hook]) && is_callable($this->config['hooks'][$hook])) {
            try {
                $this->logger->debug("Exécution du hook: $hook");
                call_user_func($this->config['hooks'][$hook], $context);
            } catch (\Throwable $e) {
                throw new UpdateFlowException("Erreur lors de l'exécution du hook $hook: " . $e->getMessage());
            }
        }
    }

    /**
     * Crée un backup du répertoire
     * 
     * @throws UpdateFlowException
     */
    private function backup(): void
    {
        if (!$this->config['autoBackup']) return;

        try {
            $backupDir = $this->config['backupPath'];
            if (!is_dir($backupDir)) {
                mkdir($backupDir, 0755, true);
            }

            $timestamp = date('Y-m-d_H-i-s');
            $backupFile = "$backupDir/backup_$timestamp.zip";

            $zip = new \ZipArchive();
            if ($zip->open($backupFile, \ZipArchive::CREATE) !== true) {
                throw new UpdateFlowException("Impossible de créer le fichier de backup");
            }

            $this->addDirToZip($zip, $this->config['repoPath'], basename($this->config['repoPath']));
            $zip->close();

            $this->logger->info("Backup créé: $backupFile");
        } catch (\Throwable $e) {
            throw new UpdateFlowException("Erreur lors de la création du backup: " . $e->getMessage());
        }
    }

    /**
     * Ajoute un répertoire à un fichier ZIP
     */
    private function addDirToZip(\ZipArchive $zip, string $path, string $localPath = ''): void
    {
        $dir = opendir($path);
        while ($entry = readdir($dir)) {
            if ($entry == '.' || $entry == '..' || $entry == '.git' || $entry == 'backups') continue;

            $fullPath = $path . '/' . $entry;
            $zipPath = $localPath ? "$localPath/$entry" : $entry;

            if (is_dir($fullPath)) {
                $zip->addEmptyDir($zipPath);
                $this->addDirToZip($zip, $fullPath, $zipPath);
            } else {
                $zip->addFile($fullPath, $zipPath);
            }
        }
        closedir($dir);
    }

    /**
     * Vérifie et acquiert le verrou
     * 
     * @throws UpdateFlowException
     */
    private function acquireLock(): void
    {
        $lockFile = $this->config['lockFile'];
        if (file_exists($lockFile)) {
            $lockData = json_decode(file_get_contents($lockFile), true);
            if ($lockData && time() - $lockData['time'] < 300) { // 5 minutes timeout
                throw new UpdateFlowException("Une autre opération est en cours");
            }
        }

        file_put_contents($lockFile, json_encode([
            'time' => time(),
            'pid' => getmypid()
        ]));
    }

    /**
     * Libère le verrou
     */
    private function releaseLock(): void
    {
        $lockFile = $this->config['lockFile'];
        if (file_exists($lockFile)) {
            unlink($lockFile);
        }
    }

    /**
     * Récupère la version actuelle
     * 
     * @return array
     */
    public function getVersion(): array
    {
        try {
            $currentVersion = $this->versionManager->getVersion();
            
            return [
                'status' => 'success',
                'version' => $currentVersion,
                'message' => "Version actuelle récupérée avec succès"
            ];
        } catch (\Throwable $e) {
            $this->logger->error("Erreur lors de la récupération de la version : " . $e->getMessage());
            
            return [
                'status' => 'error',
                'message' => "Impossible de récupérer la version",
                'details' => $e->getMessage()
            ];
        }
    }

    /**
     * Effectue un pull
     * 
     * @return array
     */
    public function pull(): array
    {
        try {
            // Vérification de l'authentification si requise
            if ($this->config['requireAuth']) {
                $this->security->checkAuth();
            }

            // Acquisition du verrou
            $this->acquireLock();

            // Backup si configuré
            if ($this->config['autoBackup']) {
                $this->backup();
            }

            // Exécution du hook pre-pull
            $this->executeHook('prePull');

            // Initialisation du gestionnaire de pull
            $pullHandler = new PullHandler(
                $this->gitManager,
                $this->versionManager,
                $this->logger
            );

            // Exécution du pull
            $result = $pullHandler->execute();

            // Exécution du hook post-pull
            $this->executeHook('postPull', $result);

            return [
                'status' => 'success',
                'message' => $result['message'] ?? 'Pull effectué avec succès',
                'version' => $result['version']
            ];

        } catch (UpdateFlowException $e) {
            $this->logger->error($e->getMessage());
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
                'code' => $e->getCode()
            ];
        } finally {
            $this->releaseLock();
        }
    }

    /**
     * Effectue un push
     * 
     * @param string $message Message de commit
     * @param string $type Type de commit
     * @return array
     */
    public function push(string $message, string $type = 'patch'): array
    {
        try {
            $this->logger->info("Début du push: $message (type: $type)");

            // Exécution du hook pré-push
            $this->executeHook('prePush', ['message' => $message, 'type' => $type]);

            // Création du backup
            $this->backup();

            // Initialisation du gestionnaire de push
            $pushHandler = new PushHandler(
                $this->gitManager,
                $this->versionManager,
                $this->logger
            );

            // Exécution du push
            $result = $pushHandler->execute($message, $type);

            // Exécution du hook post-push
            $this->executeHook('postPush', ['result' => $result]);

            // Retourne un tableau au lieu d'un objet Response
            return [
                'status' => 'success',
                'message' => $result['message'] ?? 'Push effectué avec succès',
                'version' => $result['version']
            ];

        } catch (GitException|VersionException|UpdateFlowException $e) {
            $this->logger->error("Erreur lors du push: " . $e->getMessage());

            // Retourne un tableau d'erreur
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
                'code' => $e->getCode()
            ];
        } catch (\Throwable $e) {
            $this->logger->error("Erreur inattendue lors du push: " . $e->getMessage());

            // Retourne un tableau d'erreur générique
            return [
                'status' => 'error',
                'message' => 'Une erreur inattendue est survenue',
                'details' => $e->getMessage()
            ];
        }
    }

    /**
     * Vérifie si une branche est autorisée
     * 
     * @param string $branch
     * @return bool
     */
    public function isBranchAllowed(string $branch): bool
    {
        return in_array($branch, $this->config['allowedBranches']);
    }
}
