-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : jeu. 23 mai 2024 à 23:12
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `sport`
--
CREATE DATABASE IF NOT EXISTS `sport` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `sport`;

-- --------------------------------------------------------

--
-- Structure de la table `clic`
--

CREATE TABLE `clic` (
  `id_clic` int(11) NOT NULL,
  `ip` varchar(255) NOT NULL,
  `page` varchar(255) NOT NULL,
  `parametres` varchar(255) NOT NULL,
  `reference` varchar(255) DEFAULT NULL,
  `langue` varchar(255) NOT NULL,
  `moment` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `clic`
--

INSERT INTO `clic` (`id_clic`, `ip`, `page`, `parametres`, `reference`, `langue`, `moment`) VALUES
(1, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:48:40'),
(2, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:49:58'),
(3, '::1', '/php/test/MonSite/pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:50:00'),
(4, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:50:03'),
(5, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:51:14'),
(6, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:52:13'),
(7, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:16'),
(8, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:18'),
(9, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:22'),
(10, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:22'),
(11, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:23'),
(12, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:33'),
(13, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:33'),
(14, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:34'),
(15, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:34'),
(16, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:52'),
(17, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:53:52'),
(18, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:55:33'),
(19, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:56:07'),
(20, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 08:59:25'),
(21, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:02:14'),
(22, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:02:46'),
(23, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:08:54'),
(24, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:08:56'),
(25, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:08:58'),
(26, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:08:58'),
(27, '::1', '/php/test/MonSite/pilote.php', 'toto=2', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:09:00'),
(28, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:09:00'),
(29, '::1', '/php/test/MonSite/pilote.php', 'toto=3', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:09:01'),
(30, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:09:02'),
(31, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:09:04'),
(32, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:12:21'),
(33, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:12:57'),
(34, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:13:02'),
(35, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:15:43'),
(36, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:15:43'),
(37, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:15:43'),
(38, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:15:43'),
(39, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:16:42'),
(40, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:16:42'),
(41, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:16:53'),
(42, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:16:54'),
(43, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:17:08'),
(44, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:17:08'),
(45, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:17:09'),
(46, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:17:14'),
(47, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:17:15'),
(48, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:17:15'),
(49, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:17:15'),
(50, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:22:56'),
(51, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:22:57'),
(52, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:24:16'),
(53, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:24:17'),
(54, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:24:18'),
(55, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:24:18'),
(56, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:24:23'),
(57, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:24:23'),
(58, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:25:54'),
(59, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:25:54'),
(60, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:26:51'),
(61, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:27:34'),
(62, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:30:05'),
(63, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:30:06'),
(64, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:30:07'),
(65, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:30:08'),
(66, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:30:26'),
(67, '::1', '/php/test/MonSite/pilote.php', 'toto=1', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:30:27'),
(68, '::1', '/php/test/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/test/MonSite/liste-pilote.php', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-01 09:30:27'),
(69, '::1', '/php/test/MonSite/pilote.php', '', 'http://localhost:8080/php/test/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-03 08:13:54'),
(70, '::1', '/php/TP_ME/MonSite/pilote.php', '', 'http://localhost:8080/php/TP_ME/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-23 17:09:27'),
(71, '::1', '/php/TP_ME/MonSite/liste-pilote.php', '', 'http://localhost:8080/php/TP_ME/MonSite/', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', '2024-05-23 17:09:44');

-- --------------------------------------------------------

--
-- Structure de la table `formule1`
--

CREATE TABLE `formule1` (
  `id_pilote` int(10) NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `nom` varchar(60) DEFAULT NULL,
  `age` varchar(2) DEFAULT NULL,
  `numero` varchar(5) DEFAULT NULL,
  `ecurie` varchar(255) DEFAULT NULL,
  `equipier` varchar(60) DEFAULT NULL,
  `champion` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `formule1`
--

INSERT INTO `formule1` (`id_pilote`, `image`, `nom`, `age`, `numero`, `ecurie`, `equipier`, `champion`, `description`) VALUES
(1, 'lewis_hamilton.avif', 'Lewis Hamilton', '39', '44', 'Mercedes f1 team', 'George Russell', '7', 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Deserunt nesciunt doloremque beatae eos, eius quibusdam inventore dicta iste doloribus est sunt ipsa odit quos error, expedita id harum quia. Soluta distinctio veritatis omnis esse voluptates eveniet dolore minus quaerat quidem officia veniam deleniti, beatae et corporis neque a blanditiis sunt alias sint delectus recusandae similique impedit ex odit! Doloremque consectetur sapiente odit? Illum, autem tenetur. Asperiores, deleniti esse! Dolore quia dolorum laboriosam veritatis, rerum eaque, illo eos recusandae tempore, sapiente illum facere quaerat eveniet perspiciatis impedit nemo earum! Saepe eius itaque dolor voluptates distinctio voluptatibus debitis fugit repellat adipisci delectus?\r\n'),
(2, 'charles_leclerc.avif', 'Charles Leclerc', '26', '16', 'Scuderia Ferrari', 'Carlos Sainz', '0', 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Deserunt nesciunt doloremque beatae eos, eius quibusdam inventore dicta iste doloribus est sunt ipsa odit quos error, expedita id harum quia. Soluta distinctio veritatis omnis esse voluptates eveniet dolore minus quaerat quidem officia veniam deleniti, beatae et corporis neque a blanditiis sunt alias sint delectus recusandae similique impedit ex odit! Doloremque consectetur sapiente odit? Illum, autem tenetur. Asperiores, deleniti esse! Dolore quia dolorum laboriosam veritatis, rerum eaque, illo eos recusandae tempore, sapiente illum facere quaerat eveniet perspiciatis impedit nemo earum! Saepe eius itaque dolor voluptates distinctio voluptatibus debitis fugit repellat adipisci delectus?\r\n'),
(3, 'max_verstappen.avif', 'Max Verstappen', '26', '1', 'Red Bull f1 team', 'Sergio Perez', '3', 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Deserunt nesciunt doloremque beatae eos, eius quibusdam inventore dicta iste doloribus est sunt ipsa odit quos error, expedita id harum quia. Soluta distinctio veritatis omnis esse voluptates eveniet dolore minus quaerat quidem officia veniam deleniti, beatae et corporis neque a blanditiis sunt alias sint delectus recusandae similique impedit ex odit! Doloremque consectetur sapiente odit? Illum, autem tenetur. Asperiores, deleniti esse! Dolore quia dolorum laboriosam veritatis, rerum eaque, illo eos recusandae tempore, sapiente illum facere quaerat eveniet perspiciatis impedit nemo earum! Saepe eius itaque dolor voluptates distinctio voluptatibus debitis fugit repellat adipisci delectus?\r\n'),
(4, 'pierre_gasly.avif', 'Pierre Gasly', '28', '10', 'Alpine f1 team', 'Esteban Ocon', '0', 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Deserunt nesciunt doloremque beatae eos, eius quibusdam inventore dicta iste doloribus est sunt ipsa odit quos error, expedita id harum quia. Soluta distinctio veritatis omnis esse voluptates eveniet dolore minus quaerat quidem officia veniam deleniti, beatae et corporis neque a blanditiis sunt alias sint delectus recusandae similique impedit ex odit! Doloremque consectetur sapiente odit? Illum, autem tenetur. Asperiores, deleniti esse! Dolore quia dolorum laboriosam veritatis, rerum eaque, illo eos recusandae tempore, sapiente illum facere quaerat eveniet perspiciatis impedit nemo earum! Saepe eius itaque dolor voluptates distinctio voluptatibus debitis fugit repellat adipisci delectus?\r\n'),
(5, 'lando_norris.avif', 'Lando Norris', '24', '4', 'McLaren f1 team', 'Oscar Piastri', '0', 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Deserunt nesciunt doloremque beatae eos, eius quibusdam inventore dicta iste doloribus est sunt ipsa odit quos error, expedita id harum quia. Soluta distinctio veritatis omnis esse voluptates eveniet dolore minus quaerat quidem officia veniam deleniti, beatae et corporis neque a blanditiis sunt alias sint delectus recusandae similique impedit ex odit! Doloremque consectetur sapiente odit? Illum, autem tenetur. Asperiores, deleniti esse! Dolore quia dolorum laboriosam veritatis, rerum eaque, illo eos recusandae tempore, sapiente illum facere quaerat eveniet perspiciatis impedit nemo earum! Saepe eius itaque dolor voluptates distinctio voluptatibus debitis fugit repellat adipisci delectus?\r\n');

-- --------------------------------------------------------

--
-- Structure de la table `membre`
--

CREATE TABLE `membre` (
  `id_membre` int(11) NOT NULL,
  `pseudonyme` varchar(255) NOT NULL,
  `motdepasse` varchar(255) NOT NULL,
  `courriel` varchar(255) NOT NULL,
  `prenom` varchar(255) NOT NULL,
  `nom` varchar(255) NOT NULL,
  `avatar` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `membre`
--

INSERT INTO `membre` (`id_membre`, `pseudonyme`, `motdepasse`, `courriel`, `prenom`, `nom`, `avatar`) VALUES
(1, 'Stormak', '$2y$10$kRD7txmF7mO2mjl4vfCQK.45BIFKT9EzGb6rHuy8aawlneTjigoFC', 'mohamedelabed69@hotmail.com', 'Mohamed', 'el abed', 'avatar1.png'),
(2, 'Auri', '$2y$10$d1SbJj96Vgz7MLzBsCXYnuFR4v2GauLafFGAmkGhX8.LyRe5fRsuq', 'mohamedelabed69@hotmail.com', 'Auiane', 'L', '');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `clic`
--
ALTER TABLE `clic`
  ADD PRIMARY KEY (`id_clic`);

--
-- Index pour la table `formule1`
--
ALTER TABLE `formule1`
  ADD PRIMARY KEY (`id_pilote`);

--
-- Index pour la table `membre`
--
ALTER TABLE `membre`
  ADD PRIMARY KEY (`id_membre`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `clic`
--
ALTER TABLE `clic`
  MODIFY `id_clic` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=72;

--
-- AUTO_INCREMENT pour la table `formule1`
--
ALTER TABLE `formule1`
  MODIFY `id_pilote` int(10) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT pour la table `membre`
--
ALTER TABLE `membre`
  MODIFY `id_membre` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
