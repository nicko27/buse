<?php
namespace Commun\Database;

/**
 * Interface BDDManager
 *
 * Représente un gestionnaire de base de données générique,
 * indépendant du type de source (MySQL, PostgreSQL, SQLite, API, fichier, etc.).
 *
 * Cette interface permet d'abstraire l'accès aux données de configuration
 * et de rendre le système compatible avec différents backends de stockage.
 */
interface BDDManager
{
    /**
     * Récupère toutes les lignes d'une table.
     *
     * @param string $table Nom de la table à lire
     * @return array<int, array<string, mixed>> Tableau de lignes associatives
     * @throws \Exception En cas d'erreur d'accès aux données
     */
    public function getAllContentTable(string $table): array;

    /**
     * Vérifie si une table existe et est accessible.
     *
     * @param string $table Nom de la table à vérifier
     * @return bool True si la table existe et est accessible, false sinon
     */
    public function tableExists(string $table): bool;

    /**
     * Retourne la liste des tables disponibles.
     *
     * @return array<string> Liste des noms de tables
     * @throws \Exception En cas d'erreur d'accès aux métadonnées
     */
    public function getAvailableTables(): array;

    /**
     * Teste la connectivité avec la source de données.
     *
     * @return bool True si la connexion est opérationnelle, false sinon
     */
    public function testConnection(): bool;

    /**
     * Retourne des informations sur la source de données.
     *
     * @return array<string, mixed> Informations sur le backend (type, version, etc.)
     */
    public function getSourceInfo(): array;
}
