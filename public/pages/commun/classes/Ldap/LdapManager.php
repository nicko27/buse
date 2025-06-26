<?php

namespace Commun\Ldap;

use Commun\Logger\Logger;

class BaseDNConfig
{
    public function __construct(
        public readonly string $lists,
        public readonly string $services,
        public readonly string $persons
    ) {}

}

class LdapConfig
{
    private string $uri;

    public function __construct(
        public readonly string $host,
        public readonly int $port = 389,
        public readonly ?string $user = null,
        public readonly ?string $password = null,
        public readonly bool $useLdaps = false,
        public readonly bool $validateCert = true,
        public readonly ?string $caPath = null,
        public readonly ?string $clientCert = null,
        public readonly ?string $clientKey = null,
        public readonly ?BaseDNConfig $baseDN = null
    ) {
        $this->uri = $this->buildUri();
    }

    private function buildUri(): string
    {
        $protocol = $this->useLdaps ? 'ldaps' : 'ldap';
        return sprintf('%s://%s:%d', $protocol, $this->host, $this->port);
    }

    public function getUri(): string
    {
        return $this->uri;
    }

    public function isAnonymous(): bool
    {
        return $this->user === null && $this->password === null;
    }

    public function getBaseDN(): BaseDNConfig
    {
        return $this->baseDN ;
    }
}

class LdapManager
{
    private static $instance = null;
    private $connection      = null;
    private $logger;
    private $config;

    private function __construct(LdapConfig $config)
    {
        $this->logger = Logger::getInstance()->getLogger();
        $this->config = $config;
    }

    public static function initialize(LdapConfig $config): void
    {
        if (self::$instance !== null) {
            throw new \RuntimeException('LdapManager is already initialized');
        }
        self::$instance = new self($config);
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            throw new \RuntimeException('LdapManager must be initialized with configuration before use');
        }
        return self::$instance;
    }

    private function configureTLS(): void
    {
        if ($this->config->useLdaps) {
            if (!$this->config->validateCert) {
                putenv('LDAPTLS_REQCERT=never');
            }

            if ($this->config->caPath) {
                putenv('LDAPTLS_CACERT=' . $this->config->caPath);
            }

            if ($this->config->clientCert) {
                putenv('LDAPTLS_CERT=' . $this->config->clientCert);
            }

            if ($this->config->clientKey) {
                putenv('LDAPTLS_KEY=' . $this->config->clientKey);
            }
        }
    }

    public function connect(): bool
    {
        try {
            $this->configureTLS();

            $this->connection = ldap_connect($this->config->getUri());

            if ($this->connection === false) {
                throw new \Exception("Failed to connect to LDAP server");
            }

            ldap_set_option($this->connection, LDAP_OPT_PROTOCOL_VERSION, 3);
            ldap_set_option($this->connection, LDAP_OPT_REFERRALS, 0);

            if ($this->config->useLdaps) {
                ldap_set_option($this->connection, LDAP_OPT_X_TLS_REQUIRE_CERT,
                    $this->config->validateCert ? LDAP_OPT_X_TLS_HARD : LDAP_OPT_X_TLS_NEVER);
            }

            if ($this->config->isAnonymous()) {
                $bound = @ldap_bind($this->connection);
            } else {
                $bound = @ldap_bind($this->connection, $this->config->user, $this->config->password);
            }

            if (!$bound) {
                throw new \Exception("LDAP bind failed: " . ldap_error($this->connection));
            }

            return true;

        } catch (\Exception $e) {
            $this->logger->error("Erreur de connexion LDAP", [
                'error'     => $e->getMessage(),
                'uri'       => $this->config->getUri(),
                'anonymous' => $this->config->isAnonymous(),
                'useLdaps'  => $this->config->useLdaps,
            ]);
            return false;
        }
    }

    public function searchLists(string $query, int $returnType = 2): array
    {
        $attributes = ['codeunite', 'ou', 'businessou', 'mail', 'cn'];
        $results    = $this->search($this->config->getBaseDN()->lists, $query, $attributes, 'ou');

        $list = [];
        for ($i = 0; $i < $results["count"]; $i++) {
            $entry    = $results[$i];
            $mail     = $entry['mail'][0] ?? '';
            $unitName = $entry['ou'][0] ?? '';
            $unitCode = $entry['codeunite'][0] ?? '';

            if ($returnType === 1) {
                $list[] = "<div id='c_$unitCode' class='droit_recherche' onclick='liste_select(\"c_$unitCode\")'>$unitName ($unitCode)</div>";
            } else {
                $list[] = $mail;
            }
        }

        return $returnType === 1 ? implode('', $list) : $list;
    }

    public function searchServices(string $query, array $attributes, int $limit = 10): array
    {
        // Effectue la recherche avec les attributs spécifiés
        $results = $this->search($this->config->getBaseDN()->services, $query, $attributes, 'ou', $limit);

        // Initialisation de la liste des résultats
        $list = [];

        // Parcourt les résultats et extrait dynamiquement les attributs
        for ($i = 0; $i < $results["count"]; $i++) {
            $entry = $results[$i];

            // Construire une entrée avec les attributs demandés
            $entryData = [];
            foreach ($attributes as $attribute) {
                $entryData[strtolower($attribute)] = $entry[strtolower($attribute)][0] ?? null; // Récupère la première valeur ou null
            }

            $list[] = $entryData;
        }

        // Retourne la liste des résultats
        return $list;
    }

    public function searchPersons(string $query, array $attributes, int $limit = 50): array | string
    {
        $results = $this->search($this->config->getBaseDN()->persons, $query, $attributes, 'cn', $limit);

        $list = [];
        // Parcourt les résultats et extrait dynamiquement les attributs
        for ($i = 0; $i < $results["count"]; $i++) {
            $entry = $results[$i];

            // Construire une entrée avec les attributs demandés
            $entryData = [];
            foreach ($attributes as $attribute) {
                $entryData[strtolower($attribute)] = $entry[strtolower($attribute)][0] ?? null; // Récupère la première valeur ou null
            }

            $list[] = $entryData;
        }

        // Retourne la liste des résultats
        return $list;
    }

    public function getUserName(string $numero): string
    {
        $filter  = "employeenumber=$numero";
        $results = $this->search($this->config->getBaseDN()->persons, $filter, ['cn'], 'cn');
        return $results[0]['cn'][0] ?? '';
    }

    public function getGroupName(string $numero): string
    {
        $filter  = "codeunite=$numero";
        $results = $this->search($this->config->getBaseDN()->services, $filter, ['ou'], 'ou', 10);
        return $results[0]['ou'][0] ?? '';
    }

    private function search(string $base_dn, string $filter, array $attributes = [], string $sort = '', int $limit = 0): array
    {
        if (!$this->connection && !$this->connect()) {
            return [];
        }

        try {
            $search = ldap_search($this->connection, $base_dn, $filter, $attributes, 0, $limit);
            if ($search === false) {
                $this->logger->error("Échec de la recherche LDAP", [
                    'base_dn' => $base_dn,
                    'filter'  => $filter,
                    'error'   => ldap_error($this->connection)
                ]);
                return [];
            }
            return ldap_get_entries($this->connection, $search);
        } catch (\Exception $e) {
            $this->logger->error("Erreur de recherche LDAP", [
                'error'   => $e->getMessage(),
                'base_dn' => $base_dn,
                'filter'  => $filter,
            ]);
            return [];
        }
    }

    public function __destruct()
    {
        if ($this->connection) {
            ldap_close($this->connection);
        }
    }
}
