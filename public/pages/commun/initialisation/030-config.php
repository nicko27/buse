<?php
/**
 * 030-config.php
 * Initialisation de la configuration
 */

use Commun\Config\Config;
// Initialiser la configuration (charge automatiquement le .env via loadEnv())
$config = Config::getInstance();

// Vérifier que le fichier .env a été correctement chargé
$envVars = $config->getAllEnv();
if (empty($envVars)) {
    die("Erreur critique : Aucune variable d'environnement chargée. Vérifiez que le fichier .env existe et est accessible.");
}

// Vérifier les variables critiques pour la base de données
$criticalEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
$missingEnvVars  = [];

foreach ($criticalEnvVars as $envVar) {
    if (! $config->get($envVar)) {
        $missingEnvVars[] = $envVar;
    }
}

if (! empty($missingEnvVars)) {
    die("Erreur critique : Variables d'environnement manquantes dans .env :\n" . implode("\n", $missingEnvVars));
}

// Statistiques de configuration pour le debugging
$configStats = [
    'env_vars_loaded' => count($envVars),
    'site'            => $config->get('SITE'),
    'environment'     => $config->get('ENV'),
    'debug_mode'      => $config->get('DEBUG'),
    'database_loaded' => $config->isDatabaseLoaded(),
];

// Stockage temporaire pour le logger qui sera initialisé plus tard
if (! isset($GLOBALS['app_init_stats'])) {
    $GLOBALS['app_init_stats'] = [];
}
$GLOBALS['app_init_stats']['config'] = $configStats;
