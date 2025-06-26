<?php
/**
 * 010-autoload.php
 * Chargement de l'autoloader Composer
 */

// Recherche du fichier autoload.php de Composer
$autoloadPaths = [
    dirname(__DIR__, 3) . "/vendor/autoload.php", // Structure standard
    dirname(__DIR__, 4) . "/vendor/autoload.php", // Si dans un sous-dossier
    dirname(__DIR__, 4) . "/vendor/autoload.php", // Si dans un sous-dossier
];

$autoloadFound = false;
foreach ($autoloadPaths as $autoloadPath) {
    if (file_exists($autoloadPath)) {
        require_once $autoloadPath;
        $autoloadFound = true;
        break;
    }
}

if (! $autoloadFound) {
    die("Erreur critique : Impossible de trouver l'autoloader Composer. Veuillez exécuter 'composer install'.");
}

// Vérification que les dépendances principales sont disponibles
if (! class_exists('\Twig\Environment')) {
    die("Erreur critique : Twig n'est pas installé. Veuillez exécuter 'composer install'.");
}

if (! class_exists('\Dotenv\Dotenv')) {
    die("Erreur critique : vlucas/phpdotenv n'est pas installé. Veuillez exécuter 'composer install'.");
}

if (! class_exists('\Monolog\Logger')) {
    die("Erreur critique : Monolog n'est pas installé. Veuillez exécuter 'composer install'.");
}
