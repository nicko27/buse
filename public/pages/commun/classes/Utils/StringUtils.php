<?php
namespace Commun\Utils;

/**
 * Utilitaires pour la manipulation de chaînes de caractères
 *
 * Cette classe fournit des méthodes statiques pour diverses opérations
 * sur les chaînes de caractères avec support Unicode complet.
 *
 * @package Commun\Utils
 * @author Application Framework
 * @version 1.0
 */
class StringUtils
{
    /** @var array<string, string> Table de correspondance des caractères accentués étendue */
    private const ACCENT_MAP = [
        // Caractères latins de base
        'À' => 'A', 'Á'   => 'A', 'Â'   => 'A', 'Ã'   => 'A', 'Ä'   => 'A', 'Å'   => 'A', 'Æ'   => 'AE',
        'Ç' => 'C', 'È'   => 'E', 'É'   => 'E', 'Ê'   => 'E', 'Ë'   => 'E', 'Ì'   => 'I', 'Í'   => 'I',
        'Î' => 'I', 'Ï'   => 'I', 'Ð'   => 'D', 'Ñ'   => 'N', 'Ò'   => 'O', 'Ó'   => 'O', 'Ô'   => 'O',
        'Õ' => 'O', 'Ö'   => 'O', 'Ø'   => 'O', 'Ù'   => 'U', 'Ú'   => 'U', 'Û'   => 'U', 'Ü'   => 'U',
        'Ý' => 'Y', 'Þ'   => 'TH', 'ß'  => 'ss',
        'à' => 'a', 'á'   => 'a', 'â'   => 'a', 'ã'   => 'a', 'ä'   => 'a', 'å'   => 'a', 'æ'   => 'ae',
        'ç' => 'c', 'è'   => 'e', 'é'   => 'e', 'ê'   => 'e', 'ë'   => 'e', 'ì'   => 'i', 'í'   => 'i',
        'î' => 'i', 'ï'   => 'i', 'ð'   => 'd', 'ñ'   => 'n', 'ò'   => 'o', 'ó'   => 'o', 'ô'   => 'o',
        'õ' => 'o', 'ö'   => 'o', 'ø'   => 'o', 'ù'   => 'u', 'ú'   => 'u', 'û'   => 'u', 'ü'   => 'u',
        'ý' => 'y', 'þ'   => 'th', 'ÿ'  => 'y',

        // Caractères étendus A
        'Ā' => 'A', 'ā'   => 'a', 'Ă'   => 'A', 'ă'   => 'a', 'Ą'   => 'A', 'ą'   => 'a',
        'Ć' => 'C', 'ć'   => 'c', 'Ĉ'   => 'C', 'ĉ'   => 'c', 'Ċ'   => 'C', 'ċ'   => 'c', 'Č'   => 'C', 'č'  => 'c',
        'Ď' => 'D', 'ď'   => 'd', 'Đ'   => 'D', 'đ'   => 'd',
        'Ē' => 'E', 'ē'   => 'e', 'Ĕ'   => 'E', 'ĕ'   => 'e', 'Ė'   => 'E', 'ė'   => 'e', 'Ę'   => 'E', 'ę'  => 'e', 'Ě' => 'E', 'ě' => 'e',
        'Ĝ' => 'G', 'ĝ'   => 'g', 'Ğ'   => 'G', 'ğ'   => 'g', 'Ġ'   => 'G', 'ġ'   => 'g', 'Ģ'   => 'G', 'ģ'  => 'g',
        'Ĥ' => 'H', 'ĥ'   => 'h', 'Ħ'   => 'H', 'ħ'   => 'h',
        'Ĩ' => 'I', 'ĩ'   => 'i', 'Ī'   => 'I', 'ī'   => 'i', 'Ĭ'   => 'I', 'ĭ'   => 'i', 'Į'   => 'I', 'į'  => 'i', 'İ' => 'I', 'ı' => 'i',
        'Ĵ' => 'J', 'ĵ'   => 'j',
        'Ķ' => 'K', 'ķ'   => 'k', 'ĸ'   => 'k',
        'Ĺ' => 'L', 'ĺ'   => 'l', 'Ļ'   => 'L', 'ļ'   => 'l', 'Ľ'   => 'L', 'ľ'   => 'l', 'Ŀ'   => 'L', 'ŀ'  => 'l', 'Ł' => 'L', 'ł' => 'l',
        'Ń' => 'N', 'ń'   => 'n', 'Ņ'   => 'N', 'ņ'   => 'n', 'Ň'   => 'N', 'ň'   => 'n', 'ŉ'   => 'n', 'Ŋ'  => 'N', 'ŋ' => 'n',
        'Ō' => 'O', 'ō'   => 'o', 'Ŏ'   => 'O', 'ŏ'   => 'o', 'Ő'   => 'O', 'ő'   => 'o', 'Œ'   => 'OE', 'œ' => 'oe',
        'Ŕ' => 'R', 'ŕ'   => 'r', 'Ŗ'   => 'R', 'ŗ'   => 'r', 'Ř'   => 'R', 'ř'   => 'r',
        'Ś' => 'S', 'ś'   => 's', 'Ŝ'   => 'S', 'ŝ'   => 's', 'Ş'   => 'S', 'ş'   => 's', 'Š'   => 'S', 'š'  => 's',
        'Ţ' => 'T', 'ţ'   => 't', 'Ť'   => 'T', 'ť'   => 't', 'Ŧ'   => 'T', 'ŧ'   => 't',
        'Ũ' => 'U', 'ũ'   => 'u', 'Ū'   => 'U', 'ū'   => 'u', 'Ŭ'   => 'U', 'ŭ'   => 'u', 'Ů'   => 'U', 'ů'  => 'u', 'Ű' => 'U', 'ű' => 'u', 'Ų' => 'U', 'ų' => 'u',
        'Ŵ' => 'W', 'ŵ'   => 'w',
        'Ŷ' => 'Y', 'ŷ'   => 'y', 'Ÿ'   => 'Y',
        'Ź' => 'Z', 'ź'   => 'z', 'Ż'   => 'Z', 'ż'   => 'z', 'Ž'   => 'Z', 'ž'   => 'z',

        // Caractères cyrilliques communs
        'А' => 'A', 'Б'   => 'B', 'В'   => 'V', 'Г'   => 'G', 'Д'   => 'D', 'Е'   => 'E', 'Ё'   => 'E',
        'Ж' => 'ZH', 'З'  => 'Z', 'И'   => 'I', 'Й'   => 'Y', 'К'   => 'K', 'Л'   => 'L', 'М'   => 'M',
        'Н' => 'N', 'О'   => 'O', 'П'   => 'P', 'Р'   => 'R', 'С'   => 'S', 'Т'   => 'T', 'У'   => 'U',
        'Ф' => 'F', 'Х'   => 'H', 'Ц'   => 'C', 'Ч'   => 'CH', 'Ш'  => 'SH', 'Щ'  => 'SCH', 'Ъ' => '',
        'Ы' => 'Y', 'Ь'   => '', 'Э'    => 'E', 'Ю'   => 'YU', 'Я'  => 'YA',
        'а' => 'a', 'б'   => 'b', 'в'   => 'v', 'г'   => 'g', 'д'   => 'd', 'е'   => 'e', 'ё'   => 'e',
        'ж' => 'zh', 'з'  => 'z', 'и'   => 'i', 'й'   => 'y', 'к'   => 'k', 'л'   => 'l', 'м'   => 'm',
        'н' => 'n', 'о'   => 'o', 'п'   => 'p', 'р'   => 'r', 'с'   => 's', 'т'   => 't', 'у'   => 'u',
        'ф' => 'f', 'х'   => 'h', 'ц'   => 'c', 'ч'   => 'ch', 'ш'  => 'sh', 'щ'  => 'sch', 'ъ' => '',
        'ы' => 'y', 'ь'   => '', 'э'    => 'e', 'ю'   => 'yu', 'я'  => 'ya',

        // Caractères grecs communs
        'Α' => 'A', 'Β'   => 'B', 'Γ'   => 'G', 'Δ'   => 'D', 'Ε'   => 'E', 'Ζ'   => 'Z', 'Η'   => 'H',
        'Θ' => 'TH', 'Ι'  => 'I', 'Κ'   => 'K', 'Λ'   => 'L', 'Μ'   => 'M', 'Ν'   => 'N', 'Ξ'   => 'KS',
        'Ο' => 'O', 'Π'   => 'P', 'Ρ'   => 'R', 'Σ'   => 'S', 'Τ'   => 'T', 'Υ'   => 'Y', 'Φ'   => 'F',
        'Χ' => 'CH', 'Ψ'  => 'PS', 'Ω'  => 'O',
        'α' => 'a', 'β'   => 'b', 'γ'   => 'g', 'δ'   => 'd', 'ε'   => 'e', 'ζ'   => 'z', 'η'   => 'h',
        'θ' => 'th', 'ι'  => 'i', 'κ'   => 'k', 'λ'   => 'l', 'μ'   => 'm', 'ν'   => 'n', 'ξ'   => 'ks',
        'ο' => 'o', 'π'   => 'p', 'ρ'   => 'r', 'σ'   => 's', 'ς'   => 's', 'τ'   => 't', 'υ'   => 'y',
        'φ' => 'f', 'χ'   => 'ch', 'ψ'  => 'ps', 'ω'  => 'o',

        // Symboles et caractères spéciaux
        '€' => 'EUR', '£' => 'GBP', '¥' => 'JPY', '©' => '(c)', '®' => '(r)', '™' => '(tm)',
        '°' => 'deg', '±' => '+-', '×'  => 'x', '÷'   => '/', '½'   => '1/2', '¼' => '1/4', '¾' => '3/4',
    ];

