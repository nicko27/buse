<?php
declare(strict_types=1);

namespace UpdateFlow\Utils;

use UpdateFlow\Exceptions\UpdateFlowException;

/**
 * Classe de gestion de la sécurité
 */
class Security
{
    private array $config;
    private ?Logger $logger;
    private string $tokenFile;

    /**
     * Constructeur
     * 
     * @param array $config Configuration
     * @param Logger|null $logger Logger
     */
    public function __construct(array $config, ?Logger $logger = null)
    {
        $this->config = $config;
        $this->logger = $logger;
        $this->tokenFile = $config['repoPath'] . '/.updateflow_token';
    }

    /**
     * Vérifie l'authentification
     * 
     * @throws UpdateFlowException
     */
    public function checkAuth(): void
    {
        if (!$this->config['requireAuth']) {
            return;
        }

        if (!$this->validateCsrfToken()) {
            throw new UpdateFlowException("Token CSRF invalide", 401);
        }
    }

    /**
     * Valide le token CSRF
     * 
     * @return bool
     */
    private function validateCsrfToken(): bool
    {
        // Vérification du token CSRF dans l'en-tête
        $headers = getallheaders();
        $csrfToken = $headers['X-CSRF-Token'] ?? null;

        if (!$csrfToken) {
            $this->log('Token CSRF manquant');
            return false;
        }

        if (!file_exists($this->tokenFile)) {
            $this->log('Fichier token non trouvé');
            return false;
        }

        $storedToken = trim(file_get_contents($this->tokenFile));
        if (empty($storedToken)) {
            $this->log('Token stocké invalide');
            return false;
        }

        if (!hash_equals($storedToken, $csrfToken)) {
            $this->log('Token CSRF invalide');
            return false;
        }

        return true;
    }

    /**
     * Génère un nouveau token CSRF
     * 
     * @return string
     */
    public function generateCsrfToken(): string
    {
        $token = bin2hex(random_bytes(32));
        file_put_contents($this->tokenFile, $token);
        return $token;
    }

    /**
     * Log un message si un logger est disponible
     * 
     * @param string $message
     * @param array $context
     */
    private function log(string $message, array $context = []): void
    {
        if ($this->logger) {
            $this->logger->warning($message, $context);
        }
    }
}
