<?php
declare(strict_types=1);

namespace UpdateFlow\Managers;

use Psr\Log\LoggerInterface;
use UpdateFlow\Exceptions\GitException;

/**
 * Gestionnaire des opérations Git
 */
class GitManager
{
    private string $repoPath;
    private LoggerInterface $logger;
    private array $config;

    public function __construct(string $repoPath, LoggerInterface $logger, array $config = [])
    {
        $this->repoPath = $repoPath;
        $this->logger = $logger;
        $this->config = $config;
    }

    /**
     * Exécute une commande Git
     * 
     * @param string $command
     * @param array $args
     * @return string
     * @throws GitException
     */
    private function execute(string $command, array $args = []): string
    {
        $fullCommand = sprintf(
            'cd %s && git %s %s 2>&1',
            escapeshellarg($this->repoPath),
            escapeshellcmd($command),
            implode(' ', array_map('escapeshellarg', $args))
        );

        $output = [];
        $returnVar = 0;

        exec($fullCommand, $output, $returnVar);
        $outputStr = implode("\n", $output);

        if ($returnVar !== 0) {
            $this->logger->error("Git command failed: {$fullCommand}", ['output' => $outputStr]);
            throw new GitException("Git command failed: {$outputStr}");
        }

        $this->logger->debug("Git command executed: {$command}", [
            'args' => $args,
            'output' => $outputStr
        ]);

        return $outputStr;
    }

    /**
     * Configure le répertoire comme sûr pour Git
     */
    private function configureSafeDirectory(): void
    {
        // Configure le répertoire comme sûr via une variable d'environnement
        putenv("GIT_CEILING_DIRECTORIES=none");
        putenv(sprintf("GIT_WORK_TREE=%s", $this->repoPath));
        putenv(sprintf("GIT_DIR=%s/.git", $this->repoPath));
    }

    /**
     * Configure Git avec les paramètres de base
     */
    private function configureGit(): void
    {
        // Configure les paramètres Git de base
        if (!empty($this->config['gitConfig']['userName'])) {
            $this->execute('config', ['--local', 'user.name', $this->config['gitConfig']['userName']]);
        }
        if (!empty($this->config['gitConfig']['userEmail'])) {
            $this->execute('config', ['--local', 'user.email', $this->config['gitConfig']['userEmail']]);
        }
    }

    /**
     * Ajoute tous les fichiers au suivi Git, y compris les nouveaux fichiers et les fichiers déplacés
     * 
     * @return string
     * @throws GitException
     */
    public function addAll(): string
    {
        try {
            // Configure l'environnement Git
            $this->configureSafeDirectory();
            $this->configureGit();

            // Ajoute tous les fichiers, y compris les nouveaux et les déplacés
            $output = $this->execute('add', ['-A', '.']);

            // Log les fichiers ajoutés
            $status = $this->execute('status', ['--porcelain']);
            if (!empty($status)) {
                $this->logger->info('Files added to Git:', [
                    'status' => $status,
                    'directory' => $this->repoPath
                ]);
            }

            return $output;
        } catch (GitException $e) {
            throw new GitException(sprintf(
                "Erreur lors de l'ajout des fichiers : %s\nRépertoire : %s",
                $e->getMessage(),
                $this->repoPath
            ));
        }
    }

    /**
     * Récupère la branche actuelle
     * 
     * @return string
     */
    public function getCurrentBranch(): string
    {
        return trim($this->execute('rev-parse', ['--abbrev-ref', 'HEAD']));
    }

    /**
     * Vérifie si le répertoire de travail est propre
     * 
     * @return bool
     */
    public function isWorkingTreeClean(): bool
    {
        try {
            $status = $this->execute('status', ['--porcelain']);
            return empty($status);
        } catch (GitException $e) {
            return false;
        }
    }

    /**
     * Effectue un pull
     * 
     * @return string
     */
    public function pull(): string
    {
        return $this->execute('pull', ['--ff-only']);
    }

    /**
     * Push les modifications vers le dépôt distant
     * 
     * @param string $branch Branche à pousser
     * @return string
     * @throws GitException
     */
    public function push(string $branch = ''): string
    {
        try {
            // Configure l'environnement Git
            $this->configureSafeDirectory();
            $this->configureGit();

            // Ajoute d'abord tous les fichiers si configuré
            if (!empty($this->config['gitOptions']['addAll'])) {
                $this->addAll();
            }

            $args = ['origin'];
            if (!empty($branch)) {
                $args[] = $branch;
            }

            // Ajoute l'option --force si configurée
            if (!empty($this->config['gitOptions']['force'])) {
                $args[] = '--force';
            }

            return $this->execute('push', $args);
        } catch (GitException $e) {
            throw new GitException(sprintf(
                "Erreur lors du push Git : %s\nRépertoire : %s",
                $e->getMessage(),
                $this->repoPath
            ));
        }
    }

    /**
     * Effectue un commit
     * 
     * @param string $message
     * @return string
     */
    public function commit(string $message): string
    {
        return $this->execute('commit', ['-am', $message]);
    }

    /**
     * Change de branche
     * 
     * @param string $branch
     * @return string
     */
    public function checkout(string $branch): string
    {
        if (!$this->isWorkingTreeClean()) {
            throw new GitException('Working tree is not clean');
        }
        return $this->execute('checkout', [$branch]);
    }

    /**
     * Fusionne une branche
     * 
     * @param string $branch
     * @return string
     */
    public function merge(string $branch): string
    {
        if (!$this->isWorkingTreeClean()) {
            throw new GitException('Working tree is not clean');
        }
        return $this->execute('merge', [$branch]);
    }

    /**
     * Effectue un rebase
     * 
     * @param string $branch
     * @return string
     */
    public function rebase(string $branch): string
    {
        if (!$this->isWorkingTreeClean()) {
            throw new GitException('Working tree is not clean');
        }
        return $this->execute('rebase', [$branch]);
    }

    /**
     * Effectue un reset
     * 
     * @param string $commit
     * @param string $mode hard|soft|mixed
     * @return string
     */
    public function reset(string $commit, string $mode = 'hard'): string
    {
        if (!in_array($mode, ['hard', 'soft', 'mixed'])) {
            throw new GitException('Invalid reset mode');
        }
        return $this->execute('reset', ["--{$mode}", $commit]);
    }

    /**
     * Récupère le dernier commit
     * 
     * @return array
     */
    public function getLastCommit(): array
    {
        $format = [
            'hash' => '%H',
            'author' => '%an',
            'date' => '%ai',
            'message' => '%s'
        ];

        $formatStr = implode('%n', array_map(
            fn($key, $format) => "{$key}: {$format}",
            array_keys($format),
            $format
        ));

        $output = $this->execute('log', ['-1', "--pretty=format:{$formatStr}"]);
        $lines = explode("\n", $output);
        $commit = [];

        foreach ($lines as $line) {
            [$key, $value] = explode(': ', $line, 2);
            $commit[$key] = $value;
        }

        return $commit;
    }

    /**
     * Vérifie si des mises à jour sont disponibles
     * 
     * @return bool
     */
    public function hasUpdates(): bool
    {
        $this->execute('fetch', ['origin']);
        $localRef = trim($this->execute('rev-parse', ['HEAD']));
        $remoteRef = trim($this->execute('rev-parse', ['@{u}']));
        
        return $localRef !== $remoteRef;
    }
}
