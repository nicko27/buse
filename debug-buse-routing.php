<?php
/**
 * debug-buse-routing.php
 * Debug spécifique pour le problème de sous-dossier /buse/
 */

echo "=== DEBUG ROUTING BUSE ===\n\n";

// 1. INFORMATIONS SERVEUR
echo "1. INFORMATIONS SERVEUR\n";
echo "   HTTP_HOST: " . ($_SERVER['HTTP_HOST'] ?? 'Non défini') . "\n";
echo "   REQUEST_URI: " . ($_SERVER['REQUEST_URI'] ?? 'Non défini') . "\n";
echo "   SCRIPT_NAME: " . ($_SERVER['SCRIPT_NAME'] ?? 'Non défini') . "\n";
echo "   PHP_SELF: " . ($_SERVER['PHP_SELF'] ?? 'Non défini') . "\n";
echo "   DOCUMENT_ROOT: " . ($_SERVER['DOCUMENT_ROOT'] ?? 'Non défini') . "\n";
echo "   Working Directory: " . getcwd() . "\n";

// 2. CHARGEMENT DE L'APPLICATION
echo "\n2. CHARGEMENT APPLICATION\n";
require_once 'vendor/autoload.php';
require_once 'public/pages/commun/classes/Config/Config.php';
require_once 'public/pages/commun/classes/Logger/Logger.php';
require_once 'public/pages/commun/classes/Database/SqlManager.php';
require_once 'public/pages/commun/classes/Database/SqlAdapter.php';
require_once 'public/pages/commun/classes/Router/Router.php';

$config = \Commun\Config\Config::getInstance();

// Logger
$logDir = '/var/www/html/buse/logs';
\Commun\Logger\Logger::initWithParams('buse', $logDir);

// Base de données
\Commun\Database\SqlManager::initWithParams(
    $config->get('DB_HOST'),
    $config->get('DB_NAME'),
    $config->get('DB_USER'),
    $config->get('DB_PASSWORD')
);

$sqlManager = \Commun\Database\SqlManager::getInitializedInstance();
$sqlAdapter = new \Commun\Database\SqlAdapter($sqlManager);
$config->loadFromDatabase($sqlAdapter);

echo "   ✅ Application initialisée\n";

// 3. CONFIGURATION ACTUELLE
echo "\n3. CONFIGURATION ACTUELLE\n";
echo "   WEB_DIR: '" . $config->get('WEB_DIR', '') . "'\n";
echo "   DEFAULT_ROUTE: '" . $config->get('DEFAULT_ROUTE', 'index') . "'\n";

// 4. INITIALISATION DU ROUTER
echo "\n4. ROUTER\n";
$router = \Commun\Router\Router::getInstance($sqlAdapter);

// Test avec différentes configurations WEB_DIR
$webDirTests = [
    '',
    '/buse',
    'buse',
    '/buse/',
];

foreach ($webDirTests as $webDirTest) {
    echo "\n   Test avec WEB_DIR = '$webDirTest'\n";

    $router->setWebDirectory($webDirTest);
    $router->setDefaultRoute($config->get('DEFAULT_ROUTE', 'index'));
    $router->loadRoutes();

    // URLs à tester
    $testUrls = [
        '/',
        '/buse/',
        '/buse/index',
        '/buse/index.php',
        '/index',
        '/index.php',
    ];

    foreach ($testUrls as $testUrl) {
        try {
            $route = $router->matchFromUri($testUrl);
            if ($route) {
                echo "     ✅ '$testUrl' → " . $route['page']['slug'] . " (" . $route['page']['title'] . ")\n";
            } else {
                echo "     ❌ '$testUrl' → Aucune correspondance\n";
            }
        } catch (Exception $e) {
            echo "     ❌ '$testUrl' → Erreur: " . $e->getMessage() . "\n";
        }
    }
}

// 5. ANALYSE DÉTAILLÉE DU MATCHING
echo "\n5. ANALYSE DÉTAILLÉE DU MATCHING\n";

// Configuration recommandée
$router->setWebDirectory('/buse');
$router->setDefaultRoute('index');

$detailedTestUrls = [
    'http://localhost/buse/',
    'http://localhost/buse/index',
    'http://localhost/buse/index.php',
    '/buse/',
    '/buse/index',
];