    /**
     * Tronque une chaîne au milieu en ajoutant des points de suspension
     *
     * @param string $string Chaîne à tronquer
     * @param int $maxLength Longueur maximale
     * @return string Chaîne tronquée
     */
    public static function truncateMiddle(string $string, int $maxLength): string
    {
        if (mb_strlen($string) <= $maxLength) {
            return $string;
        }

        if ($maxLength <= 5) {
            return mb_substr($string, 0, $maxLength);
        }

        $mid   = ceil($maxLength / 2) - 2;
        $start = mb_substr($string, 0, $mid);
        $end   = mb_substr($string, -$mid);
        return $start . ' ... ' . $end;
    }

    /**
     * Supprime les accents d'une chaîne avec support Unicode étendu
     * CORRECTION 27: Fallback manuel étendu pour couvrir plus de caractères
     *
     * @param string $string Chaîne à traiter
     * @return string Chaîne sans accents
     */
    public static function stripAccents(string $string): string
    {
        // Méthode 1: Utiliser transliterator si disponible (le plus robuste)
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

        // Méthode 2: Utiliser iconv si disponible
        if (function_exists('iconv')) {
            $result = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $string);
            if ($result !== false) {
                // Nettoyer les caractères résiduels
                $result = preg_replace('/[`\'^~"]/', '', $result);
                return $result;
            }
        }

