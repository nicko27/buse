<?php
/**
 * 040-database.php
 * Initialisation de la connexion à la base de données
 */

use Commun\Database\SqlManager;
use Commun\Database\SqlAdapter;

$databaseInitialized = false;
$databaseError = null;

try {
    // Tentative d'initialisation de SqlManager avec les paramètres du .env
    SqlManager::initWithParams(
        $config->get('DB_HOST'),
        $config->get('DB_NAME'),
        $config->get('DB_USER'),
        $config->get('DB_PASSWORD')
    );

    // Récupération de l'instance et test de connexion
    $sqlManager = SqlManager::getInitializedInstance();
    
    // Test simple de la connexion
    $testResult = $sqlManager->query("SELECT 1 as test");
    if ($testResult['error'] !== 0) {
        throw new \Exception("Test de connexion échoué : " . ($testResult['msgError'] ?? 'Erreur inconnue'));
    }

    // Création de l'adapter
    $sqlAdapter = new SqlAdapter($sqlManager);
    
    // Test de l'adapter
    if (!$sqlAdapter->testConnection()) {
        throw new \Exception("Test de l'adapter échoué");
    }

    $databaseInitialized = true;

    // Tentative de chargement de la configuration depuis la base de données
    try {
        $config->loadFromDatabase($sqlAdapter);
        $configFromDatabase = true;
    } catch (\Exception $e) {
        // Si échec du chargement depuis la BDD, continuer avec .env seulement
        $configFromDatabase = false;
        $databaseError = "Configuration BDD non chargée : " . $e->getMessage();
    }

} catch (\Exception $e) {
    $databaseInitialized = false;
    $databaseError = $e->getMessage();
    
    // En cas d'échec, créer des instances nulles pour éviter les erreurs fatales
    $sqlManager = null;
    $sqlAdapter = null;
    $configFromDatabase = false;
}

// Statistiques de la base de données
$databaseStats = [
    'initialized' => $databaseInitialized,
    'config_from_db' => $configFromDatabase ?? false,
    'host' => $config->get('DB_HOST'),
    'database' => $config->get('DB_NAME'),
    'error' => $databaseError,
];

// Si la base de données est disponible, récupérer quelques infos supplémentaires
if ($databaseInitialized && $sqlAdapter) {
    try {
        $sourceInfo = $sqlAdapter->getSourceInfo();
        $databaseStats['version'] = $sourceInfo['version'] ?? null;
        $databaseStats['tables_count'] = $sourceInfo['tables_count'] ?? null;
    } catch (\Exception $e) {
        // Ignore les erreurs de métadonnées
    }
}

// Stockage des stats pour le logger
$GLOBALS['app_init_stats']['database'] = $databaseStats;

// Si échec critique de la base de données et que l'application en a besoin
if (!$databaseInitialized) {
    // Vérifier si on est sur une page qui nécessite absolument la BDD
    $requiresDatabasePages = ['main', 'show', 'admin'];
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');
    
    foreach ($requiresDatabasePages as $dbPage) {
        if (str_starts_with($currentPath, $dbPage)) {
            die("Erreur critique : Base de données inaccessible pour cette page.\nErreur : " . $databaseError);
        }
    }
    
    // Pour les autres pages, log l'erreur mais continue
    error_log("Avertissement : Base de données non disponible - " . $databaseError);
}