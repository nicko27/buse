<?php
namespace Commun\Security;

use Commun\Database\SqlManager;
use Commun\Logger\Logger;
use SSOlocal;

/**
 * Classe RightsManager - Gestion des droits utilisateurs
 *
 * Cette classe interagit avec le système SSO pour récupérer l'identité de l'utilisateur
 * et vérifie ses droits dans la base de données.
 */
class RightsManager
{
    /** @var RightsManager|null Instance unique de la classe */
    private static ?RightsManager $instance = null;

    /** @var \Psr\Log\LoggerInterface Logger pour la journalisation */
    private $logger;

    /** @var SqlManager Instance du gestionnaire SQL */
    private $sqlManager;

    /** @var array Droits de l'utilisateur actuel */
    private $userRights = null;

    /** @var string|null Identifiant de l'utilisateur actuel */
    private $userId = null;

    /** @var string|null Nom de l'utilisateur actuel */
    private $userName = null;

    /** @var string|null Mail de l'utilisateur actuel */
    private $userMail = null;

    /** @var string|null Unite de l'utilisateur actuel */
    private $userUnit = null;

    /** @var string|null Code Unite de l'utilisateur actuel */
    private $userCu = null;

    /** @var string|null Nom court de l'utilisateur actuel */
    private $userShortName = null;

    /** @var bool Indique si l'utilisateur est authentifié */
    private $isAuthenticated = false;

    /** @var bool Indique si on est en debug */
    private $debug = false;
    /**
     * Constructeur privé pour empêcher l'instanciation directe
     */
    private function __construct()
    {
        $this->sqlManager = SqlManager::getInstance();

        try {
            $this->logger = Logger::getInstance()->getLogger();
        } catch (\Exception $e) {
            $this->logger = new \Psr\Log\NullLogger();
        }
    }

    /**
     * Initialise le gestionnaire de droits
     *
     * @param int $debug Mode debug (1 pour utiliser les données de test)
     * @param array $userArray Données utilisateur pour le mode debug
     * @return void
     */
    public function initialize(int $debug = 0, array $userArray = []): void
    {
        // Initialiser les droits de l'utilisateur
        if (($debug == 1) && ! empty($userArray)) {
            $this->initUserFromDebug($userArray);
        } else {
            require_once "SSOlocal.php";
            $this->initUserFromSSO();
        }
    }

