<?php

namespace Commun\Logger;

use Monolog\Logger as MonologLogger;
use Monolog\ErrorHandler;
use Monolog\Formatter\LineFormatter;
use Monolog\Handler\ErrorLogHandler;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Level;

class Logger
{
    private static $instance = null;
    private $logger;
    private $loggerName;
    private $logDir;

    private function __construct(string $loggerName, string $logDir)
    {
        $this->loggerName = $loggerName;
        $this->logDir = $logDir;
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
        $output = "[[%channel%]]{macro: autolabel} %level_name%: %message%\nContext: %context%\nExtra: %extra%\n";
        $formatter = new LineFormatter($output, "Y-m-d H:i:s", true, true);
        $formatter->ignoreEmptyContextAndExtra(true);

        // Ajouter les handlers
        $fileHandler = new RotatingFileHandler($this->logDir . "/error.log", 31, Level::Debug);
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
        $this->logger->error($message, $this->enrichContext($context));
    }

    public function warning(string $message, array $context = []): void
    {
        $this->logger->warning($message, $this->enrichContext($context));
    }

    public function info(string $message, array $context = []): void
    {
        $this->logger->info($message, $this->enrichContext($context));
    }

    public function debug(string $message, array $context = []): void
    {
        $this->logger->debug($message, $this->enrichContext($context));
    }

    private function enrichContext(array $context): array
    {
        // Ajouter des informations utiles au contexte
        $context['timestamp'] = time();
        $context['request_id'] = uniqid();
        
        if (isset($_SERVER['REQUEST_URI'])) {
            $context['url'] = $_SERVER['REQUEST_URI'];
        }
        
        if (isset($_SERVER['REQUEST_METHOD'])) {
            $context['method'] = $_SERVER['REQUEST_METHOD'];
        }
        
        return $context;
    }
}
