<?php
/*Ajout Nico */
use \Exception;
use \SoapClient;

/*Fin ajout Nico */

/* Version 2.7.0 (contribution ADC Guillaume Deborde) */
/* avec commentaires et norme >= php7 */

class SSOlocal
{
    const COOKIE_NAME   = 'XXX';
    const COOKIE_DOMAIN = 'XXX';
    const PORTAL_URL    = 'XXX';
    const REST_URL      = 'XXX';
    const MAIL_URL      = 'XXX';
    const GRP_URL       = 'XXX';

    /**
     * Récupère les informations du SSO et les stocke en session
     */
    public static function authenticate()
    {
        $opts = [
            'ssl' => [
                'verify_peer'      => false,
                'verify_peer_name' => false,
            ],
        ];

        if (isset($_COOKIE[self::COOKIE_NAME])) {
            $url = self::REST_URL . "?id=" . $_COOKIE[self::COOKIE_NAME] . "&host=" . $_SERVER['HTTP_HOST'];
            // supprimer le cookie pour éviter qu'il ne soit détourné par une autre appli dans le même domaine
            setcookie(self::COOKIE_NAME, "", time() - 3600, "/", self::COOKIE_DOMAIN);
            if ($json = file_get_contents($url, false, stream_context_create($opts))) {
                $_SESSION['user'] = json_decode($json);
            } else {
                echo '<html><body>BAD<pre>X ' . $url . ' X</pre>' . file_get_contents($url, false, stream_context_create($opts)) . '</body></html>';
            }
        } else {
            self::redirect();
        }
    }

    /**
     * Redirige l'utilisateur sur sa page d'origine
     */
    private static function redirect()
    {
        $isSecure = false;
        if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
            $isSecure = true;
        } elseif (
            (! empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] == 'https')
            || (! empty($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] == 'on')
        ) {
            $isSecure = true;
        }
        $requestProtocol = $isSecure ? 'https' : 'http';
        $url             = $requestProtocol . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        header('Location: ' . self::PORTAL_URL . '?url=' . base64_encode($url));
        exit;
    }

    /**
     * Retourne les informations de l'utilisateur stockées en session
     *
     * @return mixed
     */
    public static function user()
    {
        return $_SESSION['user'];
    }

    /**
     * @param string $subject                   Sujet du mail
     * @param string $body                      Corps du mail
     * @param array  $recipients                Destinataires du mail
     * @param bool   $throwExceptionIfExpired   Retourne une exception si l'envoi du mail échoue
     *
     * @return mixed
     * @throws SoapFault
     */
    public static function mail($subject, $body, array $recipients, $throwExceptionIfExpired = false)
    {
        if ($_SESSION['user']->mailTokenExp < time()) {
            if ($throwExceptionIfExpired) {
                throw new Exception('Jeton caduc');
            }
        } else {
            self::authenticate();
        }

        # pour envoyer le jeton dans un en-tête de requête HTTP 'MailToken'
        $stream_context = stream_context_create([
            'ssl'  => [
                'verify_peer'      => false,
                'verify_peer_name' => false,
            ],
            'http' => [
                'header' => 'MailToken: ' . $_SESSION['user']->mailToken,
            ],
        ]);

        $client = new SoapClient(null, [
            'stream_context' => $stream_context,
            'location'       => self::MAIL_URL,
            'uri'            => 'SOAPService/Mail',
        ]);

        return $client->__soapCall('send', [
            'subject'    => $subject,
            'body'       => $body,
            'recipients' => $recipients,
        ], null);
    }

    /**
     * Récupère les liste des groupes et les insère dans la session user
     *
     * @param string $motif     N'affiche que les groupes contenant le motif
     *
     * @return array
     */
    public static function groups($motif = '')
    {
        if (! isset($_SESSION['user']->groups)) {
            $opts = [
                'ssl'  => [
                    'verify_peer'      => false,
                    'verify_peer_name' => false,
                ],
                'http' => [
                    'method' => 'GET',
                    'header' => 'mailToken:' . $_SESSION['user']->mailToken . "\r\n",
                ],
            ];

            // Formate les entêtes de la requête
            $context = stream_context_create($opts);
            $url     = self::GRP_URL;
            if ($json = file_get_contents($url, false, $context)) {
                $_SESSION['user']->groups = json_decode($json);
            } else {
                #throw new  Exception ($http_response_header[0]);
                echo '<html><body><pre>' . $url . "\n" . "mailToken:" . $_SESSION['user']->mailToken . '</pre></body></html>';
            }
        }
        if ($motif) {
            return preg_grep("/$motif/", $_SESSION['user']->groups);
        } else {
            return $_SESSION['user']->groups;
        }
    }
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (! isset($_SESSION['user'])) {
    SSOlocal::authenticate();
}