        // Méthode 3: Fallback avec table de correspondance étendue
        $result = strtr($string, self::ACCENT_MAP);

        // Méthode 4: Fallback HTML entities (pour compatibilité)
        $result = htmlentities($result, ENT_NOQUOTES, 'UTF-8');
        $result = preg_replace('#&([A-za-z])(?:acute|cedil|caron|circ|grave|orn|ring|slash|th|tilde|uml);#', '\1', $result);
        $result = preg_replace('#&([A-za-z]{2})(?:lig);#', '\1', $result);
        $result = html_entity_decode($result, ENT_NOQUOTES, 'UTF-8');

        // Méthode 5: Suppression finale des caractères non-ASCII restants
        $result = preg_replace('/[^\x20-\x7E]/', '', $result);

        return $result;
    }

    /**
     * Génère un slug à partir d'une chaîne
     *
     * @param string $string Chaîne à convertir
     * @return string Slug généré
     */
    public static function slugify(string $string): string
    {
        // Supprimer les accents
        $string = self::stripAccents($string);

        // Convertir en minuscules
        $string = mb_strtolower($string, 'UTF-8');

        // Remplacer les caractères non alphanumériques par des tirets
        $string = preg_replace('/[^a-z0-9]+/', '-', $string);

        // Supprimer les tirets en début et fin
        $string = trim($string, '-');

        return $string;
    }

    /**
     * Tronque une chaîne à la fin avec points de suspension
     *
     * @param string $string Chaîne à tronquer
     * @param int $maxLength Longueur maximale
     * @param string $suffix Suffixe à ajouter
     * @return string Chaîne tronquée
     */
    public static function truncate(string $string, int $maxLength, string $suffix = '...'): string
    {
        if (mb_strlen($string) <= $maxLength) {
            return $string;
        }

        return mb_substr($string, 0, $maxLength - mb_strlen($suffix)) . $suffix;
    }

    /**
     * Tronque une chaîne au dernier mot complet
     *
     * @param string $string Chaîne à tronquer
     * @param int $maxLength Longueur maximale
     * @param string $suffix Suffixe à ajouter
     * @return string Chaîne tronquée
     */
    public static function truncateWords(string $string, int $maxLength, string $suffix = '...'): string
    {
        if (mb_strlen($string) <= $maxLength) {
            return $string;
        }

        $truncated = mb_substr($string, 0, $maxLength - mb_strlen($suffix));
        $lastSpace = mb_strrpos($truncated, ' ');

        if ($lastSpace !== false) {
            $truncated = mb_substr($truncated, 0, $lastSpace);
        }

        return $truncated . $suffix;
    }

    /**
     * Capitalise la première lettre de chaque mot
     *
     * @param string $string Chaîne à traiter
     * @return string Chaîne avec première lettre de chaque mot en majuscule
     */
    public static function titleCase(string $string): string
    {
        return mb_convert_case($string, MB_CASE_TITLE, 'UTF-8');
    }

    /**
     * Convertit une chaîne en camelCase
     *
     * @param string $string Chaîne à convertir
     * @return string Chaîne en camelCase
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
     * Convertit une chaîne en snake_case
     *
     * @param string $string Chaîne à convertir
     * @return string Chaîne en snake_case
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
     * Vérifie si une chaîne commence par un préfixe
     *
     * @param string $haystack Chaîne à vérifier
     * @param string $needle Préfixe recherché
     * @return bool True si la chaîne commence par le préfixe
     */
    public static function startsWith(string $haystack, string $needle): bool
    {
        return strpos($haystack, $needle) === 0;
    }

    /**
     * Vérifie si une chaîne se termine par un suffixe
     *
     * @param string $haystack Chaîne à vérifier
     * @param string $needle Suffixe recherché
     * @return bool True si la chaîne se termine par le suffixe
     */
    public static function endsWith(string $haystack, string $needle): bool
    {
        return substr($haystack, -strlen($needle)) === $needle;
    }

    /**
     * Vérifie si une chaîne contient une sous-chaîne
     *
     * @param string $haystack Chaîne à vérifier
     * @param string $needle Sous-chaîne recherchée
     * @return bool True si la chaîne contient la sous-chaîne
     */
    public static function contains(string $haystack, string $needle): bool
    {
        return strpos($haystack, $needle) !== false;
    }

    /**
     * Génère une chaîne aléatoire
     *
     * @param int $length Longueur de la chaîne
     * @param string $characters Caractères autorisés
     * @return string Chaîne aléatoire générée
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
     * Échappe une chaîne pour l'HTML
     *
     * @param string $string Chaîne à échapper
     * @return string Chaîne échappée
     */
    public static function escapeHtml(string $string): string
    {
        return htmlspecialchars($string, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * Nettoie une chaîne en supprimant les balises HTML
     *
     * @param string $string Chaîne à nettoyer
     * @param string $allowedTags Balises autorisées
     * @return string Chaîne nettoyée
     */
    public static function stripTags(string $string, string $allowedTags = ''): string
    {
        return strip_tags($string, $allowedTags);
    }

    /**
     * Formate un numéro de téléphone
     *
     * @param string $phone Numéro de téléphone
     * @return string Numéro formaté
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
     * Masque une chaîne partiellement
     *
     * @param string $string Chaîne à masquer
     * @param int $start Position de début
     * @param int|null $length Longueur à masquer
     * @param string $mask Caractère de masquage
     * @return string Chaîne masquée
     */
    public static function mask(string $string, int $start = 0, int $length = null, string $mask = '*'): string
    {
        if ($length === null) {
            $length = mb_strlen($string) - $start;
        }

        return mb_substr($string, 0, $start) .
        str_repeat($mask, $length) .
        mb_substr($string, $start + $length);
    }

    /**
     * Masque une adresse email
     *
     * @param string $email Email à masquer
     * @return string Email masqué
     */
    public static function maskEmail(string $email): string
    {
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $email;
        }

        list($name, $domain) = explode('@', $email);

        $nameLength = mb_strlen($name);
        if ($nameLength <= 2) {
            $maskedName = str_repeat('*', $nameLength);
        } else {
            $maskedName = mb_substr($name, 0, 1) .
            str_repeat('*', $nameLength - 2) .
            mb_substr($name, -1);
        }

        return $maskedName . '@' . $domain;
    }

    /**
     * Convertit les retours à la ligne en balises <br>
     *
     * @param string $string Chaîne à convertir
     * @return string Chaîne avec balises <br>
     */
    public static function nl2br(string $string): string
    {
        return nl2br($string, true);
    }

    /**
     * Limite le nombre de mots dans une chaîne
     *
     * @param string $string Chaîne à traiter
     * @param int $limit Nombre maximum de mots
     * @param string $suffix Suffixe à ajouter
     * @return string Chaîne limitée
     */
    public static function limitWords(string $string, int $limit, string $suffix = '...'): string
    {
        $words = preg_split('/\s+/', $string);

        if (count($words) <= $limit) {
            return $string;
        }

        return implode(' ', array_slice($words, 0, $limit)) . $suffix;
    }

    /**
     * Pad une chaîne avec des caractères
     *
     * @param string $string Chaîne à traiter
     * @param int $length Longueur finale
     * @param string $pad Caractère de remplissage
     * @param int $type Type de padding
     * @return string Chaîne paddée
     */
    public static function pad(string $string, int $length, string $pad = ' ', int $type = STR_PAD_RIGHT): string
    {
        return str_pad($string, $length, $pad, $type);
    }

    /**
     * Remplace les espaces multiples par un seul
     *
     * @param string $string Chaîne à traiter
     * @return string Chaîne normalisée
     */
    public static function normalizeSpaces(string $string): string
    {
        return preg_replace('/\s+/', ' ', trim($string));
    }

    /**
     * Vérifie si une chaîne est un JSON valide
     *
     * @param string $string Chaîne à vérifier
     * @return bool True si JSON valide
     */
    public static function isJson(string $string): bool
    {
        json_decode($string);
        return json_last_error() === JSON_ERROR_NONE;
    }

    /**
     * Encode une chaîne en base64 URL-safe
     *
     * @param string $string Chaîne à encoder
     * @return string Chaîne encodée
     */
    public static function base64UrlEncode(string $string): string
    {
        return rtrim(strtr(base64_encode($string), '+/', '-_'), '=');
    }

    /**
     * Décode une chaîne base64 URL-safe
     *
     * @param string $string Chaîne à décoder
     * @return string Chaîne décodée
     */
    public static function base64UrlDecode(string $string): string
    {
        return base64_decode(str_pad(strtr($string, '-_', '+/'), strlen($string) % 4, '=', STR_PAD_RIGHT));
    }
}
