<?php

namespace Commun\Utils;

class StringUtils
{
    /**
     * Tronque une chaîne au milieu en ajoutant des points de suspension
     */
    public static function truncateMiddle(string $string, int $maxLength): string
    {
        if (strlen($string) > $maxLength) {
            $mid   = ceil($maxLength / 2) - 2;
            $start = substr($string, 0, $mid);
            $end   = substr($string, -$mid);
            return $start . ' ... ' . $end;
        }
        return $string;
    }

    /**
     * Supprime les accents d'une chaîne
     */
    public static function stripAccents(string $string): string
    {
        $string = htmlentities($string, ENT_NOQUOTES, 'utf-8');
        $string = preg_replace('#&([A-za-z])(?:acute|cedil|caron|circ|grave|orn|ring|slash|th|tilde|uml);#', '\1', $string);
        $string = preg_replace('#&([A-za-z]{2})(?:lig);#', '\1', $string);
        $string = html_entity_decode($string);
        return $string;
    }
}
