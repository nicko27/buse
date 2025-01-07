<?php

namespace Commun\Utils;

class TphUtils
{
    /**
     * Formate un numéro de téléphone avec des zéros
     */
    public static function formatPhoneWithZeros(string $input): string
    {
        // Supprimer tous les caractères non numériques
        $number = preg_replace('/[^0-9]/', '', $input);

        // Si le numéro est vide, retourner une chaîne vide
        if (empty($number)) {
            return '';
        }

        // Si le numéro commence par 33, le supprimer
        if (substr($number, 0, 2) === '33') {
            $number = substr($number, 2);
        }

        // Formater le numéro avec des points
        return implode(' ', str_split($number, 2));
    }

    /**
     * Formate un numéro avec un préfixe et des zéros
     */
    public static function formatNumber($number, int $desiredLength, string $prefix = "3"): string
    {
        // Supprimer les espaces et convertir en chaîne
        $cleanNumber = trim((string) $number);

        // Supprimer le préfixe s'il existe déjà
        if (substr($cleanNumber, 0, strlen($prefix)) === $prefix) {
            $cleanNumber = substr($cleanNumber, strlen($prefix));
        }

        // Calculer le nombre de zéros à ajouter
        $zerosToAdd = $desiredLength - strlen($cleanNumber) - strlen($prefix);

        if ($zerosToAdd > 0) {
            return $prefix . str_repeat('0', $zerosToAdd) . $cleanNumber;
        }

        return $prefix . $cleanNumber;
    }

    public static function formatNumberWith33(string $input): string
    {
        // Supprimer tous les points pour obtenir un numéro continu
        $number = str_replace('.', '', $input);

        // Si le numéro est vide, retourner une chaîne vide
        if (empty($number)) {
            return '';
        }

        // Ajouter le préfixe +33 au numéro sans le premier zéro
        $number = '+33 ' . substr($number, 1);

        // Ajouter des espaces tous les deux chiffres après l'indicatif
        $formattedNumber = $number[0] . $number[1] . $number[2] . substr(chunk_split(substr($number, 3), 2, ' '), 0, -1);

        return $formattedNumber;
    }
}
