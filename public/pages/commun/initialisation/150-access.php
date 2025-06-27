<?php
/**
 * 150-access.php
 * Vérification des droits d'accès à la route courante
 */

$accessStats = [
    'access_checked'          => false,
    'access_granted'          => false,
    'authentication_required' => false,
    'user_authenticated'      => false,
    'rights_required'         => 0,
    'user_rights'             => 0,
    'access_method'           => null,
    'redirect_url'            => null,
    'error'                   => null,
];

try {
    // Vérifier que nous avons une route courante
    if (! isset($currentRoute) || ! $currentRoute) {
        throw new \Exception("Aucune route courante pour vérifier l'accès");
    }

    // Vérifier que le routeur est disponible
    if (! isset($router) || ! $router) {
        throw new \Exception("Routeur non disponible pour la vérification d'accès");
    }

    $page       = $currentRoute['page'];
    $pageRights = (int) ($page['rights'] ?? 0);

    $accessStats['rights_required']         = $pageRights;
    $accessStats['authentication_required'] = $pageRights > 0;

    // Si aucun droit requis, accès libre
    if ($pageRights === 0) {
        $accessStats['access_granted'] = true;
        $accessStats['access_method']  = 'public';
    } else {
        // Vérification de l'authentification et des droits
        if (! isset($rightsManager) || ! $rightsManager) {
            throw new \Exception("RightsManager non disponible pour vérifier les droits");
        }

        $accessStats['user_authenticated'] = $rightsManager->isAuthenticated();

        if (! $accessStats['user_authenticated']) {
            // Utilisateur non authentifié
            $accessStats['access_granted'] = false;
            $accessStats['access_method']  = 'authentication_required';

        } else {
            // Utilisateur authentifié - vérifier les droits
            $userRights                 = $rightsManager->getBinaryRights();
            $accessStats['user_rights'] = $userRights;

            // Vérification binaire : l'utilisateur a-t-il au moins un des droits requis ?
            $hasRequiredRights = ($userRights & $pageRights) > 0;

            if ($hasRequiredRights) {
                $accessStats['access_granted'] = true;
                $accessStats['access_method']  = 'rights_validated';
            } else {
                $accessStats['access_granted'] = false;
                $accessStats['access_method']  = 'insufficient_rights';
            }
        }
    }

    $accessStats['access_checked'] = true;

    // Log de la vérification d'accès
    if ($logger) {
        $logLevel = $accessStats['access_granted'] ? 'info' : 'warning';
        $logger->log($logLevel, "Vérification d'accès effectuée", [
            'page'            => $page['slug'],
            'access_granted'  => $accessStats['access_granted'],
            'method'          => $accessStats['access_method'],
            'rights_required' => $accessStats['rights_required'],
            'user_rights'     => $accessStats['user_rights'],
            'user_id'         => isset($rightsManager) ? $rightsManager->getUserId() : null,
            'request_method'  => $_SERVER['REQUEST_METHOD'] ?? 'GET',
        ]);
    }

} catch (\Exception $e) {
    $accessStats['error']          = $e->getMessage();
    $accessStats['access_granted'] = false;

    if ($logger) {
        $logger->error("Erreur lors de la vérification d'accès", [
            'error' => $e->getMessage(),
            'page'  => isset($page) ? $page['slug'] : 'unknown',
        ]);
    }
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['access'] = $accessStats;

// Gestion des accès refusés
if (! $accessStats['access_granted']) {

    // Déterminer l'URL de redirection
    $redirectUrl = null;

    // 1. Redirection spécifique de la page
    if (isset($page['redirect_to']) && ! empty($page['redirect_to'])) {
        $redirectUrl                 = $page['redirect_to'];
        $accessStats['redirect_url'] = $redirectUrl;
    }
    // 2. Redirection vers la page de login par défaut
    else {
        $loginRoute  = $config->get('ACCESS_DENIED_ROUTE', 'login');
        $redirectUrl = $router->generateUrl($loginRoute);

        // Ajouter l'URL demandée en paramètre pour redirection après login
        $requestedUrl = $_SERVER['REQUEST_URI'] ?? '/';
        $redirectUrl .= '?redirect=' . urlencode($requestedUrl);

        $accessStats['redirect_url'] = $redirectUrl;
    }

    // Log de la redirection
    if ($logger) {
        $logger->warning("Accès refusé - redirection", [
            'page'          => isset($page) ? $page['slug'] : 'unknown',
            'user_id'       => isset($rightsManager) ? $rightsManager->getUserId() : null,
            'reason'        => $accessStats['access_method'],
            'redirect_url'  => $redirectUrl,
            'requested_url' => $_SERVER['REQUEST_URI'] ?? '/',
        ]);
    }

    // Effectuer la redirection
    if ($redirectUrl) {
        header('Location: ' . $redirectUrl, true, 302);
        exit;
    } else {
        // Fallback : afficher une page d'erreur
        http_response_code(403);

        try {
            if (isset($twig) && $twig) {
                echo $twig->render('errors/403.twig', [
                    'error_code'         => 403,
                    'error_message'      => 'Accès refusé',
                    'reason'             => $accessStats['access_method'],
                    'required_rights'    => $accessStats['rights_required'],
                    'user_authenticated' => $accessStats['user_authenticated'],
                ]);
            } else {
                echo "<!DOCTYPE html><html><head><title>403 - Accès refusé</title></head>";
                echo "<body><h1>403 - Accès refusé</h1>";
                echo "<p>Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>";
                if (! $accessStats['user_authenticated']) {
                    echo "<p><a href='" . htmlspecialchars($router->generateUrl('login')) . "'>Se connecter</a></p>";
                }
                echo "</body></html>";
            }
        } catch (\Exception $e) {
            if ($logger) {
                $logger->error("Erreur lors du rendu de la page 403", [
                    'error' => $e->getMessage(),
                ]);
            }
            die("Erreur 403 : Accès refusé");
        }

        exit;
    }
}

// Si on arrive ici, l'accès est accordé - continuer l'initialisation
if ($logger) {
    $logger->info("Accès accordé à la page", [
        'page'    => $page['slug'],
        'user_id' => isset($rightsManager) ? $rightsManager->getUserId() : null,
        'method'  => $accessStats['access_method'],
    ]);
}
