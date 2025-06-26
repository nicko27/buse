-- phpMyAdmin SQL Dump
-- version 5.1.1deb5ubuntu1
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost:3306
-- Généré le : jeu. 26 juin 2025 à 15:41
-- Version du serveur : 8.0.42-0ubuntu0.22.04.1
-- Version de PHP : 8.1.2-1ubuntu2.21

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `buse`
--

-- --------------------------------------------------------

--
-- Structure de la table `categories`
--

CREATE TABLE `categories` (
  `id` mediumint NOT NULL,
  `niveau` tinyint NOT NULL DEFAULT '0',
  `categorie` varchar(255) NOT NULL,
  `nature` text NOT NULL,
  `send` tinyint NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `cities`
--

CREATE TABLE `cities` (
  `id` int NOT NULL,
  `insee` mediumint NOT NULL,
  `code_postal` mediumint NOT NULL,
  `name` tinytext NOT NULL,
  `old_name` tinytext NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `compagnies`
--

CREATE TABLE `compagnies` (
  `id` bigint NOT NULL,
  `color` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `cu` smallint NOT NULL,
  `ordre` tinyint NOT NULL,
  `autoHide` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Structure de la table `configuration`
--

CREATE TABLE `configuration` (
  `id` int UNSIGNED NOT NULL,
  `var` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `configuration_type_id` tinyint DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `twig` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `configuration_types`
--

CREATE TABLE `configuration_types` (
  `id` int UNSIGNED NOT NULL,
  `code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `validation_regex` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cast_php` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `twig_support` tinyint(1) NOT NULL DEFAULT '1',
  `exemple` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `evenements`
--

CREATE TABLE `evenements` (
  `id` int NOT NULL,
  `date` date NOT NULL,
  `heure` time NOT NULL,
  `categorie_id` smallint NOT NULL,
  `commune_id` mediumint NOT NULL,
  `unite_engagee` tinytext NOT NULL,
  `premiers_elt` text NOT NULL,
  `cro` text NOT NULL,
  `hash` tinytext NOT NULL,
  `sent` tinyint NOT NULL,
  `need_to_send` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `mairies`
--

CREATE TABLE `mairies` (
  `id` int UNSIGNED NOT NULL,
  `maire` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `mail` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `unit_id` int NOT NULL,
  `insee` mediumint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `memos`
--

CREATE TABLE `memos` (
  `id` bigint NOT NULL,
  `permanent` tinyint NOT NULL,
  `memo` tinytext NOT NULL,
  `alarm` tinyint NOT NULL,
  `alarmTriggered` tinyint NOT NULL,
  `date_debut` date NOT NULL,
  `debut` time NOT NULL,
  `date_fin` date NOT NULL,
  `fin` time NOT NULL,
  `invisible` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Structure de la table `pages`
--

CREATE TABLE `pages` (
  `id` int NOT NULL,
  `slug` varchar(100) NOT NULL,
  `description` text,
  `active` tinyint(1) DEFAULT '1',
  `requires_auth` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `page_assets`
--

CREATE TABLE `page_assets` (
  `id` int NOT NULL,
  `page_id` int NOT NULL,
  `zone` varchar(50) DEFAULT NULL,
  `file_path` varchar(200) NOT NULL,
  `file_type` enum('css','js') NOT NULL,
  `priority` int DEFAULT '0',
  `attributes` json DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `page_templates`
--

CREATE TABLE `page_templates` (
  `id` int NOT NULL,
  `page_id` int NOT NULL,
  `zone` varchar(50) NOT NULL,
  `template_file` varchar(200) NOT NULL,
  `priority` int DEFAULT '0',
  `enabled` tinyint(1) DEFAULT '1',
  `context_data` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `permanences`
--

CREATE TABLE `permanences` (
  `id` int NOT NULL,
  `poste` tinytext NOT NULL,
  `nom` tinytext NOT NULL,
  `tph` tinytext NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `rights`
--

CREATE TABLE `rights` (
  `id` mediumint NOT NULL,
  `u_ou_g` tinyint NOT NULL,
  `name` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `timeline` tinyint NOT NULL,
  `permanences` tinyint NOT NULL,
  `import` tinyint NOT NULL,
  `view_synthesis` tinyint NOT NULL,
  `admin` tinyint NOT NULL,
  `super_admin` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `services`
--

CREATE TABLE `services` (
  `id` int NOT NULL,
  `name` tinytext NOT NULL,
  `shortName` tinytext NOT NULL,
  `color` varchar(7) NOT NULL,
  `invisible` tinyint NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `services_unites`
--

CREATE TABLE `services_unites` (
  `id` int NOT NULL,
  `nom` tinytext NOT NULL,
  `tph` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `cu` int NOT NULL,
  `cu_cob` int NOT NULL,
  `debut` varchar(5) NOT NULL,
  `fin` varchar(5) NOT NULL,
  `date_debut` date NOT NULL,
  `date_fin` date NOT NULL,
  `users` text NOT NULL,
  `rubis` varchar(7) NOT NULL,
  `serviceId` smallint NOT NULL,
  `color` varchar(7) NOT NULL,
  `memo` tinytext NOT NULL,
  `invisible` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `sites`
--

CREATE TABLE `sites` (
  `id` int NOT NULL,
  `nom` tinytext NOT NULL,
  `url` tinytext NOT NULL,
  `color` varchar(7) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `tph_pam`
--

CREATE TABLE `tph_pam` (
  `id` int NOT NULL,
  `nom` tinytext CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `tph` tinytext CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `cu` int NOT NULL,
  `date` date NOT NULL,
  `matin` tinyint(1) NOT NULL,
  `aprem` tinyint(1) NOT NULL,
  `nuit` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Structure de la table `unites_ldap`
--

CREATE TABLE `unites_ldap` (
  `id` mediumint NOT NULL,
  `cu` mediumint NOT NULL,
  `codeServiceRio` mediumint NOT NULL,
  `name` varchar(255) NOT NULL,
  `newName` tinytext NOT NULL,
  `label` varchar(255) NOT NULL,
  `tph` tinytext NOT NULL,
  `address` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `parentCu` mediumint NOT NULL,
  `isCie` tinyint NOT NULL,
  `cuCie` tinytext NOT NULL,
  `isCob` mediumint NOT NULL,
  `cuCob` mediumint NOT NULL,
  `code_postal` mediumint NOT NULL,
  `mail` tinytext NOT NULL,
  `invisible` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `unites_manuelles`
--

CREATE TABLE `unites_manuelles` (
  `id` int NOT NULL,
  `name` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `cu` mediumint NOT NULL,
  `cieCu` mediumint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `unite_type_unite`
--

CREATE TABLE `unite_type_unite` (
  `id` int NOT NULL,
  `abrege` varchar(100) NOT NULL,
  `abreviation` varchar(10) NOT NULL,
  `label` varchar(255) NOT NULL,
  `sir_categorie_unite_id` int NOT NULL,
  `actif` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `cities`
--
ALTER TABLE `cities`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `compagnies`
--
ALTER TABLE `compagnies`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `configuration`
--
ALTER TABLE `configuration`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `key_UNIQUE` (`var`),
  ADD UNIQUE KEY `unique_var` (`var`);

--
-- Index pour la table `configuration_types`
--
ALTER TABLE `configuration_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Index pour la table `evenements`
--
ALTER TABLE `evenements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_evenements_categorie` (`categorie_id`),
  ADD KEY `idx_evenements_commune` (`commune_id`);

--
-- Index pour la table `mairies`
--
ALTER TABLE `mairies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_mairies_insee` (`insee`),
  ADD KEY `idx_mairies_unit_id` (`unit_id`);

--
-- Index pour la table `memos`
--
ALTER TABLE `memos`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `pages`
--
ALTER TABLE `pages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `idx_pages_slug` (`slug`),
  ADD KEY `idx_pages_active` (`active`);

--
-- Index pour la table `page_assets`
--
ALTER TABLE `page_assets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_page_assets_page_id` (`page_id`),
  ADD KEY `idx_page_assets_zone` (`zone`),
  ADD KEY `idx_page_assets_type` (`file_type`),
  ADD KEY `idx_page_assets_priority` (`page_id`,`zone`,`priority`);

--
-- Index pour la table `page_templates`
--
ALTER TABLE `page_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_page_templates_page_id` (`page_id`),
  ADD KEY `idx_page_templates_zone` (`zone`),
  ADD KEY `idx_page_templates_priority` (`page_id`,`zone`,`priority`);

--
-- Index pour la table `permanences`
--
ALTER TABLE `permanences`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `rights`
--
ALTER TABLE `rights`
  ADD UNIQUE KEY `id` (`id`);

--
-- Index pour la table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `services_unites`
--
ALTER TABLE `services_unites`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_services_unites_serviceId` (`serviceId`);

--
-- Index pour la table `sites`
--
ALTER TABLE `sites`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `tph_pam`
--
ALTER TABLE `tph_pam`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `unites_ldap`
--
ALTER TABLE `unites_ldap`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_unites_ldap_cu` (`cu`);

--
-- Index pour la table `unites_manuelles`
--
ALTER TABLE `unites_manuelles`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `unite_type_unite`
--
ALTER TABLE `unite_type_unite`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` mediumint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `cities`
--
ALTER TABLE `cities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `compagnies`
--
ALTER TABLE `compagnies`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `configuration`
--
ALTER TABLE `configuration`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `configuration_types`
--
ALTER TABLE `configuration_types`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `evenements`
--
ALTER TABLE `evenements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `mairies`
--
ALTER TABLE `mairies`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `memos`
--
ALTER TABLE `memos`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `pages`
--
ALTER TABLE `pages`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `page_assets`
--
ALTER TABLE `page_assets`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `page_templates`
--
ALTER TABLE `page_templates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `permanences`
--
ALTER TABLE `permanences`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `services`
--
ALTER TABLE `services`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `services_unites`
--
ALTER TABLE `services_unites`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `sites`
--
ALTER TABLE `sites`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `tph_pam`
--
ALTER TABLE `tph_pam`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `unites_ldap`
--
ALTER TABLE `unites_ldap`
  MODIFY `id` mediumint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `unites_manuelles`
--
ALTER TABLE `unites_manuelles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `unite_type_unite`
--
ALTER TABLE `unite_type_unite`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `page_assets`
--
ALTER TABLE `page_assets`
  ADD CONSTRAINT `page_assets_ibfk_1` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `page_templates`
--
ALTER TABLE `page_templates`
  ADD CONSTRAINT `page_templates_ibfk_1` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
