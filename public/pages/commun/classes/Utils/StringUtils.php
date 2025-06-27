<?php
namespace Commun\Utils;

class StringUtils
{
    /**
     * Tronque une chaîne au milieu en ajoutant des points de suspension
     */
    public static function truncateMiddle(string $string, int $maxLength): string
    {
        if (strlen($string) <= $maxLength) {
            return $string;
        }

        if ($maxLength <= 5) {
            return substr($string, 0, $maxLength);
        }

        $mid   = ceil($maxLength / 2) - 2;
        $start = substr($string, 0, $mid);
        $end   = substr($string, -$mid);
        return $start . ' ... ' . $end;
    }

    /**
     * Supprime les accents d'une chaîne
     */
    public static function stripAccents(string $string): string
    {
        // ✅ AMÉLIORATION : Utiliser transliterator si disponible
        if (class_exists('Transliterator')) {
            $transliterator = \Transliterator::createFromRules(
                ':: Any-Latin; :: Latin-ASCII; :: NFD; :: [:Nonspacing Mark:] Remove; :: NFC;',
                \Transliterator::FORWARD
            );
            if ($transliterator !== null) {
                $result = $transliterator->transliterate($string);
                if ($result !== false) {
                    return $result;
                }
            }
        }

        // Fallback : méthode originale
        $string = htmlentities($string, ENT_NOQUOTES, 'utf-8');
        $string = preg_replace('#&([A-za-z])(?:acute|cedil|caron|circ|grave|orn|ring|slash|th|tilde|uml);#', '\1', $string);
        $string = preg_replace('#&([A-za-z]{2})(?:lig);#', '\1', $string);
        $string = html_entity_decode($string);
        return $string;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Génère un slug à partir d'une chaîne
     */
    public static function slugify(string $string): string
    {
        // Supprimer les accents
        $string = self::stripAccents($string);

        // Convertir en minuscules
        $string = strtolower($string);

        // Remplacer les caractères non alphanumériques par des tirets
        $string = preg_replace('/[^a-z0-9]+/', '-', $string);

        // Supprimer les tirets en début et fin
        $string = trim($string, '-');

        return $string;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Tronque une chaîne à la fin avec points de suspension
     */
    public static function truncate(string $string, int $maxLength, string $suffix = '...'): string
    {
        if (strlen($string) <= $maxLength) {
            return $string;
        }

        return substr($string, 0, $maxLength - strlen($suffix)) . $suffix;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Tronque une chaîne au dernier mot complet
     */
    public static function truncateWords(string $string, int $maxLength, string $suffix = '...'): string
    {
        if (strlen($string) <= $maxLength) {
            return $string;
        }

        $truncated = substr($string, 0, $maxLength - strlen($suffix));
        $lastSpace = strrpos($truncated, ' ');

        if ($lastSpace !== false) {
            $truncated = substr($truncated, 0, $lastSpace);
        }

        return $truncated . $suffix;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Capitalise la première lettre de chaque mot
     */
    public static function titleCase(string $string): string
    {
        return mb_convert_case($string, MB_CASE_TITLE, 'UTF-8');
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Convertit une chaîne en camelCase
     */
    public static function camelCase(string $string): string
    {
        $string = self::stripAccents($string);
        $string = preg_replace('/[^a-zA-Z0-9]/', ' ', $string);
        $string = ucwords(strtolower($string));
        $string = str_replace(' ', '', $string);
        return lcfirst($string);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Convertit une chaîne en snake_case
     */
    public static function snakeCase(string $string): string
    {
        $string = self::stripAccents($string);
        $string = preg_replace('/[^a-zA-Z0-9]/', '_', $string);
        $string = preg_replace('/_+/', '_', $string);
        $string = trim($string, '_');
        return strtolower($string);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Vérifie si une chaîne commence par un préfixe
     */
    public static function startsWith(string $haystack, string $needle): bool
    {
        return strpos($haystack, $needle) === 0;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Vérifie si une chaîne se termine par un suffixe
     */
    public static function endsWith(string $haystack, string $needle): bool
    {
        return substr($haystack, -strlen($needle)) === $needle;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Vérifie si une chaîne contient une sous-chaîne
     */
    public static function contains(string $haystack, string $needle): bool
    {
        return strpos($haystack, $needle) !== false;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Génère une chaîne aléatoire
     */
    public static function random(int $length = 10, string $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string
    {
        $charactersLength = strlen($characters);
        $randomString     = '';

        for ($i = 0; $i < $length; $i++) {
            $randomString .= $characters[random_int(0, $charactersLength - 1)];
        }

        return $randomString;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Échappe une chaîne pour l'HTML
     */
    public static function escapeHtml(string $string): string
    {
        return htmlspecialchars($string, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Nettoie une chaîne en supprimant les balises HTML
     */
    public static function stripTags(string $string, string $allowedTags = ''): string
    {
        return strip_tags($string, $allowedTags);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Formate un numéro de téléphone
     */
    public static function formatPhone(string $phone): string
    {
        // Supprimer tous les caractères non numériques
        $phone = preg_replace('/[^0-9]/', '', $phone);

        // Si le numéro commence par 33, le remplacer par 0
        if (substr($phone, 0, 2) === '33') {
            $phone = '0' . substr($phone, 2);
        }

        // Formater selon la longueur
        if (strlen($phone) === 10) {
            return substr($phone, 0, 2) . ' ' .
            substr($phone, 2, 2) . ' ' .
            substr($phone, 4, 2) . ' ' .
            substr($phone, 6, 2) . ' ' .
            substr($phone, 8, 2);
        }

        return $phone;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Masque une chaîne partiellement
     */
    public static function mask(string $string, int $start = 0, int $length = null, string $mask = '*'): string
    {
        if ($length === null) {
            $length = strlen($string) - $start;
        }

        return substr_replace($string, str_repeat($mask, $length), $start, $length);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Masque une adresse email
     */
    public static function maskEmail(string $email): string
    {
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $email;
        }

        list($name, $domain) = explode('@', $email);

        $nameLength = strlen($name);
        if ($nameLength <= 2) {
            $maskedName = str_repeat('*', $nameLength);
        } else {
            $maskedName = substr($name, 0, 1) . str_repeat('*', $nameLength - 2) . substr($name, -1);
        }

        return $maskedName . '@' . $domain;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Convertit les retours à la ligne en balises <br>
     */
    public static function nl2br(string $string): string
    {
        return nl2br($string, true);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Limite le nombre de mots dans une chaîne
     */
    public static function limitWords(string $string, int $limit, string $suffix = '...'): string
    {
        $words = explode(' ', $string);

        if (count($words) <= $limit) {
            return $string;
        }

        return implode(' ', array_slice($words, 0, $limit)) . $suffix;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Pad une chaîne avec des caractères
     */
    public static function pad(string $string, int $length, string $pad = ' ', int $type = STR_PAD_RIGHT): string
    {
        return str_pad($string, $length, $pad, $type);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Remplace les espaces multiples par un seul
     */
    public static function normalizeSpaces(string $string): string
    {
        return preg_replace('/\s+/', ' ', trim($string));
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Vérifie si une chaîne est un JSON valide
     */
    public static function isJson(string $string): bool
    {
        json_decode($string);
        return json_last_error() === JSON_ERROR_NONE;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Encode une chaîne en base64 URL-safe
     */
    public static function base64UrlEncode(string $string): string
    {
        return rtrim(strtr(base64_encode($string), '+/', '-_'), '=');
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Décode une chaîne base64 URL-safe
     */
    public static function base64UrlDecode(string $string): string
    {
        return base64_decode(str_pad(strtr($string, '-_', '+/'), strlen($string) % 4, '=', STR_PAD_RIGHT));
    }
}
