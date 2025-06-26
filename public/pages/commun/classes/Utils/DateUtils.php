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
        list($hour, $minute) = explode(':', $time);
        $hour                = (int) $hour;
        $minute              = (int) $minute;

        // Arrondir les minutes au quart d'heure le plus proche
        $minute = round($minute / 15) * 15;
        if ($minute == 60) {
            $minute = 0;
            $hour++;
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

    public static function parseDate(string $dateString): ?\DateTime
    {
        $formats = [
            'd-M-y H:i:s', // 14-May-25 19:00:33
            'd/m/Y H:i:s', // 14/05/2025 19:00:33
            'Y-m-d H:i:s', // 2025-05-14 19:00:33
            'd-m-Y H:i:s', // 14-05-2025 19:00:33
            'd.m.Y H:i:s', // 14.05.2025 19:00:33
            'd-M-Y H:i:s', // 14-May-2025 19:00:33
                           // Ajouter d'autres formats au besoin
        ];

        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $dateString);
            if ($date !== false) {
                return $date;
            }
        }

        return null;
    }

}
