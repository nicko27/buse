<?php
namespace Commun\Utils;

class DateUtils
{
    /**
     * Convertit une date du format DD/MM/YYYY au format YYYY-MM-DD
     */
    public static function convertDate(string $date): string
    {
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $date, $matches)) {
            return sprintf('%s-%s-%s', $matches[3], $matches[2], $matches[1]);
        }
        return $date;
    }

    /**
     * Récupère les données de sélection d'heure à partir d'une heure donnée
     */
    public static function getTimeSelectionDataFromTime(string $time): array
    {
        if (! preg_match('/^(\d{1,2}):(\d{2})$/', $time, $matches)) {
            // Format invalide, utiliser l'heure actuelle
            $time                = date('H:i');
            list($hour, $minute) = explode(':', $time);
        } else {
            $hour   = $matches[1];
            $minute = $matches[2];
        }

        $hour   = (int) $hour;
        $minute = (int) $minute;

        // Arrondir les minutes au quart d'heure le plus proche
        $minute = round($minute / 15) * 15;
        if ($minute == 60) {
            $minute = 0;
            $hour++;
        }

        // Gérer le débordement d'heure
        if ($hour >= 24) {
            $hour = 0;
        }

        $hours   = [];
        $minutes = [];

        // Générer les heures
        for ($i = 0; $i < 24; $i++) {
            $hours[] = [
                'value'    => sprintf('%02d', $i),
                'selected' => ($i == $hour) ? 'selected' : '',
            ];
        }

        // Générer les minutes
        for ($i = 0; $i < 60; $i += 15) {
            $minutes[] = [
                'value'    => sprintf('%02d', $i),
                'selected' => ($i == $minute) ? 'selected' : '',
            ];
        }

        return [
            'hours'   => $hours,
            'minutes' => $minutes,
        ];
    }

    /**
     * Récupère les données de sélection d'heure actuelles
     */
    public static function getTimeSelectionData(bool $addHour = false): array
    {
        $now = new \DateTime();
        if ($addHour) {
            $now->modify('+1 hour');
        }

        return self::getTimeSelectionDataFromTime($now->format('H:i'));
    }

    /**
     * ✅ AMÉLIORATION : Parse une date avec plusieurs formats possibles
     */
    public static function parseDate(string $dateString): ?\DateTime
    {
        $formats = [
            'd-M-y H:i:s', // 14-May-25 19:00:33
            'd/m/Y H:i:s', // 14/05/2025 19:00:33
            'Y-m-d H:i:s', // 2025-05-14 19:00:33
            'd-m-Y H:i:s', // 14-05-2025 19:00:33
            'd.m.Y H:i:s', // 14.05.2025 19:00:33
            'd-M-Y H:i:s', // 14-May-2025 19:00:33
            'Y-m-d',       // 2025-05-14
            'd/m/Y',       // 14/05/2025
            'd-m-Y',       // 14-05-2025
            'd.m.Y',       // 14.05.2025
            'H:i:s',       // 19:00:33
            'H:i',         // 19:00
        ];

        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $dateString);
            if ($date !== false) {
                // Réinitialiser les erreurs pour éviter les faux positifs
                $errors = \DateTime::getLastErrors();
                if ($errors['warning_count'] == 0 && $errors['error_count'] == 0) {
                    return $date;
                }
            }
        }

        // ✅ AMÉLIORATION : Fallback avec strtotime
        $timestamp = strtotime($dateString);
        if ($timestamp !== false) {
            return new \DateTime('@' . $timestamp);
        }

        return null;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Formate une date selon différents formats
     */
    public static function formatDate(\DateTime $date, string $format = 'd/m/Y') : string
    {
        return $date->format($format);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Calcule la différence entre deux dates
     */
    public static function diffDates(\DateTime $date1, \DateTime $date2): \DateInterval
    {
        return $date1->diff($date2);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Vérifie si une date est dans une plage
     */
    public static function isDateInRange(\DateTime $date, \DateTime $start, \DateTime $end): bool
    {
        return $date >= $start && $date <= $end;
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Retourne le début et la fin d'une journée
     */
    public static function getDayBounds(\DateTime $date): array
    {
        $start = clone $date;
        $start->setTime(0, 0, 0);

        $end = clone $date;
        $end->setTime(23, 59, 59);

        return ['start' => $start, 'end' => $end];
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Convertit un timestamp en DateTime
     */
    public static function timestampToDateTime(int $timestamp): \DateTime
    {
        return new \DateTime('@' . $timestamp);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Vérifie si une année est bissextile
     */
    public static function isLeapYear(int $year): bool
    {
        return ($year % 4 == 0 && $year % 100 != 0) || ($year % 400 == 0);
    }

    /**
     * ✅ NOUVELLE MÉTHODE : Retourne le nombre de jours dans un mois
     */
    public static function getDaysInMonth(int $month, int $year): int
    {
        return cal_days_in_month(CAL_GREGORIAN, $month, $year);
    }
}
