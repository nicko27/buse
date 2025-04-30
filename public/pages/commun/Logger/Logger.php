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
        $output    = "[[%channel%]]{macro: autolabel} %level_name%: %message%\n";
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
}
