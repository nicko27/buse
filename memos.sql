-- phpMyAdmin SQL Dump
-- version 5.1.1deb5ubuntu1
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost:3306
-- Généré le : ven. 10 jan. 2025 à 15:45
-- Version du serveur : 8.0.40-0ubuntu0.22.04.1
-- Version de PHP : 8.1.2-1ubuntu2.20

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `nsu`
--

-- --------------------------------------------------------

--
-- Structure de la table `memos`
--

DROP TABLE IF EXISTS `memos`;
CREATE TABLE `memos` (
  `id` bigint NOT NULL,
  `permanent` tinyint NOT NULL,
  `memo` tinytext NOT NULL,
  `alarm` tinyint NOT NULL,
  `alarmTriggered` tinyint NOT NULL,
  `date_debut` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `debut` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `date_fin` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `fin` varchar(8) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `invisible` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Déchargement des données de la table `memos`
--

INSERT INTO `memos` (`id`, `permanent`, `memo`, `alarm`, `alarmTriggered`, `date_debut`, `debut`, `date_fin`, `fin`, `invisible`) VALUES
(4729, 0, 'update', 0, 0, '2024-06-26', '08:00', '2024-07-25', '12:00', 1),
(4730, 0, 'jjljlkjkljkl', 0, 0, '2024-07-03', '09:30', '2024-07-02', '10:30', 0),
(4731, 0, 'TOTO', 0, 0, '2024-07-03', '09:45', '2024-07-02', '10:45', 0),
(4732, 0, 'totodsqsdqdsq', 0, 0, '2024-07-02', '09:45', '2024-07-02', '10:45', 0),
(4733, 0, 'dsqsqsdqsqdsqdsdq', 0, 0, '2024-07-02', '10:00', '2024-07-02', '11:00', 0),
(4734, 1, 'Mémo permanent ne fonctionne pas \r\n', 0, 0, '2024-07-02', '12:00', '2024-07-02', '13:00', 1),
(4735, 0, 'Les mémos avec une date et une heure fonctionne', 0, 0, '2024-07-02', '12:00', '2024-07-02', '13:00', 0),
(4736, 0, 'TEXTE DU MEMO', 0, 0, '2025-01-10', '15:30', '2025-03-29', '15:30', 0),
(4737, 0, 'TEXTE DU MEMO', 0, 0, '2025-01-10', '15:30', '2025-03-29', '15:30', 0),
(4738, 0, 'TEXTE', 0, 0, '2025-01-10', '15:30', '2025-01-24', '15:30', 0),
(4739, 0, 'TOTO', 0, 0, '2025-01-10', '15:30', '2025-01-21', '15:30', 0),
(4740, 0, 'TOTO', 0, 0, '2025-01-10', '15:30', '2025-01-21', '15:30', 0),
(4741, 0, 'sqsdsqqsd', 0, 0, '2025-01-10', '15:30', '2025-01-17', '15:30', 0),
(4742, 0, 'test', 0, 0, '2025-01-10', '15:30', '2025-01-10', '15:30', 0),
(4743, 0, 'TITI', 0, 0, '2025-01-10', '15:30', '2025-01-10', '15:30', 0),
(4744, 0, 'ssqdsqd', 0, 0, '2025-01-10', '15:30', '2025-01-10', '15:30', 0),
(4745, 0, 'sqddsqsdqqsd', 0, 0, '2025-01-10', '15:30', '2025-01-24', '15:30', 0),
(4746, 0, 'qsdsdqdqssdqqs', 0, 0, '2025-01-10', '15:30', '2025-01-23', '15:30', 0);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `memos`
--
ALTER TABLE `memos`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `memos`
--
ALTER TABLE `memos`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4747;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
