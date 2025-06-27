<?php
/**
 * 090-ldap.php
 * Configuration et initialisation du service LDAP
 */

use Commun\Ldap\BaseDNConfig;
use Commun\Ldap\LdapConfig;
use Commun\Ldap\LdapManager;

$ldapStats = [
    'available' => false,
    'initialized' => false,
    'connection_tested' => false,
    'config_complete' => false,
    'config_vars' => [],
    'error' => null,
    'features_available' => [],
];

try {
    // Vérification de la disponibilité de l'extension LDAP PHP
    if (!extension_loaded('ldap')) {
        throw new \Exception("Extension PHP LDAP non disponible");
    }
    
    // Récupération des variables de configuration LDAP
    $ldapConfigVars = [
        'LDAP_BASE_DN_LISTS' => $config->get("LDAP_BASE_DN_LISTS"),
        'LDAP_BASE_DN_SERVICES' => $config->get("LDAP_BASE_DN_SERVICES"),
        'LDAP_BASE_DN_PERSONS' => $config->get("LDAP_BASE_DN_PERSONS"),
        'LDAP_HOST' => $config->get("LDAP_HOST"),
        'LDAP_PORT' => $config->get("LDAP_PORT"),
        'LDAP_USE_LDAPS' => $config->get("LDAP_USE_LDAPS"),
        'LDAP_USER' => $config->get("LDAP_USER"),
        'LDAP_PASSWORD' => $config->get("LDAP_PASSWORD"), // sera masqué dans les logs
    ];
    
    $ldapStats['config_vars'] = $ldapConfigVars;
    
    // Vérification que les variables critiques sont présentes
    $requiredVars = ['LDAP_BASE_DN_LISTS', 'LDAP_BASE_DN_SERVICES', 'LDAP_BASE_DN_PERSONS', 'LDAP_HOST', 'LDAP_PORT', 'LDAP_USE_LDAPS'];
    $missingVars = [];
    
    foreach ($requiredVars as $var) {
        if (empty($ldapConfigVars[$var])) {
            $missingVars[] = $var;
        }
    }
    
    if (!empty($missingVars)) {
        throw new \Exception("Variables LDAP manquantes dans la configuration : " . implode(', ', $missingVars));
    }
    
    $ldapStats['config_complete'] = true;
    
    // Construction de la configuration BaseDN
    $baseDN = new BaseDNConfig(
        lists: $ldapConfigVars['LDAP_BASE_DN_LISTS'],
        services: $ldapConfigVars['LDAP_BASE_DN_SERVICES'],
        persons: $ldapConfigVars['LDAP_BASE_DN_PERSONS']
    );
    
    // Construction de la configuration LDAP
    $ldapConfig = new LdapConfig(
        host: $ldapConfigVars['LDAP_HOST'],
        port: (int)$ldapConfigVars['LDAP_PORT'],
        user: $ldapConfigVars['LDAP_USER'] ?: null,
        password: $ldapConfigVars['LDAP_PASSWORD'] ?: null,
        useLdaps: (bool)$ldapConfigVars['LDAP_USE_LDAPS'],
        validateCert: $config->get('LDAP_VALIDATE_CERT', true),
        baseDN: $baseDN
    );
    
    // Initialisation du gestionnaire LDAP
    LdapManager::initialize($ldapConfig);
    $ldapManager = LdapManager::getInstance();
    $ldapStats['initialized'] = true;
    
    // Test de connexion (optionnel, peut être lent)
    $testConnection = $config->get('LDAP_TEST_CONNECTION', false);
    if ($testConnection) {
        $connectionResult = $ldapManager->connect();
        $ldapStats['connection_tested'] = true;
        
        if (!$connectionResult) {
            throw new \Exception("Test de connexion LDAP échoué");
        }
        
        // Test de recherche basique si connexion OK
        try {
            $testSearch = $ldapManager->searchPersons("employeenumber=999999", ["cn"], 1);
            $ldapStats['features_available'][] = 'search_persons';
        } catch (\Exception $e) {
            if ($logger) {
                $logger->debug("Test de recherche LDAP échoué (normal si utilisateur n'existe pas)", [
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
    
    $ldapStats['available'] = true;
    
    // Définition des fonctionnalités disponibles
    $ldapStats['features_available'] = array_merge($ldapStats['features_available'], [
        'search_lists',
        'search_services', 
        'search_persons',
        'get_user_name',
        'get_group_name',
    ]);

} catch (\Throwable $e) {
    $ldapStats['available'] = false;
    $ldapStats['error'] = $e->getMessage();
    
    if ($logger) {
        $logger->warning("LDAP non disponible", [
            'error' => $e->getMessage(),
            'code' => $e->getCode(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'config_complete' => $ldapStats['config_complete'],
        ]);
    }
    
    // Variables nulles pour éviter les erreurs dans le reste de l'application
    $ldapManager = null;
}

// Préparation des stats pour les logs (masquer le mot de passe)
$ldapStatsForLog = $ldapStats;
if (isset($ldapStatsForLog['config_vars']['LDAP_PASSWORD']) && $ldapStatsForLog['config_vars']['LDAP_PASSWORD']) {
    $ldapStatsForLog['config_vars']['LDAP_PASSWORD'] = '***masqué***';
}

// Log des informations LDAP
if ($logger) {
    if ($ldapStats['available']) {
        $logger->info("LDAP initialisé avec succès", $ldapStatsForLog);
    } else {
        $logger->info("LDAP non disponible", $ldapStatsForLog);
    }
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['ldap'] = $ldapStatsForLog;

// Variable globale pour indiquer la disponibilité LDAP (utilisée dans d'autres fichiers)
$ldapAvailable = $ldapStats['available'];

// Ajout de variables Twig pour indiquer la disponibilité LDAP
if (isset($twig)) {
    $twig->addGlobal('ldap_available', $ldapAvailable);
    $twig->addGlobal('ldap_features', $ldapStats['features_available']);
}

// Note : Le LDAP n'est pas critique pour le fonctionnement de base de l'application
// Donc pas d'arrêt fatal même si indisponible, seulement des logs et des fallbacks