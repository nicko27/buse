<?php
namespace Commun\Logger;

use Commun\Security\RightsManager;

/**
 * LogViewerAuth - Système d'authentification pour le visualiseur de logs
 * 
 * Règle simple: Seuls les SuperAdmin ont accès au visualiseur de logs
 * Tous les autres utilisateurs sont bloqués
 */
class LogViewerAuth
{
    /** @var RightsManager Gestionnaire de droits existant */
    private RightsManager $rightsManager;
    
    /** @var array Données sensibles à masquer (même pour SuperAdmin par sécurité) */
    private array $sensitivePatterns = [
        'password' => '/password["\s]*[:=]["\s]*([^"\s,}]+)/i',
        'token' => '/(?:token|api_key|secret)["\s]*[:=]["\s]*([^"\s,}]+)/i',
        'session_id' => '/(?:session_id|sess_id)["\s]*[:=]["\s]*([^"\s,}]+)/i',
        'credit_card' => '/\b(?:\d{4}[-\s]?){3}\d{4}\b/',
    ];
    
    /** @var DeduplicatedLogger Logger pour l'audit */
    private ?DeduplicatedLogger $auditLogger = null;

    public function __construct(RightsManager $rightsManager, array $config = [])
    {
        $this->rightsManager = $rightsManager;
        
        // Configurer les patterns sensibles supplémentaires si fournis
        if (isset($config['sensitive_patterns'])) {
            $this->sensitivePatterns = array_merge($this->sensitivePatterns, $config['sensitive_patterns']);
        }
    }
    
    /**
     * Définit le logger d'audit
     */
    public function setAuditLogger(DeduplicatedLogger $logger): void
    {
        $this->auditLogger = $logger;
    }
    
    /**
     * Vérifie si l'utilisateur est authentifié ET SuperAdmin
     */
    public function isAuthenticated(): bool
    {
        return $this->rightsManager->isUserAuthenticated() && $this->isSuperAdmin();
    }
    
    /**
     * Vérifie si l'utilisateur est SuperAdmin
     */
    public function isSuperAdmin(): bool
    {
        if (!$this->rightsManager->isUserAuthenticated()) {
            return false;
        }
        
        return $this->rightsManager->isSuperAdmin();
    }
    
    /**
     * Vérifie les permissions - toujours true pour SuperAdmin
     */
    public function hasPermission(string $permission): bool
    {
        return $this->isAuthenticated(); // SuperAdmin a toutes les permissions
    }
    
    /**
     * Génère un token CSRF
     */
    public function generateCsrfToken(): string
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $token = bin2hex(random_bytes(32));
        $_SESSION['logviewer_csrf_token'] = $token;
        $_SESSION['logviewer_csrf_time'] = time();
        
