<?php
/**
 * 020-classes.php
 * Chargement de toutes les classes communes de l'application
 */

// Classes principales par ordre de dépendance
$requiredClasses = [
    // Configuration et base
    __DIR__ . "/../classes/Config/Config.php",

    // Base de données
    __DIR__ . "/../classes/Database/BDDManager.php",
    __DIR__ . "/../classes/Database/SqlManager.php",
    __DIR__ . "/../classes/Database/SqlAdapter.php",

    // Logging
    __DIR__ . "/../classes/Logger/Logger.php",

    // Sécurité
    __DIR__ . "/../classes/Security/CsrfManager.php",
    __DIR__ . "/../classes/Security/RightsManager.php",

    // Routage
    __DIR__ . "/../classes/Router/Router.php",

    // Templates
    __DIR__ . "/../classes/Template/RenderContext.php",
    __DIR__ . "/../classes/Template/VariableInjector.php",
    __DIR__ . "/../classes/Template/TwigManager.php",
    __DIR__ . "/../classes/Template/TwigExtensions.php",

    // Utilitaires
    __DIR__ . "/../classes/Utils/FileUtils.php",
    __DIR__ . "/../classes/Utils/DateUtils.php",
    __DIR__ . "/../classes/Utils/StringUtils.php",
    __DIR__ . "/../classes/Utils/TphUtils.php",
    __DIR__ . "/../classes/Utils/ExcelProcessor.php",
    __DIR__ . "/../classes/Utils/UploadManager.php",
    __DIR__ . "/../classes/Utils/FileListUtils.php",

    // Services externes
    __DIR__ . "/../classes/Ldap/LdapManager.php",
    __DIR__ . "/../classes/Mail/EMLGenerator.php",
];

// Chargement avec vérification d'existence
$loadedClasses  = 0;
$missingClasses = [];

foreach ($requiredClasses as $classFile) {
    if (file_exists($classFile)) {
        require_once $classFile;
        $loadedClasses++;
    } else {
        $missingClasses[] = $classFile;
    }
}

// Log des classes manquantes (si elles ne sont pas critiques)
if (! empty($missingClasses)) {
    $nonCriticalClasses = [
        'LdapManager.php',    // Optionnel si pas de LDAP
        'EMLGenerator.php',   // Optionnel si pas d'emails
        'ExcelProcessor.php', // Optionnel si pas de traitement Excel
    ];

    $criticalMissing = [];
    foreach ($missingClasses as $missing) {
        $isCritical = true;
        foreach ($nonCriticalClasses as $nonCritical) {
            if (str_contains($missing, $nonCritical)) {
                $isCritical = false;
                break;
            }
        }

        if ($isCritical) {
            $criticalMissing[] = $missing;
        }
    }

    if (! empty($criticalMissing)) {
        die("Erreur critique : Classes manquantes :\n" . implode("\n", $criticalMissing));
    }
}

// Vérification que les classes principales sont chargées
$coreClasses = [
    'Commun\Config\Config',
    'Commun\Database\SqlManager',
    'Commun\Database\SqlAdapter',
    'Commun\Logger\Logger',
    'Commun\Router\Router',
    'Commun\Security\RightsManager',
    'Commun\Security\CsrfManager',
];

foreach ($coreClasses as $coreClass) {
    if (! class_exists($coreClass)) {
        die("Erreur critique : Classe principale non trouvée : $coreClass");
    }
}
