<?php
/**
 * 100-twig-base.php (CORRIGÉ)
 * Configuration de base de Twig avec détection intelligente des répertoires
 */

$twigStats = [
    'initialized'                => false,
    'views_directory'            => null,
    'views_directory_created'    => false,
    'cache_enabled'              => false,
    'debug_enabled'              => false,
    'loader_type'                => null,
    'templates_found'            => [],
    'critical_templates_missing' => [],
    'error'                      => null,
];

try {
    // ===== DÉTECTION ET CRÉATION DU RÉPERTOIRE DES VUES =====

    // 1. Essayer la configuration
    $viewsDir = $config->get('VIEWS_DIR');

    // 2. Chemins par défaut à essayer
    $defaultPaths = [
        dirname(__DIR__, 2) . '/views',           // public/pages/views
        dirname(__DIR__, 3) . '/views',           // views (racine)
        dirname(__DIR__, 3) . '/templates',       // templates (racine)
        dirname(__DIR__, 2) . '/templates',       // public/pages/templates
        dirname(__DIR__, 3) . '/resources/views', // resources/views
    ];

    // 3. Si pas de config, essayer les chemins par défaut
    if (! $viewsDir) {
        foreach ($defaultPaths as $path) {
            if (is_dir($path) && is_readable($path)) {
                $viewsDir = $path;
                break;
            }
        }
    }

    // 4. Si toujours rien, créer le répertoire par défaut
    if (! $viewsDir || ! is_dir($viewsDir)) {
        $viewsDir = dirname(__DIR__, 2) . '/views';

        if (! is_dir($viewsDir)) {
            if (mkdir($viewsDir, 0755, true)) {
                $twigStats['views_directory_created'] = true;
                if ($logger) {
                    $logger->info("Répertoire des vues créé", ['path' => $viewsDir]);
                }
            } else {
                throw new \Exception("Impossible de créer le répertoire des vues : $viewsDir");
            }
        }
    }

    $twigStats['views_directory'] = realpath($viewsDir);

    // ===== CRÉATION DES TEMPLATES ESSENTIELS =====

    $essentialTemplates = [
        'layouts/default.twig' => '<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}{{ app.name|default("Application") }}{% endblock %}</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        main { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); min-height: 60vh; }
        .alert { padding: 15px; margin: 15px 0; border-radius: 6px; }
        .alert-info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        .alert-warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
        .alert-danger { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .btn { padding: 10px 20px; border: none; border-radius: 6px; text-decoration: none; display: inline-block; cursor: pointer; }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
    </style>
    {% block head %}{% endblock %}
</head>
<body>
    <div class="container">
        {% block header %}
            <header>
                <h1>{{ app.name|default("Application") }}</h1>
                {% if user.authenticated|default(false) %}
                    <p>Connecté en tant que <strong>{{ user.name|default("Utilisateur") }}</strong></p>
                {% endif %}
            </header>
        {% endblock %}

        <main>
            {% block content %}
                <h2>Bienvenue</h2>
                <p>Template par défaut chargé avec succès.</p>
            {% endblock %}
        </main>
    </div>
    {% block scripts %}{% endblock %}
</body>
</html>',

        'errors/404.twig'      => '{% extends "layouts/default.twig" %}
{% block title %}404 - Page non trouvée{% endblock %}
{% block content %}
    <div style="text-align: center; padding: 40px;">
        <h1 style="font-size: 72px; color: #e74c3c; margin: 0;">404</h1>
        <h2>Page non trouvée</h2>
        <p>La page demandée n\'existe pas.</p>
        <a href="/" class="btn btn-primary">Retour à l\'accueil</a>
    </div>
{% endblock %}',

        'errors/403.twig'      => '{% extends "layouts/default.twig" %}
{% block title %}403 - Accès refusé{% endblock %}
{% block content %}
    <div style="text-align: center; padding: 40px;">
        <h1 style="font-size: 72px; color: #e67e22; margin: 0;">403</h1>
        <h2>Accès refusé</h2>
        <p>Vous n\'avez pas les droits pour accéder à cette page.</p>
        <a href="/" class="btn btn-primary">Retour à l\'accueil</a>
    </div>
{% endblock %}',

        'errors/500.twig'      => '{% extends "layouts/default.twig" %}
{% block title %}500 - Erreur serveur{% endblock %}
{% block content %}
    <div style="text-align: center; padding: 40px;">
        <h1 style="font-size: 72px; color: #c0392b; margin: 0;">500</h1>
        <h2>Erreur serveur</h2>
        <p>Une erreur interne s\'est produite.</p>
        <a href="/" class="btn btn-primary">Retour à l\'accueil</a>
    </div>
{% endblock %}',

        'index/index.twig'     => '{% extends "layouts/default.twig" %}
{% block title %}Accueil{% endblock %}
{% block content %}
    <h1>Bienvenue</h1>
    {% if user.authenticated|default(false) %}
        <div class="alert alert-info">
            <strong>Bonjour {{ user.name|default("Utilisateur") }} !</strong><br>
            Vous êtes connecté avec succès.
        </div>
    {% else %}
        <div class="alert alert-warning">
            <strong>Authentification requise</strong><br>
            Connectez-vous pour accéder aux fonctionnalités.
        </div>
    {% endif %}
{% endblock %}',
    ];

    foreach ($essentialTemplates as $templatePath => $content) {
        $fullPath    = $viewsDir . '/' . $templatePath;
        $templateDir = dirname($fullPath);

        // Créer le répertoire si nécessaire
        if (! is_dir($templateDir)) {
            mkdir($templateDir, 0755, true);
        }

        // Créer le template s'il n'existe pas
        if (! file_exists($fullPath)) {
            file_put_contents($fullPath, $content);
            $twigStats['templates_found'][] = $templatePath . ' (créé)';

            if ($logger) {
                $logger->info("Template créé automatiquement", ['template' => $templatePath]);
            }
        } else {
            $twigStats['templates_found'][] = $templatePath . ' (existant)';
        }
    }

    // ===== CONFIGURATION DE L'ENVIRONNEMENT TWIG =====

    // Vérification finale de l'accessibilité
    if (! is_readable($viewsDir)) {
        throw new \Exception("Le dossier des vues n'est pas lisible : $viewsDir");
    }

    // Création du loader Twig
    $loader                   = new \Twig\Loader\FilesystemLoader($viewsDir);
    $twigStats['loader_type'] = 'FilesystemLoader';

    // Configuration des options Twig
    $twigOptions = [
        'cache'            => $config->get('TWIG_CACHE', false),
        'debug'            => $config->get('TWIG_DEBUG', $config->get('ENV') === 'dev'),
        'strict_variables' => $config->get('TWIG_STRICT_VARIABLES', false),
        'autoescape'       => $config->get('TWIG_AUTOESCAPE', 'html'),
        'optimizations'    => $config->get('TWIG_OPTIMIZATIONS', -1),
    ];

    $twigStats['cache_enabled'] = $twigOptions['cache'] !== false;
    $twigStats['debug_enabled'] = $twigOptions['debug'];

    // Gestion du cache Twig
    if ($twigOptions['cache']) {
        $cacheDir = is_string($twigOptions['cache']) ? $twigOptions['cache'] : $config->get('TWIG_CACHE_DIR', dirname(__DIR__, 3) . '/cache/twig');

        if (! is_dir($cacheDir)) {
            if (! mkdir($cacheDir, 0755, true)) {
                if ($logger) {
                    $logger->warning("Impossible de créer le répertoire de cache Twig", [
                        'cache_dir' => $cacheDir,
                    ]);
                }
                $twigOptions['cache']       = false;
                $twigStats['cache_enabled'] = false;
            }
        }

        if (is_dir($cacheDir) && ! is_writable($cacheDir)) {
            if ($logger) {
                $logger->warning("Répertoire de cache Twig non accessible en écriture", [
                    'cache_dir' => $cacheDir,
                ]);
            }
            $twigOptions['cache']       = false;
            $twigStats['cache_enabled'] = false;
        }

        if ($twigOptions['cache']) {
            $twigOptions['cache'] = $cacheDir;
        }
    }

    // ===== CRÉATION DE L'ENVIRONNEMENT TWIG =====

    $twig                     = new \Twig\Environment($loader, $twigOptions);
    $twigStats['initialized'] = true;

    // Ajout des extensions de base
    if ($twigOptions['debug']) {
        $twig->addExtension(new \Twig\Extension\DebugExtension());
    }

    // ===== CONFIGURATION DES VARIABLES GLOBALES =====

    // Variables de base de l'application
    $baseGlobals = [
        'app'     => [
            'name'        => $config->get('SITE', 'Application'),
            'version'     => $config->get('APP_VERSION', '1.0.0'),
            'environment' => $config->get('ENV', 'production'),
            'debug'       => $twigOptions['debug'],
        ],
        'request' => [
            'uri'        => $_SERVER['REQUEST_URI'] ?? '/',
            'method'     => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            'is_https'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        ],
        'config'  => [
            'views_dir'     => $viewsDir,
            'debug_mode'    => $twigOptions['debug'],
            'cache_enabled' => $twigStats['cache_enabled'],
        ],
    ];

    foreach ($baseGlobals as $name => $value) {
        $twig->addGlobal($name, $value);
    }

    // ===== TEST DE FONCTIONNEMENT =====

    // Test simple de rendu
    try {
        $testTemplate = $twig->createTemplate('Hello {{ name }}!');
        $testResult   = $testTemplate->render(['name' => 'World']);

        if ($testResult === 'Hello World!') {
            if ($logger) {
                $logger->debug("Test de rendu Twig réussi");
            }
        } else {
            throw new \Exception("Test de rendu échoué : résultat inattendu");
        }
    } catch (\Exception $e) {
        if ($logger) {
            $logger->warning("Test de rendu Twig échoué", ['error' => $e->getMessage()]);
        }
    }

    // Vérification des templates critiques
    $criticalTemplates = ['layouts/default.twig', 'errors/404.twig'];
    foreach ($criticalTemplates as $template) {
        if (! $twig->getLoader()->exists($template)) {
            $twigStats['critical_templates_missing'][] = $template;
        }
    }

} catch (\Exception $e) {
    $twigStats['error'] = $e->getMessage();

    if ($logger) {
        $logger->error("Erreur d'initialisation de Twig", [
            'error'           => $e->getMessage(),
            'views_directory' => $twigStats['views_directory'],
            'file'            => $e->getFile(),
            'line'            => $e->getLine(),
        ]);
    }

    // ===== FALLBACK : ENVIRONNEMENT TWIG MINIMAL =====
    try {
        if ($logger) {
            $logger->info("Tentative de création d'un environnement Twig minimal de secours");
        }

        $fallbackTemplates = [
            'error.twig'           => '<!DOCTYPE html>
<html><head><title>Erreur</title></head>
<body>
    <h1>Erreur de template</h1>
    <p>{{ message|default("Une erreur s\'est produite") }}</p>
    <p><a href="/">Retour à l\'accueil</a></p>
</body></html>',

            'minimal.twig'         => '<!DOCTYPE html>
<html><head><title>{{ title|default("Application") }}</title></head>
<body>
    <h1>{{ title|default("Application") }}</h1>
    <div>{{ content|raw }}</div>
</body></html>',

            'layouts/default.twig' => '<!DOCTYPE html>
<html><head><title>{% block title %}Application{% endblock %}</title></head>
<body>
    <header><h1>Application</h1></header>
    <main>{% block content %}Contenu par défaut{% endblock %}</main>
</body></html>',
        ];

        $loader = new \Twig\Loader\ArrayLoader($fallbackTemplates);
        $twig   = new \Twig\Environment($loader, [
            'debug'            => false,
            'cache'            => false,
            'strict_variables' => false,
        ]);

        // Variables minimales
        $twig->addGlobal('app', [
            'name'        => $config->get('SITE', 'Application'),
            'version'     => $config->get('APP_VERSION', '1.0.0'),
            'environment' => 'fallback',
        ]);

        $twigStats['initialized'] = true;
        $twigStats['loader_type'] = 'ArrayLoader (fallback)';

        if ($logger) {
            $logger->warning("Twig initialisé en mode minimal de secours");
        }

    } catch (\Exception $fallbackError) {
        $twig               = null;
        $twigStats['error'] = $e->getMessage() . ' | Fallback: ' . $fallbackError->getMessage();

        if ($logger) {
            $logger->critical("Impossible d'initialiser Twig même en mode minimal", [
                'original_error' => $e->getMessage(),
                'fallback_error' => $fallbackError->getMessage(),
            ]);
        }
    }
}

// ===== LOGGING ET STATISTIQUES =====

if ($logger) {
    $logLevel = $twigStats['initialized'] ? 'info' : 'error';
    $logger->log($logLevel, "Configuration de base Twig terminée", $twigStats);

    if (! empty($twigStats['critical_templates_missing'])) {
        $logger->warning("Templates critiques manquants", [
            'missing_templates' => $twigStats['critical_templates_missing'],
        ]);
    }
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['twig_base'] = $twigStats;

// ===== VÉRIFICATION CRITIQUE =====

if (! $twigStats['initialized']) {
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');

    // Pages qui peuvent fonctionner sans Twig (API, webhooks, etc.)
    $apiPages  = ['api', 'webhook', 'cron', 'health', 'ping'];
    $isApiPage = false;

    foreach ($apiPages as $apiPage) {
        if (str_starts_with($currentPath, $apiPage)) {
            $isApiPage = true;
            break;
        }
    }

    if (! $isApiPage) {
        $errorDetails = $twigStats['error'] ?? 'Erreur inconnue';

        // Page d'erreur HTML simple si Twig indisponible
        http_response_code(500);
        header('Content-Type: text/html; charset=UTF-8');

        echo "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n";
        echo "<meta charset=\"UTF-8\">\n";
        echo "<title>Erreur de configuration Twig</title>\n";
        echo "<style>body{font-family:sans-serif;margin:40px;background:#f5f5f5;} .container{max-width:800px;margin:0 auto;background:white;padding:40px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);} .error{background:#ffebee;border-left:4px solid #f44336;padding:20px;margin:20px 0;} .info{background:#e3f2fd;border-left:4px solid #2196f3;padding:20px;margin:20px 0;}</style>\n";
        echo "</head>\n<body>\n";
        echo "<div class=\"container\">\n";
        echo "<h1>🚨 Erreur de configuration Twig</h1>\n";
        echo "<div class=\"error\">\n";
        echo "<h2>Problème détecté</h2>\n";
        echo "<p>Le système de templates Twig n'a pas pu être initialisé correctement.</p>\n";
        echo "<p><strong>Erreur :</strong> " . htmlspecialchars($errorDetails) . "</p>\n";
        echo "</div>\n";
        echo "<div class=\"info\">\n";
        echo "<h2>Solutions recommandées</h2>\n";
        echo "<ol>\n";
        echo "<li>Exécutez le script de diagnostic : <code>php diagnostic-twig.php</code></li>\n";
        echo "<li>Vérifiez que le répertoire des templates existe et est accessible</li>\n";
        echo "<li>Vérifiez la configuration dans le fichier .env</li>\n";
        echo "<li>Consultez les logs d'erreur pour plus de détails</li>\n";
        echo "</ol>\n";
        echo "</div>\n";
        echo "<p><a href=\"/\">🏠 Retour à l'accueil</a></p>\n";
        echo "</div>\n</body>\n</html>";

        exit;
    }
}
