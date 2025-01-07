<?php

function convertToMinutes($time)
{
    list($hours, $minutes) = sscanf($time, '%dh%d');
    return $hours * 60 + $minutes;
}

function isCurrentTimeInRange($time, $startTime, $endTime)
{
    // Obtenir l'heure actuelle
    $hour   = $time->format('H');
    $minute = $time->format('i');

    // Convertir l'heure actuelle en minutes depuis minuit
    $minutes = $hour * 60 + $minute;

    // Convertir les heures de début et de fin en minutes depuis minuit
    $start_minutes = convertToMinutes($startTime);
    $end_minutes   = convertToMinutes($endTime);

    // Vérifier si l'heure actuelle est comprise entre les heures de début et de fin
    if ($end_minutes < $start_minutes) {
        // La plage horaire traverse minuit
        return $minutes >= $start_minutes || $minutes < $end_minutes;
    } else {
        // La plage horaire ne traverse pas minuit
        return $minutes >= $start_minutes && $minutes < $end_minutes;
    }
}