foreach ($detailedTestUrls as $testUrl) {
    echo "\n   URL: '$testUrl'\n";

    // Simuler parse_url
    $parsed = parse_url($testUrl);
    $path   = $parsed['path'] ?? '/';
    echo "     Path extrait: '$path'\n";

    // Simuler la logique du router
    $webDir = '/buse';
    echo "     WEB_DIR configuré: '$webDir'\n";

    if (! empty($webDir) && $webDir !== '/') {
        if (strpos($path, $webDir . '/') === 0) {
            $cleanPath = substr($path, strlen($webDir));
            echo "     Path après suppression WEB_DIR: '$cleanPath'\n";
        } elseif ($path === $webDir) {
            $cleanPath = '/';
            echo "     Path normalisé (égal à WEB_DIR): '/'\n";
        } else {
            $cleanPath = $path;
            echo "     Path inchangé (ne commence pas par WEB_DIR): '$cleanPath'\n";
        }
    } else {
        $cleanPath = $path;
        echo "     Path inchangé (WEB_DIR vide): '$cleanPath'\n";
    }

    $slug = trim($cleanPath, '/');
    if (empty($slug)) {
        $slug = 'index';
        echo "     Slug final (défaut): '$slug'\n";
    } else {
        echo "     Slug final: '$slug'\n";
    }

    // Test de matching
    try {
        $route = $router->match($slug);
        if ($route) {
            echo "     ✅ SUCCÈS: " . $route['page']['title'] . "\n";
        } else {
            echo "     ❌ ÉCHEC: Slug '$slug' non trouvé\n";
        }
    } catch (Exception $e) {
        echo "     ❌ ERREUR: " . $e->getMessage() . "\n";
    }
}

// 6. ROUTES DISPONIBLES
echo "\n6. ROUTES DISPONIBLES\n";
$allRoutes = $router->getAllRoutes();
foreach ($allRoutes as $slug => $route) {
    echo "   - '$slug': " . $route['page']['title'] . " (ID: " . $route['page']['id'] . ")\n";
}

// 7. CONFIGURATION .HTACCESS
echo "\n7. CONFIGURATION .HTACCESS\n";
if (file_exists('.htaccess')) {
    echo "   ✅ Fichier .htaccess présent\n";
    $htaccess = file_get_contents('.htaccess');
    echo "   Contenu:\n";
    echo "   " . str_replace("\n", "\n   ", $htaccess) . "\n";
} else {
    echo "   ❌ Fichier .htaccess manquant\n";
    echo "\n   .htaccess recommandé pour /buse/:\n";
    echo "   RewriteEngine On\n";
    echo "   RewriteBase /buse/\n";
    echo "   RewriteCond %{REQUEST_FILENAME} !-f\n";
    echo "   RewriteCond %{REQUEST_FILENAME} !-d\n";
    echo "   RewriteRule ^(.*)$ index.php [QSA,L]\n";
}

// 8. RECOMMANDATIONS
echo "\n8. RECOMMANDATIONS\n";

echo "   Pour que http://localhost/buse/ fonctionne:\n";
echo "\n   1. Configuration dans .env:\n";
echo "      WEB_DIR=\"/buse\"\n";
echo "\n   2. Fichier .htaccess à la racine de buse/:\n";
echo "      RewriteEngine On\n";
echo "      RewriteBase /buse/\n";
echo "      RewriteCond %{REQUEST_FILENAME} !-f\n";
echo "      RewriteCond %{REQUEST_FILENAME} !-d\n";
echo "      RewriteRule ^(.*)$ index.php [QSA,L]\n";
echo "\n   3. Tests à faire:\n";
echo "      - http://localhost/buse/index.php (direct)\n";
echo "      - http://localhost/buse/ (avec rewriting)\n";
echo "      - http://localhost/buse/index (avec rewriting)\n";

// 9. TEST DIRECT DU FICHIER INDEX.PHP
echo "\n9. TEST INDEX.PHP DIRECT\n";
echo "   Testez: http://localhost/buse/index.php\n";
echo "   Si ça marche, le problème est dans .htaccess\n";
echo "   Si ça ne marche pas, le problème est dans le router\n";

echo "\n=== FIN DEBUG ===\n";