    /**
     * Obtenir l'instance unique ou en créer une nouvelle
     *
     * @return self Instance unique de RightsManager
     */
    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Initialise l'utilisateur avec des données de test pour le mode debug
     *
     * @param array $userArray Tableau contenant les données utilisateur
     * @return bool True si l'utilisateur a été correctement initialisé
     */
    private function initUserFromDebug(array $userArray): bool
    {
        try {
            $this->userId   = $userArray['employeenumber'] ?? null;
            $this->userName = ($userArray['title'] ?? '') . " " . ($userArray['sn'] ?? '') . " " . ($userArray['givenname'] ?? '');
            $this->userMail = $userArray['mail'] ?? null;
            $this->userUnit = $userArray['ou'] ?? null;
            $this->userCu   = $userArray['codeunite'] ?? null;
            $this->logger->info("Cu RightsManager Debug:" . $this->userCu);
            $this->userShortName = $userArray['sn'] ?? null;
            $this->debug         = true;
            if ($this->userId) {
                $this->isAuthenticated = true;
                $this->loadUserRights();
                return true;
            }

            return false;
        } catch (\Exception $e) {
            $this->logger->error("Erreur lors de l'initialisation de l'utilisateur en mode debug", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }

    /**
     * Initialise l'utilisateur à partir des informations du SSO
     *
     * @return bool True si l'utilisateur a été correctement authentifié
     */
    private function initUserFromSSO(): bool
    {
        try {
            if (! isset($_SESSION['user'])) {
                SSOlocal::authenticate();
            }

            // Vérifie si l'authentification a réussi
            if (! SSOlocal::user()) {
                $this->logger->warning("Échec d'authentification SSO");
                return false;
            }

            $this->userId   = SSOlocal::user()->nigend ?? null;
            $this->userName = (SSOlocal::user()->title ?? '') . " " . (SSOlocal::user()->sn ?? '') . " " . (SSOlocal::user()->givenName ?? '');
            $this->userMail = SSOlocal::user()->mail ?? null;
            $this->userUnit = SSOlocal::user()->unite ?? null;
            $this->userCu   = SSOlocal::user()->codeUnite ?? null;
            $this->logger->info("Cu RightsManager SSO:" . $this->userCu);
            $this->userShortName = SSOlocal::user()->sn ?? null;
            $this->debug         = 0;

            if ($this->userId) {
                $this->isAuthenticated = true;
                $this->loadUserRights();
                return true;
            }

            return false;
        } catch (\Exception $e) {
            $this->logger->error("Erreur lors de l'initialisation de l'utilisateur depuis le SSO", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }

    /**
     * Charge les droits de l'utilisateur depuis la base de données
     */
    private function loadUserRights(): void
    {
        if (! $this->isAuthenticated || ! $this->userId) {
            $this->userRights = $this->getDefaultRights();
            return;
        }

        try {
            // 1. Vérifier les droits directs de l'utilisateur
            $userQuery = $this->sqlManager->query(
                "SELECT * FROM rights WHERE u_ou_g = 0 AND id = :id",
                ['id' => $this->userId]
            );

            // 2. Vérifier les droits de l'unité/groupe de l'utilisateur
            $groupRights = [];
            if ($this->userCu) {
                $groupQuery = $this->sqlManager->query(
                    "SELECT * FROM rights WHERE u_ou_g = 1 AND id = :id",
                    ['id' => $this->userCu]
                );

                if ($groupQuery['rowCount'] == 0) {
                    $groupQuery = $this->sqlManager->query(
                        "SELECT * FROM rights WHERE u_ou_g = 1 AND id = :id",
                        ['id' => 0]
                    );
                }

                if (! $groupQuery['error'] && ! empty($groupQuery['data'])) {
                    $groupRights = $groupQuery['data'];
                }
            }

            // 3. Fusionner les droits (utilisateur + groupes)
            $this->userRights = $this->mergeRights(
                $userQuery['error'] ? [] : $userQuery['data'],
                $groupRights
            );
        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des droits utilisateur", [
                'error'  => $e->getMessage(),
                'userId' => $this->userId,
            ]);

            // Par défaut, attribuer des droits minimaux
            $this->userRights = $this->getDefaultRights();
        }
    }

    /**
     * Fusionne les droits utilisateur et groupes
     *
     * @param array $userRights Droits directs de l'utilisateur
     * @param array $groupRights Droits des groupes de l'utilisateur
     * @return array Droits fusionnés
     */
    private function mergeRights(array $userRights, array $groupRights): array
    {
        // Droits par défaut (aucun droit)
        $mergedRights = $this->getDefaultRights();

        // Appliquer les droits de groupe
        foreach ($groupRights as $groupRight) {
            $mergedRights['timeline']    = $mergedRights['timeline'] || (bool) ($groupRight['timeline'] ?? 0);
            $mergedRights['permanences'] = $mergedRights['permanences'] || (bool) ($groupRight['permanences'] ?? 0);
            $mergedRights['import']      = $mergedRights['import'] || (bool) ($groupRight['import'] ?? 0);

            // Pour view_synthesis, prendre la valeur la plus élevée
            $mergedRights['view_synthesis'] = max($mergedRights['view_synthesis'], (int) ($groupRight['view_synthesis'] ?? 0));

            $mergedRights['admin']       = $mergedRights['admin'] || (bool) ($groupRight['admin'] ?? 0);
            $mergedRights['super_admin'] = $mergedRights['super_admin'] || (bool) ($groupRight['super_admin'] ?? 0);
        }

        // Les droits utilisateur ont priorité sur les droits de groupe
        if (! empty($userRights)) {
            $userRight                   = $userRights[0]; // On suppose qu'il n'y a qu'une entrée par utilisateur
            $mergedRights['timeline']    = (bool) ($userRight['timeline'] ?? 0);
            $mergedRights['permanences'] = (bool) ($userRight['permanences'] ?? 0);
            $mergedRights['import']      = (bool) ($userRight['import'] ?? 0);

            // Pour view_synthesis, stocker la valeur numérique directement
            $mergedRights['view_synthesis'] = (int) ($userRight['view_synthesis'] ?? 0);

            $mergedRights['admin']       = (bool) ($userRight['admin'] ?? 0);
            $mergedRights['super_admin'] = (bool) ($userRight['super_admin'] ?? 0);
        }

        return $mergedRights;
    }

    /**
     * Retourne les droits par défaut (aucun droit)
     *
     * @return array Droits par défaut
     */
    private function getDefaultRights(): array
    {
        return [
            'timeline'       => false,
            'permanences'    => false,
            'import'         => false,
            'view_synthesis' => 0,
            'admin'          => false,
            'super_admin'    => false,
        ];
    }

    /**
     * Vérifie si l'utilisateur a un droit spécifique
     *
     * @param string $right Nom du droit à vérifier
     * @return bool True si l'utilisateur a le droit, false sinon
     */
    public function hasRight(string $right): bool
    {
        if (! $this->isAuthenticated) {
            return false;
        }

        // Le super admin a tous les droits
        if (isset($this->userRights['super_admin']) && $this->userRights['super_admin']) {
            return true;
        }

        // L'admin a tous les droits sauf super_admin
        if ($right !== 'super_admin' && isset($this->userRights['admin']) && $this->userRights['admin']) {
            return true;
        }

        // Cas spécial pour view_synthesis qui est un entier
        if ($right === 'view_synthesis') {
            return isset($this->userRights['view_synthesis']) && $this->userRights['view_synthesis'] > 0;
        }

        // Vérifier le droit spécifique
        return isset($this->userRights[$right]) && $this->userRights[$right];
    }

    /**
     * Vérifie si l'utilisateur a le droit de lecture pour la timeline
     *
     * @return bool True si l'utilisateur a le droit de lecture de la timeline
     */
    public function canReadTimeline(): bool
    {
        return $this->hasRight('timeline');
    }

    /**
     * Vérifie si l'utilisateur a le droit de lecture pour les permanences
     *
     * @return bool True si l'utilisateur a le droit de lecture pour les permanences
     */
    public function canReadPermanences(): bool
    {
        return $this->hasRight('permanences');
    }

    /**
     * Vérifie si l'utilisateur a le droit de lecture (Timeline ou Permanences)
     * Méthode de compatibilité
     *
     * @return bool True si l'utilisateur a au moins un droit de lecture
     */
    public function canRead(): bool
    {
        return $this->canReadTimeline() || $this->canReadPermanences();
    }

    /**
     * Vérifie si l'utilisateur a le droit de gestion
     *
     * @return bool True si l'utilisateur a le droit de gestion
     */
    public function canImport(): bool
    {
        return $this->hasRight('import');
    }

    /**
     * Retourne le niveau de droit de visualisation synthèse (0, 1 ou 2)
     *
     * @return int Niveau de droit de visualisation synthèse
     */
    public function getSynthesisViewLevel(): int
    {
        if (! $this->isAuthenticated) {
            return 0;
        }

        // Le super admin a tous les droits au niveau maximal
        if (isset($this->userRights['super_admin']) && $this->userRights['super_admin']) {
            return 2;
        }

        // L'admin a également tous les droits
        if (isset($this->userRights['admin']) && $this->userRights['admin']) {
            return 2;
        }

        // Vérifier le niveau spécifique
        if (isset($this->userRights['view_synthesis'])) {
            return (int) $this->userRights['view_synthesis'];
        }

        return 0;
    }

    /**
     * Vérifie si l'utilisateur a un niveau minimum de droit de visualisation synthèse
     *
     * @param int $minLevel Niveau minimum requis (1 ou 2)
     * @return bool True si l'utilisateur a au moins le niveau de droit spécifié
     */
    public function canViewSynthesisLevel(int $minLevel): bool
    {
        return $this->getSynthesisViewLevel() >= $minLevel;
    }

    /**
     * Vérifie si l'utilisateur a le droit de visualisation de synthèse de base (niveau 1 ou plus)
     *
     * @return bool True si l'utilisateur a au moins le niveau 1 de droit de visualisation synthèse
     */
    public function canViewSynthesis(): bool
    {
        return $this->canViewSynthesisLevel(1);
    }

    /**
     * Vérifie si l'utilisateur a le droit de visualisation de synthèse avancé (niveau 2)
     *
     * @return bool True si l'utilisateur a le niveau 2 de droit de visualisation synthèse
     */
    public function canViewAdvancedSynthesis(): bool
    {
        return $this->canViewSynthesisLevel(2);
    }

    /**
     * Vérifie si l'utilisateur a le droit d'administration
     *
     * @return bool True si l'utilisateur a le droit d'administration
     */
    public function isAdmin(): bool
    {
        return $this->hasRight('admin');
    }

    /**
     * Vérifie si on est en mode debug
     *
     * @return bool True si oui
     */
    public function isDebug(): bool
    {
        return $this->debug;
    }

    /**
     * Vérifie si l'utilisateur est super administrateur
     *
     * @return bool True si l'utilisateur est super administrateur
     */
    public function isSuperAdmin(): bool
    {
        return $this->hasRight('super_admin');
    }

    /**
     * Vérifie si l'utilisateur est authentifié
     *
     * @return bool True si l'utilisateur est authentifié
     */
    public function isAuthenticated(): bool
    {
        return $this->isAuthenticated;
    }

    /**
     * Retourne l'identifiant de l'utilisateur actuel
     *
     * @return string|null Identifiant de l'utilisateur ou null si non authentifié
     */
    public function getUserId(): ?string
    {
        return $this->userId;
    }

    /**
     * Retourne le nom de l'utilisateur actuel
     *
     * @return string|null Nom de l'utilisateur ou null si non authentifié
     */
    public function getUserName(): ?string
    {
        return $this->userName;
    }

    /**
     * Retourne l'email de l'utilisateur actuel
     *
     * @return string|null Email de l'utilisateur ou null si non authentifié
     */
    public function getUserMail(): ?string
    {
        return $this->userMail;
    }

    /**
     * Retourne l'unité de l'utilisateur actuel
     *
     * @return string|null Unité de l'utilisateur ou null si non authentifié
     */
    public function getUserUnit(): ?string
    {
        return $this->userUnit;
    }

    /**
     * Retourne le code unité de l'utilisateur actuel
     *
     * @return string|null Code unité de l'utilisateur ou null si non authentifié
     */
    public function getUserCu(): ?string
    {
        return $this->userCu;
    }

    /**
     * Retourne le nom court de l'utilisateur actuel
     *
     * @return string|null Nom court de l'utilisateur ou null si non authentifié
     */
    public function getUserShortName(): ?string
    {
        return $this->userShortName;
    }

    /**
     * Retourne tous les droits de l'utilisateur
     *
     * @return array Tableau des droits de l'utilisateur
     */
    public function getAllRights(): array
    {
        return $this->userRights ?? $this->getDefaultRights();
    }

    /**
     * Force le rechargement des droits de l'utilisateur
     *
     * @return void
     */
    public function refreshRights(): void
    {
        $this->loadUserRights();
    }

    /**
     * Vérifie si l'utilisateur a au moins un des droits spécifiés
     *
     * @param array $rights Liste des droits à vérifier
     * @return bool True si l'utilisateur a au moins un des droits
     */
    public function hasAnyRight(array $rights): bool
    {
        foreach ($rights as $right) {
            if ($this->hasRight($right)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Vérifie si l'utilisateur a tous les droits spécifiés
     *
     * @param array $rights Liste des droits à vérifier
     * @return bool True si l'utilisateur a tous les droits
     */
    public function hasAllRights(array $rights): bool
    {
        foreach ($rights as $right) {
            if (! $this->hasRight($right)) {
                return false;
            }
        }
        return true;
    }
}
