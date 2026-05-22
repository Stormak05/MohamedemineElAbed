<?php
require "../configuration.php";
include "../traitement-image.php";
require CHEMIN_ACCESSEUR. "MembreDAO.php";

if(isset($_POST['imageok'])) {

    if(empty($_POST['pseudonyme']) || !preg_match('/^[A-Za-z0-9]+([A-Za-z0-9]*|[._-]?[A-Za-z0-9]+)*$/', $_POST['pseudonyme'])) {
        $_SESSION['erreurInformation'] = "Veuillez renseigner le pseudonyme correctement";
        header('Location: inscription-information');
    } else if (!empty(MembreDAO::trouverMembre(array('pseudonyme' => $_POST['pseudonyme'])))) {
        $_SESSION['erreurInformation'] = "Pseudonyme non disponible";
        header('Location: inscription-information');
    }
    else if (empty($_POST['motdepasse']) || $_POST['motdepasse'] != $_POST['motedepasse2']) {
        $_SESSION['erreurInformation'] = "Vos mots de passe doivent être identiques";
        header('Location: inscription-information');
    } else if (empty($image)) {
        $_SESSION['erreurInformation'] = "Veuillez choisir votre avatar";
        header('Location: inscription-information');
    }
    else {
        $filtreMembre = array(
            'pseudonyme' => FILTER_SANITIZE_SPECIAL_CHARS,
            'motdepasse' => FILTER_SANITIZE_ENCODED,
        );
    
        $informations  = filter_input_array(INPUT_POST, $filtreMembre);
    
        $_SESSION['membre']['pseudonyme'] = $informations ['pseudonyme'];
        $_SESSION['membre']['motdepasse'] = password_hash($_POST['motdepasse'], PASSWORD_DEFAULT);
        $_SESSION['membre']['avatar'] = $image;
    
        $reussiteInscription = MembreDAO::enregistrerMembre($_SESSION['membre']);
    
        if($reussiteInscription) {
            header('Location: ../membre.php');
        }
    }
}