<?php

require_once CHEMIN_ACCESSEUR ."BaseDeDonnees.php";

class PiloteDAO
{
    public static function listerPilotes()
    {
        $MESSAGE_SQL_LISTE_PILOTE = "SELECT `id_pilote`, `image`, `nom`, `numero`, `ecurie`, `equipier`, `age` FROM `formule1`";
        $requeteListePilote = BaseDeDonnees::getConnexion()->prepare($MESSAGE_SQL_LISTE_PILOTE);
        $requeteListePilote->execute();
        $listePilote = $requeteListePilote->fetchAll();

        return $listePilote;
    }

    public static function lirePilote($id_pilote)
    {
        $id_pilote = filter_var($_GET['toto'], FILTER_SANITIZE_NUMBER_INT);
        $MESSAGE_SQL_PILOTE = "SELECT * FROM formule1 WHERE id_pilote = " . $id_pilote;

        $requeteListePilote = BaseDeDonnees::getConnexion()->prepare($MESSAGE_SQL_PILOTE);
        $requeteListePilote->bindParam(':id_pilote', $id_pilote, PDO::PARAM_INT);
        $requeteListePilote->execute();
        $formule1 = $requeteListePilote->fetch();

        return $formule1;
    }

    public static function ajouterPilote($pilote)
    {
        $SQL_AJOUTER_PILOTE = 'INSERT INTO `formule1`(`nom`, `age`, `numero`, `ecurie`, `equipier`, `champion`, `description`) VALUES (:$nom ,:$age ,:$numero,:$ecurie,:$equipier,:$champion,:$description)';

        $requeteAjouterPilote = BaseDeDonnees::getConnexion()->prepare($SQL_AJOUTER_PILOTE);

        $requeteAjouterPilote->bindParam(':nom', $pilote['nom'] ,PDO::PARAM_STR);
        $requeteAjouterPilote->bindParam(':age', $pilote['age'] ,PDO::PARAM_STR);
        $requeteAjouterPilote->bindParam(':numero', $pilote['numero'] ,PDO::PARAM_STR);
        $requeteAjouterPilote->bindParam(':ecurie', $pilote['ecurie'] ,PDO::PARAM_STR);
        $requeteAjouterPilote->bindParam(':equipier', $pilote['equipier'] ,PDO::PARAM_STR);
        $requeteAjouterPilote->bindParam(':champion', $pilote['champion'] ,PDO::PARAM_STR);
        $requeteAjouterPilote->bindParam(':description', $pilote['description'] ,PDO::PARAM_STR);
        $requeteAjouterPilote->bindParam(':image', $image, PDO::PARAM_STR);
        $reussiteAjout = $requeteAjouterPilote->execute();

        return $pilote;
    }

    public static function listerCategorie()
    {
        $MESSAGE_LISTER_CATEGORIE = "SELECT categorie, nom, numero, COUNT(*) as nombre, AVG(champion) as moychampion, SUM(champion) as totalchampion, MAX(champion) as maxchampion, MIN(champion) as minchampion FROM formule1 GROUP BY categorie";
        $requeteCategorie = BaseDeDonnees::getConnexion()->prepare($MESSAGE_LISTER_CATEGORIE);
        $requeteCategorie->execute();
        $statsCategorie = $requeteCategorie->fetchAll();

        return $statsCategorie;
    }

    public static function afficherImageAleatoire()
    {
        $MESSAGE_IMAGE_ALEATOIRE = "SELECT nom, image, numero, champion, AVG(champion) AS moyenne, STDDEV(champion) AS ecart_type FROM formule1;";
        $requeteImageAleatoire = BaseDeDonnees::getConnexion()->prepare($MESSAGE_IMAGE_ALEATOIRE);
        $requeteImageAleatoire->execute();
        $imageAleatoire = $requeteImageAleatoire->fetch();

        return $imageAleatoire;
    }

    public static function listeParCategorie()
    {
        $MESSAGE_LISTE_CATEGORIE = "SELECT categorie FROM formule1 WHERE 1 = 1";
        $requeteStats = BaseDeDonnees::getConnexion()->prepare($MESSAGE_LISTE_CATEGORIE);
        $requeteStats->execute();
        $listeParCategorie = $requeteStats->fetchAll();

        return $listeParCategorie;
    }

    public static function listeParChampion()
    {
        $MESSAGE_LISTE_CATEGORIE = "SELECT champion FROM formule1 WHERE 1 = 1";
        $requeteStats = BaseDeDonnees::getConnexion()->prepare($MESSAGE_LISTE_CATEGORIE);
        $requeteStats->execute();
        $listeParChampion = $requeteStats->fetchAll();

        return $listeParChampion;
    }

    public static function listeParNumero()
    {
        $MESSAGE_LISTE_CATEGORIE = "SELECT numero FROM formule1 WHERE 1 = 1";
        $requeteStats = BaseDeDonnees::getConnexion()->prepare($MESSAGE_LISTE_CATEGORIE);
        $requeteStats->execute();
        $listeParNumero = $requeteStats->fetchAll();

        return $listeParNumero;
    }
}

?>