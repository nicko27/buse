<?php
namespace Commun\Security;

/**
 * Gestionnaire de tokens CSRF avec renouvellement automatique
 *
 * Cette classe gère la génération, validation et renouvellement des tokens CSRF
 * pour protéger contre les attaques Cross-Site Request Forgery.
 *
 * Fonctionnalités :
 * - Génération de tokens sécurisés
 * - Validation avec protection contre les attaques de timing
 * - Renouvellement automatique périodique
 * - Protection contre la fixation de tokens
 * - Gestion de multiples tokens par utilisateur
 *
 * @package Commun\Security
 * @author Application Framework
 * @version 1.0
 */
class CsrfManager
{
    /** @var CsrfManager|null Instance singleton */
    private static ?CsrfManager $instance = null;

    /** @var string Clé de session pour le token principal */
    private const SESSION_TOKEN_KEY = 'CSRF_TOKEN';

    /** @var string Clé de session pour les tokens secondaires */
    private const SESSION_TOKENS_KEY = 'CSRF_TOKENS';

    /** @var string Clé de session pour la dernière génération */
    private const SESSION_LAST_GENERATION_KEY = 'CSRF_LAST_GENERATION';

    /** @var string Clé de session pour le compteur d'utilisation */
    private const SESSION_USAGE_COUNT_KEY = 'CSRF_USAGE_COUNT';

    /** @var int Durée de vie d'un token en secondes (30 minutes par défaut) */
    private int $tokenLifetime = 1800;

    /** @var int Nombre maximum d'utilisations avant renouvellement forcé */
    private int $maxUsageCount = 10;

    /** @var int Nombre maximum de tokens stockés simultanément */
    private int $maxTokens = 5;

    /** @var string Token principal actuel */
    private string $currentToken;

    /**
     * Constructeur privé pour le pattern Singleton
     *
     * @throws \RuntimeException Si la session n'est pas démarrée
     */
    private function __construct()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (session_status() !== PHP_SESSION_ACTIVE) {
            throw new \RuntimeException('Session PHP requise pour le gestionnaire CSRF');
        }

