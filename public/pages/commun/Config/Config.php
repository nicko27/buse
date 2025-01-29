<?php

namespace Commun\Config;

use Dotenv\Dotenv;

class Config
{
    private static $instance = null;
    private $config = [];
    private $constants = [];

    private function __construct()
    {
        $this->loadEnvVariables();
        $this->defineConstants();
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function loadEnvVariables(): void
    {
        // Charger les variables d'environnement
        $dotenv = Dotenv::createImmutable(dirname(__DIR__, 4));
        $dotenv->load();
        $this->config = $_ENV;

        // Ajouter WEB_SERVER
        $this->config['WEB_SERVER'] = $_SERVER['DOCUMENT_ROOT'];
    }

    private function defineConstants(): void
    {
        // Construire les tableaux de pages et sous-pages
        $pages = [];
        $subpages = [];
        foreach ($this->config as $key => $value) {
            // Convertir les valeurs numériques
            if (is_numeric($value) && strpos($value, '.') === false) {
                $this->config[$key] = (int)$value;
                $value = (int)$value;
            }

            // Construire le tableau des pages
            if (strpos($key, 'PAGES_') === 0 && is_numeric(substr($key, 6))) {
                $pageId = (int)substr($key, 6);
                $pages[$pageId] = $value;
            }
            // Construire le tableau des sous-pages
            if (strpos($key, 'SUBPAGES_') === 0 && is_numeric(substr($key, 9))) {
                $subpageId = (int)substr($key, 9);
                $subpages[$subpageId] = $value;
            }

            // Définir la constante si elle n'existe pas
            if (!defined($key)) {
                define($key, $value);
            }
            // Stocker la valeur de la constante
            $this->constants[$key] = constant($key);
        }

        // Ajouter les tableaux à la configuration et aux constantes
        if (!defined('PAGES_LIST')) {
            define('PAGES_LIST', $pages);
        }
        if (!defined('SUBPAGES_MAIN_LIST')) {
            define('SUBPAGES_MAIN_LIST', $subpages);
        }
        $this->config['PAGES_LIST'] = $pages;
        $this->config['SUBPAGES_MAIN_LIST'] = $subpages;
        $this->constants['PAGES_LIST'] = $pages;
        $this->constants['SUBPAGES_MAIN_LIST'] = $subpages;
    }

    public function get(string $key, $default = null)
    {
        // Si la valeur existe dans la config, la retourner
        if (isset($this->config[$key])) {
            return $this->config[$key];
        }
        
        // Si la constante existe, la retourner
        if (defined($key)) {
            return constant($key);
        }

        // Sinon retourner la valeur par défaut
        return $default;
    }

    public function set(string $key, $value): void
    {
        $this->config[$key] = $value;
        if (!defined($key)) {
            define($key, $value);
        }
        $this->constants[$key] = $value;
    }

    public function has(string $key): bool
    {
        return isset($this->config[$key]) || defined($key);
    }

    public function getConstant(string $key, $default = null)
    {
        return defined($key) ? constant($key) : $default;
    }

    public function all(): array
    {
        return $this->config;
    }

    public function allConstants(): array
    {
        return $this->constants;
    }
}