        return $token;
    }
    
    /**
     * Vérifie un token CSRF
     */
    public function verifyCsrfToken(string $token): bool
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        if (!isset($_SESSION['logviewer_csrf_token']) || !isset($_SESSION['logviewer_csrf_time'])) {
            return false;
        }
        
        // Vérifier l'expiration (15 minutes)
        if (time() - $_SESSION['logviewer_csrf_time'] > 900) {
            unset($_SESSION['logviewer_csrf_token'], $_SESSION['logviewer_csrf_time']);
            return false;
        }
        
        return hash_equals($_SESSION['logviewer_csrf_token'], $token);
    }
    
    /**
     * Masque les données vraiment sensibles (mots de passe, tokens)
     * Même les SuperAdmin ne voient pas les mots de passe en clair
     */
    public function maskSensitiveData(string $content): string
    {
        $masked = $content;
        
        foreach ($this->sensitivePatterns as $type => $pattern) {
            $masked = preg_replace_callback($pattern, function($matches) use ($type) {
                $value = $matches[1] ?? $matches[0];
                return str_replace($value, $this->maskValue($value, $type), $matches[0]);
            }, $masked);
        }
        
        return $masked;
    }
    
    /**
     * Masque une valeur selon son type
     */
    private function maskValue(string $value, string $type): string
    {
        switch ($type) {
            case 'password':
            case 'token':
            case 'session_id':
                return '***MASKED***';
                
            case 'credit_card':
                $cleaned = preg_replace('/[^0-9]/', '', $value);
                if (strlen($cleaned) >= 12) {
                    return '****-****-****-' . substr($cleaned, -4);
                }
                return '****-****-****-****';
                
            default:
                return '***MASKED***';
        }
    }
    
    /**
     * Filtre les logs - SuperAdmin voit tout (avec masquage des données critiques)
     */
    public function filterLogsByPermission(array $logs): array
    {
        if (!$this->isAuthenticated()) {
            $this->logUnauthorizedAccess('filter_logs_attempt');
            return [];
        }
        
        $filteredLogs = [];
        
        foreach ($logs as $log) {
            // Masquer seulement les données vraiment critiques
            $log['message'] = $this->maskSensitiveData($log['message']);
            
            // Masquer le contexte si présent
            if (isset($log['context']) && is_string($log['context'])) {
                $log['context'] = $this->maskSensitiveData($log['context']);
            }
            
            $filteredLogs[] = $log;
        }
        
        return $filteredLogs;
    }
    
    /**
     * Enregistre un événement d'audit
     */
    public function logAuditEvent(string $event, array $context = []): void
    {
        if (!$this->auditLogger) {
            return;
        }
        
        $currentUser = $this->rightsManager->getCurrentUser();
        
        $auditContext = array_merge($context, [
            'event_type' => 'logviewer_audit',
            'user_id' => $currentUser['id'] ?? null,
            'username' => $currentUser['username'] ?? null,
            'is_superadmin' => $this->isSuperAdmin(),
            'ip' => $this->getClientIp(),
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'timestamp' => time(),
            'session_id' => session_id()
        ]);
        
        $this->auditLogger->info("LOGVIEWER_AUDIT: {$event}", $auditContext);
    }
    
    /**
     * Enregistre une tentative d'accès non autorisé
     */
    private function logUnauthorizedAccess(string $action): void
    {
        $currentUser = $this->rightsManager->getCurrentUser();
        
        $this->logAuditEvent('unauthorized_access', [
            'action_attempted' => $action,
            'user_authenticated' => $this->rightsManager->isUserAuthenticated(),
            'user_is_superadmin' => $this->isSuperAdmin(),
            'access_denied' => true
        ]);
    }
    
    /**
     * Obtient l'adresse IP du client
     */
    private function getClientIp(): string
    {
        $ipHeaders = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'HTTP_X_FORWARDED',
            'HTTP_FORWARDED_FOR',
            'HTTP_FORWARDED',
            'REMOTE_ADDR'
        ];
        
        foreach ($ipHeaders as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = trim(explode(',', $_SERVER[$header])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
    
    /**
     * Retourne les informations de l'utilisateur connecté
     */
    public function getCurrentUser(): ?array
    {
        if (!$this->rightsManager->isUserAuthenticated()) {
            return null;
        }
        
        $user = $this->rightsManager->getCurrentUser();
        $isSuperAdmin = $this->isSuperAdmin();
        
        return [
            'id' => $user['id'] ?? null,
            'username' => $user['username'] ?? null,
            'name' => $user['name'] ?? $user['username'] ?? null,
            'is_superadmin' => $isSuperAdmin,
            'has_log_access' => $isSuperAdmin,
            'permissions' => $isSuperAdmin ? [
                'view_logs' => true,
                'search_logs' => true,
                'download_logs' => true,
                'clear_logs' => true,
                'view_debug' => true,
                'admin_panel' => true
            ] : []
        ];
    }
    
    /**
     * Vérifie l'accès avec audit - bloque tout sauf SuperAdmin
     */
    public function checkAccess(string $action, array $context = []): bool
    {
        $isAuthenticated = $this->rightsManager->isUserAuthenticated();
        $isSuperAdmin = $this->isSuperAdmin();
        $hasAccess = $isAuthenticated && $isSuperAdmin;
        
        if (!$hasAccess && $isAuthenticated) {
            // Utilisateur connecté mais pas SuperAdmin
            $this->logUnauthorizedAccess($action);
        }
        
        if ($hasAccess) {
            $this->logAuditEvent('access_granted', [
                'action' => $action,
                'context' => $context
            ]);
        }
        
        return $hasAccess;
    }
    
    /**
     * Retourne les statistiques de sécurité
     */
    public function getSecurityStats(): array
    {
        $user = $this->getCurrentUser();
        $isAuthenticated = $this->rightsManager->isUserAuthenticated();
        $isSuperAdmin = $this->isSuperAdmin();
        
        return [
            'is_authenticated' => $isAuthenticated,
            'is_superadmin' => $isSuperAdmin,
            'has_log_access' => $isAuthenticated && $isSuperAdmin,
            'current_user' => $user ? $user['username'] : null,
            'access_level' => $isSuperAdmin ? 'superadmin' : ($isAuthenticated ? 'user' : 'none'),
            'sensitive_patterns' => count($this->sensitivePatterns),
            'csrf_enabled' => isset($_SESSION['logviewer_csrf_token']),
            'security_model' => 'superadmin_only'
        ];
    }
    
    /**
     * Middleware pour vérifier l'accès à chaque requête
     */
    public function requireSuperAdmin(): void
    {
        if (!$this->checkAccess('page_access')) {
            // Rediriger vers la page de connexion ou afficher erreur 403
            http_response_code(403);
            
            if ($this->rightsManager->isUserAuthenticated()) {
                // Utilisateur connecté mais pas SuperAdmin
                echo "Accès refusé. Seuls les SuperAdmin peuvent accéder au visualiseur de logs.";
            } else {
                // Utilisateur non connecté
                echo "Authentification requise.";
            }
            
            exit;
        }
    }
    
    /**
     * Génère une page d'erreur d'accès
     */
    public function renderAccessDenied(): void
    {
        http_response_code(403);
        
        $currentUser = $this->rightsManager->getCurrentUser();
        $isAuthenticated = $this->rightsManager->isUserAuthenticated();
        
        echo '<!DOCTYPE html>
<html>
<head>
    <title>Accès refusé - Visualiseur de logs</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 50px; background: #f5f5f5; }
        .error-box { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
        .error-title { color: #d32f2f; font-size: 24px; margin-bottom: 20px; }
        .error-message { color: #666; line-height: 1.6; }
        .user-info { background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="error-box">
        <div class="error-title">🚫 Accès refusé</div>
        <div class="error-message">';
        
        if ($isAuthenticated) {
            echo '<p>Vous êtes connecté mais vous n\'avez pas les droits nécessaires pour accéder au visualiseur de logs.</p>';
            echo '<p><strong>Seuls les SuperAdmin peuvent accéder à cette interface.</strong></p>';
            echo '<div class="user-info">';
            echo '<strong>Utilisateur connecté :</strong> ' . htmlspecialchars($currentUser['username'] ?? 'Inconnu') . '<br>';
            echo '<strong>Niveau d\'accès :</strong> ' . ($this->isSuperAdmin() ? 'SuperAdmin' : 'Utilisateur standard');
            echo '</div>';
        } else {
            echo '<p>Vous devez vous connecter avec un compte SuperAdmin pour accéder au visualiseur de logs.</p>';
        }
        
        echo '</div>
    </div>
</body>
</html>';
    }
}