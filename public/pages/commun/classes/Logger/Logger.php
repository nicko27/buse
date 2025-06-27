<?php
namespace Commun\Logger;

use Monolog\ErrorHandler;
use Monolog\Formatter\LineFormatter;
use Monolog\Handler\ErrorLogHandler;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Level;
use Monolog\Logger as MonologLogger;
use Monolog\LogRecord;

class Logger
{
    private static $instance = null;
    private $logger;
    private $loggerName;
    private $logDir;

    private function __construct(string $loggerName, string $logDir)
    {
        $this->loggerName = $loggerName;
        $this->logDir     = $logDir;
        $this->initLogger();
        $this->registerErrorHandler();
    }

    public static function initWithParams(string $loggerName, string $logDir): void
    {
        if (self::$instance === null) {
            self::$instance = new self($loggerName, $logDir);
        }
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            throw new \RuntimeException('Logger must be initialized with initWithParams before using getInstance');
        }
        return self::$instance;
    }

    private function initLogger(): void
    {
        // Créer le logger
        $this->logger = new MonologLogger($this->loggerName);

        // Configurer le format avec retour à la ligne
        $output    = "%datetime% - %level_name%: %message%\n";
        $formatter = new LineFormatter($output, "Y-m-d H:i:s", true, true);
        $formatter->ignoreEmptyContextAndExtra(true);

        // Créer un handler personnalisé qui étend RotatingFileHandler
        $fileHandler = new class($this->logDir . "/error.log", 31, Level::Debug) extends RotatingFileHandler
        {
            protected function streamWrite($stream, LogRecord $record): void
            {
                if (is_resource($stream)) {
                    $formatted = mb_convert_encoding($record->formatted, 'UTF-8', 'auto');
                    fwrite($stream, (string) $formatted);
                }
            }
        };

        $fileHandler->setFormatter($formatter);
        $this->logger->pushHandler($fileHandler);

        // Handler pour les erreurs système
        $syslogHandler = new ErrorLogHandler();
        $syslogHandler->setFormatter($formatter);
        $this->logger->pushHandler($syslogHandler);
    }

    private function registerErrorHandler(): void
    {
        ErrorHandler::register($this->logger);
    }

    public function getLogger(): MonologLogger
    {
        return $this->logger;
    }

    // Méthodes de logging avec contexte
    public function error(string $message, array $context = []): void
    {
        $message = mb_convert_encoding($message, 'UTF-8', 'auto');
        $this->logger->error($message, $this->enrichContext($context));
    }

    public function warning(string $message, array $context = []): void
    {
        $message = mb_convert_encoding($message, 'UTF-8', 'auto');
        $this->logger->warning($message, $this->enrichContext($context));
    }

    public function info(string $message, array $context = []): void
    {
        $message = mb_convert_encoding($message, 'UTF-8', 'auto');
        $this->logger->info($message, $this->enrichContext($context));
    }

    public function debug(string $message, array $context = []): void
    {
        $message = mb_convert_encoding($message, 'UTF-8', 'auto');
        $this->logger->debug($message, $this->enrichContext($context));
    }

    public function critical(string $message, array $context = []): void
    {
        $message = mb_convert_encoding($message, 'UTF-8', 'auto');
        $this->logger->critical($message, $this->enrichContext($context));
    }

    public function log($level, string $message, array $context = []): void
    {
        $message = mb_convert_encoding($message, 'UTF-8', 'auto');
        $this->logger->log($level, $message, $this->enrichContext($context));
    }

    private function enrichContext(array $context): array
    {
        if (empty($context)) {
            return [];
        }

        // Ajouter des informations utiles au contexte
        $context['timestamp']  = time();
        $context['request_id'] = uniqid();

        if (isset($_SERVER['REQUEST_URI'])) {
            $context['url'] = $_SERVER['REQUEST_URI'];
        }

        if (isset($_SERVER['REMOTE_ADDR'])) {
            $context['ip'] = $_SERVER['REMOTE_ADDR'];
        }

        // Convertir toutes les chaînes du contexte en UTF-8
        array_walk_recursive($context, function (&$value) {
            if (is_string($value)) {
                $value = mb_convert_encoding($value, 'UTF-8', 'auto');
            }
        });

        return $context;
    }

    /**
     * Nettoie un tableau pour le logging en limitant la profondeur et la taille
     * Évite les références circulaires et les structures trop complexes
     *
     * @param mixed $data Les données à nettoyer
     * @param int $maxDepth Profondeur maximale à explorer
     * @param int $currentDepth Profondeur actuelle (usage interne)
     * @return mixed Données nettoyées pour le log
     */
    public function sanitizeForLog($data, int $maxDepth = 3, int $currentDepth = 0)
    {
        if ($currentDepth >= $maxDepth) {
            return '[MAX_DEPTH_REACHED]';
        }

        // Gestion des différents types de données
        if (is_array($data)) {
            return $this->sanitizeArrayForLog($data, $maxDepth, $currentDepth);
        } elseif (is_object($data)) {
            return $this->sanitizeObjectForLog($data, $maxDepth, $currentDepth);
        } elseif (is_string($data) && strlen($data) > 500) {
            return substr($data, 0, 500) . '... (truncated from ' . strlen($data) . ' chars)';
        } else {
            return $data;
        }
    }

    /**
     * Nettoie un tableau pour le logging
     */
    private function sanitizeArrayForLog(array $array, int $maxDepth, int $currentDepth): array
    {
        $result   = [];
        $count    = 0;
        $maxItems = 50; // Limiter le nombre d'éléments par niveau

        foreach ($array as $key => $value) {
            if ($count >= $maxItems) {
                $result['...'] = '[TRUNCATED - ' . (count($array) - $maxItems) . ' more items]';
                break;
            }

            $result[$key] = $this->sanitizeForLog($value, $maxDepth, $currentDepth + 1);
            $count++;
        }

        return $result;
    }

    /**
     * Nettoie un objet pour le logging
     */
    private function sanitizeObjectForLog(object $object, int $maxDepth, int $currentDepth): array
    {
        $className = get_class($object);
        $result    = [
            '__object_class' => $className,
        ];

        // Pour certains objets spéciaux, retourner des infos utiles
        if ($object instanceof \DateTime) {
            $result['__datetime'] = $object->format('Y-m-d H:i:s');
            return $result;
        }

        if ($object instanceof \Exception  || $object instanceof \Throwable) {
            $result['__exception_message'] = $object->getMessage();
            $result['__exception_code']    = $object->getCode();
            return $result;
        }

        // Pour les autres objets, lister les propriétés publiques
        try {
            $properties = get_object_vars($object);
            if (! empty($properties)) {
                $result['__properties_count'] = count($properties);

                // Limiter le nombre de propriétés affichées
                $maxProps  = 10;
                $propCount = 0;

                foreach ($properties as $prop => $value) {
                    if ($propCount >= $maxProps) {
                        $result['__more_properties'] = '... and ' . (count($properties) - $maxProps) . ' more';
                        break;
                    }

                    $result[$prop] = $this->sanitizeForLog($value, $maxDepth, $currentDepth + 1);
                    $propCount++;
                }
            }

            // Ajouter quelques méthodes publiques pour référence
            $methods = get_class_methods($object);
            if ($methods) {
                $publicMethods = [];
                foreach ($methods as $method) {
                    try {
                        $reflection = new \ReflectionMethod($object, $method);
                        if ($reflection->isPublic() && ! $reflection->isStatic()) {
                            $publicMethods[] = $method;
                        }
                    } catch (\ReflectionException $e) {
                        // Ignorer les erreurs de réflexion
                        continue;
                    }
                }

                $result['__public_methods'] = array_slice($publicMethods, 0, 10);
                if (count($publicMethods) > 10) {
                    $result['__methods_total'] = count($publicMethods);
                }
            }
        } catch (\Exception $e) {
            // En cas d'erreur, retourner juste la classe
            $result['__error'] = 'Cannot inspect object: ' . $e->getMessage();
        }

        return $result;
    }

    /**
     * Masque les données sensibles dans un contexte de log
     *
     * @param array $context Le contexte à masquer
     * @param array $sensitiveKeys Les clés considérées comme sensibles
     * @return array Le contexte avec les données sensibles masquées
     */
    public function maskSensitiveData(array $context, array $sensitiveKeys = []): array
    {
        $defaultSensitiveKeys = [
            'password', 'passwd', 'pass', 'pwd',
            'token', 'csrf_token', 'api_token', 'auth_token',
            'secret', 'private_key', 'api_key',
            'session_id', 'sess_id',
            'email', 'mail', 'user_email',
        ];

        $allSensitiveKeys = array_merge($defaultSensitiveKeys, $sensitiveKeys);

        return $this->maskSensitiveDataRecursive($context, $allSensitiveKeys);
    }

    /**
     * Masque récursivement les données sensibles
     */
    private function maskSensitiveDataRecursive($data, array $sensitiveKeys)
    {
        if (is_array($data)) {
            $result = [];
            foreach ($data as $key => $value) {
                $keyLower    = strtolower((string) $key);
                $isSensitive = false;

                foreach ($sensitiveKeys as $sensitiveKey) {
                    if (strpos($keyLower, strtolower($sensitiveKey)) !== false) {
                        $isSensitive = true;
                        break;
                    }
                }

                if ($isSensitive) {
                    if (is_string($value)) {
                        $result[$key] = $this->maskString($value);
                    } else {
                        $result[$key] = '***masked***';
                    }
                } else {
                    $result[$key] = $this->maskSensitiveDataRecursive($value, $sensitiveKeys);
                }
            }
            return $result;
        } elseif (is_object($data)) {
            // Pour les objets, on applique le masquage après la sanitization
            return $this->sanitizeForLog($data);
        } else {
            return $data;
        }
    }

    /**
     * Masque partiellement une chaîne de caractères
     */
    private function maskString(string $value): string
    {
        $length = strlen($value);

        if ($length === 0) {
            return '';
        } elseif ($length <= 4) {
            return str_repeat('*', $length);
        } elseif ($length <= 8) {
            return substr($value, 0, 2) . str_repeat('*', $length - 2);
        } else {
            return substr($value, 0, 3) . str_repeat('*', max(0, $length - 6)) . substr($value, -3);
        }
    }

    /**
     * Log spécialisé pour les variables Twig avec nettoyage automatique
     *
     * @param string $message Message de log
     * @param array $twigVars Variables Twig à logger
     * @param array $context Contexte supplémentaire
     */
    public function logTwigVars(string $message, array $twigVars, array $context = []): void
    {
        $sanitizedVars = $this->sanitizeForLog($twigVars, 3);
        $maskedVars    = $this->maskSensitiveData($sanitizedVars);

        $fullContext = array_merge($context, [
            'twig_vars_count' => count($twigVars),
            'twig_variables'  => $maskedVars,
        ]);

        $this->debug($message, $fullContext);
    }

    /**
     * Log spécialisé pour les erreurs avec contexte enrichi
     *
     * @param string $message Message d'erreur
     * @param \Throwable $exception Exception à logger
     * @param array $context Contexte supplémentaire
     */
    public function logException(string $message, \Throwable $exception, array $context = []): void
    {
        $exceptionContext = [
            'exception_class'   => get_class($exception),
            'exception_message' => $exception->getMessage(),
            'exception_code'    => $exception->getCode(),
            'exception_file'    => $exception->getFile(),
            'exception_line'    => $exception->getLine(),
            'exception_trace'   => $this->sanitizeForLog($exception->getTrace(), 2),
        ];

        $fullContext = array_merge($context, $exceptionContext);

        $this->error($message, $fullContext);
    }
}
