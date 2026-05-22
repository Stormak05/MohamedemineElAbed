<?php
require_once CHEMIN_ACCESSEUR . "BaseDeDonnees.php";

class MembreDAO
{
    public static function trouverMembre($membre)
    {
        $SQL_AUTHENTIFICATION = "SELECT * FROM membre WHERE pseudonyme = :pseudonyme";
        $requeteAuthentification = BaseDeDonnees::getConnexion()->prepare($SQL_AUTHENTIFICATION);
        $requeteAuthentification->bindParam(':pseudonyme', $membre['pseudonyme'], PDO::PARAM_STR);
        $requeteAuthentification->execute();
        $membreTrouve = $requeteAuthentification->fetch();

            return $membreTrouve;
        
    }

    public static function enregistrerMembre($membre) {

        $AJOUTER_MEMBRE ="INSERT into membre(prenom, nom, pseudonyme, motdepasse, courriel, avatar) VALUE (:prenom, :nom, :pseudonyme, :motdepasse, :courriel, :avatar)";
        $requeteAjouterMembre = BaseDeDonnees::getConnexion()->prepare($AJOUTER_MEMBRE);
        $requeteAjouterMembre->bindParam(':prenom', $membre['prenom'], PDO::PARAM_STR);
        $requeteAjouterMembre->bindParam(':nom', $membre['nom'], PDO::PARAM_STR);
        $requeteAjouterMembre->bindParam(':pseudonyme', $membre['pseudonyme'], PDO::PARAM_STR);
        $requeteAjouterMembre->bindParam(':courriel', $membre['courriel'], PDO::PARAM_STR);
        $requeteAjouterMembre->bindParam(':motdepasse', $membre['motdepasse'], PDO::PARAM_STR);
        $requeteAjouterMembre->bindParam(':avatar', $membre['avatar'], PDO::PARAM_STR);

        $reussiteInscription = $requeteAjouterMembre->execute();

        return $reussiteInscription;

    }

    public static function trouverCourriel($membre) {

        $TROUVER_COURRIEL = "SELECT id_membre FROM membre WHERE courriel = :courriel";
        $requete = BaseDeDonnees::getConnexion()->prepare($TROUVER_COURRIEL);
        $requete->bindParam(':courriel', $membre, PDO::PARAM_STR);
        $requete->execute();
        $membre = $requete->fetch();

        return $membre;
    }
}
?>