        $this->initializeTokens();
    }

    /**
     * Retourne l'instance singleton
     *
     * @return self Instance unique du gestionnaire CSRF
     */
    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Initialise les tokens CSRF
     *
     * @return void
     */
    private function initializeTokens(): void
    {
        // CORRECTION 11: Vérification et renouvellement automatique du token
        if ($this->shouldRenewToken()) {
            $this->renewToken();
        } else {
            // Récupérer le token existant ou en créer un nouveau
            if (! isset($_SESSION[self::SESSION_TOKEN_KEY]) || empty($_SESSION[self::SESSION_TOKEN_KEY])) {
                $this->generateNewToken();
            } else {
                $this->currentToken = $_SESSION[self::SESSION_TOKEN_KEY];
            }
        }

        // Initialiser les structures de données si nécessaire
        if (! isset($_SESSION[self::SESSION_TOKENS_KEY])) {
            $_SESSION[self::SESSION_TOKENS_KEY] = [];
        }

        if (! isset($_SESSION[self::SESSION_USAGE_COUNT_KEY])) {
            $_SESSION[self::SESSION_USAGE_COUNT_KEY] = 0;
        }
    }

    /**
     * Vérifie si le token doit être renouvelé
     *
     * @return bool True si le token doit être renouvelé
     */
    private function shouldRenewToken(): bool
    {
        // Pas de token existant
        if (! isset($_SESSION[self::SESSION_TOKEN_KEY]) || empty($_SESSION[self::SESSION_TOKEN_KEY])) {
            return true;
        }

        // Token expiré par l'âge
        if (isset($_SESSION[self::SESSION_LAST_GENERATION_KEY])) {
            $age = time() - $_SESSION[self::SESSION_LAST_GENERATION_KEY];
            if ($age > $this->tokenLifetime) {
                return true;
            }
        }

        // Token expiré par utilisation excessive
        if (isset($_SESSION[self::SESSION_USAGE_COUNT_KEY])) {
            if ($_SESSION[self::SESSION_USAGE_COUNT_KEY] >= $this->maxUsageCount) {
                return true;
            }
        }

        // Renouvellement aléatoire (1% de chance) pour éviter la prédictibilité
        if (random_int(1, 100) === 1) {
            return true;
        }

        return false;
    }

    /**
     * Génère un nouveau token CSRF
     *
     * @return void
     */
    private function generateNewToken(): void
    {
        $this->currentToken                          = $this->createSecureToken();
        $_SESSION[self::SESSION_TOKEN_KEY]           = $this->currentToken;
        $_SESSION[self::SESSION_LAST_GENERATION_KEY] = time();
        $_SESSION[self::SESSION_USAGE_COUNT_KEY]     = 0;

        // Ajouter le token à la liste des tokens valides
        $this->addToValidTokens($this->currentToken);
    }

    /**
     * Crée un token sécurisé
     *
     * @return string Token CSRF sécurisé
     * @throws \RuntimeException Si impossible de générer un token sécurisé
     */
    private function createSecureToken(): string
    {
        try {
            // Utiliser random_bytes pour une sécurité cryptographique
            $randomBytes = random_bytes(32);

            // Ajouter des données supplémentaires pour renforcer l'entropie
            $additionalData = serialize([
                'time'        => microtime(true),
                'session_id'  => session_id(),
                'user_agent'  => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? '',
                'random'      => random_int(PHP_INT_MIN, PHP_INT_MAX),
            ]);

            // Combiner et hasher
            $combined = $randomBytes . hash('sha256', $additionalData, true);

            return bin2hex($combined);

        } catch (\Exception $e) {
            throw new \RuntimeException('Impossible de générer un token CSRF sécurisé: ' . $e->getMessage());
        }
    }

    /**
     * Ajoute un token à la liste des tokens valides
     *
     * @param string $token Token à ajouter
     * @return void
     */
    private function addToValidTokens(string $token): void
    {
        if (! isset($_SESSION[self::SESSION_TOKENS_KEY])) {
            $_SESSION[self::SESSION_TOKENS_KEY] = [];
        }

        // Ajouter le nouveau token avec timestamp
        $_SESSION[self::SESSION_TOKENS_KEY][$token] = time();

        // Nettoyer les anciens tokens si nécessaire
        $this->cleanupOldTokens();
    }

    /**
     * Nettoie les anciens tokens
     *
     * @return void
     */
    private function cleanupOldTokens(): void
    {
        if (! isset($_SESSION[self::SESSION_TOKENS_KEY])) {
            return;
        }

        $now    = time();
        $tokens = $_SESSION[self::SESSION_TOKENS_KEY];

        // Supprimer les tokens expirés
        foreach ($tokens as $token => $timestamp) {
            if (($now - $timestamp) > $this->tokenLifetime) {
                unset($_SESSION[self::SESSION_TOKENS_KEY][$token]);
            }
        }

        // Si trop de tokens, garder seulement les plus récents
        if (count($_SESSION[self::SESSION_TOKENS_KEY]) > $this->maxTokens) {
            // Trier par timestamp décroissant
            arsort($_SESSION[self::SESSION_TOKENS_KEY]);
            // Garder seulement les N plus récents
            $_SESSION[self::SESSION_TOKENS_KEY] = array_slice(
                $_SESSION[self::SESSION_TOKENS_KEY],
                0,
                $this->maxTokens,
                true
            );
        }
    }

    /**
     * Retourne le token CSRF actuel
     *
     * @return string Token CSRF
     */
    public function getToken(): string
    {
        // Vérifier si un renouvellement est nécessaire
        if ($this->shouldRenewToken()) {
            $this->renewToken();
        }

        return $this->currentToken;
    }

    /**
     * Valide un token CSRF
     *
     * @param string $token Token à valider
     * @return bool True si le token est valide
     */
    public function validateToken(string $token): bool
    {
        if (empty($token)) {
            return false;
        }

        // Vérifier le token principal
        if (isset($_SESSION[self::SESSION_TOKEN_KEY]) &&
            hash_equals($_SESSION[self::SESSION_TOKEN_KEY], $token)) {

            $this->incrementUsageCount();
            return true;
        }

        // Vérifier les tokens secondaires valides
        if (isset($_SESSION[self::SESSION_TOKENS_KEY])) {
            foreach ($_SESSION[self::SESSION_TOKENS_KEY] as $validToken => $timestamp) {
                if (hash_equals($validToken, $token)) {
                    // Vérifier que le token n'est pas expiré
                    if ((time() - $timestamp) <= $this->tokenLifetime) {
                        $this->incrementUsageCount();
                        return true;
                    } else {
                        // Supprimer le token expiré
                        unset($_SESSION[self::SESSION_TOKENS_KEY][$validToken]);
                    }
                }
            }
        }

        return false;
    }

    /**
     * Incrémente le compteur d'utilisation
     *
     * @return void
     */
    private function incrementUsageCount(): void
    {
        if (! isset($_SESSION[self::SESSION_USAGE_COUNT_KEY])) {
            $_SESSION[self::SESSION_USAGE_COUNT_KEY] = 0;
        }

        $_SESSION[self::SESSION_USAGE_COUNT_KEY]++;
    }

    /**
     * Renouvelle le token CSRF
     * CORRECTION 11: Méthode de renouvellement automatique améliorée
     *
     * @return string Nouveau token généré
     */
    public function renewToken(): string
    {
        // Sauvegarder l'ancien token dans la liste des tokens valides
        if (isset($_SESSION[self::SESSION_TOKEN_KEY]) && ! empty($_SESSION[self::SESSION_TOKEN_KEY])) {
            $this->addToValidTokens($_SESSION[self::SESSION_TOKEN_KEY]);
        }

        // Générer un nouveau token
        $this->generateNewToken();

        return $this->currentToken;
    }

    /**
     * Force un renouvellement immédiat du token
     *
     * @return string Nouveau token généré
     */
    public function forceRenewal(): string
    {
        return $this->renewToken();
    }

    /**
     * Invalide tous les tokens CSRF
     *
     * @return void
     */
    public function invalidateAllTokens(): void
    {
        unset($_SESSION[self::SESSION_TOKEN_KEY]);
        unset($_SESSION[self::SESSION_TOKENS_KEY]);
        unset($_SESSION[self::SESSION_LAST_GENERATION_KEY]);
        unset($_SESSION[self::SESSION_USAGE_COUNT_KEY]);

        // Régénérer un nouveau token
        $this->generateNewToken();
    }

    /**
     * Configure la durée de vie des tokens
     *
     * @param int $seconds Durée de vie en secondes
     * @return self Pour le chaînage de méthodes
     */
    public function setTokenLifetime(int $seconds): self
    {
        if ($seconds <= 0) {
            throw new \InvalidArgumentException('La durée de vie du token doit être positive');
        }

        $this->tokenLifetime = $seconds;
        return $this;
    }

    /**
     * Configure le nombre maximum d'utilisations
     *
     * @param int $count Nombre maximum d'utilisations
     * @return self Pour le chaînage de méthodes
     */
    public function setMaxUsageCount(int $count): self
    {
        if ($count <= 0) {
            throw new \InvalidArgumentException('Le nombre maximum d\'utilisations doit être positif');
        }

        $this->maxUsageCount = $count;
        return $this;
    }

    /**
     * Configure le nombre maximum de tokens stockés
     *
     * @param int $count Nombre maximum de tokens
     * @return self Pour le chaînage de méthodes
     */
    public function setMaxTokens(int $count): self
    {
        if ($count <= 0) {
            throw new \InvalidArgumentException('Le nombre maximum de tokens doit être positif');
        }

        $this->maxTokens = $count;
        return $this;
    }

    /**
     * Retourne les statistiques du gestionnaire CSRF
     *
     * @return array<string, mixed> Statistiques
     */
    public function getStats(): array
    {
        return [
            'current_token_age'  => isset($_SESSION[self::SESSION_LAST_GENERATION_KEY])
            ? time() - $_SESSION[self::SESSION_LAST_GENERATION_KEY]
            : 0,
            'usage_count'        => $_SESSION[self::SESSION_USAGE_COUNT_KEY] ?? 0,
            'valid_tokens_count' => count($_SESSION[self::SESSION_TOKENS_KEY] ?? []),
            'token_lifetime'     => $this->tokenLifetime,
            'max_usage_count'    => $this->maxUsageCount,
            'max_tokens'         => $this->maxTokens,
            'should_renew'       => $this->shouldRenewToken(),
        ];
    }

    /**
     * Vérifie si le gestionnaire est correctement configuré
     *
     * @return bool True si correctement configuré
     */
    public function isValid(): bool
    {
        return session_status() === PHP_SESSION_ACTIVE &&
        ! empty($this->currentToken) &&
        isset($_SESSION[self::SESSION_TOKEN_KEY]);
    }

    /**
     * Génère un champ de formulaire HTML caché pour le token CSRF
     *
     * @param string $fieldName Nom du champ (par défaut 'csrf_token')
     * @return string Code HTML du champ caché
     */
    public function getHiddenField(string $fieldName = 'csrf_token'): string
    {
        $token     = htmlspecialchars($this->getToken(), ENT_QUOTES, 'UTF-8');
        $fieldName = htmlspecialchars($fieldName, ENT_QUOTES, 'UTF-8');

        return sprintf('<input type="hidden" name="%s" value="%s">', $fieldName, $token);
    }

    /**
     * Génère un meta tag HTML pour le token CSRF (pour AJAX)
     *
     * @param string $metaName Nom du meta tag (par défaut 'csrf-token')
     * @return string Code HTML du meta tag
     */
    public function getMetaTag(string $metaName = 'csrf-token'): string
    {
        $token    = htmlspecialchars($this->getToken(), ENT_QUOTES, 'UTF-8');
        $metaName = htmlspecialchars($metaName, ENT_QUOTES, 'UTF-8');

        return sprintf('<meta name="%s" content="%s">', $metaName, $token);
    }
}
