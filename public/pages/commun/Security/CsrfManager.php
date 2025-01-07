<?php

namespace Commun\Security;

class CsrfManager {
    private static $instance = null;
    private $token;

    private function __construct() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        if (!isset($_SESSION['CSRF_TOKEN'])) {
            $_SESSION['CSRF_TOKEN'] = bin2hex(random_bytes(32));
        }
        
        $this->token = $_SESSION['CSRF_TOKEN'];
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getToken() {
        return $this->token;
    }

    public function validateToken($token) {
        if (empty($token) || !isset($_SESSION['CSRF_TOKEN'])) {
            return false;
        }
        return hash_equals($_SESSION['CSRF_TOKEN'], $token);
    }

    public function refreshToken() {
        $_SESSION['CSRF_TOKEN'] = bin2hex(random_bytes(32));
        $this->token = $_SESSION['CSRF_TOKEN'];
        return $this->token;
    }
}
